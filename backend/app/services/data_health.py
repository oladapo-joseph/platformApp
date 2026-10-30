"""Data health for admins (US-7.6): is the crawler running, and is the data complete?"""

from datetime import date, datetime, time, timedelta
from typing import Any

from app.core.cache import ttl_cache
from app.db.mongo import WAT
from app.repositories import get_repos
from app.services import market_service, stock_service

STALE_AFTER = timedelta(hours=2)
WINDOW_DAYS = 30
SESSION_SETTLED = time(15, 30)  # after the close and the last crawl: a weekday without data by now is missing


@ttl_cache(seconds=60)
def health() -> dict[str, Any]:
    bars = get_repos().bars
    now = datetime.now(WAT)
    last_fetch = bars.last_fetch_at()
    latest = bars.latest_trade_date()
    trading = market_service.is_trading_hours(now)
    listed = [r["symbol"] for r in stock_service.directory()]
    priced = {b["symbol"] for b in bars.date_bars(latest)} if latest else set()
    return {
        "last_fetch_at": last_fetch,
        "last_bars_update_at": bars.last_bars_update_at(),
        "latest_trade_date": latest,
        "trading_hours": trading,
        "stale": trading and (last_fetch is None or now - last_fetch.astimezone(WAT) > STALE_AFTER),
        "listed": len(listed),
        "missing_symbols": [s for s in listed if s not in priced] if latest else listed,
        "missing_sessions": missing_sessions(now) if latest else [],
    }


def missing_sessions(now: datetime) -> list[date]:
    """Weekdays in the last WINDOW_DAYS with no data; today counts only once its session has settled."""
    sessions = {date.fromisoformat(str(s["trade_date"])) for s in market_service.history(WINDOW_DAYS)["sessions"]}
    today = now.date()
    last = today if now.time() >= SESSION_SETTLED else today - timedelta(days=1)
    days = (today - timedelta(days=n) for n in range(WINDOW_DAYS + 1))
    return sorted(d for d in days if d <= last and d.weekday() < 5 and d not in sessions)
