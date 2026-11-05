from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_user
from app.schemas.screener import CompareInsight, CompareInsightRequest, CompareResponse, ScreenResponse
from app.services import compare_service, insight_service, screener_service

router = APIRouter(tags=["stocks"], dependencies=[Depends(require_user)])


@router.get(
    "/screener",
    response_model=ScreenResponse,
    summary="Every stock for the latest session or a period, with screener columns and sparklines",
)
def screener(
    start: date | None = Query(None, description="With `end`, a period; omit both for the latest session"),
    end: date | None = None,
) -> dict:
    return screener_service.screen(start, end)


@router.get("/compare", response_model=CompareResponse, summary="Compare up to 4 stocks over a period")
def compare(
    symbols: str = Query(..., description="Comma list, 1–4, e.g. GTCO,ZENITHBANK"),
    start: date = Query(...),
    end: date = Query(...),
    benchmarks: str = Query("", description="Comma list: sector (each stock's sector average), market"),
) -> dict:
    return compare_service.compare(
        compare_service.parse_symbols(symbols), start, end, compare_service.parse_benchmarks(benchmarks)
    )


@router.post(
    "/compare/insights",
    response_model=CompareInsight,
    summary="AI overview of 2–4 stocks (shared cache; a new overview uses one of today's allowance)",
    responses={
        429: {"description": "Today's allowance is used up (`ai-quota`)"},
        503: {"description": "AI is off (`ai-off`) or the provider failed (`ai-unavailable`)"},
    },
)
def compare_insights(body: CompareInsightRequest, user: dict = Depends(require_user)) -> dict:
    return insight_service.explain_comparison(user, body)
