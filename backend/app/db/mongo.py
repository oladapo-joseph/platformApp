"""
PyMongo client lifecycle (ADR-003: sync client, handlers run in the threadpool).

The platform only reads the crawler's collections (tradesData, daily_bars,
industry_data, news_articles) and never creates indexes on them. Its own
collections get theirs from repositories.ensure_indexes() at startup.
"""

from zoneinfo import ZoneInfo

from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import Settings

WAT = ZoneInfo("Africa/Lagos")

_client: MongoClient | None = None
_db_name: str | None = None


def connect(settings: Settings) -> None:
    global _client, _db_name
    # tz_aware + tzinfo: every datetime read comes back as aware WAT
    _client = MongoClient(
        settings.mongodb_uri.get_secret_value(),
        tz_aware=True,
        tzinfo=WAT,
        appname="equitylens-api",
        serverSelectionTimeoutMS=5000,
    )
    _db_name = settings.mongodb_db


def close() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_db() -> Database:
    if _client is None or _db_name is None:
        raise RuntimeError("Mongo client not connected; call connect() at startup")
    return _client[_db_name]


def ping() -> bool:
    try:
        get_db().command("ping")
        return True
    except Exception:
        return False
