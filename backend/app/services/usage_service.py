"""
First-party usage analytics (US-7.8): page views and feature events from the signed-in
app, so the owner can see what people use and how they move through it.

Pseudonymous by design: a random session ID from the browser and a keyed hash of the
user ID; no IP, no user agent, nothing typed. A user who turns it off sends nothing,
and the server drops anything that arrives anyway. Kept 90 days (the collection's TTL).
"""

import hashlib
import hmac
import re
import secrets
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.core import ratelimit
from app.core.cache import ttl_cache
from app.core.errors import TooManyRequests
from app.db.mongo import WAT
from app.repositories import get_repos
from app.schemas.events import EventBatch

PAGE_VIEW = "page_view"
TOP = 20
_PROP_KEY = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
_key = secrets.token_bytes(32)  # replaced at start-up with one derived from SESSION_SECRET


def use_key(secret: str) -> None:
    """Pseudonyms stay stable across restarts while SESSION_SECRET does (rotating it starts afresh)."""
    global _key
    _key = hashlib.sha256(b"usage-pseudonym|" + secret.encode()).digest()


def pseudonym(user_id: ObjectId) -> str:
    return hmac.new(_key, str(user_id).encode(), hashlib.sha256).hexdigest()[:24]


def record(user: dict[str, Any], batch: EventBatch) -> int:
    """Stores a batch from the browser; returns how many events were kept."""
    if user.get("usage_analytics") is False:
        return 0
    wait = ratelimit.usage_batches.hit(str(user["_id"]))
    if wait:
        raise TooManyRequests("Too many usage events.", wait)
    now = datetime.now(WAT)
    who = pseudonym(user["_id"])

    def when(at: datetime) -> datetime:
        at = at if at.tzinfo else at.replace(tzinfo=UTC)
        return min(max(at, now - timedelta(hours=1)), now)  # a wrong device clock can't skew the charts

    docs = [
        {
            "at": when(e.at),
            "name": e.name,
            "path": e.path,
            "prev": e.prev,
            "prev_ms": e.prev_ms,
            "props": {k: v[:60] if isinstance(v, str) else v for k, v in e.props.items() if _PROP_KEY.match(k)},
            "session": batch.session,
            "device": batch.device,
            "user": who,
        }
        for e in batch.events
    ]
    get_repos().events.insert_many(docs)
    return len(docs)


def _counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = [{"key": r["_id"] or "—", "count": r["count"], "users": len(r["users"])} for r in rows]
    return sorted(out, key=lambda c: (-c["count"], c["key"]))[:TOP]


def _first_steps(paths: list[tuple[datetime, str]]) -> tuple[str, ...]:
    """A session's first three pages, a reload or repeat of the same page counted once."""
    steps: list[str] = []
    for _, path in sorted(paths):
        if not steps or steps[-1] != path:
            steps.append(path)
        if len(steps) == 3:
            break
    return tuple(steps)


@ttl_cache(seconds=300, maxsize=8)
def usage(days: int) -> dict[str, Any]:
    events = get_repos().events
    since = datetime.now(WAT) - timedelta(days=days)
    is_view = {"$eq": ["$name", PAGE_VIEW]}

    daily_rows = events.aggregate(
        since,
        [
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$at", "timezone": "Africa/Lagos"}},
                    "users": {"$addToSet": "$user"},
                    "sessions": {"$addToSet": "$session"},
                    "page_views": {"$sum": {"$cond": [is_view, 1, 0]}},
                }
            }
        ],
    )
    users = set().union(*(r["users"] for r in daily_rows)) if daily_rows else set()
    sessions = set().union(*(r["sessions"] for r in daily_rows)) if daily_rows else set()
    page_views = sum(r["page_views"] for r in daily_rows)

    views = {"$match": {"name": PAGE_VIEW}}
    pages = events.aggregate(
        since, [views, {"$group": {"_id": "$path", "count": {"$sum": 1}, "users": {"$addToSet": "$user"}}}]
    )
    dwell = {
        r["_id"]: r["avg"]
        for r in events.aggregate(
            since,
            [
                {"$match": {"name": PAGE_VIEW, "prev": {"$ne": None}, "prev_ms": {"$ne": None}}},
                {"$group": {"_id": "$prev", "avg": {"$avg": "$prev_ms"}}},
            ],
        )
    }
    features = events.aggregate(
        since,
        [
            {"$match": {"name": {"$ne": PAGE_VIEW}}},
            {"$group": {"_id": "$name", "count": {"$sum": 1}, "users": {"$addToSet": "$user"}}},
        ],
    )
    entries = events.aggregate(
        since,
        [
            {"$match": {"name": PAGE_VIEW, "prev": None}},
            {"$group": {"_id": "$path", "count": {"$sum": 1}, "users": {"$addToSet": "$user"}}},
        ],
    )
    transitions = events.aggregate(
        since,
        [
            {"$match": {"name": PAGE_VIEW, "prev": {"$ne": None}}},
            {"$group": {"_id": {"source": "$prev", "target": "$path"}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},  # after $group: one row per page pair
            {"$limit": TOP},
        ],
    )
    by_session = events.aggregate(
        since, [views, {"$group": {"_id": "$session", "pages": {"$push": {"at": "$at", "path": "$path"}}}}]
    )
    journeys = Counter(
        steps for s in by_session if len(steps := _first_steps([(p["at"], p["path"]) for p in s["pages"]])) >= 2
    )
    devices = events.aggregate(
        since,
        [
            {"$group": {"_id": {"device": "$device", "session": "$session"}, "user": {"$first": "$user"}}},
            {"$group": {"_id": "$_id.device", "count": {"$sum": 1}, "users": {"$addToSet": "$user"}}},
        ],
    )
    return {
        "days": days,
        "users": len(users),
        "sessions": len(sessions),
        "page_views": page_views,
        "pages_per_session": round(page_views / len(sessions), 1) if sessions else None,
        "daily": sorted(
            (
                {
                    "day": r["_id"],
                    "users": len(r["users"]),
                    "sessions": len(r["sessions"]),
                    "page_views": r["page_views"],
                }
                for r in daily_rows
            ),
            key=lambda d: d["day"],
        ),
        "pages": [
            {
                "path": c["key"],
                "views": c["count"],
                "users": c["users"],
                "avg_seconds": round(dwell[c["key"]] / 1000, 1) if c["key"] in dwell else None,
            }
            for c in _counts(pages)
        ],
        "features": _counts(features),
        "entries": _counts(entries),
        "transitions": [{**r["_id"], "count": r["count"]} for r in transitions],
        "journeys": [{"steps": list(k), "sessions": n} for k, n in journeys.most_common(10)],
        "devices": _counts(devices),
    }
