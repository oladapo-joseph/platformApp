"""
Market and period summaries: pure functions over per-symbol rows
(ported from streamlitApp/views/market_overview.py and deep_dive.py::_meta_bar).
"""

from collections import defaultdict
from dataclasses import asdict, dataclass
from statistics import fmean
from typing import Any

import pandas as pd

MOVERS_N = 8


@dataclass(frozen=True)
class SymbolRow:
    """One stock over a day (snapshot) or a period (range)."""

    symbol: str
    sector: str
    close: float | None
    pct_change: float | None  # day % change, or period % change
    volume: float
    value: float


def resolve_pct(pct: float | None, close: float | None, prev_close: float | None) -> float | None:
    """NGX sometimes omits PercChange; derive it from the previous close when possible."""
    if pct is not None:
        return pct
    if close is not None and prev_close:
        return (close - prev_close) / prev_close * 100
    return None


def summarize(rows: list[SymbolRow]) -> dict:
    """Totals, breadth, movers and sector aggregates for one snapshot or period."""
    pcts = [r.pct_change for r in rows if r.pct_change is not None]
    gainers = sum(1 for p in pcts if p > 0)
    losers = sum(1 for p in pcts if p < 0)

    by_sector: dict[str, list[SymbolRow]] = defaultdict(list)
    for r in rows:
        by_sector[r.sector or "Unknown"].append(r)
    sectors: list[dict[str, Any]] = [
        {
            "sector": name,
            "avg_pct_change": round(fmean(p), 2)
            if (p := [r.pct_change for r in rs if r.pct_change is not None])
            else None,
            "total_value": sum(r.value for r in rs),
            "total_volume": sum(r.volume for r in rs),
            "stock_count": len(rs),
        }
        for name, rs in by_sector.items()
    ]
    sectors.sort(key=lambda s: -s["total_value"])
    ranked = [s for s in sectors if s["avg_pct_change"] is not None]

    def top(key: str, n: int = MOVERS_N, reverse: bool = True) -> list[dict]:
        pool = [r for r in rows if getattr(r, key) is not None]
        return [asdict(r) for r in sorted(pool, key=lambda r: getattr(r, key), reverse=reverse)[:n]]

    return {
        "stock_count": len(rows),
        "total_value": sum(r.value for r in rows),
        "total_volume": sum(r.volume for r in rows),
        "breadth": {"gainers": gainers, "losers": losers, "unchanged": len(rows) - gainers - losers},
        "top_sector_by_value": sectors[0]["sector"] if sectors else None,
        "top_sector_by_return": max(ranked, key=lambda s: s["avg_pct_change"])["sector"] if ranked else None,
        "gainers": top("pct_change"),
        "losers": top("pct_change", reverse=False),
        "most_traded": top("volume"),
        "sectors": sectors,
    }


def period_stats(bars: pd.DataFrame) -> dict:
    """Open/high/low/close, change and totals across bars (columns: open, high, low, close, volume, value, trades)."""
    if bars.empty:
        return {}
    first_open = bars["open"].dropna()
    last_close = bars["close"].dropna()
    p_open = float(first_open.iloc[0]) if not first_open.empty else None
    p_close = float(last_close.iloc[-1]) if not last_close.empty else None
    change = p_close - p_open if p_open is not None and p_close is not None else None
    trades = bars["trades"].dropna()
    return {
        "days": len(bars),
        "open": p_open,
        "close": p_close,
        "high": float(bars["high"].max()) if bars["high"].notna().any() else None,
        "low": float(bars["low"].min()) if bars["low"].notna().any() else None,
        "change": change,
        "pct_change": change / p_open * 100 if change is not None and p_open else None,
        "volume": float(bars["volume"].sum()),
        "value": float(bars["value"].sum()),
        "trades": int(trades.sum()) if not trades.empty else None,
    }
