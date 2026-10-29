"""All MongoDB access lives here (only this package imports PyMongo)."""

from dataclasses import dataclass

from pymongo.database import Database

from app.core.config import Settings
from app.repositories.audit_repo import AuditRepo
from app.repositories.bars_repo import BarsRepo
from app.repositories.industry_repo import IndustryRepo
from app.repositories.invites_repo import AccessRequestsRepo, InvitesRepo
from app.repositories.news_repo import NewsRepo
from app.repositories.sessions_repo import EmailTokensRepo, SessionsRepo
from app.repositories.users_repo import UsersRepo
from app.repositories.watchlist_repo import WatchlistRepo


@dataclass(frozen=True)
class Repos:
    bars: BarsRepo
    industry: IndustryRepo
    news: NewsRepo
    users: UsersRepo
    sessions: SessionsRepo
    email_tokens: EmailTokensRepo
    invites: InvitesRepo
    access_requests: AccessRequestsRepo
    audit: AuditRepo
    watchlists: WatchlistRepo


_repos: Repos | None = None


def init_repos(db: Database, settings: Settings) -> Repos:
    global _repos
    _repos = Repos(
        bars=BarsRepo(db, settings.trades_collection, settings.bars_source),
        industry=IndustryRepo(db),
        news=NewsRepo(db),
        users=UsersRepo(db),
        sessions=SessionsRepo(db),
        email_tokens=EmailTokensRepo(db),
        invites=InvitesRepo(db),
        access_requests=AccessRequestsRepo(db),
        audit=AuditRepo(db),
        watchlists=WatchlistRepo(db),
    )
    return _repos


def ensure_indexes(repos: Repos) -> None:
    """Indexes on platform-owned collections only; the crawler's collections are never touched."""
    for repo in (
        repos.users,
        repos.sessions,
        repos.email_tokens,
        repos.invites,
        repos.access_requests,
        repos.audit,
        repos.watchlists,
    ):
        repo.ensure_indexes()


def get_repos() -> Repos:
    if _repos is None:
        raise RuntimeError("repositories not initialised; call init_repos() at startup")
    return _repos
