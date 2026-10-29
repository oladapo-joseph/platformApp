"""
The user's watchlist (US-5.1 – US-5.4) and its news (US-9.4).

Rows are built from each stock's cached full history (shared with the stock page), so a
watchlist of 50 costs no more than opening those 50 stock pages.
"""

from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
from bson import ObjectId

from app.core.cache import ttl_cache
from app.core.errors import BadRequest, Conflict, NotFound
from app.db.mongo import WAT
from app.domain.market import period_stats
from app.domain.signals import STRATEGIES
from app.repositories import get_repos
from app.repositories.news_repo import NewsFilter
from app.services import news_service, stock_service

LIMIT = 50  # Q-6
PERIOD_DAYS = {"1W": 7, "1M": 30, "3M": 91}  # and "YTD": from 1 January
SPARK_POINTS = 60


def _now() -> datetime:
    return datetime.now(WAT)


def _view(symbols: list[str]) -> dict[str, Any]:
    return {"symbols": symbols, "limit": LIMIT}


def get(user: dict[str, Any]) -> dict[str, Any]:
    return _view(get_repos().watchlists.symbols(user["_id"]))


def add(user: dict[str, Any], symbol: str) -> dict[str, Any]:
    known = {r["symbol"] for r in stock_service.directory()}
    if symbol not in known and stock_service.history(symbol).empty:
        raise NotFound(f"Unknown symbol {symbol}.", "unknown-symbol")
    symbols = get_repos().watchlists.add(user["_id"], symbol, LIMIT, _now())
    if symbols is None:
        raise Conflict(f"Your watchlist holds up to {LIMIT} stocks. Remove one to add {symbol}.", "watchlist-full")
    return _view(symbols)


def remove(user: dict[str, Any], symbol: str) -> dict[str, Any]:
    return _view(get_repos().watchlists.remove(user["_id"], symbol, _now()))


def symbols_of(user_id: ObjectId) -> list[str]:
    return get_repos().watchlists.symbols(user_id)


def period_start(period: str, as_of: date) -> date:
    return date(as_of.year, 1, 1) if period == "YTD" else as_of - timedelta(days=PERIOD_DAYS[period])


def _spark(closes: list[float]) -> list[float]:
    """At most SPARK_POINTS closes, evenly spaced, always keeping the first and the last."""
    if len(closes) <= SPARK_POINTS:
        return closes
    step = (len(closes) - 1) / (SPARK_POINTS - 1)
    return [closes[round(i * step)] for i in range(SPARK_POINTS)]


@ttl_cache(seconds=300, maxsize=512)
def _row(symbol: str, period: str, strategy: str, as_of: str | None) -> dict[str, Any]:
    entry = next((r for r in stock_service.directory() if r["symbol"] == symbol), None)
    row: dict[str, Any] = {
        "symbol": symbol,
        "company": entry["company"] or None if entry else None,
        "sector": entry["sector"] or None if entry else None,
        "trade_date": None,
        "close": None,
        "pct_change": None,
        "period_pct_change": None,
        "spark": [],
        "signal": None,
    }
    df = stock_service.history(symbol)
    if df.empty:
        return row
    last = df.iloc[-1]
    window = df.loc[pd.Timestamp(period_start(period, date.fromisoformat(as_of))) :] if as_of else df.iloc[-1:]
    stats = period_stats(window) if not window.empty else {}
    events = stock_service.signals(symbol, strategy, None, None)["signals"]
    return row | {
        "trade_date": df.index[-1].date(),
        "close": None if pd.isna(last["close"]) else float(last["close"]),
        "pct_change": None if pd.isna(last["pct_change"]) else float(last["pct_change"]),
        "period_pct_change": stats.get("pct_change"),
        "spark": _spark([float(c) for c in window["close"].dropna()]),
        "signal": events[-1] if events else None,
    }


def overview(user: dict[str, Any], period: str, strategy: str) -> dict[str, Any]:
    strat = STRATEGIES.get(strategy)
    if strat is None:
        raise BadRequest(f"Unknown strategy. Use one of: {', '.join(STRATEGIES)}.", "invalid-strategy")
    as_of = get_repos().bars.latest_trade_date()
    return {
        "period": period,
        "start": period_start(period, date.fromisoformat(as_of)) if as_of else None,
        "as_of": as_of,
        "strategy": stock_service.strategy_info(strat),
        "stocks": [_row(s, period, strategy, as_of) for s in symbols_of(user["_id"])],
    }


def news(user: dict[str, Any], days: int, limit: int) -> dict[str, Any]:
    symbols = symbols_of(user["_id"])
    if not symbols:
        return {"symbols": [], "articles": []}
    f = NewsFilter(symbols=tuple(symbols), date_from=_now() - timedelta(days=days))
    docs = get_repos().news.search(f, "recent", limit)
    return {"symbols": symbols, "articles": [news_service.article(d) for d in docs]}
