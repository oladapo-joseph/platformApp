"""
Buy/sell signal strategies: pure pandas (ported from streamlitApp/analysis/signals.py).

Each strategy takes the full close-price history (DatetimeIndex) and returns
crossover events. The caller slices to the requested range afterwards, so a
crossover's look-back always has real data (C1).
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

import pandas as pd

from app.domain.indicators import macd, rsi, sma

Side = Literal["buy", "sell"]


@dataclass(frozen=True)
class Signal:
    date: pd.Timestamp
    side: Side
    price: float


def _events(close: pd.Series, buy: pd.Series, sell: pd.Series) -> list[Signal]:
    valid = close.notna()
    events = [Signal(d, "buy", float(close[d])) for d in close.index[buy & valid]]
    events += [Signal(d, "sell", float(close[d])) for d in close.index[sell & valid]]
    return sorted(events, key=lambda s: s.date)


def _cross_up(a: pd.Series, b: pd.Series | float) -> pd.Series:
    prev_b = b.shift(1) if isinstance(b, pd.Series) else b
    return (a > b) & (a.shift(1) <= prev_b)


def _cross_down(a: pd.Series, b: pd.Series | float) -> pd.Series:
    prev_b = b.shift(1) if isinstance(b, pd.Series) else b
    return (a < b) & (a.shift(1) >= prev_b)


def macd_crossover(close: pd.Series) -> list[Signal]:
    """Buy when MACD crosses above its signal line; sell when it crosses below."""
    m = macd(close)
    return _events(close, _cross_up(m["macd"], m["signal"]), _cross_down(m["macd"], m["signal"]))


def rsi_reversal(close: pd.Series, window: int = 14, oversold: float = 30, overbought: float = 70) -> list[Signal]:
    """Buy when RSI climbs back above oversold; sell when it drops back below overbought."""
    r = rsi(close, window)
    return _events(close, _cross_up(r, oversold), _cross_down(r, overbought))


def sma_golden_cross(close: pd.Series, short: int = 50, long: int = 200) -> list[Signal]:
    """Golden cross (SMA50 above SMA200) buys; death cross sells."""
    s, lg = sma(close, short), sma(close, long)
    return _events(close, _cross_up(s, lg), _cross_down(s, lg))


@dataclass(frozen=True)
class Strategy:
    slug: str
    label: str
    description: str
    run: Callable[[pd.Series], list[Signal]]
    # history a signal needs before it can fire (for "not enough data" messages)
    warmup_days: int


STRATEGIES: dict[str, Strategy] = {
    s.slug: s
    for s in (
        Strategy(
            "macd_crossover", "MACD Crossover", "MACD (12, 26) crosses its 9-day signal line.", macd_crossover, 35
        ),
        Strategy(
            "rsi_reversal",
            "RSI Reversal",
            "RSI (14) recovers from below 30 or falls back from above 70.",
            rsi_reversal,
            15,
        ),
        Strategy("sma_golden_cross", "SMA Golden Cross", "50-day SMA crosses the 200-day SMA.", sma_golden_cross, 200),
    )
}
DEFAULT_STRATEGY = "macd_crossover"
