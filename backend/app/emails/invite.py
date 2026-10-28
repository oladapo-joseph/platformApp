"""Invite (US-1.3, US-7.1): an admin invited someone, or approved their access request."""

from datetime import datetime

from app.emails import OutgoingEmail, TemplateSpec, Var, make
from app.emails._format import first_name, when
from app.emails.layout import Button, Callout, Details, Heading, Paragraph

SPEC = TemplateSpec(
    alias="el-invite",
    name="Invite",
    description="Invitation to create an account; the link proves the email.",
    trigger="Admin sends or resends an invite, or approves an access request",
    subject="You're invited to EquityLensNG",
    preheader="Set your name and password to start. The link works once.",
    blocks=(
        Heading("You're invited to EquityLensNG"),
        Paragraph("Hi {{{NAME}}},"),
        Paragraph(
            "{{{INVITER}}} has invited you to EquityLensNG: clear charts, signals and news for stocks on the "
            "Nigerian Exchange. Set your name and password and you're in. There's no separate email check."
        ),
        Details(
            (("For", "{{{INVITEE_EMAIL}}}"), ("Invited by", "{{{INVITER}}}"), ("Link expires", "{{{EXPIRES_AT}}}"))
        ),
        Button("Accept your invite", "{{{ACTION_URL}}}"),
        Callout("Not expecting this? You can ignore this email. Nothing happens unless you open the link."),
    ),
    reason="You're receiving this because someone invited {{{INVITEE_EMAIL}}} to EquityLensNG.",
    variables=(
        Var("NAME", "Invitee's first name, if the admin gave one", fallback="there"),
        Var("INVITER", "Name of the admin who sent it", fallback="The EquityLensNG team"),
        Var("INVITEE_EMAIL", "The invited address"),
        Var("EXPIRES_AT", "When the link stops working, e.g. 'Tue 4 Nov 2026, 14:05 WAT'"),
        Var("ACTION_URL", "Accept-invite link (single use)"),
    ),
)


def build(to: str, link: str, name: str | None, inviter: str | None, expires_at: datetime) -> OutgoingEmail:
    return make(
        to, SPEC, NAME=first_name(name), INVITER=inviter, INVITEE_EMAIL=to, EXPIRES_AT=when(expires_at), ACTION_URL=link
    )
