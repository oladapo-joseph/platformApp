"""Password reset (US-1.6): sent only to a confirmed address; the caller always sees 'sent'."""

from datetime import datetime

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import when
from app.emails.layout import Button, Callout, Details, Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-password-reset",
    name="Password reset",
    description="Single-use link to choose a new password.",
    trigger="Someone asks to reset the password for a confirmed email",
    subject="Reset your EquityLensNG password",
    preheader="This link works once and expires in {{{MINUTES}}} minutes.",
    blocks=(
        Heading("Reset your password"),
        Paragraph(
            "Someone asked to reset the password for your EquityLensNG account. Choose a new one with the "
            "button below. The link works once and expires in {{{MINUTES}}} minutes, and you'll be signed "
            "out on your other devices."
        ),
        Details((("Account", "{{{ACCOUNT_EMAIL}}}"), ("Link expires", "{{{EXPIRES_AT}}}"))),
        Button("Choose a new password", "{{{ACTION_URL}}}"),
        Callout("Didn't ask for this? You can ignore this email: your password won't change."),
    ),
    reason="You're receiving this because a password reset was requested for {{{ACCOUNT_EMAIL}}}.",
    variables=(
        Var("ACCOUNT_EMAIL", "The account's address"),
        Var("EXPIRES_AT", "When the link stops working"),
        Var("MINUTES", "Link lifetime in minutes", fallback="30"),
        Var("ACTION_URL", "Reset link (single use)"),
    ),
)


def build(to: str, link: str, expires_at: datetime, minutes: int) -> OutgoingEmail:
    return make(to, SPEC, ACCOUNT_EMAIL=to, EXPIRES_AT=when(expires_at), MINUTES=str(minutes), ACTION_URL=link)
