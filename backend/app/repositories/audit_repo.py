"""
`audit_log`, append-only (D-14, US-7.7).

The app only inserts and reads: no update and no delete, not even when a user
deletes their account, whose events keep their email (D-18). Retention is a
365-day TTL.
"""

from datetime import datetime
from typing import Any

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
