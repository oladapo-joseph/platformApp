"""AI readings: whether they're on, and my allowance for today (US-4.4, US-4.5)."""

from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import require_user
from app.schemas.insights import AiStatus
from app.services import insight_service

router = APIRouter(prefix="/me", tags=["ai"])


@router.get("/ai", response_model=AiStatus, summary="AI on or off, the model, and my readings left today")
def status(user: dict = Depends(require_user)) -> dict[str, Any]:
    return insight_service.status(user)
