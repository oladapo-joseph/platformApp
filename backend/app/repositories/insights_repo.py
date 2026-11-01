"""
AI readings: the shared cache (`ai_insights`), each person's daily allowance (`ai_quota`) and
the request log behind admin AI usage (`ai_usage`, US-7.5).
"""

from contextlib import suppress
from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

CACHE_SECONDS = 7 * 24 * 3600
USAGE_SECONDS = 90 * 24 * 3600


class InsightsRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["ai_insights"]

    def ensure_indexes(self) -> None:
        self.col.create_index("cache_key", unique=True, name="cache_key")
        self.col.create_index("created_at", expireAfterSeconds=CACHE_SECONDS, name="ttl_created_at")

    def get(self, cache_key: str) -> dict[str, Any] | None:
        return self.col.find_one({"cache_key": cache_key})

    def put(self, doc: dict[str, Any]) -> None:
        with suppress(DuplicateKeyError):  # another worker stored the same reading first; theirs stands
            self.col.insert_one(doc)


class AiQuotaRepo:
    """One counter per person per WAT day; it expires the day after."""

    def __init__(self, db: Database) -> None:
        self.col = db["ai_quota"]

    def ensure_indexes(self) -> None:
        self.col.create_index("expires_at", expireAfterSeconds=0, name="ttl_expires_at")
        self.col.create_index("user_id", name="user_id")

    def used(self, user_id: ObjectId, day: str) -> int:
        doc = self.col.find_one({"_id": f"{user_id}:{day}"}, {"used": 1})
        return int(doc["used"]) if doc else 0

    def reserve(self, user_id: ObjectId, day: str, limit: int, expires_at: datetime) -> int | None:
        """Takes one reading from today's allowance, atomically; None when it's used up."""
        if limit <= 0:
            return None
        try:
            doc = self.col.find_one_and_update(
                {"_id": f"{user_id}:{day}", "used": {"$lt": limit}},
                {"$inc": {"used": 1}, "$setOnInsert": {"user_id": user_id, "day": day, "expires_at": expires_at}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:  # the day's counter exists and is at the limit
            return None
        return int(doc["used"]) if doc else None

    def refund(self, user_id: ObjectId, day: str) -> None:
        """A reading that failed doesn't count (US-4.5)."""
        self.col.update_one({"_id": f"{user_id}:{day}", "used": {"$gt": 0}}, {"$inc": {"used": -1}})

    def delete_for_user(self, user_id: ObjectId) -> None:
        self.col.delete_many({"user_id": user_id})


class AiUsageRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["ai_usage"]

    def ensure_indexes(self) -> None:
        self.col.create_index("at", expireAfterSeconds=USAGE_SECONDS, name="ttl_at")
        self.col.create_index([("user_id", 1), ("at", 1)], name="user_at")

    def insert(self, doc: dict[str, Any]) -> None:
        self.col.insert_one(doc)

    def delete_for_user(self, user_id: ObjectId) -> None:
        self.col.delete_many({"user_id": user_id})

    def aggregate(self, since: datetime, stages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Grouping pipelines only: each starts by matching the window and groups before any sort (M0)."""
        return list(self.col.aggregate([{"$match": {"at": {"$gte": since}}}, *stages]))
