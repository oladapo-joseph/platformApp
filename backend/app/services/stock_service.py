"""
One stock: directory, profile, bars, indicators, signals, peers.

Indicators and signals always run on the symbol's full history and are then
sliced to [start, end], so the requested range never starts in a warm-up gap
and a strategy's signals don't depend on the range picked (fixes C1).
"""

import re
from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.cache import ttl_cache
from app.core.errors import BadRequest, NotFound
from app.domain import indicators as ind
from app.domain.market import period_stats, resolve_pct
from app.domain.signals import STRATEGIES, Strategy
from app.domain.similarity import PeerInput, SortKey, find_similar
from app.repositories import get_repos

SYMBOL_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,19}$")
_EMPTY_BARS = pd.DataFrame(
    columns=["open", "high", "low", "close", "prev_close", "change", "pct_change", "volume", "value", "trades"]
)


def normalize_symbol(raw: str) -> str:
    symbol = raw.strip().upper()
    if not SYMBOL_RE.match(symbol):
        raise BadRequest("Symbols are letters and digits, e.g. MTNN.", "invalid-symbol")
    return symbol


@ttl_cache(seconds=3600, maxsize=1)
def directory() -> list[dict[str, Any]]:
    rows = get_repos().industry.directory()
    return sorted(
        (
            {k: r[k] or ("—" if k == "subsector" else "") for k in ("symbol", "company", "sector", "subsector")}
            for r in rows
        ),
        key=lambda r: r["symbol"],
    )


def company_names() -> dict[str, str]:
    return {r["symbol"]: r["company"] for r in directory() if r["company"]}


@ttl_cache(seconds=300, maxsize=128)
def history(symbol: str) -> pd.DataFrame:
    """Full daily history, DatetimeIndex (trade date), oldest first. Shared: do not mutate."""
    bars = get_repos().bars.symbol_bars(symbol)
    if not bars:
        return _EMPTY_BARS
    df = pd.DataFrame(bars)
    df.index = pd.DatetimeIndex(pd.to_datetime(df.pop("trade_date")), name="date")
    df = df[~df.index.duplicated(keep="last")].sort_index()
    df["pct_change"] = [
        resolve_pct(p, c, pc)
        for p, c, pc in zip(_opt(df["pct_change"]), _opt(df["close"]), _opt(df["prev_close"]), strict=True)
    ]
    return df


def _opt(s: pd.Series) -> list[float | None]:
    return [None if pd.isna(v) else float(v) for v in s]


def require_history(symbol: str) -> pd.DataFrame:
    df = history(symbol)
    if df.empty:
        raise NotFound(f"No price history for {symbol}.", "unknown-symbol")
    return df


def _slice(df: pd.DataFrame, start: date | None, end: date | None) -> pd.DataFrame:
    if start and end and start > end:
        raise BadRequest("`start` must be on or before `end`.", "invalid-range")
    lo = pd.Timestamp(start) if start else None
    hi = pd.Timestamp(end) if end else None
    return df.loc[lo:hi]


def _nullable(values: pd.Series) -> list[float | None]:
    return [None if pd.isna(v) else round(float(v), 6) for v in values]


def bars(symbol: str, start: date | None, end: date | None) -> dict[str, Any]:
    df = _slice(require_history(symbol), start, end)
    rows = [
        {"date": ts.date(), **{c: (None if pd.isna(v) else float(v)) for c, v in rec.items()}}
        for ts, rec in zip(df.index, df[_EMPTY_BARS.columns].to_dict("records"), strict=True)
    ]
    return {
        "symbol": symbol,
        "start": start,
        "end": end,
        "bars": rows,
        "stats": period_stats(df) if not df.empty else None,
    }


@ttl_cache(seconds=300, maxsize=256)
def indicators(symbol: str, raw_set: str, start: date | None, end: date | None) -> dict[str, Any]:
    try:
        specs = ind.parse_set(raw_set)
    except ValueError as exc:
        raise BadRequest(str(exc), "invalid-indicator") from exc
    if not specs:
        raise BadRequest("Ask for at least one indicator, e.g. set=sma50,rsi14.", "invalid-indicator")
    full = require_history(symbol)
    close = full["close"].astype(float)
    keep = _slice(full, start, end).index
    series = []
    for spec in specs:
        frame = ind.compute(close, spec).loc[keep]
        series.append(
            {
                "key": spec.key,
                "kind": spec.kind,
                "window": spec.window,
                "values": {col: _nullable(frame[col]) for col in frame.columns},
            }
        )
    return {"symbol": symbol, "start": start, "end": end, "dates": [ts.date() for ts in keep], "indicators": series}


def strategy_info(s: Strategy) -> dict[str, Any]:
    return {"slug": s.slug, "label": s.label, "description": s.description, "warmup_days": s.warmup_days}


@ttl_cache(seconds=300, maxsize=256)
def signals(symbol: str, strategy: str, start: date | None, end: date | None) -> dict[str, Any]:
    strat = STRATEGIES.get(strategy)
    if strat is None:
        raise BadRequest(f"Unknown strategy. Use one of: {', '.join(STRATEGIES)}.", "invalid-strategy")
    full = require_history(symbol)
    if start and end and start > end:
        raise BadRequest("`start` must be on or before `end`.", "invalid-range")
    close = full["close"].astype(float)
    events = [
        e
        for e in strat.run(close)
        if (start is None or e.date.date() >= start) and (end is None or e.date.date() <= end)
    ]
    history_days = int(close.notna().sum())
    return {
        "symbol": symbol,
        "strategy": strategy_info(strat),
        "start": start,
        "end": end,
        "signals": [{"date": e.date.date(), "side": e.side, "price": e.price} for e in events],
        "history_days": history_days,
        "enough_history": history_days > strat.warmup_days,
    }


@ttl_cache(seconds=300, maxsize=256)
def profile(symbol: str) -> dict[str, Any]:
    repos = get_repos()
    info = repos.industry.profile(symbol)
    latest = repos.bars.latest_trade_date()
    quote = None
    if latest:
        since = (date.fromisoformat(latest) - timedelta(days=14)).isoformat()
        recent = repos.bars.symbol_bars(symbol, since, latest)
        if recent:
            b = recent[-1]
            quote = {
                **{
                    k: b[k]
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
                "pct_change": resolve_pct(b["pct_change"], b["close"], b["prev_close"]),
                "company": info["company"] if info else None,
            }
            latest = b["trade_date"]
    if info is None and quote is None:
        raise NotFound(f"Unknown symbol {symbol}.", "unknown-symbol")
    base = info or {
        "symbol": symbol,
        "company": symbol,
        "sector": (quote or {}).get("sector") or "",
        "subsector": "",
        "shares_outstanding": None,
        "website": None,
        "logo_url": None,
        "summary": None,
        "nature_of_business": None,
        "date_listed": None,
        "market_classification": None,
    }
    shares, close = base.get("shares_outstanding"), (quote or {}).get("close")
    return {
        **{k: v for k, v in base.items() if k != "similarsector"},
        "subsector": base.get("subsector") or "—",
        "market_cap": shares * close if shares and close else None,
        "latest_trade_date": latest if quote else None,
        "quote": quote,
    }


@ttl_cache(seconds=600, maxsize=128)
def similar(symbol: str, start: date, end: date, sort: SortKey, n: int) -> dict[str, Any]:
    from app.services.market_service import range_summary  # market_service imports this module

    stocks = range_summary(start, end)["stocks"]
    meta = {r["symbol"]: r for r in get_repos().industry.directory()}
    universe = []
    for s in stocks:
        m = meta.get(s["symbol"], {})
        shares = m.get("shares_outstanding")
        universe.append(
            PeerInput(
                symbol=s["symbol"],
                company=m.get("company") or s["symbol"],
                sector=(m.get("sector") or s.get("sector") or "").upper(),
                subsector=m.get("subsector") or "—",
                market_cap=shares * s["close"] if shares and s["close"] else 0.0,
                traded_value=s["value"],
                volume=s["volume"],
                similarsector=m.get("similarsector") or {},
            )
        )
    if not any(p.symbol == symbol for p in universe):
        raise NotFound(f"{symbol} has no trading data in that range.", "no-market-data")
    peers = find_similar(symbol, universe, sort, n)
    return {
        "symbol": symbol,
        "start": start,
        "end": end,
        "sort": sort,
        "peers": [
            {
                "symbol": p.symbol,
                "company": p.company,
                "sector": p.sector,
                "subsector": p.subsector,
                "market_cap": p.market_cap,
                "traded_value": p.traded_value,
                "volume": p.volume,
                "scores": p.scores,
            }
            for p in peers
        ],
    }
