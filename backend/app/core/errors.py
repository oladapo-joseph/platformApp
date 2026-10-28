"""RFC 9457 problem+json responses for every error the API returns."""

import logging
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)

PROBLEM_JSON = "application/problem+json"


class ProblemError(Exception):
    """Raise from services for a client-facing error with a stable `type` slug."""

    def __init__(
        self,
        status: int,
        title: str,
        detail: str | None = None,
        slug: str | None = None,
        headers: dict[str, str] | None = None,
        **extra: Any,
    ) -> None:
        super().__init__(detail or title)
        self.status, self.title, self.detail, self.slug, self.extra = status, title, detail, slug, extra
        self.headers = headers


class NotFound(ProblemError):
    def __init__(self, detail: str, slug: str = "not-found") -> None:
        super().__init__(404, "Not found", detail, slug)


class BadRequest(ProblemError):
    def __init__(self, detail: str, slug: str = "bad-request", **extra: Any) -> None:
        super().__init__(400, "Bad request", detail, slug, **extra)


class Unauthorized(ProblemError):
    def __init__(self, detail: str, slug: str = "unauthenticated") -> None:
        super().__init__(401, "Unauthorized", detail, slug)


class Forbidden(ProblemError):
    def __init__(self, detail: str, slug: str = "forbidden") -> None:
        super().__init__(403, "Forbidden", detail, slug)


class Conflict(ProblemError):
    def __init__(self, detail: str, slug: str = "conflict") -> None:
        super().__init__(409, "Conflict", detail, slug)


class TooManyRequests(ProblemError):
    def __init__(self, detail: str, retry_after: int, slug: str = "rate-limited") -> None:
        super().__init__(
            429, "Too many requests", detail, slug, headers={"Retry-After": str(retry_after)}, retry_after=retry_after
        )


def problem(
    request: Request,
    status: int,
    title: str,
    detail: str | None = None,
    slug: str | None = None,
    headers: dict[str, str] | None = None,
    **extra: Any,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"https://equitylens.ng/problems/{slug}" if slug else "about:blank",
        "title": title,
        "status": status,
        "instance": request.url.path,
    }
    if detail:
        body["detail"] = detail
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        body["request_id"] = request_id
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def install(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError) -> JSONResponse:
        return problem(request, exc.status, exc.title, exc.detail, exc.slug, headers=exc.headers, **exc.extra)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        title = HTTPStatus(exc.status_code).phrase
        detail = exc.detail if isinstance(exc.detail, str) and exc.detail != title else None
        return problem(request, exc.status_code, title, detail, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return problem(
            request, 422, "Invalid request", "One or more parameters are invalid.", "validation", errors=errors
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error on %s", request.url.path)
        return problem(request, 500, "Internal server error", "Something went wrong on our side.")
