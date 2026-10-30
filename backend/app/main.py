"""
App factory: middleware, routers, problem+json errors, optional SPA mount (ADR-008: same origin).

Run with: uvicorn app.main:create_app --factory
"""

import base64
import hashlib
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.deps import CSRF_HEADER
from app.api.v1 import admin, auth, events, health, invites, market, news, stocks, watchlist
from app.core import errors, security
from app.core import logging as app_logging
from app.core.config import Settings, get_settings
from app.db import mongo
from app.repositories import ensure_indexes, init_repos
from app.services import usage_service
from app.services.email import build_sender, use_sender

log = logging.getLogger("equitylens.api")

API_PREFIX = "/api/v1"
_NO_HTTP_CACHE = (f"{API_PREFIX}/healthz", f"{API_PREFIX}/readyz")
# per-user or security-sensitive: never cached by the browser
_PRIVATE = tuple(f"{API_PREFIX}/{p}" for p in ("auth", "admin", "invites", "access-requests", "me", "events"))
_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
_DOCS = f"{API_PREFIX}/docs"  # Swagger UI loads its scripts from a CDN
# The React app (docs/12 §6, ASVS 3.4.3): scripts, fonts, images and API calls from this origin
# only. The one inline script, index.html's theme script (it must run before first paint), is
# allowed by its hash, never by 'unsafe-inline'. Inline *styles* stay allowed: Radix's scroll
# lock injects a <style> element, and style attributes carry chart and layout sizes.
SPA_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; "
    "frame-ancestors 'none'"
)
_INLINE_SCRIPT = re.compile(r"<script>(.*?)</script>", re.DOTALL)  # no attributes: not src or module


def spa_csp(index_html: str) -> str:
    """SPA_CSP plus a sha256 source for each inline script in the built index.html, read at start-up."""
    hashes = "".join(
        f" 'sha256-{base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()}'"
        for body in _INLINE_SCRIPT.findall(index_html)
    )
    return SPA_CSP.replace("script-src 'self'", f"script-src 'self'{hashes}", 1)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    mongo.connect(settings)
    ensure_indexes(init_repos(mongo.get_db(), settings))
    log.info("started (env=%s, bars_source=%s)", settings.env, settings.bars_source)
    yield
    mongo.close()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app_logging.configure(settings.log_level)
    app = FastAPI(
        title="EquityLensNG API",
        version="1.0.0",
        description="NGX market data, technical analysis and news. Educational information, not financial advice.",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.spa_csp = SPA_CSP  # gains the theme script's hash when the build is mounted
    use_sender(build_sender(settings))
    usage_service.use_key(settings.session_secret.get_secret_value())  # type: ignore[union-attr]
    errors.install(app)

    for router in (
        health.router,
        auth.router,
        invites.router,
        admin.router,
        market.router,
        stocks.router,
        news.router,
        watchlist.router,
        events.router,
    ):
        app.include_router(router, prefix=API_PREFIX)

    _install_middleware(app, settings)
    _mount_spa(app, settings)
    return app


def _install_middleware(app: FastAPI, settings: Settings) -> None:
    Next = Callable[[Request], Awaitable[Response]]

    @app.middleware("http")
    async def http_cache(request: Request, call_next: Next) -> Response:
        """Weak ETag over the JSON body for API GETs; If-None-Match → 304 (the body is cached server-side)."""
        response = await call_next(request)
        path = request.url.path
        if path.startswith(_PRIVATE):
            response.headers["Cache-Control"] = "no-store"
            return response
        if (
            request.method != "GET"
            or response.status_code != 200
            or not path.startswith(API_PREFIX)
            or path in _NO_HTTP_CACHE
            or response.headers.get("content-type") != "application/json"
        ):
            return response
        body = b"".join([chunk async for chunk in response.body_iterator])  # type: ignore[attr-defined]
        etag = f'W/"{hashlib.blake2b(body, digest_size=16).hexdigest()}"'
        headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
        headers |= {"ETag": etag, "Cache-Control": "private, max-age=60"}
        if etag in request.headers.get("if-none-match", ""):
            return Response(status_code=304, headers={"ETag": etag, "Cache-Control": headers["Cache-Control"]})
        return Response(body, status_code=200, headers=headers, media_type="application/json")

    @app.middleware("http")
    async def csrf(request: Request, call_next: Next) -> Response:
        """Signed double-submit token on every state-changing API call (ADR-005)."""
        if request.method in _UNSAFE and request.url.path.startswith(API_PREFIX):
            secret = settings.session_secret.get_secret_value()  # type: ignore[union-attr]
            if not security.valid_csrf(
                secret, request.cookies.get(settings.csrf_cookie), request.headers.get(CSRF_HEADER)
            ):
                return errors.problem(
                    request, 403, "Forbidden", "Missing or invalid CSRF token. Reload the page and try again.", "csrf"
                )
        return await call_next(request)

    @app.middleware("http")
    async def request_context(request: Request, call_next: Next) -> Response:
        request_id = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex
        request.state.request_id = request_id
        token = app_logging.request_id_var.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            app_logging.request_id_var.reset(token)
        ms = round((time.perf_counter() - started) * 1000, 1)
        if getattr(request.state, "clear_session", False):  # stale cookie: drop it
            response.delete_cookie(
                settings.session_cookie, path="/", httponly=True, secure=settings.secure_cookies, samesite="lax"
            )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        # never framed (clickjacking); API JSON may load nothing at all; the SPA only its own origin
        response.headers["X-Frame-Options"] = "DENY"
        path = request.url.path
        if path.startswith(_DOCS):
            csp = "frame-ancestors 'none'"
        elif path.startswith(API_PREFIX):
            csp = "default-src 'none'; frame-ancestors 'none'"
        else:
            csp = request.app.state.spa_csp
        response.headers["Content-Security-Policy"] = csp
        if settings.env != "local":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        log.info(
            "request",
            extra={"method": request.method, "path": request.url.path, "status": response.status_code, "ms": ms},
        )
        return response

    app.add_middleware(GZipMiddleware, minimum_size=1024)


EMAIL_ASSETS = Path(__file__).resolve().parent / "static" / "email"


def _mount_spa(app: FastAPI, settings: Settings) -> None:
    """Serve the built React app at "/" with index.html fallback for client routes, plus the email logos."""
    app.mount("/email-assets", StaticFiles(directory=EMAIL_ASSETS), name="email-assets")
    dist = settings.frontend_dist
    index = dist / "index.html"
    if not index.is_file():
        return
    app.state.spa_csp = spa_csp(index.read_text(encoding="utf-8"))
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise errors.NotFound("No such API route.")
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)
