"""
Daily OHLCV bars (ADR-007).

Source of truth is `daily_bars`, written by the ngxPro crawler: one row per
(symbol, NGX trade date), close = the day's latest snapshot. It only has
history from the crawler's deploy until scripts/backfill_daily_bars.py runs,
so with BARS_SOURCE=auto a request is split at daily_bars' first trade date:
older days are aggregated from `tradesData` with the same rules, newer days
read from `daily_bars`. Once the backfill runs, everything reads daily_bars.

M0 rule: no pipeline sorts raw documents before $group. "Latest snapshot"
uses the $top accumulator (Mongo ≥ 5.2) instead of a pre-group $sort.
"""

import math
from datetime import date, datetime, timedelta
from typing import Any, Literal

from pymongo.database import Database

from app.core.cache import ttl_cache
from app.db.mongo import WAT

DAILY_BARS = "daily_bars"
BAR_FIELDS = ("open", "high", "low", "close", "prev_close", "change", "pct_change", "volume", "value", "trades")

Source = Literal["daily_bars", "trades"]
Segment = tuple[Source, str | None, str | None]  # (source, first trade date, last trade date), inclusive

# NGX TradeDate is a datetime (older rows), "2025-02-11", "2026-04-27T00:00:00" or
# "2026-02-20 00:00:00.0000000"; fall back to the crawl's WAT date (crawler's trade_date_of()).
TRADE_DATE_EXPR: dict[str, Any] = {
    "$switch": {
        "branches": [
            {
                "case": {"$eq": [{"$type": "$TradeDate"}, "date"]},
                "then": {"$dateToString": {"format": "%Y-%m-%d", "date": "$TradeDate"}},
            },
            {
                "case": {
                    "$regexMatch": {
                        "input": {"$toString": {"$ifNull": ["$TradeDate", ""]}},
                        "regex": r"^\d{4}-\d{2}-\d{2}",
                    }
                },
                "then": {"$substrCP": [{"$toString": "$TradeDate"}, 0, 10]},
            },
        ],
        "default": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fetched_at", "timezone": "Africa/Lagos"}},
    }
}

# Latest snapshot of the day wins (fixes C5: the old loader took the intraday max close)
_LATEST_OUTPUT = {
    "sector": "$Sector",
    "open": "$OpeningPrice",
    "close": "$ClosePrice",
    "prev_close": "$PrevClosingPrice",
    "change": "$Change",
    "pct_change": "$PercChange",
    "volume": "$Volume",
    "value": "$Value",
    "trades": "$Trades",
    "updated_at": "$fetched_at",
}


def _positive(field: str) -> dict[str, Any]:
    """The field if it's a positive number, else null ($max/$min skip nulls; NaN would win $min)."""
    return {"$cond": [{"$gt": [field, 0]}, field, None]}


_DAY_GROUP = {
    "latest": {"$top": {"sortBy": {"fetched_at": -1}, "output": _LATEST_OUTPUT}},
    "high": {"$max": _positive("$HighPrice")},
    "low": {"$min": _positive("$LowPrice")},
}

# The first crawls of a session (~09:35-10:35) return rows with every price null or NaN;
# they aren't data. $gt 0 drops null, NaN (it sorts below all numbers) and non-numbers.
_HAS_PRICE = {"ClosePrice": {"$gt": 0}}
_BAR_HAS_PRICE = {"close": {"$gt": 0}}  # older crawler builds upserted those rows too

# NGX publishes final end-of-day figures after the close, so late-night and next-morning
# crawls still carry the previous TradeDate (a Monday 09:00 crawl carries Friday's):
# look a few days past the range and group by TradeDate, never by crawl day
_FETCH_LOOKAHEAD = timedelta(days=5)


def num(v: Any) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _day(d: str) -> date:
    return date.fromisoformat(d)


def _wat_midnight(d: str) -> datetime:
    return datetime.combine(_day(d), datetime.min.time(), WAT)


def _fetched_window(start: str | None, end: str | None) -> dict[str, datetime]:
    window: dict[str, datetime] = {}
    if start:
        window["$gte"] = _wat_midnight(start)
    if end:
        window["$lt"] = _wat_midnight(end) + timedelta(days=1) + _FETCH_LOOKAHEAD
    return window


def _date_range(start: str | None, end: str | None) -> dict[str, str]:
    rng: dict[str, str] = {}
    if start:
        rng["$gte"] = start
    if end:
        rng["$lte"] = end
    return rng


def _flatten_trades_day(doc: dict[str, Any], symbol: str | None = None) -> dict[str, Any]:
    latest = doc["latest"]
    bar = {
        "symbol": symbol or doc["_id"]["symbol"],
        "trade_date": doc["trade_date"],
        "sector": latest.get("sector"),
        "updated_at": latest.get("updated_at"),
        "high": num(doc.get("high")),
        "low": num(doc.get("low")),
    }
    for f in BAR_FIELDS:
        if f not in ("high", "low"):
            bar[f] = num(latest.get(f))
    return bar


def _clean_bar(doc: dict[str, Any]) -> dict[str, Any]:
    bar = {
        "symbol": doc["symbol"],
        "trade_date": doc["trade_date"],
        "sector": doc.get("sector"),
        "updated_at": doc.get("updated_at"),
    }
    for f in BAR_FIELDS:
        bar[f] = num(doc.get(f))
    return bar


class BarsRepo:
    def __init__(self, db: Database, trades_collection: str, source: str = "auto") -> None:
        self.db = db
        self.trades = db[trades_collection]
        self.bars = db[DAILY_BARS]
        self.source = source

    # ── coverage ─────────────────────────────────────────────────────────────

    def first_bar_date(self) -> str | None:
        return _first_bar_date(self.bars)

    def segments(self, start: str | None, end: str | None) -> list[Segment]:
        """Which source serves which part of [start, end] (None = open-ended)."""
        if self.source in ("trades", "daily_bars"):
            return [(self.source, start, end)]  # type: ignore[list-item]
        since = self.first_bar_date()
        if since is None or (end is not None and end < since):
            return [("trades", start, end)]
        if start is not None and start >= since:
            return [("daily_bars", start, end)]
        before = (_day(since) - timedelta(days=1)).isoformat()
        return [("trades", start, before), ("daily_bars", since, end)]

    # ── one symbol ───────────────────────────────────────────────────────────

    def symbol_bars(self, symbol: str, start: str | None = None, end: str | None = None) -> list[dict[str, Any]]:
        """Daily bars for one symbol, oldest first."""
        out: list[dict[str, Any]] = []
        for source, s, e in self.segments(start, end):
            if source == "daily_bars":
                q: dict[str, Any] = {"symbol": symbol, **_BAR_HAS_PRICE}
                if rng := _date_range(s, e):
                    q["trade_date"] = rng
                out += [_clean_bar(d) for d in self.bars.find(q, {"_id": 0}).sort("trade_date", 1)]
            else:
                match: dict[str, Any] = {"Symbol": symbol, **_HAS_PRICE}
                if window := _fetched_window(s, e):
                    match["fetched_at"] = window
                pipeline: list[dict[str, Any]] = [
                    {"$match": match},
                    {"$group": {"_id": TRADE_DATE_EXPR, **_DAY_GROUP}},
                    {"$set": {"trade_date": "$_id"}},
                ]
                if rng := _date_range(s, e):
                    pipeline.append({"$match": {"trade_date": rng}})
                pipeline.append({"$sort": {"trade_date": 1}})  # after $group: ≤ 1 row per day
                out += [_flatten_trades_day(d, symbol) for d in self.trades.aggregate(pipeline)]
        return out

    # ── all symbols ──────────────────────────────────────────────────────────

    def date_bars(self, trade_date: str) -> list[dict[str, Any]]:
        """Every symbol's bar for one trade date."""
        [(source, _, _)] = self.segments(trade_date, trade_date)
        if source == "daily_bars":
            return [_clean_bar(d) for d in self.bars.find({"trade_date": trade_date, **_BAR_HAS_PRICE}, {"_id": 0})]
        pipeline: list[dict[str, Any]] = [
            {"$match": {"fetched_at": _fetched_window(trade_date, trade_date), **_HAS_PRICE}},
            {"$group": {"_id": {"symbol": "$Symbol", "trade_date": TRADE_DATE_EXPR}, **_DAY_GROUP}},
            {"$match": {"_id.trade_date": trade_date}},
            {"$set": {"trade_date": "$_id.trade_date"}},
        ]
        return [_flatten_trades_day(d) for d in self.trades.aggregate(pipeline)]

    def range_bars(self, start: str, end: str) -> list[dict[str, Any]]:
        """Every symbol's bar for every trade date in [start, end] (market history; keep ranges short)."""
        out: list[dict[str, Any]] = []
        for source, s, e in self.segments(start, end):
            rng = _date_range(s, e)
            if source == "daily_bars":
                q = {**({"trade_date": rng} if rng else {}), **_BAR_HAS_PRICE}
                out += [_clean_bar(d) for d in self.bars.find(q, {"_id": 0})]
                continue
            pipeline: list[dict[str, Any]] = [
                {"$match": {"fetched_at": _fetched_window(s, e), **_HAS_PRICE}},
                {"$group": {"_id": {"symbol": "$Symbol", "trade_date": TRADE_DATE_EXPR}, **_DAY_GROUP}},
                {"$match": {"_id.trade_date": rng} if rng else {}},
                {"$set": {"trade_date": "$_id.trade_date"}},
            ]
            out += [_flatten_trades_day(d) for d in self.trades.aggregate(pipeline)]
        return out

    def range_summaries(self, start: str, end: str) -> list[dict[str, Any]]:
        """Per symbol across [start, end]: first open, last close, high, low, totals, trading days."""
        merged: dict[str, dict[str, Any]] = {}
        for source, s, e in self.segments(start, end):  # oldest segment first
            for row in self._segment_summaries(source, s, e):
                prev = merged.get(row["symbol"])
                if prev is None:
                    merged[row["symbol"]] = row
                    continue
                prev["close"] = row["close"] if row["close"] is not None else prev["close"]
                prev["sector"] = row["sector"] or prev["sector"]
                prev["high"] = max((v for v in (prev["high"], row["high"]) if v is not None), default=None)
                prev["low"] = min((v for v in (prev["low"], row["low"]) if v is not None), default=None)
                if prev["open"] is None:
                    prev["open"] = row["open"]
                for f in ("volume", "value", "days"):
                    prev[f] += row[f]
        return list(merged.values())

    def _segment_summaries(self, source: Source, start: str | None, end: str | None) -> list[dict[str, Any]]:
        by_date_first = {"sortBy": {"trade_date": 1}}
        by_date_last = {"sortBy": {"trade_date": -1}}
        per_symbol = {
            "sector": {"$top": {**by_date_last, "output": "$sector"}},
            "open": {"$top": {**by_date_first, "output": "$open"}},
            "close": {"$top": {**by_date_last, "output": "$close"}},
            "high": {"$max": "$high"},
            "low": {"$min": "$low"},
            "volume": {"$sum": "$volume"},
            "value": {"$sum": "$value"},
            "days": {"$sum": 1},
        }
        rng = _date_range(start, end)
        if source == "daily_bars":
            pipeline: list[dict[str, Any]] = [
                {"$match": {**({"trade_date": rng} if rng else {}), **_BAR_HAS_PRICE}},
                {"$group": {"_id": "$symbol", **per_symbol}},
            ]
            docs = self.bars.aggregate(pipeline)
        else:
            pipeline = [
                {"$match": {"fetched_at": _fetched_window(start, end), **_HAS_PRICE}},
                {"$group": {"_id": {"symbol": "$Symbol", "trade_date": TRADE_DATE_EXPR}, **_DAY_GROUP}},
                {"$match": {"_id.trade_date": rng} if rng else {}},
                {
                    "$project": {
                        "symbol": "$_id.symbol",
                        "trade_date": "$_id.trade_date",
                        "sector": "$latest.sector",
                        "open": "$latest.open",
                        "close": "$latest.close",
                        "high": 1,
                        "low": 1,
                        "volume": "$latest.volume",
                        "value": "$latest.value",
                    }
                },
                {"$group": {"_id": "$symbol", **per_symbol}},
            ]
            docs = self.trades.aggregate(pipeline)
        return [
            {
                "symbol": d["_id"],
                "sector": d.get("sector"),
                "open": num(d.get("open")),
                "close": num(d.get("close")),
                "high": num(d.get("high")),
                "low": num(d.get("low")),
                "volume": num(d.get("volume")) or 0.0,
                "value": num(d.get("value")) or 0.0,
                "days": int(d["days"]),
            }
            for d in docs
            if d["_id"]
        ]

    # ── freshness ────────────────────────────────────────────────────────────

    def latest_trade_date(self) -> str | None:
        if self.source != "trades":
            doc = self.bars.find_one(_BAR_HAS_PRICE, {"trade_date": 1}, sort=[("trade_date", -1)])
            if doc:
                return str(doc["trade_date"])
        latest = self.trades.find_one(_HAS_PRICE, {"TradeDate": 1, "fetched_at": 1}, sort=[("fetched_at", -1)])
        if not latest:
            return None
        rows = list(
            self.trades.aggregate(
                [
                    {"$match": {"_id": latest["_id"]}},
                    {"$project": {"d": TRADE_DATE_EXPR}},
                ]
            )
        )
        return str(rows[0]["d"]) if rows else None

    def trade_date_on_or_before(self, day: str) -> str | None:
        """The last trading day ≤ `day` (weekends and holidays have no bars)."""
        if self.source != "trades":
            doc = self.bars.find_one(
                {"trade_date": {"$lte": day}, **_BAR_HAS_PRICE}, {"trade_date": 1}, sort=[("trade_date", -1)]
            )
            since = self.first_bar_date()
            if doc and (self.source == "daily_bars" or since is None or doc["trade_date"] >= since):
                return str(doc["trade_date"])
            if self.source == "daily_bars":
                return None
        # tradesData: newest crawl that could carry a trade date ≤ day, then its trade date
        rows = list(
            self.trades.aggregate(
                [
                    {
                        "$match": {
                            "fetched_at": {
                                "$lt": _wat_midnight(day) + timedelta(days=1) + _FETCH_LOOKAHEAD,
                                "$gte": _wat_midnight(day) - timedelta(days=21),
                            }
                        }
                    },
                    {"$group": {"_id": TRADE_DATE_EXPR}},
                    {"$match": {"_id": {"$lte": day}}},
                    {"$sort": {"_id": -1}},  # after $group: ≤ ~26 rows
                    {"$limit": 1},
                ]
            )
        )
        return str(rows[0]["_id"]) if rows else None

    def data_as_of(self) -> datetime | None:
        """When the newest data was crawled."""
        if self.source != "trades":
            day = self.latest_trade_date()
            if day:
                doc = self.bars.find_one({"trade_date": day}, {"updated_at": 1}, sort=[("updated_at", -1)])
                if doc and doc.get("updated_at"):
                    return doc["updated_at"]
        latest = self.trades.find_one({}, {"fetched_at": 1}, sort=[("fetched_at", -1)])
        return latest["fetched_at"] if latest else None


@ttl_cache(seconds=600, maxsize=4)
def _first_bar_date(bars: Any) -> str | None:
    doc = bars.find_one({}, {"trade_date": 1}, sort=[("trade_date", 1)])
    return str(doc["trade_date"]) if doc else None
