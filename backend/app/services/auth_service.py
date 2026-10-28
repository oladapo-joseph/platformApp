"""
Sign-in, sessions, passwords and the signed-in user's own account (ADR-004, ADR-005).

Sessions are opaque 256-bit tokens in an HttpOnly cookie; the database holds only
their SHA-256. "Keep me signed in" gives 30 days, sliding (the expiry moves at most
once a day); otherwise a browser-session cookie backed by a 12-hour server expiry.
Deactivation and password changes revoke sessions immediately.

Legacy Streamlit users (username + PBKDF2) sign in as before; their password is
re-hashed with argon2id into `password_argon2` while the PBKDF2 fields are kept
for the Streamlit app until cutover (D-17).
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from email_validator import EmailNotValidError, validate_email

from app.core import ratelimit, security
from app.core.config import Settings
from app.core.errors import BadRequest, Conflict, Forbidden, TooManyRequests, Unauthorized
from app.db.mongo import WAT
from app.emails import OutgoingEmail, email_changed, password_changed, password_reset
from app.emails import verify_email as verify_mail
from app.repositories import get_repos
from app.repositories.users_repo import EmailTaken
from app.services import audit_service as audit
from app.services.audit_service import RequestMeta
from app.services.email import sender

log = logging.getLogger(__name__)

BAD_CREDENTIALS = "Email or password is incorrect."
_DUMMY_HASH = security.hash_password("timing-equaliser-not-a-real-password")


def now() -> datetime:
    return datetime.now(WAT)


def normalize_email(raw: str) -> str:
    """Lower-cased, syntax-checked address (no DNS lookups: those block and can leak timing)."""
    try:
        return validate_email(raw.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise BadRequest("Enter a valid email address.", "invalid-email", field="email") from exc


def check_password(password: str, *personal: str | None) -> None:
    problem = security.password_problem(password, *(p for p in personal if p))
    if problem:
        raise BadRequest(problem, "weak-password", field="password")


def password_fields(password: str, settings: Settings) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "password_argon2": security.hash_password(password),
        "hash_scheme": "argon2id",
        "password_changed_at": now(),
    }
    if settings.legacy_password_sync:
        fields["password_hash"], fields["salt"] = security.legacy_hash(password)
    return fields


def notify(email: OutgoingEmail) -> None:
    """Security notices are best-effort: a mail outage must not undo a password change."""
    try:
        sender().send(email)
    except Exception:
        log.exception("notice email failed (%s)", email.tag)


def _password_changed_notice(user: dict[str, Any], settings: Settings) -> None:
    if user.get("email") and user.get("email_verified_at"):
        notify(
            password_changed.build(user["email"], user.get("display_name"), now(), f"{settings.public_base_url}/forgot")
        )


def password_matches(user: dict[str, Any], password: str) -> bool:
    if user.get("password_argon2"):
        return security.verify_password(password, user["password_argon2"])
    if user.get("password_hash") and user.get("salt"):
        return security.verify_legacy(password, user["password_hash"], user["salt"])
    return False


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "email": user.get("email"),
        "email_verified": bool(user.get("email_verified_at")),
        "pending_email": user.get("pending_email"),
        "username": user.get("username"),
        "display_name": user.get("display_name") or user.get("username") or user.get("email"),
        "role": user.get("role", "user"),
        "needs_email": not user.get("email_verified_at"),
        "theme": user.get("theme") if user.get("theme") in ("light", "dark") else "system",
        "created_at": user.get("created_at"),
        "last_login_at": user.get("last_login_at"),
    }


# ── sessions ─────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class NewSession:
    token: str
    max_age: int | None  # None → browser-session cookie


def start_session(user: dict[str, Any], remember: bool, meta: RequestMeta, settings: Settings) -> NewSession:
    token, at = security.new_token(), now()
    life = timedelta(days=settings.session_days) if remember else timedelta(hours=settings.session_hours_short)
    get_repos().sessions.create(
        {
            "token_hash": security.token_hash(token),
            "user_id": user["_id"],
            "created_at": at,
            "last_seen_at": at,
            "expires_at": at + life,
            "remember": remember,
            "ip": meta.ip,
            "user_agent": (meta.user_agent or "")[:300],
        }
    )
    return NewSession(token, int(life.total_seconds()) if remember else None)


def resolve_session(token: str, settings: Settings) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """(user, session) for a live session of an active user; revokes it otherwise."""
    repos = get_repos()
    h = security.token_hash(token)
    session = repos.sessions.get(h)
    at = now()
    if session is None:
        return None
    if session["expires_at"] <= at:
        repos.sessions.delete(h)
        return None
    user = repos.users.by_id(session["user_id"])
    if user is None or user.get("is_active") is False:
        repos.sessions.delete(h)
        return None
    if session.get("remember"):
        full = at + timedelta(days=settings.session_days)
        if full - session["expires_at"] > timedelta(days=1):  # slide, writing at most once a day
            repos.sessions.extend(h, full, at)
    return user, session


def end_session_token(token: str) -> None:
    """Revoke a session by its raw token (the cookie a browser had before signing in again)."""
    get_repos().sessions.delete(security.token_hash(token))


def logout(session: dict[str, Any], user: dict[str, Any], meta: RequestMeta) -> None:
    get_repos().sessions.delete(session["token_hash"])
    audit.record("auth.logout", audit.actor_of(user), meta, target=audit.target("user", user["_id"], _label(user)))


def logout_all(user: dict[str, Any], meta: RequestMeta) -> None:
    n = get_repos().sessions.delete_for_user(user["_id"])
    audit.record(
        "auth.logout_all",
        audit.actor_of(user),
        meta,
        target=audit.target("user", user["_id"], _label(user)),
        changes={"sessions_revoked": n},
    )


def _label(user: dict[str, Any]) -> str | None:
    return user.get("email") or user.get("username")


# ── sign in ──────────────────────────────────────────────────────────────────


def login(identifier: str, password: str, meta: RequestMeta, settings: Settings) -> dict[str, Any]:
    repos = get_repos()
    ident = identifier.strip()
    key, ip = f"{ident.lower()}|{meta.ip}", meta.ip or "?"
    wait = ratelimit.login_guard.locked_for(key) or ratelimit.login_ip_failures.blocked(ip)
    if wait:
        audit.record(
            "auth.login_locked",
            audit.actor_of(None),
            meta,
            target=audit.target("user", None, ident.lower()),
            outcome="failure",
        )
        minutes = max(1, (wait + 59) // 60)
        raise TooManyRequests(f"Too many attempts. Try again in {minutes} minute{'s' if minutes > 1 else ''}.", wait)

    user = repos.users.by_identifier(ident)
    if user:
        ok = password_matches(user, password)
    else:
        security.verify_password(password, _DUMMY_HASH)  # same work either way: no user-exists timing signal
        ok = False
    if not user or not ok or user.get("is_active") is False:
        ratelimit.login_guard.failed(key)
        ratelimit.login_ip_failures.hit(ip)
        reason = "unknown" if not user else ("inactive" if ok else "bad_password")
        audit.record(
            "auth.login_failed",
            audit.actor_of(None),
            meta,
            outcome="failure",
            target=audit.target("user", user["_id"] if user else None, ident.lower()),
            changes={"reason": reason},
        )
        raise Unauthorized(BAD_CREDENTIALS, "bad-credentials")
    if user.get("source") == "signup" and not user.get("email_verified_at"):
        raise Forbidden("Confirm your email first: we sent you a link when you signed up.", "email-unverified")

    ratelimit.login_guard.succeeded(key)
    at = now()
    fields: dict[str, Any] = {"last_login_at": at}
    if not user.get("password_argon2"):  # legacy PBKDF2 → argon2id, keeping the legacy fields (D-17)
        fields |= {"password_argon2": security.hash_password(password), "hash_scheme": "argon2id"}
    user = repos.users.update(user["_id"], fields) or user
    audit.record(
        "auth.login",
        audit.actor_of(user),
        meta,
        target=audit.target("user", user["_id"], _label(user)),
        changes={"upgraded_hash": True} if "password_argon2" in fields else None,
    )
    return user


# ── forgotten password ───────────────────────────────────────────────────────


def forgot_password(raw_email: str, meta: RequestMeta, settings: Settings) -> OutgoingEmail | None:
    """Always 'sent' to the caller (no enumeration); emails only verified addresses.

    Returns the email for the caller to send *after* responding: sending inline would
    make known addresses slower than unknown ones, and a mail outage would turn into a
    500 only for real accounts. Either would tell an attacker which emails exist."""
    email = normalize_email(raw_email)
    wait = ratelimit.password_resets.hit(f"{meta.ip}|{email}")
    if wait:
        raise TooManyRequests("Please wait a minute before asking for another link.", wait)
    repos = get_repos()
    user = repos.users.by_email(email)
    if not user or not user.get("email_verified_at") or user.get("is_active") is False:
        audit.record(
            "auth.password_reset_requested",
            audit.actor_of(None),
            meta,
            outcome="failure",
            target=audit.target("user", None, email),
            changes={"reason": "no_account"},
        )
        return None
    token, at = security.new_token(), now()
    repos.email_tokens.invalidate(user["_id"], "reset", at)
    repos.email_tokens.create(
        {
            "token_hash": security.token_hash(token),
            "user_id": user["_id"],
            "purpose": "reset",
            "created_at": at,
            "used_at": None,
            "expires_at": at + timedelta(minutes=settings.reset_ttl_minutes),
        }
    )
    link = f"{settings.public_base_url}/reset#token={token}"  # fragment: never sent to a server or logged
    expires = at + timedelta(minutes=settings.reset_ttl_minutes)
    audit.record(
        "auth.password_reset_requested", audit.actor_of(None), meta, target=audit.target("user", user["_id"], email)
    )
    return password_reset.build(email, link, expires, settings.reset_ttl_minutes)


def reset_password(token: str, password: str, meta: RequestMeta, settings: Settings) -> dict[str, Any]:
    repos = get_repos()
    h = security.token_hash(token)
    pending = repos.email_tokens.peek(h, "reset")
    user = repos.users.by_id(pending["user_id"]) if pending else None
    if user is not None:
        check_password(password, user.get("email"), user.get("display_name"))  # before burning the link
    doc = repos.email_tokens.consume(h, "reset", now())
    if doc is None or user is None or user.get("is_active") is False:
        raise BadRequest("This reset link has expired or was already used. Ask for a new one.", "invalid-token")
    user = repos.users.update(user["_id"], password_fields(password, settings)) or user
    repos.sessions.delete_for_user(user["_id"])
    audit.record(
        "auth.password_reset", audit.actor_of(user), meta, target=audit.target("user", user["_id"], _label(user))
    )
    _password_changed_notice(user, settings)
    return user


# ── the signed-in user's account ─────────────────────────────────────────────


def update_me(
    user: dict[str, Any],
    session: dict[str, Any],
    meta: RequestMeta,
    settings: Settings,
    *,
    display_name: str | None = None,
    email: str | None = None,
    current_password: str | None = None,
    new_password: str | None = None,
    theme: str | None = None,
) -> dict[str, Any]:
    repos = get_repos()
    changes: dict[str, Any] = {}

    # changing the password, or a confirmed email, needs the current password, throttled
    # like sign-in so a borrowed session can't be used to guess it
    sensitive = new_password is not None or (email is not None and user.get("email_verified_at"))
    if sensitive:
        key = f"me|{user['_id']}"
        wait = ratelimit.login_guard.locked_for(key)
        if wait:
            raise TooManyRequests("Too many attempts. Try again in a few minutes.", wait)
        if not current_password or not password_matches(user, current_password):
            ratelimit.login_guard.failed(key)
            raise Forbidden("Your current password is incorrect.", "bad-current-password")
        ratelimit.login_guard.succeeded(key)

    if display_name is not None:
        name = " ".join(display_name.split())
        if not 1 <= len(name) <= 60:
            raise BadRequest("Use 1–60 characters for your name.", "invalid-name", field="display_name")
        user = repos.users.update(user["_id"], {"display_name": name}) or user
        changes["display_name"] = name

    if theme is not None:  # a display preference: not audited
        user = repos.users.update(user["_id"], {"theme": theme}) or user

    if new_password is not None:
        check_password(new_password, user.get("email"), user.get("display_name"), user.get("username"))
        user = repos.users.update(user["_id"], password_fields(new_password, settings)) or user
        repos.sessions.delete_for_user(user["_id"], keep_hash=session["token_hash"])
        audit.record(
            "account.password_changed",
            audit.actor_of(user),
            meta,
            target=audit.target("user", user["_id"], _label(user)),
        )
        _password_changed_notice(user, settings)

    if email is not None:
        address = normalize_email(email)
        if address != user.get("email"):
            _send_verification(user, address, meta, settings)
            user = repos.users.update(user["_id"], {"pending_email": address}) or user

    if changes:
        audit.record(
            "account.updated",
            audit.actor_of(user),
            meta,
            target=audit.target("user", user["_id"], _label(user)),
            changes=changes,
        )
    return user


def _send_verification(user: dict[str, Any], address: str, meta: RequestMeta, settings: Settings) -> None:
    repos = get_repos()
    owner = repos.users.by_email(address)
    if owner and owner["_id"] != user["_id"]:  # someone else has it: say nothing (no enumeration), send nothing
        audit.record(
            "account.email_change_requested",
            audit.actor_of(user),
            meta,
            outcome="failure",
            target=audit.target("user", user["_id"], _label(user)),
            changes={"reason": "email_taken"},
        )
        return
    token, at = security.new_token(), now()
    repos.email_tokens.invalidate(user["_id"], "verify", at)
    repos.email_tokens.create(
        {
            "token_hash": security.token_hash(token),
            "user_id": user["_id"],
            "purpose": "verify",
            "email": address,
            "created_at": at,
            "used_at": None,
            "expires_at": at + timedelta(hours=settings.verify_ttl_hours),
        }
    )
    sender().send(
        verify_mail.build(
            address, f"{settings.public_base_url}/verify#token={token}", at + timedelta(hours=settings.verify_ttl_hours)
        )
    )
    audit.record(
        "account.email_change_requested",
        audit.actor_of(user),
        meta,
        target=audit.target("user", user["_id"], _label(user)),
        changes={"email": address},
    )


def verify_email(token: str, meta: RequestMeta, settings: Settings) -> dict[str, Any]:
    repos = get_repos()
    doc = repos.email_tokens.consume(security.token_hash(token), "verify", now())
    user = repos.users.by_id(doc["user_id"]) if doc else None
    if doc is None or user is None:
        raise BadRequest("This confirmation link has expired or was already used.", "invalid-token")
    previous = user.get("email") if user.get("email_verified_at") else None
    try:
        user = (
            repos.users.update(
                user["_id"], {"email": doc["email"], "email_verified_at": now()}, unset=("pending_email",)
            )
            or user
        )
    except EmailTaken as exc:
        raise Conflict("That email is already used by another account.", "email-taken") from exc
    audit.record(
        "account.email_verified", audit.actor_of(user), meta, target=audit.target("user", user["_id"], doc["email"])
    )
    if previous and previous != doc["email"]:  # tell the old address, in case this wasn't its owner
        notify(email_changed.build(previous, doc["email"], now(), f"{settings.public_base_url}/forgot"))
    return user


def delete_me(user: dict[str, Any], confirm: str, meta: RequestMeta) -> None:
    repos = get_repos()
    expected = {v.lower() for v in (user.get("email"), user.get("username")) if v}
    if confirm.strip().lower() not in expected:
        raise BadRequest("Type your email exactly to confirm.", "confirmation-mismatch", field="confirm")
    if user.get("role") == "admin" and repos.users.active_admins() <= 1:
        raise Conflict("You're the only admin. Make someone else an admin first.", "last-admin")
    # recorded before the user is gone; the audit log keeps the real email (D-18: never rewritten)
    audit.record("account.deleted", audit.actor_of(user), meta, target=audit.target("user", user["_id"], _label(user)))
    repos.sessions.delete_for_user(user["_id"])
    repos.email_tokens.delete_for_user(user["_id"])
    repos.users.delete(user["_id"])


# ── self-serve sign-up (built, off while SIGNUP_MODE=invite; ADR-013) ────────


def signup(raw_email: str, display_name: str, password: str, meta: RequestMeta, settings: Settings) -> None:
    if settings.signup_mode != "open":
        raise Forbidden("EquityLensNG is invite-only for now. Request an invite instead.", "signup-closed")
    wait = ratelimit.signups.hit(meta.ip or "?")
    if wait:
        raise TooManyRequests("Please try again later.", wait)
    email = normalize_email(raw_email)
    check_password(password, email, display_name)
    repos = get_repos()
    if repos.users.by_email(email) or repos.users.by_identifier(email):
        return  # same response as success: no enumeration
    try:
        user_id = repos.users.create(
            {
                "email": email,
                "username": email,
                "display_name": " ".join(display_name.split())[:60],
                "role": "user",
                "is_active": True,
                "created_at": now(),
                "source": "signup",
                "email_verified_at": None,
                **password_fields(password, settings),
            }
        )
    except EmailTaken:
        return
    user = repos.users.by_id(user_id)
    assert user is not None
    _send_verification(user, email, meta, settings)
    audit.record("account.signed_up", audit.actor_of(user), meta, target=audit.target("user", user_id, email))
