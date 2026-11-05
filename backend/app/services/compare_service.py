"""
Compare stocks (US-3.10): up to 4 stocks over one period, rebased to 0% on the first day they
all have a price, with optional benchmarks: the average of each one's sector and of the whole
market (equal weight; NGX's All-Share Index isn't in the data yet, US-2.8). Alongside the lines:
returns, risk, trading activity, valuation, indicators, each strategy's latest signal and how
closely the stocks' daily moves line up.
"""

import math
from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.cache import ttl_cache
from app.core.errors import BadRequest, NotFound
from app.domain import indicators as ind
from app.repositories import get_repos
from app.services import market_service
from app.services.panel_service import latest_signals, panel, window
from app.services.stock_service import normalize_symbol

MAX_SYMBOLS = 4
BENCHMARKS = ("sector", "market")
MIN_OVERLAP = 10  # sessions both stocks traded before their correlation means anything
BAD_RETURN = 0.5  # NGX caps a day's move at ±10%; beyond ±50% in an average is a data error
TRADING_DAYS = 252


def parse_symbols(raw: str) -> tuple[str, ...]:
    symbols = tuple(dict.fromkeys(normalize_symbol(s) for s in raw.split(",") if s.strip()))
    if not 1 <= len(symbols) <= MAX_SYMBOLS:
        raise BadRequest(f"Compare 1 to {MAX_SYMBOLS} stocks, e.g. symbols=GTCO,ZENITHBANK.", "invalid-symbols")
    return symbols


def parse_benchmarks(raw: str) -> tuple[str, ...]:
    picked = tuple(dict.fromkeys(b.strip().lower() for b in raw.split(",") if b.strip()))
    if any(b not in BENCHMARKS for b in picked):
        raise BadRequest(f"Benchmarks are {', '.join(BENCHMARKS)}.", "invalid-benchmark")
    return picked


def _r(v: Any, digits: int = 2) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if math.isnan(f) or math.isinf(f) else round(f, digits)


def _pct_series(index: pd.Series) -> list[float | None]:
    return [_r((v - 1) * 100) for v in index]


def _risk(level: pd.Series) -> dict[str, float | None]:
    """Return, annualised volatility and deepest fall of a price or index level series."""
    level = level.dropna()
    if len(level) < 2:
        return {"return_pct": None, "volatility_pct": None, "max_drawdown_pct": None}
    returns = level.pct_change().dropna()
    return {
        "return_pct": _r((level.iloc[-1] / level.iloc[0] - 1) * 100),
        "volatility_pct": _r(returns.std() * math.sqrt(TRADING_DAYS) * 100) if len(returns) > 1 else None,
        "max_drawdown_pct": _r((level / level.cummax() - 1).min() * 100),
    }


def _average(closes: pd.DataFrame) -> pd.Series:
    """Equal-weight index (1.0 on the first day) of the stocks in `closes`, from their daily returns."""
    returns = closes.ffill().pct_change(fill_method=None)
    returns = returns.where(returns.abs() <= BAD_RETURN)
    daily = returns.mean(axis=1, skipna=True).fillna(0.0)
    daily.iloc[0] = 0.0
    return (1 + daily).cumprod()


def _extreme(prices: pd.Series, closes: pd.Series, how: str) -> float | None:
    """The day highs' max (or lows' min), else the closes' when the feed had no highs or lows."""
    for s in (prices.dropna(), closes.dropna()):
        if len(s):
            return float(s.max() if how == "max" else s.min())
    return None


def _day_move(returns: pd.Series, best: bool) -> dict[str, Any] | None:
    if returns.empty:
        return None
    i = int(returns.to_numpy().argmax() if best else returns.to_numpy().argmin())
    return {"date": pd.Timestamp(returns.index[i]).date(), "pct": _r(returns.iloc[i] * 100)}


def _stock(sym: str, frame: pd.Series, p: Any, start: pd.Timestamp, end: date, meta: dict[str, Any]) -> dict:
    span = slice(start, pd.Timestamp(end))
    level = frame.dropna()
    returns = level.pct_change().dropna()
    volume = p.volume[sym].loc[span]
    value = p.value[sym].loc[span]
    highs, lows = p.high[sym].loc[span], p.low[sym].loc[span]
    history = p.close[sym].loc[: pd.Timestamp(end)].dropna()  # indicators use everything up to the end
    year = slice(pd.Timestamp(end - timedelta(days=365)), pd.Timestamp(end))
    last = float(level.iloc[-1])
    sma50, sma200 = ind.sma(history, 50).iloc[-1], ind.sma(history, 200).iloc[-1]
    shares = meta.get("shares_outstanding")
    return {
        "symbol": sym,
        "company": meta.get("company") or sym,
        "sector": meta.get("sector") or None,
        "subsector": meta.get("subsector") or None,
        "first_close": _r(level.iloc[0]),
        "last_close": _r(last),
        **_risk(level),
        "high": _r(_extreme(highs, level, "max")),
        "low": _r(_extreme(lows, level, "min")),
        "up_days": int((returns > 0).sum()),
        "down_days": int((returns < 0).sum()),
        "flat_days": int((returns == 0).sum()),
        "best_day": _day_move(returns, best=True),
        "worst_day": _day_move(returns, best=False),
        "days_traded": int((volume.fillna(0) > 0).sum()),
        "total_value": _r(value.fillna(0).sum(), 0),
        "avg_daily_value": _r(value.fillna(0).mean(), 0) if len(value) else None,
        "total_volume": _r(volume.fillna(0).sum(), 0),
        "market_cap": _r(shares * last, 0) if shares else None,
        "high_52w": _r(_extreme(p.high[sym].loc[year], history.loc[year], "max")),
        "low_52w": _r(_extreme(p.low[sym].loc[year], history.loc[year], "min")),
        "rsi14": _r(ind.rsi(history, 14).iloc[-1], 1) if len(history) > 14 else None,
        "pct_vs_sma50": _r((last / sma50 - 1) * 100) if not pd.isna(sma50) else None,
        "pct_vs_sma200": _r((last / sma200 - 1) * 100) if not pd.isna(sma200) else None,
        "signals": latest_signals(history),
    }


def _correlations(raw: pd.DataFrame, symbols: tuple[str, ...]) -> list[dict[str, Any]]:
    """Daily-return correlation for each pair, on the sessions both traded."""
    returns = raw.pct_change(fill_method=None)
    out = []
    for i, a in enumerate(symbols):
        for b in symbols[i + 1 :]:
            both = returns[[a, b]].dropna()
            value = both[a].corr(both[b]) if len(both) >= MIN_OVERLAP else None
            out.append({"a": a, "b": b, "value": _r(value), "sessions": len(both)})
    return out


@ttl_cache(seconds=300, maxsize=64)
def compare(symbols: tuple[str, ...], start: date, end: date, benchmarks: tuple[str, ...]) -> dict[str, Any]:
    market_service.check_range(start, end)
    latest = market_service.resolve_trade_date(None)
    p = panel(latest)
    missing = [s for s in symbols if s not in p.close.columns]
    if missing:
        raise NotFound(f"No price history for {', '.join(missing)}.", "unknown-symbol")
    closes = window(p.close, start, end)
    raw = closes[list(symbols)].dropna(how="all")
    filled = raw.ffill().dropna()  # from the first day every stock has a price
    if len(filled) < 2:
        raise NotFound("These stocks don't share two trading days in that period.", "no-market-data")
    first, last_day = filled.index[0], filled.index[-1]
    dates = filled.index

    directory = {r["symbol"]: r for r in get_repos().industry.directory()}
    series = [
        {
            "key": s,
            "kind": "stock",
            "symbol": s,
            "sector": directory.get(s, {}).get("sector") or None,
            "members": 1,
            "values": _pct_series(filled[s] / filled[s].iloc[0]),
        }
        for s in symbols
    ]
    bench: list[dict[str, Any]] = []
    universe = closes.loc[first:last_day]
    if "sector" in benchmarks:
        for sector in dict.fromkeys(directory.get(s, {}).get("sector") for s in symbols):
            if not sector:
                continue
            members = [c for c in universe.columns if directory.get(c, {}).get("sector") == sector]
            bench.append(
                {
                    "key": f"sector:{sector}",
                    "kind": "sector",
                    "symbol": None,
                    "sector": sector,
                    "members": len(members),
                    "level": _average(universe[members]).reindex(dates).ffill(),
                }
            )
    if "market" in benchmarks:
        bench.append(
            {
                "key": "market",
                "kind": "market",
                "symbol": None,
                "sector": None,
                "members": len(universe.columns),
                "level": _average(universe).reindex(dates).ffill(),
            }
        )

    stocks = [_stock(s, filled[s], p, first, last_day.date(), directory.get(s, {})) for s in symbols]
    return {
        "start": start,
        "end": end,
        "from_date": first.date(),
        "to_date": last_day.date(),
        "dates": [d.date() for d in dates],
        "series": series
        + [{**{k: v for k, v in b.items() if k != "level"}, "values": _pct_series(b["level"])} for b in bench],
        "stocks": stocks,
        "benchmarks": [
            {"key": b["key"], "kind": b["kind"], "sector": b["sector"], "members": b["members"], **_risk(b["level"])}
            for b in bench
        ],
        "correlations": _correlations(raw.loc[first:], symbols),
    }
