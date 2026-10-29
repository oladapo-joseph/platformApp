"""`app_watchlists` (D-19: `watchlists` belongs to the Telegram bot): one document per user."""

from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError


class WatchlistRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["app_watchlists"]

    def ensure_indexes(self) -> None:
        self.col.create_index("user_id", unique=True, name="user_id_unique")

    def symbols(self, user_id: ObjectId) -> list[str]:
        doc = self.col.find_one({"user_id": user_id}, {"symbols": 1})
        return list(doc["symbols"]) if doc else []

    def add(self, user_id: ObjectId, symbol: str, limit: int, now: datetime) -> list[str] | None:
        """Appends `symbol` (a no-op if it's there); None when the list already holds `limit` others."""
        try:
            doc: dict[str, Any] | None = self.col.find_one_and_update(
                # matches only while there's room or the symbol is already in; otherwise the upsert
                # collides with the user's existing document on the unique index
                {"user_id": user_id, "$or": [{"symbols": symbol}, {f"symbols.{limit - 1}": {"$exists": False}}]},
                {"$addToSet": {"symbols": symbol}, "$set": {"updated_at": now}},
                upsert=True,
                projection={"symbols": 1},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return None
        return list(doc["symbols"]) if doc else []

    def remove(self, user_id: ObjectId, symbol: str, now: datetime) -> list[str]:
        doc = self.col.find_one_and_update(
            {"user_id": user_id},
            {"$pull": {"symbols": symbol}, "$set": {"updated_at": now}},
            projection={"symbols": 1},
            return_document=ReturnDocument.AFTER,
        )
        return list(doc["symbols"]) if doc else []

    def delete_for_user(self, user_id: ObjectId) -> None:
        self.col.delete_one({"user_id": user_id})
