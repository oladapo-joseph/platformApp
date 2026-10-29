"""Market today / over a range: snapshot, period performance, sectors, freshness."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any

from app.core.cache import ttl_cache
from app.core.errors import BadRequest, NotFound
from app.db.mongo import WAT
from app.domain.market import SymbolRow, resolve_pct, summarize
from app.repositories import get_repos
from app.services.stock_service import company_names

NGX_OPEN, NGX_CLOSE = time(10, 0), time(14, 30)
MAX_RANGE_DAYS = 3 * 366


def is_trading_hours(now: datetime) -> bool:
    local = now.astimezone(WAT)
    return local.weekday() < 5 and NGX_OPEN <= local.time() <= NGX_CLOSE


@ttl_cache(seconds=60)
def status() -> dict[str, Any]:
    bars = get_repos().bars
    latest = bars.latest_trade_date()
    as_of = bars.data_as_of()
    now = datetime.now(WAT)
    return {
        "latest_trade_date": latest,
        "data_as_of": as_of,
        "data_age_minutes": int((now - as_of).total_seconds() // 60) if as_of else None,
        "is_trading_hours": is_trading_hours(now),
    }


@ttl_cache(seconds=300)
def resolve_trade_date(day: date | None) -> str:
    """The requested day if it traded, else the last trading day before it; latest when None."""
    bars = get_repos().bars
    resolved = bars.latest_trade_date() if day is None else bars.trade_date_on_or_before(day.isoformat())
    if resolved is None:
        raise NotFound("No market data on or before that date.", "no-market-data")
    return resolved


def _quote(bar: dict[str, Any], names: dict[str, str]) -> dict[str, Any]:
    pct = resolve_pct(bar["pct_change"], bar["close"], bar["prev_close"])
    return {
        **{
            k: bar[k]
            for k in (
                "symbol",
                "sector",
                "open",
                "high",
                "low",
                "close",
                "prev_close",
                "change",
                "volume",
                "value",
                "trades",
            )
        },
        "pct_change": pct,
        "company": names.get(bar["symbol"]),
    }


def _row(q: dict[str, Any]) -> SymbolRow:
    return SymbolRow(
        q["symbol"], q["sector"] or "Unknown", q["close"], q["pct_change"], q["volume"] or 0.0, q["value"] or 0.0
    )


@ttl_cache(seconds=300, maxsize=64)
def snapshot(trade_date: str) -> dict[str, Any]:
    bars = get_repos().bars.date_bars(trade_date)
    if not bars:
        raise NotFound(f"No market data for {trade_date}.", "no-market-data")
    names = company_names()
    quotes = sorted((_quote(b, names) for b in bars), key=lambda q: q["symbol"])
    as_of = max((b["updated_at"] for b in bars if b.get("updated_at")), default=None)
    return {
        "trade_date": trade_date,
        "data_as_of": as_of,
        "summary": summarize([_row(q) for q in quotes]),
        "stocks": quotes,
    }


@ttl_cache(seconds=300, maxsize=16)
def history(days: int) -> dict[str, Any]:
    """Market totals and breadth for the last `days` sessions, oldest first (sparklines, US-2.1)."""
    end = resolve_trade_date(None)
    start = (date.fromisoformat(end) - timedelta(days=days * 2 + 10)).isoformat()  # weekends and holidays
    rows: dict[str, list[SymbolRow]] = defaultdict(list)
    deals: dict[str, float] = defaultdict(float)
    for bar in get_repos().bars.range_bars(start, end):
        pct = resolve_pct(bar["pct_change"], bar["close"], bar["prev_close"])
        day = bar["trade_date"]
        rows[day].append(
            SymbolRow(
                bar["symbol"], bar["sector"] or "Unknown", bar["close"], pct, bar["volume"] or 0.0, bar["value"] or 0.0
            )
        )
        deals[day] += bar["trades"] or 0.0
    sessions = []
    for day in sorted(rows)[-days:]:
        s = summarize(rows[day])
        sessions.append(
            {
                "trade_date": day,
                "total_value": s["total_value"],
                "total_volume": s["total_volume"],
                "total_trades": deals[day],
                "stock_count": s["stock_count"],
                "breadth": s["breadth"],
            }
        )
    return {"sessions": sessions}


def check_range(start: date, end: date) -> None:
    if start > end:
        raise BadRequest("`start` must be on or before `end`.", "invalid-range")
    if (end - start).days > MAX_RANGE_DAYS:
        raise BadRequest("Ranges are limited to 3 years.", "range-too-long")


@ttl_cache(seconds=300, maxsize=64)
def range_summary(start: date, end: date) -> dict[str, Any]:
    check_range(start, end)
    rows = get_repos().bars.range_summaries(start.isoformat(), end.isoformat())
    if not rows:
        raise NotFound("No market data in that range.", "no-market-data")
    names = company_names()
    stocks = []
    for r in sorted(rows, key=lambda r: r["symbol"]):
        change = r["close"] - r["open"] if r["close"] is not None and r["open"] is not None else None
        stocks.append(
            {
                **r,
                "company": names.get(r["symbol"]),
                "change": change,
                "pct_change": change / r["open"] * 100 if change is not None and r["open"] else None,
            }
        )
    summary = summarize(
        [
            SymbolRow(s["symbol"], s["sector"] or "Unknown", s["close"], s["pct_change"], s["volume"], s["value"])
            for s in stocks
        ]
    )
    return {"start": start, "end": end, "summary": summary, "stocks": stocks}


def sectors(day: date | None, start: date | None, end: date | None) -> dict[str, Any]:
    if start or end:
        if not (start and end):
            raise BadRequest("Pass both `start` and `end`, or `date`.", "invalid-range")
        return {"start": start, "end": end, "sectors": range_summary(start, end)["summary"]["sectors"]}
    trade_date = date.fromisoformat(resolve_trade_date(day))
    return {"start": trade_date, "end": trade_date, "sectors": snapshot(trade_date.isoformat())["summary"]["sectors"]}
