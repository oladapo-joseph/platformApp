from fastapi import APIRouter, Depends, Response

from app.api.deps import require_user
from app.schemas.events import EventBatch
from app.services import usage_service

router = APIRouter(tags=["usage"])


@router.post("/events", status_code=204, summary="Usage events from the app (pseudonymous; none if turned off)")
def events(batch: EventBatch, user: dict = Depends(require_user)) -> Response:
    usage_service.record(user, batch)
    return Response(status_code=204)
