"""Admin console: invites, access requests, users, audit log, data health (US-7.1–7.4, 7.6, 7.7)."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["user", "admin"]


class InviteEntry(BaseModel):
    email: str = Field(max_length=254)
    name: str | None = Field(None, max_length=120)
    role: Role = "user"


class CreateInvites(BaseModel):
    invites: list[InviteEntry] = Field(min_length=1, max_length=50)


class Invite(BaseModel):
    id: str
    email: str
    name: str | None
    role: Role
    status: Literal["pending", "accepted", "expired", "revoked"]
    invited_by: str | None
    created_at: datetime
    expires_at: datetime
    resend_count: int
    accepted_at: datetime | None
    email_failed: bool = Field(description="The email didn't go out: share invite_url another way")


class IssuedInvite(Invite):
    invite_url: str = Field(description="Shown once, for 'Copy invite link' (e.g. WhatsApp)")


class SkippedInvite(BaseModel):
    email: str
    reason: Literal["invalid_email", "duplicate", "already_member"]


class InviteBatch(BaseModel):
    sent: list[IssuedInvite]
    skipped: list[SkippedInvite]


class InvitePage(BaseModel):
    items: list[Invite]
    total: int


class AccessRequest(BaseModel):
    id: str
    email: str
    name: str | None
    note: str | None
    status: Literal["new", "approved", "declined"]
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by: str | None


class AccessRequestPage(BaseModel):
    items: list[AccessRequest]
    total: int
    new_count: int = Field(description="For the admin nav badge")


class Approve(BaseModel):
    role: Role = "user"


class Decline(BaseModel):
    notify: bool = Field(False, description="Send a short, polite email")


class Approval(BaseModel):
    request: AccessRequest
    invite: IssuedInvite | None = Field(description="None when the email already had an account")


class AdminUser(BaseModel):
    id: str
    email: str | None
    username: str | None
    display_name: str | None
    role: Role
    is_active: bool
    created_at: datetime | None
    last_login_at: datetime | None
    legacy: bool = Field(description="No confirmed email yet (migrated Streamlit account)")


class UserPage(BaseModel):
    items: list[AdminUser]
    total: int


class UpdateUser(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


# ── audit log (US-7.7) ──────────────────────────────────────────────────────

AuditCategory = Literal["access", "sign_in", "account", "admin"]
Outcome = Literal["success", "failure"]


class AuditActor(BaseModel):
    kind: Literal["user", "admin", "anonymous", "system"]
    id: str | None
    email: str | None
    name: str | None


class AuditTarget(BaseModel):
    type: str
    id: str | None
    label: str | None


class AuditEntry(BaseModel):
    id: str
    at: datetime
    action: str = Field(description="Stable code, e.g. access_request.approved")
    description: str = Field(description="The action in plain words, e.g. 'Approved access request'")
    category: str
    actor: AuditActor
    target: AuditTarget | None
    outcome: Outcome
    ip: str | None
    user_agent: str | None
    request_id: str | None
    changes: dict[str, Any] | None = Field(description="Before and after values; never passwords or tokens")
    flags: list[str] = Field(description="'suspicious': a burst of failed sign-ins for one account")


class AuditPage(BaseModel):
    items: list[AuditEntry]
    next_cursor: str | None


class AuditQuery(BaseModel):
    """The audit viewer's filters (US-7.7); the CSV export takes the same."""

    date_from: date | None = Field(None, alias="from")
    date_to: date | None = Field(None, alias="to", description="Inclusive")
    category: AuditCategory | None = None
    outcome: Outcome | None = None
    actor: str | None = Field(None, max_length=254, description="Actor's email, exact")
    target: str | None = Field(None, max_length=254, description="Target's email or label, exact")
    q: str | None = Field(None, max_length=254, description="Part of an actor's or target's email")
    user_id: str | None = Field(None, description="Events by or about this user ('View activity')")
    suspicious: bool = False

    model_config = {"populate_by_name": True}


class AdminSummary(BaseModel):
    access_requests: int = Field(description="New access requests waiting for a decision")
    suspicious: int = Field(description="Suspicious sign-in events in the last 7 days")


# ── data health (US-7.6) ────────────────────────────────────────────────────


class DataHealth(BaseModel):
    last_fetch_at: datetime | None = Field(description="Newest tradesData crawl (WAT)")
    last_bars_update_at: datetime | None = Field(description="Newest daily_bars write for the latest session")
    latest_trade_date: date | None
    trading_hours: bool
    stale: bool = Field(description="Trading hours and the newest crawl is more than 2 h old")
    listed: int = Field(description="Stocks in the directory")
    missing_symbols: list[str] = Field(description="Listed stocks with no priced bar in the latest session")
    missing_sessions: list[date] = Field(
        description="Weekdays in the last 30 days with no market data (public holidays show here too)"
    )
