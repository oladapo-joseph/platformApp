"""
Every email EquityLensNG sends, one module per type (docs/11-email-design-system.md).

Each module defines a `TemplateSpec`: content built from the design-system blocks
(layout.py) with Resend variables, `{{{NAME}}}`, in place of
anything personal. `python -m app.cli email-templates sync` turns each spec into a
published Resend template and records it in registry.json; sending then passes
only the template alias and the variables.

To add an email: create a module here with SPEC and a `build(...)` that returns an
OutgoingEmail, add it to all_specs() below, preview it (`email-templates render`), then sync.
"""

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Literal

from app.emails.layout import Block, render_html, render_text

PLACEHOLDER = re.compile(r"\{\{\{([A-Z][A-Z0-9_]{0,49})\}\}\}")
# Resend reserves these; never use them as our own variable keys
RESERVED = {"FIRST_NAME", "LAST_NAME", "EMAIL", "UNSUBSCRIBE_URL", "RESEND_UNSUBSCRIBE_URL", "contact", "this"}
MAX_VARIABLES = 50  # per template
MAX_NAME_CHARS = 50  # the template name shown in the Resend dashboard
MAX_VALUE_CHARS = 2000  # per string value at send time; Resend rejects longer ones


@dataclass(frozen=True)
class Var:
    key: str
    description: str
    fallback: str | None = None  # used when the value isn't sent; None = must always be sent
    type: Literal["string", "number"] = "string"


@dataclass(frozen=True)
class TemplateSpec:
    alias: str  # stable Resend alias, e.g. "el-invite"; never rename (it's how we send)
    name: str  # shown in the Resend dashboard
    description: str
    trigger: str  # what sends it (for docs/11 and the registry)
    subject: str  # static: subjects never carry personal data
    preheader: str
    blocks: tuple[Block, ...]
    reason: str  # footer line: why the reader got this
    variables: tuple[Var, ...] = field(default=())

    @property
    def resend_name(self) -> str:
        return f"EquityLensNG · {self.name}"

    def html(self, logo_url: str | None) -> str:
        return render_html(self.subject, self.preheader, self.blocks, self.reason, logo_url)

    def text(self) -> str:
        return render_text(self.blocks, self.reason)

    def used_keys(self, logo_url: str | None = None) -> set[str]:
        return set(PLACEHOLDER.findall(self.html(logo_url) + self.text() + self.subject))

    def fingerprint(self, logo_url: str | None, defaults: dict[str, str] | None = None) -> str:
        """Changes whenever what Resend stores would change (content, variables, default from/reply_to)."""
        payload = json.dumps(
            [
                self.name,
                self.subject,
                self.html(logo_url),
                self.text(),
                [(v.key, v.type, v.fallback) for v in self.variables],
                defaults or {},
            ],
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def check(self) -> None:
        declared = {v.key for v in self.variables}
        used = self.used_keys()
        if len(self.resend_name) > MAX_NAME_CHARS:
            raise ValueError(f"{self.alias}: name {self.resend_name!r} is over {MAX_NAME_CHARS} characters")
        if len(self.variables) > MAX_VARIABLES:
            raise ValueError(f"{self.alias}: {len(self.variables)} variables (Resend allows {MAX_VARIABLES})")
        if bad := declared & RESERVED:
            raise ValueError(f"{self.alias}: reserved variable names {sorted(bad)}")
        if undeclared := used - declared:
            raise ValueError(f"{self.alias}: placeholders without a Var: {sorted(undeclared)}")
        if unused := declared - used:
            raise ValueError(f"{self.alias}: declared but unused: {sorted(unused)}")


def clean(value: str) -> str:
    """Resend's {{{ }}} inserts values unescaped: drop the characters that could open a tag or attribute."""
    return value.replace("<", "").replace(">", "").replace('"', "").strip()


def fill(template: str, values: dict[str, str], spec: TemplateSpec) -> str:
    """What Resend does at send time: values, then fallbacks (used locally and in tests)."""
    fallbacks = {v.key: v.fallback for v in spec.variables}

    def sub(m: re.Match[str]) -> str:
        key = m.group(1)
        if key in values:
            return values[key]
        if fallbacks.get(key) is not None:
            return str(fallbacks[key])
        raise KeyError(f"{spec.alias}: no value for {key}")

    return PLACEHOLDER.sub(sub, template)


@dataclass(frozen=True)
class OutgoingEmail:
    """One email to send: a template and its values. Senders decide how it's delivered."""

    to: str
    spec: TemplateSpec
    values: dict[str, str]

    @property
    def tag(self) -> str:
        return self.spec.alias

    @property
    def subject(self) -> str:
        return fill(self.spec.subject, self.values, self.spec)

    @property
    def text(self) -> str:
        return fill(self.spec.text(), self.values, self.spec)

    def html(self, logo_url: str | None = None) -> str:
        return fill(self.spec.html(logo_url), self.values, self.spec)

    @property
    def action_url(self) -> str | None:
        return self.values.get("ACTION_URL")


def make(to: str, spec: TemplateSpec, **values: str | None) -> OutgoingEmail:
    """Build an email; None values are left out so the template's fallback applies."""
    cleaned = {k: clean(v) for k, v in values.items() if v is not None and v.strip()}
    if too_long := [k for k, v in cleaned.items() if len(v) > MAX_VALUE_CHARS]:
        # fail here, not at Resend: truncating would break links
        raise ValueError(f"{spec.alias}: values over {MAX_VALUE_CHARS} characters: {sorted(too_long)}")
    return OutgoingEmail(to, spec, cleaned)


def all_specs() -> tuple[TemplateSpec, ...]:
    from app.emails import (
        access_declined,
        email_changed,
        invite,
        password_changed,
        password_reset,
        verify_email,
    )

    specs = tuple(
        m.SPEC for m in (invite, password_reset, verify_email, password_changed, email_changed, access_declined)
    )
    for s in specs:
        s.check()
    return specs
