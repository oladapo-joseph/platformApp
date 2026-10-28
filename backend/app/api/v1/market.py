from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_user
from app.schemas.market import MarketStatus, RangeSummary, SectorsResponse, Snapshot
from app.services import market_service

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/status", response_model=MarketStatus, summary="Data freshness and trading hours")
def status() -> dict:
    return market_service.status()


@router.get(
    "/snapshot",
    response_model=Snapshot,
    dependencies=[Depends(require_user)],
    summary="One trading day: stats, breadth, movers, sectors and every stock",
)
def snapshot(
    day: date | None = Query(
        None, alias="date", description="Defaults to the latest; a non-trading day uses the one before"
    ),
) -> dict:
    return market_service.snapshot(market_service.resolve_trade_date(day))


@router.get(
    "/range",
    response_model=RangeSummary,
    dependencies=[Depends(require_user)],
    summary="Cumulative per-stock performance over a period (max 3 years)",
)
def range_summary(start: date, end: date) -> dict:
    return market_service.range_summary(start, end)


@router.get(
    "/sectors",
    response_model=SectorsResponse,
    dependencies=[Depends(require_user)],
    summary="Sector aggregates for one day (`date`) or a period (`start` + `end`)",
)
def sectors(day: date | None = Query(None, alias="date"), start: date | None = None, end: date | None = None) -> dict:
    return market_service.sectors(day, start, end)
