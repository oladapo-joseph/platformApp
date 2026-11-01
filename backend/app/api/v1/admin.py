"""Admin console API: invites, access requests, users, audit log, usage, data health (US-7.1–7.8)."""

from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.deps import request_meta, require_admin, settings_of
from app.db.mongo import WAT
from app.schemas.admin import (
    AccessRequest,
    AccessRequestPage,
    AdminSummary,
    AdminUser,
    Approval,
    Approve,
    AuditCategory,
    AuditPage,
    AuditQuery,
    CreateInvites,
    DataHealth,
    Decline,
    Invite,
    InviteBatch,
    InvitePage,
    IssuedInvite,
    Outcome,
    UpdateUser,
    UserPage,
)
from app.schemas.events import Usage
from app.schemas.insights import AiUsage
from app.services import audit_viewer, data_health, insight_service, invite_service, usage_service

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


@router.get("/summary", response_model=AdminSummary, summary="Counts for the admin nav badge")
def summary(admin: dict = Depends(require_admin)) -> dict[str, int]:
    return audit_viewer.summary()


def audit_query(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to", description="Inclusive"),
    category: AuditCategory | None = None,
    outcome: Outcome | None = None,
    actor: str | None = Query(None, max_length=254, description="Actor's email, exact"),
    target: str | None = Query(None, max_length=254, description="Target's email or label, exact"),
    q: str | None = Query(None, max_length=254, description="Part of an actor's or target's email"),
    user_id: str | None = Query(None, description="Events by or about this user"),
    suspicious: bool = False,
) -> AuditQuery:
    return AuditQuery(
        date_from=date_from,
        date_to=date_to,
        category=category,
        outcome=outcome,
        actor=actor,
        target=target,
        q=q,
        user_id=user_id,
        suspicious=suspicious,
    )


@router.get("/audit", response_model=AuditPage, summary="Audit log, newest first (read-only)")
def audit_log(
    f: AuditQuery = Depends(audit_query),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = None,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    return audit_viewer.page(f, limit, cursor)


@router.post(
    "/audit/export",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}, "description": "The filtered view as CSV"}},
    summary="Export the filtered audit log as CSV (the export is logged)",
)
def export_audit(body: AuditQuery, request: Request, admin: dict = Depends(require_admin)) -> Response:
    text, _ = audit_viewer.export_csv(body, admin, request_meta(request))
    name = f"audit-log-{datetime.now(WAT):%Y%m%d-%H%M}.csv"
    return Response(
        "﻿" + text,  # BOM: Excel reads the naira sign and names as UTF-8
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/data-health", response_model=DataHealth, summary="Crawler freshness and data completeness")
def data_health_view(admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return data_health.health()


@router.get("/usage", response_model=Usage, summary="What people use and how they move through the app (US-7.8)")
def usage(days: int = Query(30, ge=1, le=90), admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return usage_service.usage(days)


@router.get("/ai-usage", response_model=AiUsage, summary="AI readings per day, cache hits, top users, tokens (US-7.5)")
def ai_usage(days: int = Query(30, ge=1, le=90), admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return insight_service.usage(days)
