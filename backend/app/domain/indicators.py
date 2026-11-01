"""
Technical indicators: pure pandas, no I/O (ported from the Streamlit app's data/indicators.py).

Project rules (never change):
  EMA: ewm(span=window, adjust=False)
  RSI: Wilder smoothing, ewm(com=window-1, adjust=False)
Always compute on the full history, then slice to the requested range, so the
warm-up period never shows as NaN inside the range (fixes C1's short-range gaps).
"""

import re
from dataclasses import dataclass

import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window=window).mean()


def ema(series: pd.Series, window: int) -> pd.Series:
    return series.ewm(span=window, adjust=False).mean()


def rsi(series: pd.Series, window: int) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0).ewm(com=window - 1, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(com=window - 1, adjust=False).mean()
    return 100 - (100 / (1 + gain / loss))


def macd(series: pd.Series, short: int = 12, long: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(series, short) - ema(series, long)
    sig = ema(line, signal)
    return pd.DataFrame({"macd": line, "signal": sig, "histogram": line - sig})


def bollinger(series: pd.Series, window: int = 20, k: float = 2.0) -> pd.DataFrame:
    """Middle = SMA; bands = ±k population standard deviations (ddof=0, as most charting tools)."""
    mid = sma(series, window)
    std = series.rolling(window=window).std(ddof=0)
    return pd.DataFrame({"middle": mid, "upper": mid + k * std, "lower": mid - k * std})


# ── Indicator set parsing: "sma50,ema12,rsi14,macd,bb20" ──────────────────────

MIN_WINDOW, MAX_WINDOW = 2, 400
_TOKEN = re.compile(r"^(sma|ema|rsi|bb)(\d{1,3})$|^macd$")


@dataclass(frozen=True)
class IndicatorSpec:
    kind: str  # sma | ema | rsi | bb | macd
    window: int | None  # None for macd (12/26/9)

    @property
    def key(self) -> str:
        return self.kind if self.window is None else f"{self.kind}{self.window}"


def parse_set(raw: str) -> list[IndicatorSpec]:
    """Parse a comma list into unique specs, in order. Raises ValueError on a bad token."""
    specs: list[IndicatorSpec] = []
    for token in (t.strip().lower() for t in raw.split(",")):
        if not token:
            continue
        m = _TOKEN.match(token)
        if not m:
            raise ValueError(f"unknown indicator '{token}'")
        spec = IndicatorSpec("macd", None) if token == "macd" else IndicatorSpec(m.group(1), int(m.group(2)))
        if spec.window is not None and not MIN_WINDOW <= spec.window <= MAX_WINDOW:
            raise ValueError(f"window for '{token}' must be {MIN_WINDOW}-{MAX_WINDOW}")
        if spec not in specs:
            specs.append(spec)
    return specs


def compute(close: pd.Series, spec: IndicatorSpec) -> pd.DataFrame:
    """One indicator as a DataFrame with named columns, indexed like `close`."""
    if spec.kind == "macd":
        return macd(close)
    assert spec.window is not None
    if spec.kind == "bb":
        return bollinger(close, spec.window)
    fn = {"sma": sma, "ema": ema, "rsi": rsi}[spec.kind]
    return pd.DataFrame({"value": fn(close, spec.window)})
