"""First-party usage analytics (US-7.8): what people use and how they move through the app."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

PropValue = str | int | float | bool
Device = Literal["mobile", "tablet", "desktop"]


class EventIn(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_.]{1,47}$", description="page_view, or a feature like watchlist.add")
    path: str = Field(
        max_length=120, pattern=r"^/[A-Za-z0-9/:_\-]*$", description="Route template: /app/stocks/:symbol"
    )
    prev: str | None = Field(
        None, max_length=120, pattern=r"^/[A-Za-z0-9/:_\-]*$", description="page_view: the page before"
    )
    prev_ms: int | None = Field(None, ge=0, le=6 * 3600 * 1000, description="page_view: time spent on `prev`")
    props: dict[str, PropValue] = Field(default_factory=dict, max_length=8)
    at: datetime


class EventBatch(BaseModel):
    session: str = Field(pattern=r"^[A-Za-z0-9_-]{8,40}$", description="Random per browser tab session")
    device: Device
    events: list[EventIn] = Field(min_length=1, max_length=50)


class Count(BaseModel):
    key: str
    count: int
    users: int


class PageStat(BaseModel):
    path: str
    views: int
    users: int
    avg_seconds: float | None = Field(description="Mean time on the page, from the next page view")


class Transition(BaseModel):
    source: str
    target: str
    count: int


class Journey(BaseModel):
    steps: list[str]
    sessions: int


class UsageDay(BaseModel):
    day: date
    users: int
    sessions: int
    page_views: int


class Usage(BaseModel):
    days: int
    users: int
    sessions: int
    page_views: int
    pages_per_session: float | None
    daily: list[UsageDay]
    pages: list[PageStat]
    features: list[Count] = Field(description="Feature events (everything but page views), most used first")
    entries: list[Count] = Field(description="First page of a session")
    transitions: list[Transition] = Field(description="Most common page-to-page moves")
    journeys: list[Journey] = Field(description="Most common first three pages of a session")
    devices: list[Count]
