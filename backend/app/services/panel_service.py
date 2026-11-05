"""
Every stock's daily prices as one wide table (dates × symbols), for the Stocks page and Compare
(US-2.9, US-3.10): the 52-week range, the latest signals, sparklines, sector and market averages.

One query, not one history per stock. Past sessions are read once per trading day (they don't
change once the next session exists) and cached; the latest session comes from the snapshot,
which refreshes every 5 minutes while the market is open. Only five columns are fetched.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.cache import ttl_cache
from app.domain.signals import STRATEGIES
from app.repositories import get_repos
from app.services import market_service

FIELDS = ("close", "high", "low", "volume", "value")
HISTORY_DAYS = market_service.MAX_RANGE_DAYS + 300  # a 3-year compare, plus the warm-up its indicators need


@dataclass(frozen=True)
class Panel:
    """One frame per field, indexed by trade date (oldest first), a column per symbol. Shared: don't mutate."""

    close: pd.DataFrame
    high: pd.DataFrame
    low: pd.DataFrame
    volume: pd.DataFrame
    value: pd.DataFrame
    latest: str


def _wide(bars: list[dict[str, Any]]) -> dict[str, pd.DataFrame]:
    if not bars:
        return {f: pd.DataFrame(dtype=float) for f in FIELDS}
    df = pd.DataFrame(bars, columns=["symbol", "trade_date", *FIELDS])
    df["trade_date"] = pd.to_datetime(df["trade_date"])
    df = df.drop_duplicates(["trade_date", "symbol"], keep="last")
    return {f: df.pivot(index="trade_date", columns="symbol", values=f).astype(float).sort_index() for f in FIELDS}


@ttl_cache(seconds=12 * 3600, maxsize=2)
def _past(latest: str) -> dict[str, pd.DataFrame]:
    """Every session before `latest`: fetched once per new trading day."""
    end = date.fromisoformat(latest) - timedelta(days=1)
    start = end - timedelta(days=HISTORY_DAYS)
    return _wide(get_repos().bars.range_bars(start.isoformat(), end.isoformat(), FIELDS))


@ttl_cache(seconds=300, maxsize=2)
def panel(latest: str | None = None) -> Panel:
    latest = latest or market_service.resolve_trade_date(None)
    past = _past(latest)
    today = _wide([{**q, "trade_date": latest} for q in market_service.snapshot(latest)["stocks"]])
    frames = {f: pd.concat([past[f], today[f]]).sort_index() for f in FIELDS}
    return Panel(**frames, latest=latest)


def window(df: pd.DataFrame, start: date | None, end: date | None) -> pd.DataFrame:
    return df.loc[pd.Timestamp(start) if start else None : pd.Timestamp(end) if end else None]


def latest_signals(close: pd.Series) -> list[dict[str, Any]]:
    """Each strategy's most recent signal on one stock's closes (oldest first, gaps dropped)."""
    out = []
    s = close.dropna()
    for strat in STRATEGIES.values():
        events = strat.run(s) if len(s) > 1 else []
        if events:
            e = events[-1]
            out.append({"strategy": strat.slug, "side": e.side, "date": e.date.date(), "price": e.price})
    return out


@ttl_cache(seconds=300, maxsize=2)
def all_latest_signals(latest: str) -> dict[str, list[dict[str, Any]]]:
    p = panel(latest)
    return {sym: latest_signals(p.close[sym]) for sym in p.close.columns}


def downsample(values: list[float], n: int) -> list[float]:
    """At most n points, evenly spaced, always keeping the first and the last."""
    if len(values) <= n:
        return values
    step = (len(values) - 1) / (n - 1)
    return [values[round(i * step)] for i in range(n)]
