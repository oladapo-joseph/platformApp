"""Admin console: invites, access requests, users (US-7.1–7.4)."""

from datetime import datetime
from typing import Literal

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
