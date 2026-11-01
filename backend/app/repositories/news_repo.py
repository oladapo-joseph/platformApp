"""
News reads over the crawler's `news_articles` (ADR-014, tag schema v2 in docs/10).

Articles tagged before the v2 rollout lack the v2 fields until
scripts/retag_news.py runs; every filter treats a missing field as "no tags",
and the sector filter falls back to the v1 query `sector` for them.
The collection is small (90-day TTL), so $facet over a $match is M0-safe.
"""

import re
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from pymongo.database import Database

Sort = Literal["recent", "importance"]

_PROJECTION = {"embedding": 0}
_SORT_FIELD: dict[str, str] = {"recent": "published_at", "importance": "importance_score"}
FACET_FIELDS = ("symbols", "sectors", "subsectors", "topics", "scope", "regulators", "content_type", "source")
_SYMBOL_FACET_LIMIT = 25
# The NewsFilter field each facet narrows: a facet's counts ignore its own selection, so picking
# a second topic shows what it would add (values within one filter are OR-ed).
_FACET_FILTER = {
    "symbols": "symbols",
    "sectors": "sectors",
    "subsectors": "subsectors",
    "topics": "topics",
    "scope": "scope",
    "regulators": "regulators",
    "content_type": "content_types",
    "source": "sources",
}


@dataclass(frozen=True)  # hashable: services cache on it
class NewsFilter:
    symbols: tuple[str, ...] = ()
    sectors: tuple[str, ...] = ()
    subsectors: tuple[str, ...] = ()
    topics: tuple[str, ...] = ()
    scope: tuple[str, ...] = ()
    regulators: tuple[str, ...] = ()
    content_types: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()
    date_from: datetime | None = None
    date_to: datetime | None = None
    title_only: bool = False  # only articles naming one of `symbols` in the headline
    q: str | None = None  # headline text search


def build_match(f: NewsFilter) -> dict[str, Any]:
    clauses: list[dict[str, Any]] = []
    if f.symbols:
        if f.title_only:
            clauses.append({"symbol_mentions": {"$elemMatch": {"symbol": {"$in": list(f.symbols)}, "in_title": True}}})
        else:
            clauses.append({"symbols": {"$in": list(f.symbols)}})
    if f.sectors:
        clauses.append(
            {
                "$or": [
                    {"sectors": {"$in": list(f.sectors)}},
                    {"tagger_version": {"$exists": False}, "sector": {"$in": list(f.sectors)}},
                ]
            }
        )
    for name, values in (
        ("subsectors", f.subsectors),
        ("topics", f.topics),
        ("scope", f.scope),
        ("regulators", f.regulators),
        ("source", f.sources),
    ):
        if values:
            clauses.append({name: {"$in": list(values)}})
    if f.content_types:
        clause: dict[str, Any] = {"content_type": {"$in": list(f.content_types)}}
        if "news" in f.content_types:  # untagged (pre-v2) articles are plain news
            clause = {"$or": [clause, {"content_type": {"$exists": False}}]}
        clauses.append(clause)
    if f.date_from or f.date_to:
        rng: dict[str, datetime] = {}
        if f.date_from:
            rng["$gte"] = f.date_from
        if f.date_to:
            rng["$lt"] = f.date_to
        clauses.append({"published_at": rng})
    if f.q:
        clauses.append({"title": {"$regex": re.escape(f.q.strip()), "$options": "i"}})
    if not clauses:
        return {}
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


class NewsRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["news_articles"]

    def search(
        self, f: NewsFilter, sort: Sort, limit: int, after: tuple[Any, ObjectId] | None = None
    ) -> list[dict[str, Any]]:
        """Up to `limit` articles after the cursor position, newest/most important first."""
        key = _SORT_FIELD[sort]
        match = build_match(f)
        if after is not None:
            value, oid = after
            page = {"$or": [{key: {"$lt": value}}, {key: value, "_id": {"$lt": oid}}]}
            match = {"$and": [match, page]} if match else page
        return list(self.col.find(match, _PROJECTION).sort([(key, -1), ("_id", -1)]).limit(limit))

    def facets(self, f: NewsFilter) -> tuple[dict[str, list[dict[str, Any]]], int]:
        """Counts per value of each filterable field (the result set with every other filter
        applied), and the size of the result set itself."""

        def counts(name: str) -> list[dict[str, Any]]:
            cleared: dict[str, Any] = {_FACET_FILTER[name]: ()}
            own = replace(f, **cleared)
            stages: list[dict[str, Any]] = [{"$match": build_match(own)}]
            if name in arrays:
                stages.append({"$unwind": f"${name}"})
            stages += [{"$match": {name: {"$nin": [None, ""]}}}, {"$sortByCount": f"${name}"}]
            if name == "symbols":
                stages.append({"$limit": _SYMBOL_FACET_LIMIT})
            return stages

        arrays = {"symbols", "sectors", "subsectors", "topics", "regulators"}
        # Narrow first on what every facet shares (dates, search), then per facet.
        every: dict[str, Any] = {field: () for field in _FACET_FILTER.values()}
        shared = replace(f, **every)
        facet = {n: counts(n) for n in FACET_FIELDS} | {"_total": [{"$match": build_match(f)}, {"$count": "n"}]}
        [doc] = self.col.aggregate([{"$match": build_match(shared)}, {"$facet": facet}])
        total = doc["_total"][0]["n"] if doc["_total"] else 0
        return {name: [{"value": r["_id"], "count": r["count"]} for r in doc[name]] for name in FACET_FIELDS}, total

    def for_symbol(self, symbol: str, since: datetime, sort: Sort, limit: int) -> list[dict[str, Any]]:
        q = {"symbols": symbol, "published_at": {"$gte": since}}
        return list(self.col.find(q, _PROJECTION).sort([(_SORT_FIELD[sort], -1), ("_id", -1)]).limit(limit))

    def sector_fill(self, sector: str, exclude_symbol: str, since: datetime, limit: int) -> list[dict[str, Any]]:
        """Sector stories that don't mention the stock, most important first."""
        q = {
            "symbols": {"$ne": exclude_symbol},
            "published_at": {"$gte": since},
            **build_match(NewsFilter(sectors=(sector,))),
        }
        return list(self.col.find(q, _PROJECTION).sort([("importance_score", -1), ("_id", -1)]).limit(limit))

    def headlines_for_symbol(self, symbol: str, start: datetime, end: datetime, limit: int) -> list[dict[str, Any]]:
        """The newest articles mentioning the stock published in [start, end), for AI readings (US-9.5)."""
        q = {"symbols": symbol, "published_at": {"$gte": start, "$lt": end}}
        projection = {"title": 1, "source": 1, "url": 1, "published_at": 1}
        return list(self.col.find(q, projection).sort([("published_at", -1), ("_id", -1)]).limit(limit))

    def dated_for_symbol(self, symbol: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
        """Articles with a real (not estimated) date in [start, end), for chart markers."""
        q = {"symbols": symbol, "published_at": {"$gte": start, "$lt": end}, "published_at_estimated": {"$ne": True}}
        return list(self.col.find(q, {"title": 1, "source": 1, "url": 1, "published_at": 1, "importance_score": 1}))

    def top(self, since: datetime, limit: int, sector: str | None = None) -> list[dict[str, Any]]:
        """Most important dated stories since `since` (estimated dates can't prove they're recent)."""
        q: dict[str, Any] = {"published_at": {"$gte": since}, "published_at_estimated": {"$ne": True}}
        if sector:
            q.update(build_match(NewsFilter(sectors=(sector,))))
        return list(self.col.find(q, _PROJECTION).sort([("importance_score", -1), ("_id", -1)]).limit(limit))
