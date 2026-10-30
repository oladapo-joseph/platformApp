"""
`audit_log`, append-only (D-14, US-7.7).

The app only inserts and reads: no update and no delete, not even when a user
deletes their account, whose events keep their email (D-18). Retention is a
365-day TTL.
"""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.database import Database

RETENTION_SECONDS = 365 * 24 * 3600


class AuditRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["audit_log"]

    def ensure_indexes(self) -> None:
        self.col.create_index("at", expireAfterSeconds=RETENTION_SECONDS, name="ttl_at")
        self.col.create_index([("actor.id", 1), ("at", -1)], name="actor_at")
        self.col.create_index([("target.id", 1), ("at", -1)], name="target_at")
        self.col.create_index([("category", 1), ("at", -1)], name="category_at")
        self.col.create_index([("action", 1), ("target.label", 1), ("at", -1)], name="action_target_at")

    def insert(self, event: dict[str, Any]) -> None:
        self.col.insert_one(event)

    def count(self, action: str, target_label: str, since: datetime) -> int:
        return self.col.count_documents({"action": action, "target.label": target_label, "at": {"$gte": since}})

    def search(
        self, match: dict[str, Any], limit: int, after: tuple[datetime, ObjectId] | None = None
    ) -> list[dict[str, Any]]:
        """Newest first, `limit` at most, after the cursor position."""
        if after is not None:
            at, oid = after
            page = {"$or": [{"at": {"$lt": at}}, {"at": at, "_id": {"$lt": oid}}]}
            match = {"$and": [match, page]} if match else page
        return list(self.col.find(match).sort([("at", -1), ("_id", -1)]).limit(limit))

    def count_flagged(self, since: datetime) -> int:
        return self.col.count_documents({"flags": "suspicious", "at": {"$gte": since}})
