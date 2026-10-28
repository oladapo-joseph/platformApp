"""
Invite-only access (ADR-013, D-13): admins invite people or approve their requests;
nothing is ever approved automatically. Invite links are single-use, expire after
INVITE_TTL_DAYS, and accepting one proves the email (no separate verification).
"""

import contextlib
from datetime import datetime, timedelta
from typing import Any, Literal

from bson import ObjectId

from app.core import ratelimit, security
from app.core.config import Settings
from app.core.errors import BadRequest, Conflict, NotFound, TooManyRequests
from app.emails import access_declined
from app.emails import invite as invite_mail
from app.repositories import get_repos
from app.repositories.users_repo import EmailTaken, oid
from app.services import audit_service as audit
from app.services.audit_service import RequestMeta
from app.services.auth_service import (
    NewSession,
    check_password,
    normalize_email,
    now,
    password_fields,
    start_session,
)
from app.services.email import sender

MAX_BATCH = 50
Role = Literal["user", "admin"]


def _link(token: str, settings: Settings) -> str:
    # the token rides in the fragment: browsers never send it, so no server, proxy or log sees it (ASVS 14.2.1)
    return f"{settings.public_base_url}/invite#token={token}"


def invite_status(doc: dict[str, Any], at: datetime) -> str:
    if doc["status"] == "pending" and doc["expires_at"] <= at:
        return "expired"
    return str(doc["status"])


def public_invite(doc: dict[str, Any], at: datetime) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name"),
        "role": doc.get("role", "user"),
        "status": invite_status(doc, at),
        "invited_by": (doc.get("invited_by") or {}).get("email"),
        "created_at": doc["created_at"],
        "expires_at": doc["expires_at"],
        "resend_count": doc.get("resend_count", 0),
        "accepted_at": doc.get("accepted_at"),
        "email_failed": bool(doc.get("email_error")),
    }


def _issue(
    admin: dict[str, Any],
    email: str,
    name: str | None,
    role: Role,
    meta: RequestMeta,
    settings: Settings,
    access_request_id: ObjectId | None = None,
) -> dict[str, Any]:
    repos = get_repos()
    at = now()
    token = security.new_token()
    repos.invites.supersede_pending(email, at)
    doc: dict[str, Any] = {
        "email": email,
        "name": name,
        "role": role,
        "status": "pending",
        "token_hash": security.token_hash(token),
        "invited_by": {"id": admin["_id"], "email": admin.get("email") or admin.get("username")},
        "created_at": at,
        "expires_at": at + timedelta(days=settings.invite_ttl_days),
        "resend_count": 0,
        "access_request_id": access_request_id,
    }
    doc["_id"] = repos.invites.create(doc)
    _deliver(doc, token, admin, settings)
    audit.record(
        "invite.sent",
        audit.actor_of(admin),
        meta,
        target=audit.target("invite", doc["_id"], email),
        changes={"role": role, "via": "access_request" if access_request_id else "admin"},
    )
    return {**public_invite(repos.invites.by_id(doc["_id"]) or doc, at), "invite_url": _link(token, settings)}


def _deliver(doc: dict[str, Any], token: str, admin: dict[str, Any], settings: Settings) -> None:
    """Send the email; on failure keep the invite (the admin can copy the link instead)."""
    inviter = admin.get("display_name") or admin.get("email")
    try:
        sender().send(
            invite_mail.build(doc["email"], _link(token, settings), doc.get("name"), inviter, doc["expires_at"])
        )
        get_repos().invites.update(doc["_id"], {"email_error": None})
    except Exception as exc:
        get_repos().invites.update(doc["_id"], {"email_error": str(exc)[:200]})


# ── admin: invites ───────────────────────────────────────────────────────────


def create_invites(
    admin: dict[str, Any], entries: list[dict[str, Any]], meta: RequestMeta, settings: Settings
) -> dict[str, Any]:
    if not entries:
        raise BadRequest("Add at least one email.", "no-invites")
    if len(entries) > MAX_BATCH:
        raise BadRequest(f"Invite up to {MAX_BATCH} people at a time.", "too-many-invites")
    repos = get_repos()
    sent, skipped, seen = [], [], set()
    for entry in entries:
        raw = str(entry.get("email") or "").strip()
        try:
            email = normalize_email(raw)
        except BadRequest:
            skipped.append({"email": raw, "reason": "invalid_email"})
            continue
        if email in seen:
            skipped.append({"email": email, "reason": "duplicate"})
            continue
        seen.add(email)
        if repos.users.by_email(email) or repos.users.by_identifier(email):
            skipped.append({"email": email, "reason": "already_member"})
            continue
        name = " ".join(str(entry.get("name") or "").split())[:60] or None
        sent.append(_issue(admin, email, name, entry.get("role") or "user", meta, settings))
    return {"sent": sent, "skipped": skipped}


def list_invites(status: str | None, limit: int, skip: int) -> dict[str, Any]:
    at = now()
    docs, total = get_repos().invites.list(status, limit, skip, at)
    return {"items": [public_invite(d, at) for d in docs], "total": total}


def _invite_or_404(invite_id: str) -> dict[str, Any]:
    key = oid(invite_id)
    doc = get_repos().invites.by_id(key) if key else None
    if doc is None:
        raise NotFound("No such invite.", "unknown-invite")
    return doc


def resend_invite(admin: dict[str, Any], invite_id: str, meta: RequestMeta, settings: Settings) -> dict[str, Any]:
    doc = _invite_or_404(invite_id)
    if doc["status"] == "accepted":
        raise Conflict("This invite was already accepted.", "invite-accepted")
    if get_repos().users.by_email(doc["email"]):
        raise Conflict("That email already has an account.", "already-member")
    repos, at = get_repos(), now()
    token = security.new_token()  # new link; the old one stops working
    updated = repos.invites.update(
        doc["_id"],
        {
            "status": "pending",
            "token_hash": security.token_hash(token),
            "expires_at": at + timedelta(days=settings.invite_ttl_days),
            "resent_at": at,
        },
        inc={"resend_count": 1},
    )
    assert updated is not None
    _deliver(updated, token, admin, settings)
    audit.record("invite.resent", audit.actor_of(admin), meta, target=audit.target("invite", doc["_id"], doc["email"]))
    return {**public_invite(repos.invites.by_id(doc["_id"]) or updated, at), "invite_url": _link(token, settings)}


def revoke_invite(admin: dict[str, Any], invite_id: str, meta: RequestMeta) -> dict[str, Any]:
    doc = _invite_or_404(invite_id)
    if doc["status"] == "accepted":
        raise Conflict("This invite was already accepted; deactivate the user instead.", "invite-accepted")
    at = now()
    updated = get_repos().invites.update(doc["_id"], {"status": "revoked", "revoked_at": at})
    audit.record("invite.revoked", audit.actor_of(admin), meta, target=audit.target("invite", doc["_id"], doc["email"]))
    return public_invite(updated or doc, at)


# ── public: open and accept an invite ────────────────────────────────────────


def lookup(token: str, meta: RequestMeta) -> dict[str, Any]:
    """What the invite page should show. Revoked and unknown links look the same (US-1.4)."""
    wait = ratelimit.invite_lookups.hit(meta.ip or "?")
    if wait:
        raise TooManyRequests("Please try again later.", wait)
    repos, at = get_repos(), now()
    doc = repos.invites.by_token_hash(security.token_hash(token))
    if doc is None or doc["status"] == "revoked":
        return {"status": "invalid", "email": None, "name": None}
    status = invite_status(doc, at)
    if status == "expired" and doc["status"] == "pending":
        repos.invites.update(doc["_id"], {"status": "expired"})
        audit.record(
            "invite.expired", audit.SYSTEM_ACTOR, meta, target=audit.target("invite", doc["_id"], doc["email"])
        )
    if status == "accepted":
        return {"status": "used", "email": None, "name": None}
    return {"status": "valid" if status == "pending" else status, "email": doc["email"], "name": doc.get("name")}


def accept(
    token: str, display_name: str, password: str, meta: RequestMeta, settings: Settings
) -> tuple[dict[str, Any], NewSession]:
    repos, at = get_repos(), now()
    h = security.token_hash(token)
    doc = repos.invites.by_token_hash(h)
    if doc is None or invite_status(doc, at) != "pending":
        raise BadRequest("This invite link isn't valid any more.", "invalid-invite")
    name = " ".join(display_name.split())
    if not 1 <= len(name) <= 60:
        raise BadRequest("Use 1–60 characters for your name.", "invalid-name", field="display_name")
    check_password(password, doc["email"], name)
    if repos.users.by_email(doc["email"]) or repos.users.by_identifier(doc["email"]):
        raise Conflict("That email already has an account. Sign in instead.", "already-member")

    user_id = ObjectId()
    claimed = repos.invites.claim(h, at, user_id)  # atomic: one link, one account
    if claimed is None:
        raise BadRequest("This invite link isn't valid any more.", "invalid-invite")
    user = {
        "_id": user_id,
        "email": doc["email"],
        "email_verified_at": at,
        "username": doc["email"],  # the Streamlit app's unique username index (D-17)
        "display_name": name,
        "role": doc.get("role", "user"),
        "is_active": True,
        "created_at": at,
        "source": "invite",
        "invite_id": doc["_id"],
        **password_fields(password, settings),
    }
    try:
        repos.users.create(user)
    except EmailTaken:
        repos.invites.update(doc["_id"], {"status": "pending", "accepted_at": None, "accepted_user_id": None})
        raise Conflict("That email already has an account. Sign in instead.", "already-member") from None
    repos.access_requests.close_for_email(doc["email"], {"reviewed_at": at, "closed_by": "invite_accepted"})
    session = start_session(user, True, meta, settings)
    audit.record("invite.accepted", audit.actor_of(user), meta, target=audit.target("invite", doc["_id"], doc["email"]))
    return user, session


# ── access requests (public form + admin queue) ──────────────────────────────


def submit_request(raw_email: str, name: str, note: str | None, meta: RequestMeta) -> None:
    """Always the same response: never reveals accounts or earlier requests (US-1.2)."""
    wait = ratelimit.access_requests.hit(meta.ip or "?")
    if wait:
        raise TooManyRequests("Please try again later.", wait)
    email = normalize_email(raw_email)
    clean_name = " ".join(name.split())[:60]
    if not clean_name:
        raise BadRequest("Tell us your name.", "invalid-name", field="name")
    repos = get_repos()
    if repos.users.by_email(email) or repos.users.by_identifier(email):
        return
    doc: dict[str, Any] = {
        "_id": ObjectId(),
        "email": email,
        "name": clean_name,
        "note": (note or "").strip()[:200] or None,
        "status": "new",
        "created_at": now(),
        "ip": meta.ip,
    }
    if repos.access_requests.create(doc):
        audit.record(
            "access_request.submitted",
            audit.actor_of(None),
            meta,
            target=audit.target("access_request", doc["_id"], email),
        )


def public_request(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name"),
        "note": doc.get("note"),
        "status": doc["status"],
        "created_at": doc["created_at"],
        "reviewed_at": doc.get("reviewed_at"),
        "reviewed_by": (doc.get("reviewed_by") or {}).get("email"),
    }


def list_requests(status: str | None, limit: int, skip: int) -> dict[str, Any]:
    repos = get_repos()
    docs, total = repos.access_requests.list(status, limit, skip)
    return {"items": [public_request(d) for d in docs], "total": total, "new_count": repos.access_requests.count_new()}


def _review(admin: dict[str, Any], request_id: str, status: str) -> dict[str, Any]:
    key = oid(request_id)
    repos = get_repos()
    if key is None or repos.access_requests.by_id(key) is None:
        raise NotFound("No such access request.", "unknown-request")
    doc = repos.access_requests.review(
        key,
        status,
        {
            "reviewed_at": now(),
            "reviewed_by": {"id": admin["_id"], "email": admin.get("email") or admin.get("username")},
        },
    )
    if doc is None:
        raise Conflict("This request was already reviewed.", "already-reviewed")
    return doc


def approve_request(
    admin: dict[str, Any], request_id: str, role: Role, meta: RequestMeta, settings: Settings
) -> dict[str, Any]:
    doc = _review(admin, request_id, "approved")
    audit.record(
        "access_request.approved",
        audit.actor_of(admin),
        meta,
        target=audit.target("access_request", doc["_id"], doc["email"]),
        changes={"role": role},
    )
    if get_repos().users.by_email(doc["email"]):
        return {"request": public_request(doc), "invite": None}
    invite = _issue(admin, doc["email"], doc.get("name"), role, meta, settings, access_request_id=doc["_id"])
    return {"request": public_request(doc), "invite": invite}


def decline_request(admin: dict[str, Any], request_id: str, notify: bool, meta: RequestMeta) -> dict[str, Any]:
    doc = _review(admin, request_id, "declined")
    if notify:
        with contextlib.suppress(Exception):  # declining must not fail because the courtesy email did
            sender().send(access_declined.build(doc["email"], doc.get("name")))
    audit.record(
        "access_request.declined",
        audit.actor_of(admin),
        meta,
        target=audit.target("access_request", doc["_id"], doc["email"]),
        changes={"notified": notify},
    )
    return public_request(doc)


# ── admin: users (US-7.4) ────────────────────────────────────────────────────


def admin_user(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "username": doc.get("username"),
        "display_name": doc.get("display_name"),
        "role": doc.get("role", "user"),
        "is_active": doc.get("is_active", True) is not False,
        "created_at": doc.get("created_at"),
        "last_login_at": doc.get("last_login_at"),
        "legacy": not doc.get("email_verified_at"),
    }


def list_users(q: str | None, limit: int, skip: int) -> dict[str, Any]:
    docs, total = get_repos().users.search(q, limit, skip)
    return {"items": [admin_user(d) for d in docs], "total": total}


def update_user(
    admin: dict[str, Any], user_id: str, meta: RequestMeta, *, role: Role | None = None, is_active: bool | None = None
) -> dict[str, Any]:
    repos = get_repos()
    key = oid(user_id)
    user = repos.users.by_id(key) if key else None
    if user is None:
        raise NotFound("No such user.", "unknown-user")
    was_admin_active = user.get("role") == "admin" and user.get("is_active") is not False
    if user["_id"] == admin["_id"] and (is_active is False or role == "user"):
        raise Conflict("You can't deactivate or demote yourself.", "self-change")
    losing_admin = was_admin_active and (role == "user" or is_active is False)
    if losing_admin and repos.users.active_admins() <= 1:
        raise Conflict("This is the last active admin.", "last-admin")

    label = user.get("email") or user.get("username")
    fields: dict[str, Any] = {}
    if role is not None and role != user.get("role", "user"):
        fields["role"] = role
        audit.record(
            "admin.role_changed",
            audit.actor_of(admin),
            meta,
            target=audit.target("user", user["_id"], label),
            changes={"before": user.get("role", "user"), "after": role},
        )
    if is_active is not None and is_active != (user.get("is_active") is not False):
        fields["is_active"] = is_active
        fields["deactivated_at" if not is_active else "reactivated_at"] = now()
        if not is_active:
            repos.sessions.delete_for_user(user["_id"])  # signed out everywhere, immediately
        audit.record(
            "admin.user_deactivated" if not is_active else "admin.user_reactivated",
            audit.actor_of(admin),
            meta,
            target=audit.target("user", user["_id"], label),
        )
    if fields:
        user = repos.users.update(user["_id"], fields) or user
    return admin_user(user)
