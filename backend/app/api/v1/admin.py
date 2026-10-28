"""Admin console API: invites, access requests, users (US-7.1–7.4). The audit-log viewer ships in P4."""

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import request_meta, require_admin, settings_of
from app.schemas.admin import (
    AccessRequest,
    AccessRequestPage,
    AdminUser,
    Approval,
    Approve,
    CreateInvites,
    Decline,
    Invite,
    InviteBatch,
    InvitePage,
    IssuedInvite,
    UpdateUser,
    UserPage,
)
from app.services import invite_service

router = APIRouter(prefix="/admin", tags=["admin"])

Limit = Query(50, ge=1, le=200)
Skip = Query(0, ge=0, le=100_000)


@router.get("/invites", response_model=InvitePage, summary="Invites, newest first")
def list_invites(
    status: Literal["pending", "accepted", "expired", "revoked"] | None = None,
    limit: int = Limit,
    skip: int = Skip,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    return invite_service.list_invites(status, limit, skip)


@router.post(
    "/invites",
    status_code=201,
    response_model=InviteBatch,
    summary="Invite up to 50 people; members, duplicates and bad emails are skipped",
)
def create_invites(body: CreateInvites, request: Request, admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return invite_service.create_invites(
        admin, [e.model_dump() for e in body.invites], request_meta(request), settings_of(request)
    )


@router.post("/invites/{invite_id}/resend", response_model=IssuedInvite, summary="New link; the old one stops working")
def resend_invite(invite_id: str, request: Request, admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return invite_service.resend_invite(admin, invite_id, request_meta(request), settings_of(request))


@router.delete("/invites/{invite_id}", response_model=Invite, summary="Revoke an invite")
def revoke_invite(invite_id: str, request: Request, admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return invite_service.revoke_invite(admin, invite_id, request_meta(request))


@router.get("/access-requests", response_model=AccessRequestPage, summary="'Request an invite' queue")
def list_requests(
    status: Literal["new", "approved", "declined"] | None = "new",
    limit: int = Limit,
    skip: int = Skip,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    return invite_service.list_requests(status, limit, skip)


@router.post("/access-requests/{request_id}/approve", response_model=Approval, summary="Approve: sends an invite")
def approve(
    request_id: str, request: Request, body: Approve | None = None, admin: dict = Depends(require_admin)
) -> dict[str, Any]:
    role = body.role if body else "user"
    return invite_service.approve_request(admin, request_id, role, request_meta(request), settings_of(request))


@router.post("/access-requests/{request_id}/decline", response_model=AccessRequest, summary="Decline a request")
def decline(
    request_id: str, request: Request, body: Decline | None = None, admin: dict = Depends(require_admin)
) -> dict[str, Any]:
    return invite_service.decline_request(admin, request_id, bool(body and body.notify), request_meta(request))


@router.get("/users", response_model=UserPage, summary="Find users by name, email or username")
def list_users(
    q: str | None = Query(None, max_length=100),
    limit: int = Limit,
    skip: int = Skip,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    return invite_service.list_users(q, limit, skip)


@router.patch(
    "/users/{user_id}",
    response_model=AdminUser,
    summary="Change role or (de)activate; deactivation signs the user out everywhere",
)
def update_user(
    user_id: str, body: UpdateUser, request: Request, admin: dict = Depends(require_admin)
) -> dict[str, Any]:
    return invite_service.update_user(admin, user_id, request_meta(request), role=body.role, is_active=body.is_active)
