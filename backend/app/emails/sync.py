"""
Keep Resend's templates in step with app/emails, and record what exists in registry.json.

registry.json is committed: it's the history of every template we created in Resend
(alias, Resend id, version, content fingerprint, when created/updated/published).
`sync` changes Resend and the registry together; `status` only reads and reports drift.
"""

import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from app.emails import TemplateSpec, all_specs

REGISTRY = Path(__file__).with_name("registry.json")
API = "https://api.resend.com"
_PAUSE = 0.6  # Resend's default limit is 2 requests per second


class ResendError(RuntimeError):
    pass


class ResendTemplates:
    def __init__(self, api_key: str) -> None:
        self.client = httpx.Client(base_url=API, headers={"Authorization": f"Bearer {api_key}"}, timeout=20)

    def _call(self, method: str, path: str, **kw: Any) -> dict[str, Any]:
        time.sleep(_PAUSE)
        resp = self.client.request(method, path, **kw)
        if resp.status_code >= 400:
            raise ResendError(f"{method} {path} → {resp.status_code}: {resp.text[:300]}")
        return resp.json() if resp.content else {}

    def list(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        params: dict[str, Any] = {"limit": 100}
        while True:
            page = self._call("GET", "/templates", params=params)
            out += page.get("data", [])
            if not page.get("has_more") or not out:
                return out
            params = {"limit": 100, "after": out[-1]["id"]}

    def create(self, body: dict[str, Any]) -> str:
        return str(self._call("POST", "/templates", json=body)["id"])

    def update(self, id_or_alias: str, body: dict[str, Any]) -> None:
        self._call("PATCH", f"/templates/{id_or_alias}", json=body)

    def publish(self, id_or_alias: str) -> None:
        self._call("POST", f"/templates/{id_or_alias}/publish")


def template_defaults(email_from: str, reply_to: str | None) -> dict[str, str]:
    """Default from/reply_to stored on each template, so dashboard test sends work as-is.
    Sends still pass their own `from`, which takes precedence. A localhost sender isn't stored."""
    out = {}
    if not email_from.rstrip(">").endswith("@localhost"):
        out["from"] = email_from
    if reply_to:
        out["reply_to"] = reply_to
    return out


def template_body(spec: TemplateSpec, logo_url: str | None, defaults: dict[str, str] | None = None) -> dict[str, Any]:
    variables = []
    for v in spec.variables:
        var: dict[str, Any] = {"key": v.key, "type": v.type}
        if v.fallback is not None:
            var["fallback_value"] = v.fallback
        variables.append(var)
    return {
        "name": spec.resend_name,
        "alias": spec.alias,
        "subject": spec.subject,
        "html": spec.html(logo_url),
        "text": spec.text(),
        "variables": variables,
        **(defaults or {}),
    }


def load_registry() -> dict[str, Any]:
    if REGISTRY.exists():
        return json.loads(REGISTRY.read_text(encoding="utf-8"))
    return {"templates": {}}


def save_registry(reg: dict[str, Any]) -> None:
    reg["_about"] = (
        "Every EquityLensNG email template created in Resend. Written by "
        "`python -m app.cli email-templates sync`; do not edit by hand."
    )
    REGISTRY.write_text(json.dumps(reg, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


@dataclass
class Change:
    alias: str
    action: str  # create | update | publish | unchanged
    version: int


def plan(
    specs: tuple[TemplateSpec, ...],
    logo_url: str | None,
    reg: dict[str, Any],
    remote: dict[str, dict[str, Any]],
    defaults: dict[str, str] | None = None,
) -> list[Change]:
    changes = []
    for spec in specs:
        entry = reg["templates"].get(spec.alias)
        live = remote.get(spec.alias)
        fp = spec.fingerprint(logo_url, defaults)
        version = entry["version"] if entry else 0
        if live is None:
            changes.append(Change(spec.alias, "create", version + 1))
        elif not entry or entry.get("fingerprint") != fp:
            changes.append(Change(spec.alias, "update", version + 1))
        elif live.get("status") != "published":
            changes.append(Change(spec.alias, "publish", version))
        else:
            changes.append(Change(spec.alias, "unchanged", version))
    return changes


def sync(
    api: ResendTemplates, logo_url: str | None, dry_run: bool = False, defaults: dict[str, str] | None = None
) -> list[Change]:
    specs = all_specs()
    reg = load_registry()
    remote = {t["alias"]: t for t in api.list() if t.get("alias")}
    changes = plan(specs, logo_url, reg, remote, defaults)
    if dry_run:
        return changes
    by_alias = {s.alias: s for s in specs}
    for change in changes:
        spec = by_alias[change.alias]
        if change.action == "unchanged":
            continue
        body = template_body(spec, logo_url, defaults)
        entry = reg["templates"].get(spec.alias, {})
        if change.action == "create":
            entry = {"id": api.create(body), "created_at": _now()}
        elif change.action == "update":
            api.update(spec.alias, body)
            entry.setdefault("id", remote[spec.alias]["id"])
            entry["updated_at"] = _now()
        api.publish(spec.alias)
        entry |= {
            "name": body["name"],
            "version": change.version,
            "fingerprint": spec.fingerprint(logo_url, defaults),
            "status": "published",
            "published_at": _now(),
            "subject": spec.subject,
            "trigger": spec.trigger,
            "variables": [v.key for v in spec.variables],
            "logo": bool(logo_url),
            "from": (defaults or {}).get("from"),
            "reply_to": (defaults or {}).get("reply_to"),
        }
        reg["templates"][spec.alias] = entry
        save_registry(reg)  # after every template: a failure halfway still leaves an accurate record
    return changes


def status(api: ResendTemplates, logo_url: str | None, defaults: dict[str, str] | None = None) -> dict[str, list[str]]:
    """Drift report: what sync would do, plus templates in Resend that no spec owns."""
    specs = all_specs()
    reg = load_registry()
    remote = {t["alias"]: t for t in api.list() if t.get("alias")}
    report: dict[str, list[str]] = {}
    for c in plan(specs, logo_url, reg, remote, defaults):
        report.setdefault(c.action, []).append(c.alias)
    known = {s.alias for s in specs}
    orphans = [a for a in remote if a.startswith("el-") and a not in known]
    if orphans:
        report["orphaned_in_resend"] = orphans
    missing = [a for a in reg["templates"] if a not in remote]
    if missing:
        report["in_registry_but_not_in_resend"] = missing
    return report
