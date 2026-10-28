"""Confirm an email (US-1.7): a legacy user adds one, a user changes theirs, or open sign-up."""

from datetime import datetime

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import when
from app.emails.layout import Button, Callout, Details, Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-verify-email",
    name="Confirm email",
    description="Confirms an address before it becomes the sign-in email.",
    trigger="A user adds or changes their email (or signs up while SIGNUP_MODE=open)",
    subject="Confirm your email for EquityLensNG",
    preheader="One click, so you can sign in with it and reset your password.",
    blocks=(
        Heading("Confirm your email"),
        Paragraph("Confirm this address so you can sign in with it and reset your password if you ever forget it."),
        Details((("Email", "{{{ACCOUNT_EMAIL}}}"), ("Link expires", "{{{EXPIRES_AT}}}"))),
        Button("Confirm your email", "{{{ACTION_URL}}}"),
        Callout("Didn't ask for this? You can ignore this email. The address won't be added."),
    ),
    reason="You're receiving this because {{{ACCOUNT_EMAIL}}} was added to an EquityLensNG account.",
    variables=(
        Var("ACCOUNT_EMAIL", "The address being confirmed"),
        Var("EXPIRES_AT", "When the link stops working"),
        Var("ACTION_URL", "Confirmation link (single use)"),
    ),
)


def build(to: str, link: str, expires_at: datetime) -> OutgoingEmail:
    return make(to, SPEC, ACCOUNT_EMAIL=to, EXPIRES_AT=when(expires_at), ACTION_URL=link)
