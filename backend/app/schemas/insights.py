"""AI signal interpretation (US-4.1 – US-4.5, US-9.5, ADR-006) and AI usage (US-7.5)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Stance = Literal["bullish", "bearish", "neutral"]
Confidence = Literal["low", "medium", "high"]


class InsightRequest(BaseModel):
    strategy: str = Field(max_length=40, description="Signal strategy slug (GET /strategies)")
    start: date | None = Field(None, description="First trade date of the range; omit for full history")
    end: date | None = Field(None, description="Last trade date of the range; omit for the latest")


class KeyLevels(BaseModel):
    support: float | None
    resistance: float | None


class InsightBody(BaseModel):
    """What the model writes, validated (insight_service checks the limits and the cited sources)."""

    stance: Stance
    summary: str = Field(description="Plain English, at most 60 words")
    drivers: list[str] = Field(description="2–4 short points")
    key_levels: KeyLevels
    confidence: Confidence
    caveats: list[str] = Field(description="1–3 short points")
    news_context: str = Field(description="One sentence on the headlines; empty when there were none")
    sources: list[str] = Field(description="IDs of the headlines the reading leans on, from `headlines`")


class Headline(BaseModel):
    id: str
    title: str
    source: str
    url: str
    published_at: datetime | None


class AiQuota(BaseModel):
    limit: int
    used: int
    remaining: int
    resets_at: datetime = Field(description="Next midnight WAT")


class Insight(BaseModel):
    symbol: str
    strategy: str
    strategy_label: str
    start: date | None
    end: date | None
    data_as_of: date = Field(description="The last trading day the reading is based on")
    provider: str
    model: str
    generated_at: datetime
    cached: bool = Field(description="Served from the shared cache (didn't use a reading from the allowance)")
    reading: InsightBody
    headlines: list[Headline] = Field(description="Headlines the model was given (≤ 5)")
    quota: AiQuota


class AiStatus(BaseModel):
    enabled: bool
    provider: str | None
    model: str | None
    quota: AiQuota | None


class AiDay(BaseModel):
    day: date
    generated: int
    cached: int
    failed: int


class AiUser(BaseModel):
    user_id: str
    name: str | None
    email: str | None
    generated: int
    cached: int


class AiModelUse(BaseModel):
    provider: str
    model: str
    readings: int
    tokens_in: int
    tokens_out: int
    est_cost_usd: float | None = Field(description="From list prices; null for a model without a known price")


class AiUsage(BaseModel):
    days: int
    enabled: bool
    provider: str | None
    model: str | None
    generated: int
    cached: int
    failed: int
    quota_hits: int = Field(description="Requests refused because the person had used today's allowance")
    hit_rate: float | None = Field(description="Share of readings served from the cache, 0–1")
    daily: list[AiDay]
    top_users: list[AiUser]
    models: list[AiModelUse]
