"""`sessions` and `email_tokens`: only SHA-256 hashes of the tokens are stored."""

from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database

Purpose = Literal["reset", "verify"]


class SessionsRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["sessions"]

    def ensure_indexes(self) -> None:
        self.col.create_index("token_hash", unique=True, name="token_hash_unique")
        self.col.create_index("user_id", name="user_id")
        self.col.create_index("expires_at", expireAfterSeconds=0, name="ttl")

    def create(self, doc: dict[str, Any]) -> None:
        self.col.insert_one(doc)

    def get(self, token_hash: str) -> dict[str, Any] | None:
        return self.col.find_one({"token_hash": token_hash})

    def extend(self, token_hash: str, expires_at: datetime, seen_at: datetime) -> None:
        self.col.update_one({"token_hash": token_hash}, {"$set": {"expires_at": expires_at, "last_seen_at": seen_at}})

    def delete(self, token_hash: str) -> None:
        self.col.delete_one({"token_hash": token_hash})

    def delete_for_user(self, user_id: ObjectId, keep_hash: str | None = None) -> int:
        q: dict[str, Any] = {"user_id": user_id}
        if keep_hash:
            q["token_hash"] = {"$ne": keep_hash}
        return self.col.delete_many(q).deleted_count


class EmailTokensRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["email_tokens"]

    def ensure_indexes(self) -> None:
        self.col.create_index("token_hash", unique=True, name="token_hash_unique")
        self.col.create_index([("user_id", 1), ("purpose", 1)], name="user_purpose")
        self.col.create_index("expires_at", expireAfterSeconds=0, name="ttl")

    def create(self, doc: dict[str, Any]) -> None:
        self.col.insert_one(doc)

    def consume(self, token_hash: str, purpose: Purpose, now: datetime) -> dict[str, Any] | None:
        """Atomically mark an unused, unexpired token used; None if it isn't one."""
        return self.col.find_one_and_update(
            {"token_hash": token_hash, "purpose": purpose, "used_at": None, "expires_at": {"$gt": now}},
            {"$set": {"used_at": now}},
            return_document=ReturnDocument.AFTER,
        )

    def peek(self, token_hash: str, purpose: Purpose) -> dict[str, Any] | None:
        return self.col.find_one({"token_hash": token_hash, "purpose": purpose})

    def invalidate(self, user_id: ObjectId, purpose: Purpose, now: datetime) -> None:
        self.col.update_many({"user_id": user_id, "purpose": purpose, "used_at": None}, {"$set": {"used_at": now}})

    def delete_for_user(self, user_id: ObjectId) -> None:
        self.col.delete_many({"user_id": user_id})
