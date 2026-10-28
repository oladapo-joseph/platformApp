from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import mongo

router = APIRouter(tags=["health"])


@router.get("/healthz", summary="Liveness")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", summary="Readiness (MongoDB reachable)", response_model=None)
def readyz() -> dict[str, str] | JSONResponse:
    if mongo.ping():
        return {"status": "ready"}
    return JSONResponse({"status": "unavailable", "mongo": "unreachable"}, status_code=503)
