"""Public access flow: request an invite, open an invite link, accept it (US-1.2–1.4)."""

from typing import Any

from fastapi import APIRouter, Request, Response

from app.api.deps import request_meta, settings_of, start_session_cookie
from app.core.errors import BadRequest
from app.schemas.auth import Accepted, AcceptInvite, AccessRequestIn, InviteView, Me, TokenRequest
from app.services import auth_service, invite_service

router = APIRouter(tags=["access"])


@router.post(
    "/access-requests",
    status_code=202,
    response_model=Accepted,
    summary="Request an invite (same answer for every email)",
)
def request_access(body: AccessRequestIn, request: Request) -> dict[str, str]:
    if not body.accept_disclaimer:
        raise BadRequest(
            "Please confirm you understand EquityLensNG is educational, not investment advice.",
            "disclaimer-required",
            field="accept_disclaimer",
        )
    invite_service.submit_request(body.email, body.name, body.note, request_meta(request))
    return {"message": "Thanks — we'll email you when your invite is ready."}


# Tokens travel in the body, never the URL, so they don't reach access logs (ASVS 14.2.1).
@router.post("/invites/lookup", response_model=InviteView, summary="Check an invite link before showing the form")
def open_invite(body: TokenRequest, request: Request) -> dict[str, Any]:
    return invite_service.lookup(body.token, request_meta(request))


@router.post(
    "/invites/accept",
    status_code=201,
    response_model=Me,
    summary="Accept an invite: creates the account (email already proven) and signs in",
)
def accept_invite(body: AcceptInvite, request: Request, response: Response) -> dict[str, Any]:
    if not body.accept_terms:
        raise BadRequest("Please accept the terms and disclaimer to continue.", "terms-required", field="accept_terms")
    settings = settings_of(request)
    user, session = invite_service.accept(body.token, body.display_name, body.password, request_meta(request), settings)
    start_session_cookie(request, response, session, settings)
    return auth_service.public_user(user)
