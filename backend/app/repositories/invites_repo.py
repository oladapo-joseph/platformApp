"""`invites` and `access_requests` (ADR-013: invite-only, every invite approved by an admin)."""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError


class InvitesRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["invites"]

    def ensure_indexes(self) -> None:
        self.col.create_index("token_hash", unique=True, name="token_hash_unique")
        self.col.create_index([("email", 1), ("status", 1)], name="email_status")
        self.col.create_index([("status", 1), ("created_at", -1)], name="status_created")

    def create(self, doc: dict[str, Any]) -> ObjectId:
        return self.col.insert_one(doc).inserted_id

    def by_token_hash(self, token_hash: str) -> dict[str, Any] | None:
        return self.col.find_one({"token_hash": token_hash})

    def by_id(self, invite_id: ObjectId) -> dict[str, Any] | None:
        return self.col.find_one({"_id": invite_id})

    def pending_for(self, email: str, now: datetime) -> dict[str, Any] | None:
        return self.col.find_one({"email": email, "status": "pending", "expires_at": {"$gt": now}})

    def update(self, invite_id: ObjectId, fields: dict[str, Any], inc: dict[str, int] | None = None) -> dict | None:
        op: dict[str, Any] = {"$set": fields}
        if inc:
            op["$inc"] = inc
        return self.col.find_one_and_update({"_id": invite_id}, op, return_document=ReturnDocument.AFTER)

    def claim(self, token_hash: str, now: datetime, accepted_by: ObjectId) -> dict[str, Any] | None:
        """Atomically pending → accepted, so one link can't create two accounts."""
        return self.col.find_one_and_update(
            {"token_hash": token_hash, "status": "pending", "expires_at": {"$gt": now}},
            {"$set": {"status": "accepted", "accepted_at": now, "accepted_user_id": accepted_by}},
            return_document=ReturnDocument.AFTER,
        )

    def supersede_pending(self, email: str, now: datetime) -> None:
        """Older pending invites to the same email stop working once a new one is sent."""
        self.col.update_many({"email": email, "status": "pending"}, {"$set": {"status": "revoked", "revoked_at": now}})

    def list(self, status: str | None, limit: int, skip: int, now: datetime) -> tuple[list[dict[str, Any]], int]:
        q: dict[str, Any] = {}
        if status == "expired":
            q = {"status": "pending", "expires_at": {"$lte": now}}
        elif status == "pending":
            q = {"status": "pending", "expires_at": {"$gt": now}}
        elif status:
            q = {"status": status}
        docs = list(self.col.find(q).sort([("created_at", -1), ("_id", -1)]).skip(skip).limit(limit))
        return docs, self.col.count_documents(q)


class AccessRequestsRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["access_requests"]

    def ensure_indexes(self) -> None:
        # one open request per email
        self.col.create_index("email", unique=True, name="email_new_unique", partialFilterExpression={"status": "new"})
        self.col.create_index([("status", 1), ("created_at", -1)], name="status_created")

    def create(self, doc: dict[str, Any]) -> bool:
        """False when the email already has an open request."""
        try:
            self.col.insert_one(doc)
            return True
        except DuplicateKeyError:
            return False

    def by_id(self, request_id: ObjectId) -> dict[str, Any] | None:
        return self.col.find_one({"_id": request_id})

    def review(self, request_id: ObjectId, status: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        """new → approved/declined, once (two admins can't both approve)."""
        return self.col.find_one_and_update(
            {"_id": request_id, "status": "new"},
            {"$set": {"status": status, **fields}},
            return_document=ReturnDocument.AFTER,
        )

    def close_for_email(self, email: str, fields: dict[str, Any]) -> None:
        self.col.update_many({"email": email, "status": "new"}, {"$set": {"status": "approved", **fields}})

    def list(self, status: str | None, limit: int, skip: int) -> tuple[list[dict[str, Any]], int]:
        q = {"status": status} if status else {}
        docs = list(self.col.find(q).sort([("created_at", -1), ("_id", -1)]).skip(skip).limit(limit))
        return docs, self.col.count_documents(q)

    def count_new(self) -> int:
        return self.col.count_documents({"status": "new"})
