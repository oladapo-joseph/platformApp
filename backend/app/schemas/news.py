"""News responses (ADR-014). Article text is never returned in full: a ≤ 200-char snippet only."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Scope = Literal["company", "multi_company", "sector", "market", "macro"]
ContentType = Literal["news", "analysis", "opinion", "press_release", "disclosure"]
Topic = Literal[
    "earnings",
    "dividend",
    "corporate_action",
    "capital_raising",
    "mergers_acquisitions",
    "governance",
    "listing_trading",
    "regulation",
    "monetary_policy",
    "fx",
    "macro",
    "energy",
    "market_wrap",
    "legal",
    "outlook",
]


class Article(BaseModel):
    id: str
    title: str
    url: str
    source: str
    published_at: datetime
    published_at_estimated: bool = Field(description="True when the source gave no date (crawl time used)")
    snippet: str
    symbols: list[str]
    primary_symbol: str | None
    match: Literal["title", "body", "query"] | None = Field(
        None,
        description="How the requested stock appears: in the headline, the body, or only via the search "
        "query (weakest evidence). Set on per-stock lists only.",
    )
    topics: list[str]
    scope: str | None
    content_type: str | None
    sectors: list[str]
    source_tier: int | None
    importance: float | None


class StockNews(BaseModel):
    symbol: str
    mentions: list[Article] = Field(description="Articles tagged with this stock")
    sector: list[Article] = Field(description="Recent sector stories that don't mention it")


class MarkerHeadline(BaseModel):
    id: str
    title: str
    source: str
    url: str


class MarkerDay(BaseModel):
    date: date
    count: int
    headlines: list[MarkerHeadline] = Field(description="Up to 3, most important first")


class NewsMarkers(BaseModel):
    symbol: str
    start: date
    end: date
    days: list[MarkerDay]


class FacetCount(BaseModel):
    value: str
    count: int


class NewsPage(BaseModel):
    items: list[Article]
    next_cursor: str | None
    facets: dict[str, list[FacetCount]] | None = Field(
        description="Counts per filter value (first page only). Each filter's counts apply every other filter "
        "but not its own, so they show what picking another value would add"
    )
    total: int | None = Field(None, description="Articles matching every filter (first page only)")
