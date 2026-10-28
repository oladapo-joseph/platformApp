from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_user
from app.db.mongo import WAT
from app.repositories.news_repo import NewsFilter
from app.schemas.news import Article, ContentType, NewsPage, Scope, Topic
from app.services import news_service
from app.services.stock_service import normalize_symbol

router = APIRouter(prefix="/news", tags=["news"], dependencies=[Depends(require_user)])


def _csv(raw: str | None, upper: bool = False) -> tuple[str, ...]:
    """Comma list → unique values, order kept."""
    if not raw:
        return ()
    out: list[str] = []
    for v in (p.strip() for p in raw.split(",")):
        v = v.upper() if upper else v
        if v and v not in out:
            out.append(v)
    return tuple(out)


@router.get("/top", response_model=list[Article], summary="Top stories by importance")
def top(
    hours: int = Query(48, ge=1, le=24 * 30), limit: int = Query(5, ge=1, le=20), sector: str | None = None
) -> list[dict]:
    return news_service.top(hours, limit, sector.strip().upper() if sector else None)


@router.get("", response_model=NewsPage, summary="News page: filtered, cursor-paginated, with facets")
def search(
    symbols: str | None = Query(None, description="Comma list of tickers"),
    sectors: str | None = None,
    subsectors: str | None = None,
    topics: list[Topic] = Query(default=[]),
    scope: list[Scope] = Query(default=[]),
    regulators: str | None = Query(None, description="e.g. CBN,SEC"),
    content_types: list[ContentType] = Query(default=[]),
    sources: str | None = Query(None, description="Domains, e.g. businessday.ng"),
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to", description="Inclusive"),
    title_only: bool = Query(False, description="With `symbols`: only headlines naming them"),
    q: str | None = Query(None, max_length=80, description="Headline contains"),
    sort: Literal["recent", "importance"] = "recent",
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
) -> dict:
    f = NewsFilter(
        symbols=tuple(normalize_symbol(s) for s in _csv(symbols, upper=True)),
        sectors=_csv(sectors, upper=True),
        subsectors=_csv(subsectors),
        topics=tuple(dict.fromkeys(topics)),
        scope=tuple(dict.fromkeys(scope)),
        regulators=_csv(regulators),
        content_types=tuple(dict.fromkeys(content_types)),
        sources=_csv(sources),
        date_from=datetime.combine(date_from, datetime.min.time(), WAT) if date_from else None,
        date_to=datetime.combine(date_to + timedelta(days=1), datetime.min.time(), WAT) if date_to else None,
        title_only=title_only,
        q=q.strip() if q and q.strip() else None,
    )
    return news_service.search(f, sort, limit, cursor)
