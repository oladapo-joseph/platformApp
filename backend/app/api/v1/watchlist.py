from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_user, symbol_path
from app.domain.signals import DEFAULT_STRATEGY
from app.schemas.watchlist import Watchlist, WatchlistNews, WatchlistOverview, WatchlistPeriod
from app.services import watchlist_service

router = APIRouter(prefix="/me/watchlist", tags=["watchlist"])


@router.get("", response_model=Watchlist, summary="My watchlist's symbols")
def get(user: dict = Depends(require_user)) -> dict[str, Any]:
    return watchlist_service.get(user)


@router.get("/overview", response_model=WatchlistOverview, summary="Each stock's price, changes, trend and signal")
def overview(
    period: WatchlistPeriod = "1M",
    strategy: str = Query(DEFAULT_STRATEGY, description="Signal strategy slug (GET /strategies)"),
    user: dict = Depends(require_user),
) -> dict[str, Any]:
    return watchlist_service.overview(user, period, strategy)


@router.get("/news", response_model=WatchlistNews, summary="News mentioning any of my stocks")
def news(
    days: int = Query(7, ge=1, le=90), limit: int = Query(50, ge=1, le=100), user: dict = Depends(require_user)
) -> dict[str, Any]:
    return watchlist_service.news(user, days, limit)


@router.put("/{symbol}", response_model=Watchlist, summary="Add a stock (no-op if it's there; 50 at most)")
def add(symbol: str = Depends(symbol_path), user: dict = Depends(require_user)) -> dict[str, Any]:
    return watchlist_service.add(user, symbol)


@router.delete("/{symbol}", response_model=Watchlist, summary="Remove a stock (no-op if it isn't there)")
def remove(symbol: str = Depends(symbol_path), user: dict = Depends(require_user)) -> dict[str, Any]:
    return watchlist_service.remove(user, symbol)
