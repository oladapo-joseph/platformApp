"""
The Stocks page (US-2.9, US-2.10): every listed stock for the latest session or a period, with
what a screener and the digest cards need beyond the price list: subsector, market cap, the
52-week range, each strategy's latest signal and a short series of closes for a sparkline.
"""

from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.cache import ttl_cache
from app.core.errors import BadRequest
from app.repositories import get_repos
from app.services import market_service
from app.services.panel_service import all_latest_signals, downsample, panel, window

SPARK_POINTS = 40
SESSION_SPARK_DAYS = 30  # a session's cards show the last month


def _round(v: Any, digits: int = 2) -> float | None:
    return None if v is None or pd.isna(v) else round(float(v), digits)


@ttl_cache(seconds=300, maxsize=32)
def screen(start: date | None, end: date | None) -> dict[str, Any]:
    if bool(start) != bool(end):
        raise BadRequest("Pass both `start` and `end`, or neither for the latest session.", "invalid-range")
    latest = market_service.resolve_trade_date(None)
    if start and end:
        source = market_service.range_summary(start, end)
        rows, as_of = source["stocks"], None
        spark_from, spark_to = start, end
    else:
        source = market_service.snapshot(latest)
        rows, as_of = source["stocks"], source["data_as_of"]
        spark_to = date.fromisoformat(latest)
        spark_from = spark_to - timedelta(days=SESSION_SPARK_DAYS)

    p = panel(latest)
    year_ago = date.fromisoformat(latest) - timedelta(days=365)
    closes_1y = window(p.close, year_ago, None)
    highs = window(p.high, year_ago, None).max().combine_first(closes_1y.max())
    lows = window(p.low, year_ago, None).min().combine_first(closes_1y.min())
    sparks = window(p.close, spark_from, spark_to)
    signals = all_latest_signals(latest)
    meta = {r["symbol"]: r for r in get_repos().industry.directory()}

    stocks = []
    for r in rows:
        sym = r["symbol"]
        m = meta.get(sym, {})
        shares = m.get("shares_outstanding")
        closes = sparks[sym].dropna().tolist() if sym in sparks.columns else []
        stocks.append(
            {
                **{k: r.get(k) for k in ("symbol", "company", "sector", "close", "change", "pct_change", "volume")},
                "value": r.get("value"),
                "trades": r.get("trades"),
                "days": r.get("days"),
                "subsector": m.get("subsector") or None,
                "market_cap": shares * r["close"] if shares and r.get("close") else None,
                "high_52w": _round(highs.get(sym)),
                "low_52w": _round(lows.get(sym)),
                "signals": signals.get(sym, []),
                "spark": [round(v, 2) for v in downsample(closes, SPARK_POINTS)],
            }
        )
    return {
        "start": start,
        "end": end,
        "trade_date": latest,
        "data_as_of": as_of,
        "stocks": stocks,
    }
