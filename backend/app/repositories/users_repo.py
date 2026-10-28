"""
`app_users`, shared with the Streamlit app until cutover.

The Streamlit app looks users up by `username` (it creates a plain unique index
on it at every start) and verifies `password_hash` + `salt` (PBKDF2). So this repo
never removes those fields, and gives new users username = email: a second user
without a username would collide on that index's null key (D-17).
"""

import re
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

COLLECTION = "app_users"


class EmailTaken(Exception):
    pass


def oid(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


class UsersRepo:
    def __init__(self, db: Database) -> None:
        self.col = db[COLLECTION]

    def ensure_indexes(self) -> None:
        # email is optional (legacy users have none): unique only where present
        self.col.create_index(
            "email", unique=True, name="email_unique", partialFilterExpression={"email": {"$type": "string"}}
        )
        self.col.create_index("pending_email", name="pending_email")

    def by_id(self, user_id: ObjectId) -> dict[str, Any] | None:
        return self.col.find_one({"_id": user_id})

    def by_email(self, email: str) -> dict[str, Any] | None:
        return self.col.find_one({"email": email.lower()})

    def by_identifier(self, identifier: str) -> dict[str, Any] | None:
        """Email (case-insensitive) or legacy username (exact, as the Streamlit app matched it)."""
        identifier = identifier.strip()
        if "@" in identifier:
            user = self.by_email(identifier)
            if user:
                return user
        return self.col.find_one({"username": identifier})

    def create(self, doc: dict[str, Any]) -> ObjectId:
        try:
            return self.col.insert_one(doc).inserted_id
        except DuplicateKeyError as exc:
            raise EmailTaken from exc

    def update(self, user_id: ObjectId, fields: dict[str, Any], unset: tuple[str, ...] = ()) -> dict[str, Any] | None:
        op: dict[str, Any] = {"$set": fields}
        if unset:
            op["$unset"] = dict.fromkeys(unset, "")
        try:
            return self.col.find_one_and_update({"_id": user_id}, op, return_document=ReturnDocument.AFTER)
        except DuplicateKeyError as exc:
            raise EmailTaken from exc

    def touch_login(self, user_id: ObjectId, at: datetime) -> None:
        self.col.update_one({"_id": user_id}, {"$set": {"last_login_at": at}})

    def search(self, q: str | None, limit: int, skip: int) -> tuple[list[dict[str, Any]], int]:
        query: dict[str, Any] = {}
        if q:
            rx = {"$regex": re.escape(q.strip()), "$options": "i"}
            query = {"$or": [{"email": rx}, {"username": rx}, {"display_name": rx}]}
        cursor = self.col.find(query).sort([("created_at", -1), ("_id", -1)]).skip(skip).limit(limit)
        return list(cursor), self.col.count_documents(query)

    def active_admins(self) -> int:
        return self.col.count_documents({"role": "admin", "is_active": {"$ne": False}})

    def delete(self, user_id: ObjectId) -> None:
        self.col.delete_one({"_id": user_id})
