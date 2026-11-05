"""The Stocks page (screener and digest cards) and Compare. Money is raw NGN; trade dates are YYYY-MM-DD."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.insights import AiQuota, Headline


class LatestSignal(BaseModel):
    strategy: str = Field(description="Strategy slug (GET /strategies)")
    side: Literal["buy", "sell"]
    date: date
    price: float


class ScreenRow(BaseModel):
    symbol: str
    company: str | None
    sector: str | None
    subsector: str | None
    close: float | None
    change: float | None
    pct_change: float | None = Field(description="The session's % change, or the period's")
    volume: float | None
    value: float | None
    trades: float | None = Field(description="Deals in the session; null for a period")
    days: int | None = Field(description="Trading days in the period; null for a session")
    market_cap: float | None = Field(description="Shares outstanding × close")
    high_52w: float | None
    low_52w: float | None
    signals: list[LatestSignal] = Field(description="Each strategy's most recent signal, up to the latest session")
    spark: list[float] = Field(description="Up to 40 closes across the period (a session: the last 30 days)")


class ScreenResponse(BaseModel):
    start: date | None = Field(description="Null for the latest session")
    end: date | None
    trade_date: date = Field(description="The latest trading day")
    data_as_of: datetime | None
    stocks: list[ScreenRow]


class CompareSeries(BaseModel):
    key: str = Field(description="The symbol, `sector:<SECTOR>` or `market`")
    kind: Literal["stock", "sector", "market"]
    symbol: str | None
    sector: str | None
    members: int = Field(description="Stocks in an average (1 for a stock)")
    values: list[float | None] = Field(description="% change from `from_date`, aligned with `dates`")


class DayMove(BaseModel):
    date: date
    pct: float | None


class CompareStock(BaseModel):
    symbol: str
    company: str
    sector: str | None
    subsector: str | None
    first_close: float | None
    last_close: float | None
    return_pct: float | None
    volatility_pct: float | None = Field(description="Annualised standard deviation of daily returns")
    max_drawdown_pct: float | None = Field(description="Deepest fall from a high within the period")
    high: float | None
    low: float | None
    up_days: int
    down_days: int
    flat_days: int
    best_day: DayMove | None
    worst_day: DayMove | None
    days_traded: int
    total_value: float | None
    avg_daily_value: float | None
    total_volume: float | None
    market_cap: float | None
    high_52w: float | None
    low_52w: float | None
    rsi14: float | None
    pct_vs_sma50: float | None
    pct_vs_sma200: float | None
    signals: list[LatestSignal] = Field(description="Each strategy's most recent signal, up to `to_date`")


class CompareBenchmark(BaseModel):
    key: str
    kind: Literal["sector", "market"]
    sector: str | None
    members: int
    return_pct: float | None
    volatility_pct: float | None
    max_drawdown_pct: float | None


class Correlation(BaseModel):
    a: str
    b: str
    value: float | None = Field(description="Daily-return correlation, −1 to 1; null under 10 shared sessions")
    sessions: int


class CompareResponse(BaseModel):
    start: date
    end: date
    from_date: date = Field(description="First day every stock had a price: the common 0%")
    to_date: date
    dates: list[date]
    series: list[CompareSeries]
    stocks: list[CompareStock]
    benchmarks: list[CompareBenchmark]
    correlations: list[Correlation]


class CompareInsightRequest(BaseModel):
    symbols: list[str] = Field(min_length=2, max_length=4)
    start: date
    end: date


class StockNote(BaseModel):
    symbol: str
    note: str = Field(description="One or two sentences, at most 35 words")


class CompareInsightBody(BaseModel):
    """What the model writes, validated (insight_service checks the limits and the cited sources)."""

    summary: str = Field(description="Plain English, at most 80 words")
    stocks: list[StockNote] = Field(description="One note per stock compared, in the order asked")
    differences: list[str] = Field(description="2–4 short points on what sets them apart")
    caveats: list[str] = Field(description="1–3 short points")
    news_context: str = Field(description="One sentence on the headlines; empty when there were none")
    sources: list[str] = Field(description="IDs of the headlines the overview leans on, from `headlines`")


class CompareInsight(BaseModel):
    symbols: list[str]
    start: date
    end: date
    data_as_of: date
    provider: str
    model: str
    generated_at: datetime
    cached: bool = Field(description="Served from the shared cache (didn't use a reading from the allowance)")
    reading: CompareInsightBody
    headlines: list[Headline] = Field(description="Headlines the model was given (≤ 6)")
    quota: AiQuota
