"""Stock responses: directory, profile, bars, indicators, signals, peers."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.market import Quote


class DirectoryEntry(BaseModel):
    symbol: str
    company: str
    sector: str
    subsector: str


class StockProfile(BaseModel):
    symbol: str
    company: str
    sector: str
    subsector: str
    shares_outstanding: float | None
    market_cap: float | None = Field(description="Shares outstanding × latest close")
    website: str | None
    logo_url: str | None
    summary: str | None
    nature_of_business: str | None
    date_listed: str | None
    market_classification: str | None
    latest_trade_date: date | None
    quote: Quote | None


class Bar(BaseModel):
    date: date
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    prev_close: float | None
    change: float | None
    pct_change: float | None
    volume: float | None
    value: float | None
    trades: float | None


class PeriodStats(BaseModel):
    days: int
    open: float | None
    close: float | None
    high: float | None
    low: float | None
    change: float | None
    pct_change: float | None
    volume: float
    value: float
    trades: int | None


class BarsResponse(BaseModel):
    symbol: str
    start: date | None
    end: date | None
    bars: list[Bar]
    stats: PeriodStats | None


class IndicatorSeries(BaseModel):
    key: str = Field(examples=["sma50", "macd", "bb20"])
    kind: Literal["sma", "ema", "rsi", "macd", "bb"]
    window: int | None
    values: dict[str, list[float | None]] = Field(
        description="Column → values aligned with `dates`: value (sma/ema/rsi); macd, signal, histogram; "
        "middle, upper, lower (bb)"
    )


class IndicatorsResponse(BaseModel):
    symbol: str
    start: date | None
    end: date | None
    dates: list[date]
    indicators: list[IndicatorSeries]


class StrategyInfo(BaseModel):
    slug: str
    label: str
    description: str
    warmup_days: int


class SignalEvent(BaseModel):
    date: date
    side: Literal["buy", "sell"]
    price: float


class SignalsResponse(BaseModel):
    symbol: str
    strategy: StrategyInfo
    start: date | None
    end: date | None
    signals: list[SignalEvent]
    history_days: int = Field(description="Trading days of history the strategy ran on")
    enough_history: bool


class PeerScores(BaseModel):
    overall: int
    industry: int
    market_cap: int
    traded_value: int
    volume: int


class PeerEntry(BaseModel):
    symbol: str
    company: str
    sector: str
    subsector: str
    market_cap: float
    traded_value: float
    volume: float
    scores: PeerScores


class SimilarResponse(BaseModel):
    symbol: str
    start: date
    end: date
    sort: str
    peers: list[PeerEntry]
