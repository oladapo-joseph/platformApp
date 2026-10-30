"""`app_events`: pseudonymous usage analytics (US-7.8). No IP, no user agent; kept 90 days."""

from datetime import datetime
from typing import Any

from pymongo.database import Database

RETENTION_SECONDS = 90 * 24 * 3600


class EventsRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["app_events"]

    def ensure_indexes(self) -> None:
        self.col.create_index("at", expireAfterSeconds=RETENTION_SECONDS, name="ttl_at")
        self.col.create_index([("user", 1), ("at", 1)], name="user_at")

    def insert_many(self, docs: list[dict[str, Any]]) -> None:
        if docs:
            self.col.insert_many(docs, ordered=False)

    def delete_for_user(self, user: str) -> None:
        self.col.delete_many({"user": user})

    def aggregate(self, since: datetime, stages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Grouping pipelines only: every one starts by matching the window and groups before any sort (M0)."""
        return list(self.col.aggregate([{"$match": {"at": {"$gte": since}}}, *stages]))
