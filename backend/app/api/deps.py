"""Request dependencies: the signed-in user, admin checks, request metadata, cookies."""

from typing import Any

from fastapi import Depends, Path, Request, Response

from app.core.config import Settings
from app.core.errors import Forbidden, Unauthorized
from app.services import auth_service
from app.services.audit_service import RequestMeta
from app.services.auth_service import NewSession
from app.services.stock_service import normalize_symbol

CSRF_HEADER = "x-csrf-token"  # cookie names come from Settings (__Host- prefixed outside local)


def settings_of(request: Request) -> Settings:
    return request.app.state.settings


def request_meta(request: Request) -> RequestMeta:
    # behind Azure Container Apps, uvicorn --proxy-headers puts the client IP here
    return RequestMeta(
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        getattr(request.state, "request_id", None),
    )


def current(request: Request) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """(user, session) for this request's cookie, resolved once per request."""
    if not hasattr(request.state, "auth"):
        token = request.cookies.get(settings_of(request).session_cookie)
        request.state.auth = auth_service.resolve_session(token, settings_of(request)) if token else None
    return request.state.auth


def require_user(request: Request) -> dict[str, Any]:
    auth = current(request)
    if auth is None:
        if request.cookies.get(settings_of(request).session_cookie):
            request.state.clear_session = True
            raise Unauthorized("Your session has ended. Please sign in again.", "session-expired")
        raise Unauthorized("Sign in to continue.", "unauthenticated")
    return auth[0]


def require_session(request: Request, user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    auth = current(request)
    assert auth is not None
    return auth[1]


def require_admin(user: dict[str, Any] = Depends(require_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise Forbidden("Only admins can do that.", "admin-only")
    return user


def start_session_cookie(request: Request, response: Response, session: NewSession, settings: Settings) -> None:
    """Set a new session cookie, ending the session this browser arrived with (ASVS 7.2.4)."""
    previous = request.cookies.get(settings.session_cookie)
    if previous:
        auth_service.end_session_token(previous)
    response.set_cookie(
        settings.session_cookie,
        session.token,
        max_age=session.max_age,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie, path="/", httponly=True, secure=settings.secure_cookies, samesite="lax"
    )


def symbol_path(symbol: str = Path(description="NGX ticker, e.g. MTNN", examples=["MTNN"])) -> str:
    return normalize_symbol(symbol)
