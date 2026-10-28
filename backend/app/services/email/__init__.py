"""
Delivery of app/emails templates (D-04): Resend in staging/production, the console
locally. Resend sends a *published template* by alias plus variables, so the HTML
lives in Resend (synced from app/emails by `python -m app.cli email-templates sync`)
and this module never builds markup. The console sender fills the same template
locally, so development shows exactly what users will get.
"""

import logging
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import Settings, get_settings
from app.emails import OutgoingEmail

log = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com"


class EmailSender(Protocol):
    def send(self, email: OutgoingEmail) -> None: ...


class ConsoleSender:
    """Local development: logs the filled-in plain text (links included) instead of sending."""

    def send(self, email: OutgoingEmail) -> None:
        log.info("EMAIL [%s] to=%s subject=%r\n%s", email.tag, email.to, email.subject, email.text)


class ResendSender:
    def __init__(self, api_key: str, sender: str, reply_to: str | None = None) -> None:
        self.api_key, self.sender, self.reply_to = api_key, sender, reply_to

    def send(self, email: OutgoingEmail) -> None:
        payload: dict[str, object] = {
            "from": self.sender,
            "to": [email.to],
            "subject": email.subject,
            "template": {"id": email.spec.alias, "variables": email.values},
            "tags": [{"name": "template", "value": email.tag}],
        }
        if self.reply_to:
            payload["reply_to"] = self.reply_to
        resp = httpx.post(
            f"{RESEND_API}/emails", headers={"Authorization": f"Bearer {self.api_key}"}, json=payload, timeout=10
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Resend rejected the email ({resp.status_code}): {resp.text[:200]}")


def build_sender(settings: Settings) -> EmailSender:
    if settings.email_provider == "resend":
        assert settings.resend_api_key is not None
        return ResendSender(settings.resend_api_key.get_secret_value(), settings.email_from, settings.email_reply_to)
    return ConsoleSender()


@lru_cache(maxsize=1)
def _default_sender() -> EmailSender:
    return build_sender(get_settings())


_override: EmailSender | None = None


def sender() -> EmailSender:
    return _override if _override is not None else _default_sender()


def use_sender(s: EmailSender | None) -> None:
    """Swap the sender (tests, or the app factory with explicit settings)."""
    global _override
    _override = s
