"""Security notice: the password changed (after a change or a reset). Best-effort, never blocks the change."""

from datetime import datetime

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import first_name, when
from app.emails.layout import Button, Callout, Details, Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-password-changed",
    name="Password changed (security notice)",
    description="Tells the owner their password changed, with a way back if it wasn't them.",
    trigger="Password changed in the account page, or reset by link",
    subject="Your EquityLensNG password was changed",
    preheader="If this was you, there's nothing to do.",
    blocks=(
        Heading("Your password was changed"),
        Paragraph("Hi {{{NAME}}},"),
        Paragraph(
            "The password for your EquityLensNG account was just changed, and your other devices were signed "
            "out. If this was you, there's nothing to do."
        ),
        Details((("Account", "{{{ACCOUNT_EMAIL}}}"), ("Changed", "{{{CHANGED_AT}}}"))),
        Callout("Wasn't you? Reset your password now: that signs out everyone else.", tone="warning"),
        Button("Reset your password", "{{{ACTION_URL}}}"),
    ),
    reason="You're receiving this security notice because the password for {{{ACCOUNT_EMAIL}}} changed.",
    variables=(
        Var("NAME", "First name", fallback="there"),
        Var("ACCOUNT_EMAIL", "The account's address"),
        Var("CHANGED_AT", "When it changed"),
        Var("ACTION_URL", "The 'forgot password' page"),
    ),
)


def build(to: str, name: str | None, at: datetime, forgot_link: str) -> OutgoingEmail:
    return make(to, SPEC, NAME=first_name(name), ACCOUNT_EMAIL=to, CHANGED_AT=when(at), ACTION_URL=forgot_link)
