"""Accounts: sign-in, invites, access requests, the signed-in user (ADR-004/005/013)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Password = Field(min_length=1, max_length=256)


class CsrfToken(BaseModel):
    csrf_token: str = Field(description="Send back as the X-CSRF-Token header on every POST/PUT/PATCH/DELETE")


Theme = Literal["system", "light", "dark"]


class Me(BaseModel):
    id: str
    email: str | None
    email_verified: bool
    pending_email: str | None = Field(description="Waiting for the confirmation link")
    username: str | None = Field(description="Legacy Streamlit username, kept until cutover")
    display_name: str | None
    role: Literal["user", "admin"]
    needs_email: bool = Field(description="Show the 'Add your email' banner (US-1.7)")
    theme: Theme = Field("system", description="Light, dark, or follow the device (US-6.2)")
    created_at: datetime | None
    last_login_at: datetime | None


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254, description="Email, or legacy username")
    password: str = Password
    remember: bool = Field(True, description="Keep me signed in (30 days); false = browser-session cookie")


class Accepted(BaseModel):
    message: str


class ForgotRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ResetRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Password


class TokenRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class UpdateMe(BaseModel):
    display_name: str | None = Field(None, max_length=120)
    email: str | None = Field(None, max_length=254, description="Starts a confirmation; applied once confirmed")
    current_password: str | None = Field(
        None, max_length=256, description="Required to change the password or a confirmed email"
    )
    new_password: str | None = Field(None, max_length=256)
    theme: Theme | None = None


class DeleteMe(BaseModel):
    confirm: str = Field(min_length=1, max_length=254, description="Your email (or legacy username), typed out")


class SignupRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Password


class InviteView(BaseModel):
    status: Literal["valid", "expired", "used", "invalid"]
    email: str | None = Field(description="Shown read-only on the form; also pre-fills 'Request a new invite'")
    name: str | None


class AcceptInvite(BaseModel):
    token: str = Field(min_length=10, max_length=200, description="From the invite link")
    display_name: str = Field(min_length=1, max_length=120)
    password: str = Password
    accept_terms: bool = Field(description="Terms and the educational-use disclaimer")


class AccessRequestIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=120)
    note: str | None = Field(None, max_length=200, description="How will you use EquityLensNG?")
    accept_disclaimer: bool
