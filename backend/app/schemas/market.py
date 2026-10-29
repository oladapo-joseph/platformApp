"""Market responses. Money is raw NGN; datetimes are ISO-8601 in WAT; trade dates are YYYY-MM-DD."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class MarketStatus(BaseModel):
    latest_trade_date: date | None
    data_as_of: datetime | None = Field(description="When the newest data was crawled (WAT)")
    data_age_minutes: int | None
    is_trading_hours: bool = Field(description="Mon–Fri 10:00–14:30 WAT (public holidays not known)")
    timezone: str = "Africa/Lagos"


class Quote(BaseModel):
    symbol: str
    company: str | None = None
    sector: str | None
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


class Mover(BaseModel):
    symbol: str
    sector: str
    close: float | None
    pct_change: float | None
    volume: float
    value: float


class Breadth(BaseModel):
    gainers: int
    losers: int
    unchanged: int


class SectorAggregate(BaseModel):
    sector: str
    avg_pct_change: float | None
    total_value: float
    total_volume: float
    stock_count: int


class MarketSummary(BaseModel):
    stock_count: int
    total_value: float
    total_volume: float
    breadth: Breadth
    top_sector_by_value: str | None
    top_sector_by_return: str | None
    gainers: list[Mover]
    losers: list[Mover]
    most_traded: list[Mover]
    sectors: list[SectorAggregate]


class SessionTotals(BaseModel):
    trade_date: date
    total_value: float
    total_volume: float
    total_trades: float
    stock_count: int
    breadth: Breadth


class MarketHistory(BaseModel):
    sessions: list[SessionTotals] = Field(description="Oldest first, ending with the latest session")


class Snapshot(BaseModel):
    trade_date: date
    data_as_of: datetime | None
    summary: MarketSummary
    stocks: list[Quote]


class RangeRow(BaseModel):
    symbol: str
    company: str | None = None
    sector: str | None
    open: float | None = Field(description="Open on the first trading day in the range")
    close: float | None = Field(description="Close on the last trading day in the range")
    high: float | None
    low: float | None
    change: float | None
    pct_change: float | None
    volume: float
    value: float
    days: int = Field(description="Trading days with data in the range")


class RangeSummary(BaseModel):
    start: date
    end: date
    summary: MarketSummary
    stocks: list[RangeRow]


class SectorsResponse(BaseModel):
    start: date
    end: date
    sectors: list[SectorAggregate]
