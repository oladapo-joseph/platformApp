"""Optional, polite reply when an admin declines an access request (US-7.3)."""

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import first_name
from app.emails.layout import Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-access-declined",
    name="Access request declined",
    description="Kind no-for-now; sent only when the admin ticks 'send a polite email'.",
    trigger="Admin declines an access request with 'notify' on",
    subject="Your EquityLensNG access request",
    preheader="We can't offer you a place right now.",
    blocks=(
        Heading("About your access request"),
        Paragraph("Hi {{{NAME}}},"),
        Paragraph(
            "Thanks for your interest in EquityLensNG. We're keeping the group small while we finish the "
            "product, so we can't offer you a place right now."
        ),
        Paragraph("We'll email you when we open up. You don't need to do anything."),
    ),
    reason="You're receiving this because {{{REQUEST_EMAIL}}} asked for an invite to EquityLensNG.",
    variables=(
        Var("NAME", "First name from the request", fallback="there"),
        Var("REQUEST_EMAIL", "The address that asked"),
    ),
)


def build(to: str, name: str | None) -> OutgoingEmail:
    return make(to, SPEC, NAME=first_name(name), REQUEST_EMAIL=to)
