"""News for a stock, chart markers, top stories and the filterable News page (ADR-014)."""

import base64
import binascii
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.core.cache import ttl_cache
from app.core.errors import BadRequest
from app.db.mongo import WAT
from app.repositories import get_repos
from app.repositories.news_repo import NewsFilter, Sort
from app.services.stock_service import directory

SNIPPET_CHARS = 200
SECTOR_FILL = 3
MARKER_HEADLINES = 3

_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)")  # markdown links/images → their text
_MARKUP = re.compile(r"[#*_`|>~]+|https?://\S+")
_SPACE = re.compile(r"\s+")


def snippet(content: str | None) -> str:
    text = _SPACE.sub(" ", _MARKUP.sub(" ", _LINK.sub(r"\1", content or ""))).strip()
    if len(text) <= SNIPPET_CHARS:
        return text
    cut = text[:SNIPPET_CHARS].rsplit(" ", 1)[0].rstrip(" ,;:.-")
    return f"{cut}…"


def article(doc: dict[str, Any], symbol: str | None = None) -> dict[str, Any]:
    match = None
    if symbol:
        mention = next((m for m in doc.get("symbol_mentions") or [] if m.get("symbol") == symbol), None)
        if mention:
            match = (
                "query" if mention.get("matched_on") == "query" else ("title" if mention.get("in_title") else "body")
            )
    return {
        "id": str(doc["_id"]),
        "title": _SPACE.sub(" ", doc.get("title") or "").strip(),  # \s covers the NBSPs some sources use
        "url": doc.get("url") or "",
        "source": doc.get("source") or "",
        "published_at": doc.get("published_at") or doc.get("fetched_at"),
        "published_at_estimated": bool(doc.get("published_at_estimated", False)),
        "snippet": snippet(doc.get("content")),
        "symbols": doc.get("symbols") or [],
        "primary_symbol": doc.get("primary_symbol"),
        "match": match,
        "topics": doc.get("topics") or [],
        "scope": doc.get("scope"),
        "content_type": doc.get("content_type"),
        "sectors": doc.get("sectors") or ([doc["sector"]] if doc.get("sector") else []),
        "source_tier": doc.get("source_tier"),
        "importance": doc.get("importance_score"),
    }


def _sector_of(symbol: str) -> str | None:
    return next((r["sector"] for r in directory() if r["symbol"] == symbol and r["sector"]), None)


@ttl_cache(seconds=600, maxsize=256)
def stock_news(symbol: str, days: int, limit: int, sort: Sort) -> dict[str, Any]:
    repo = get_repos().news
    since = datetime.now(WAT) - timedelta(days=days)
    mentions = [article(d, symbol) for d in repo.for_symbol(symbol, since, sort, limit)]
    sector = _sector_of(symbol)
    fill = [article(d) for d in repo.sector_fill(sector, symbol, since, min(limit, SECTOR_FILL))] if sector else []
    return {"symbol": symbol, "mentions": mentions, "sector": fill}


@ttl_cache(seconds=600, maxsize=256)
def markers(symbol: str, start: date, end: date) -> dict[str, Any]:
    if start > end:
        raise BadRequest("`start` must be on or before `end`.", "invalid-range")
    lo = datetime.combine(start, datetime.min.time(), WAT)
    hi = datetime.combine(end + timedelta(days=1), datetime.min.time(), WAT)
    by_day: dict[date, list[dict[str, Any]]] = defaultdict(list)
    for doc in get_repos().news.dated_for_symbol(symbol, lo, hi):
        by_day[doc["published_at"].astimezone(WAT).date()].append(doc)
    days = []
    for day in sorted(by_day):
        docs = sorted(by_day[day], key=lambda d: -(d.get("importance_score") or 0))
        days.append(
            {
                "date": day,
                "count": len(docs),
                "headlines": [
                    {
                        "id": str(d["_id"]),
                        "title": d.get("title") or "",
                        "source": d.get("source") or "",
                        "url": d.get("url") or "",
                    }
                    for d in docs[:MARKER_HEADLINES]
                ],
            }
        )
    return {"symbol": symbol, "start": start, "end": end, "days": days}


@ttl_cache(seconds=600, maxsize=64)
def top(hours: int, limit: int, sector: str | None) -> list[dict[str, Any]]:
    since = datetime.now(WAT) - timedelta(hours=hours)
    return [article(d) for d in get_repos().news.top(since, limit, sector)]


# ── News page: cursor = base64url(JSON [sort, sort value, id]) ───────────────


def encode_cursor(sort: Sort, doc: dict[str, Any]) -> str:
    value = doc.get("published_at") if sort == "recent" else doc.get("importance_score")
    if isinstance(value, datetime):
        value = {"dt": value.isoformat()}
    raw = json.dumps([sort, value, str(doc["_id"])], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str, sort: Sort) -> tuple[Any, ObjectId]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        cur_sort, value, oid = json.loads(raw)
        if cur_sort != sort:
            raise ValueError("sort changed")
        if isinstance(value, dict):
            value = datetime.fromisoformat(value["dt"])
        return value, ObjectId(oid)
    except (ValueError, TypeError, KeyError, InvalidId, binascii.Error, json.JSONDecodeError) as exc:
        raise BadRequest(
            "The cursor is invalid or belongs to a different sort; start from the first page.", "invalid-cursor"
        ) from exc


@ttl_cache(seconds=600, maxsize=256)
def search(f: NewsFilter, sort: Sort, limit: int, cursor: str | None) -> dict[str, Any]:
    repo = get_repos().news
    after = decode_cursor(cursor, sort) if cursor else None
    docs = repo.search(f, sort, limit + 1, after)
    page, more = docs[:limit], len(docs) > limit
    facets, total = repo.facets(f) if cursor is None else (None, None)
    return {
        "items": [article(d, f.symbols[0] if len(f.symbols) == 1 else None) for d in page],
        "next_cursor": encode_cursor(sort, page[-1]) if more and page else None,
        "facets": facets,
        "total": total,
    }
