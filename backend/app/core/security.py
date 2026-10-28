"""
Passwords, opaque tokens and CSRF (ADR-005).

* New hashes are argon2id (pwdlib defaults). Legacy Streamlit hashes are
  PBKDF2-HMAC-SHA256, 260,000 rounds, over salt.encode() with a 32-hex-char salt,
  stored as hex; they are verified in constant time and upgraded on sign-in.
* Session, invite, reset and verify tokens are 256-bit random strings; only their
  SHA-256 is stored, so a database leak doesn't hand out live links or sessions.
* CSRF is a signed double-submit token: the `el_csrf` cookie and the X-CSRF-Token
  header must match, and the value must carry a valid HMAC (a cookie planted from
  another subdomain can't forge one).
"""

import hashlib
import hmac
import secrets
from functools import cache
from pathlib import Path

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()

LEGACY_ROUNDS = 260_000
MIN_PASSWORD, MAX_PASSWORD = 10, 128
_COMMON = Path(__file__).with_name("common_passwords.txt")


# ── passwords ────────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, argon2_hash: str) -> bool:
    try:
        return _hasher.verify(password, argon2_hash)
    except Exception:  # malformed hash: never let it become a 500 or a pass
        return False


def legacy_hash(password: str, salt: str | None = None) -> tuple[str, str]:
    """The Streamlit app's scheme (utility/auth.py::_hash_password): (hex digest, salt)."""
    salt = salt or secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), LEGACY_ROUNDS)
    return key.hex(), salt


def verify_legacy(password: str, digest: str, salt: str) -> bool:
    computed, _ = legacy_hash(password, salt)
    return hmac.compare_digest(computed, digest)


@cache
def _common_passwords() -> frozenset[str]:
    lines = _COMMON.read_text(encoding="utf-8").splitlines()
    return frozenset(w for w in lines if w and not w.startswith("#"))


def password_problem(password: str, *personal: str) -> str | None:
    """Why a new password is unacceptable, in words a user can act on; None if fine."""
    if len(password) < MIN_PASSWORD:
        return f"Use at least {MIN_PASSWORD} characters."
    if len(password) > MAX_PASSWORD:
        return f"Use at most {MAX_PASSWORD} characters."
    lowered = password.lower()
    if lowered in _common_passwords() or len(set(lowered)) < 4:
        return "That password is too common. Try a short phrase of unrelated words."
    squashed = "".join(ch for ch in lowered if ch.isalnum())
    for value in personal:
        local = value.lower().split("@")[0]
        words = [w for w in "".join(ch if ch.isalnum() else " " for ch in local).split() if len(w) >= 4]
        whole = "".join(ch for ch in local if ch.isalnum())  # "Ada Obi" → "adaobi"
        if any(w in squashed for w in [*words, *([whole] if len(whole) >= 5 else [])]):
            return "Don't include your name or email in your password."
    return None


# ── opaque tokens ────────────────────────────────────────────────────────────


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── CSRF ─────────────────────────────────────────────────────────────────────


def _csrf_sig(secret: str, nonce: str) -> str:
    return hmac.new(secret.encode(), nonce.encode(), hashlib.sha256).hexdigest()[:32]


def new_csrf_token(secret: str) -> str:
    nonce = secrets.token_urlsafe(18)
    return f"{nonce}.{_csrf_sig(secret, nonce)}"


def valid_csrf(secret: str, cookie: str | None, header: str | None) -> bool:
    if not cookie or not header or not hmac.compare_digest(cookie, header):
        return False
    nonce, _, sig = cookie.partition(".")
    return bool(nonce) and hmac.compare_digest(sig, _csrf_sig(secret, nonce))
