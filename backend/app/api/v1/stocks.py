from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_user, symbol_path
from app.domain.signals import DEFAULT_STRATEGY, STRATEGIES
from app.schemas.insights import Insight, InsightRequest
from app.schemas.news import NewsMarkers, StockNews
from app.schemas.stocks import (
    BarsResponse,
    DirectoryEntry,
    IndicatorsResponse,
    SignalsResponse,
    SimilarResponse,
    StockProfile,
    StrategyInfo,
)
from app.services import insight_service, news_service, stock_service

router = APIRouter(tags=["stocks"], dependencies=[Depends(require_user)])

Start = Query(None, description="First trade date (inclusive); omit for full history")
End = Query(None, description="Last trade date (inclusive); omit for latest")


@router.get("/strategies", response_model=list[StrategyInfo], summary="Signal strategies")
def strategies() -> list[dict]:
    return [stock_service.strategy_info(s) for s in STRATEGIES.values()]


@router.get("/stocks", response_model=list[DirectoryEntry], summary="Symbol directory (search)")
def directory() -> list[dict]:
    return stock_service.directory()


@router.get("/stocks/{symbol}", response_model=StockProfile, summary="Profile and latest quote")
def profile(symbol: str = Depends(symbol_path)) -> dict:
    return stock_service.profile(symbol)


@router.get("/stocks/{symbol}/bars", response_model=BarsResponse, summary="Daily OHLCV and period stats")
def bars(symbol: str = Depends(symbol_path), start: date | None = Start, end: date | None = End) -> dict:
    return stock_service.bars(symbol, start, end)


@router.get(
    "/stocks/{symbol}/indicators",
    response_model=IndicatorsResponse,
    summary="Indicator series computed on full history, sliced to the range",
)
def indicators(
    symbol: str = Depends(symbol_path),
    indicator_set: str = Query(
        "sma50,ema12,rsi14,macd,bb20", alias="set", description="Comma list: smaN, emaN, rsiN, bbN (N = 2–400), macd"
    ),
    start: date | None = Start,
    end: date | None = End,
) -> dict:
    return stock_service.indicators(symbol, indicator_set.lower(), start, end)


@router.get(
    "/stocks/{symbol}/signals",
    response_model=SignalsResponse,
    summary="Buy/sell events for one strategy (computed on full history, sliced)",
)
def signals(
    symbol: str = Depends(symbol_path),
    strategy: str = DEFAULT_STRATEGY,
    start: date | None = Start,
    end: date | None = End,
) -> dict:
    return stock_service.signals(symbol, strategy, start, end)


@router.get("/stocks/{symbol}/similar", response_model=SimilarResponse, summary="Peers with component scores")
def similar(
    symbol: str = Depends(symbol_path),
    start: date = Query(...),
    end: date = Query(...),
    sort: Literal["overall", "industry", "market_cap", "traded_value", "volume"] = "overall",
    limit: int = Query(8, ge=1, le=25),
) -> dict:
    return stock_service.similar(symbol, start, end, sort, limit)


@router.post(
    "/stocks/{symbol}/insights",
    response_model=Insight,
    summary="AI signal interpretation (shared cache; a new reading uses one of today's allowance)",
    responses={
        429: {"description": "Today's allowance is used up (`ai-quota`)"},
        503: {"description": "AI is off (`ai-off`) or the provider failed (`ai-unavailable`)"},
    },
)
def insights(body: InsightRequest, symbol: str = Depends(symbol_path), user: dict = Depends(require_user)) -> dict:
    return insight_service.explain(user, symbol, body)


@router.get("/stocks/{symbol}/news", response_model=StockNews, summary="Recent news mentioning the stock")
def stock_news(
    symbol: str = Depends(symbol_path),
    days: int = Query(30, ge=1, le=90),
    limit: int = Query(5, ge=1, le=20),
    sort: Literal["recent", "importance"] = "recent",
) -> dict:
    return news_service.stock_news(symbol, days, limit, sort)


@router.get(
    "/stocks/{symbol}/news/markers",
    response_model=NewsMarkers,
    summary="Per-day article counts and headlines for chart markers",
)
def news_markers(symbol: str = Depends(symbol_path), start: date = Query(...), end: date = Query(...)) -> dict:
    return news_service.markers(symbol, start, end)
