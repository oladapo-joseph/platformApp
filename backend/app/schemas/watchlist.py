"""Watchlist responses (US-5.1 – US-5.4, US-9.4)."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.news import Article
from app.schemas.stocks import SignalEvent, StrategyInfo

WatchlistPeriod = Literal["1W", "1M", "3M", "YTD"]


class Watchlist(BaseModel):
    symbols: list[str] = Field(description="Oldest added first")
    limit: int = Field(description="Most stocks a watchlist can hold")


class WatchlistRow(BaseModel):
    symbol: str
    company: str | None
    sector: str | None
    trade_date: date | None = Field(description="The stock's latest session: older than `as_of` if it didn't trade")
    close: float | None
    pct_change: float | None = Field(description="Change on `trade_date` vs the session before, %")
    period_pct_change: float | None = Field(description="First open in the period to the latest close, %")
    spark: list[float] = Field(description="Closes across the period, oldest first, at most 60 points")
    signal: SignalEvent | None = Field(description="The strategy's latest signal, on any date")


class WatchlistOverview(BaseModel):
    period: WatchlistPeriod
    start: date | None = Field(description="First day of the period")
    as_of: date | None = Field(description="The market's latest session")
    strategy: StrategyInfo
    stocks: list[WatchlistRow] = Field(description="In watchlist order")


class WatchlistNews(BaseModel):
    symbols: list[str]
    articles: list[Article] = Field(description="Newest first; `symbols` on each says which stocks it mentions")
