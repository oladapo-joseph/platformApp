# utility/auth.py — user management and authentication backed by MongoDB

import os
import hashlib
import secrets
from datetime import datetime
from pymongo import MongoClient, errors
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

MONGODB_URI = os.getenv("MONGODB_URI", "").strip().strip('"')
MONGODB_DB = os.getenv("MONGODB_DB", "ngx")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

_client = None


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI)
    return _client


def _users_collection():
    return _get_client()[MONGODB_DB]["app_users"]


def _hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return key.hex(), salt


def init_users_collection():
    """Create users collection and seed admin account if it doesn't exist."""
    col = _users_collection()
    col.create_index("username", unique=True)

    admin_user = ADMIN_USERNAME
    admin_pass = ADMIN_PASSWORD

    existing = col.find_one({"username": admin_user})
    if not existing:
        pwd_hash, salt = _hash_password(admin_pass)
        col.insert_one({
            "username": admin_user,
            "password_hash": pwd_hash,
            "salt": salt,
            "role": "admin",
            "is_active": True,
            "created_at": datetime.utcnow(),
        })


def verify_user(username: str, password: str) -> dict | None:
    """
    Returns {"username": ..., "role": ...} on success, None on failure.
    Returns None if the account is inactive.
    """
    row = _users_collection().find_one({"username": username})
    if not row or not row.get("is_active", True):
        return None

    computed, _ = _hash_password(password, row["salt"])
    if computed == row["password_hash"]:
        return {"username": username, "role": row.get("role", "user")}
    return None


def create_user(username: str, password: str, role: str = "user") -> bool:
    """Returns False if username already exists."""
    collection = _users_collection()
    pwd_hash, salt = _hash_password(password)
    try:
        collection.insert_one({
            "username": username,
            "password_hash": pwd_hash,
            "salt": salt,
            "role": role,
            "is_active": True,
            "created_at": datetime.utcnow(),
        })
        return True
    except errors.DuplicateKeyError:
        return False


def list_users() -> list[dict]:
    rows = _users_collection().find(
        {},
        {"username": 1, "role": 1, "is_active": 1, "created_at": 1, "_id": 0},
    ).sort("created_at", -1)
    return [
        {
            "username": r["username"],
            "role": r.get("role", "user"),
            "is_active": bool(r.get("is_active", True)),
            "created_at": r.get("created_at"),
        }
        for r in rows
    ]


def set_user_active(username: str, active: bool):
    _users_collection().update_one(
        {"username": username},
        {"$set": {"is_active": bool(active)}},
    )
