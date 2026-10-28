"""Security notice to the OLD address when the sign-in email changes. Best-effort."""

from datetime import datetime

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import when
from app.emails.layout import Button, Callout, Details, Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-email-changed",
    name="Email changed (security notice)",
    description="Warns the previous address that the account moved to a new email.",
    trigger="A confirmed email is replaced by a newly confirmed one",
    subject="Your EquityLensNG sign-in email changed",
    preheader="Your account now uses {{{NEW_EMAIL}}}.",
    blocks=(
        Heading("Your sign-in email changed"),
        Paragraph(
            "Your EquityLensNG account now signs in with {{{NEW_EMAIL}}}. Emails about your account will go "
            "there from now on. If this was you, there's nothing to do."
        ),
        Details((("Old email", "{{{OLD_EMAIL}}}"), ("New email", "{{{NEW_EMAIL}}}"), ("Changed", "{{{CHANGED_AT}}}"))),
        Callout("Wasn't you? Reset your password straight away: that signs out everyone else.", tone="warning"),
        Button("Reset your password", "{{{ACTION_URL}}}"),
    ),
    reason="You're receiving this security notice because {{{OLD_EMAIL}}} was the sign-in email for this account.",
    variables=(
        Var("OLD_EMAIL", "Previous address (this email goes to it)"),
        Var("NEW_EMAIL", "New address"),
        Var("CHANGED_AT", "When it changed"),
        Var("ACTION_URL", "The 'forgot password' page"),
    ),
)


def build(old_address: str, new_address: str, at: datetime, forgot_link: str) -> OutgoingEmail:
    return make(
        old_address, SPEC, OLD_EMAIL=old_address, NEW_EMAIL=new_address, CHANGED_AT=when(at), ACTION_URL=forgot_link
    )
