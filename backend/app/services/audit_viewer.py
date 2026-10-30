"""
Reading the audit log (US-7.7): filtered pages, newest first, and a CSV export
that is itself logged. Read-only: there is no code path that edits or deletes an
entry (the repo has insert and find only).
"""

import base64
import binascii
import csv
import io
import json
import re
from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.core.errors import BadRequest
from app.db.mongo import WAT
from app.repositories import get_repos
from app.schemas.admin import AuditQuery
from app.services import audit_service as audit
from app.services.audit_service import RequestMeta

EXPORT_MAX = 10_000

# what each action says in the viewer and the CSV ("Ada Obi · Approved access request · tunde@…")
DESCRIPTIONS = {
    "auth.login": "Signed in",
    "auth.login_failed": "Failed to sign in",
    "auth.login_locked": "Sign-in paused after repeated failures",
    "auth.logout": "Signed out",
    "auth.logout_all": "Signed out everywhere",
    "auth.password_reset_requested": "Asked for a password reset",
    "auth.password_reset": "Reset password",
    "account.signed_up": "Signed up",
    "account.updated": "Updated profile",
    "account.password_changed": "Changed password",
    "account.email_change_requested": "Asked to change email",
    "account.email_verified": "Confirmed email",
    "account.deleted": "Deleted account",
    "access_request.submitted": "Requested an invite",
    "access_request.approved": "Approved access request",
    "access_request.declined": "Declined access request",
    "invite.sent": "Sent invite",
    "invite.resent": "Resent invite",
    "invite.revoked": "Revoked invite",
    "invite.accepted": "Accepted invite",
    "invite.expired": "Invite expired",
    "admin.admin_created": "Created admin account",
    "admin.role_changed": "Changed role",
    "admin.user_deactivated": "Deactivated user",
    "admin.user_reactivated": "Reactivated user",
    "admin.audit_exported": "Exported the audit log",
}


def describe(action: str) -> str:
    return DESCRIPTIONS.get(action, action.replace("_", " ").replace(".", ": ").capitalize())


def _plain(value: Any) -> Any:
    """ObjectIds to strings, recursively, so `changes` serialises."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def entry(doc: dict[str, Any]) -> dict[str, Any]:
    actor = doc.get("actor") or {}
    target = doc.get("target")
    return {
        "id": str(doc["_id"]),
        "at": doc["at"],
        "action": doc["action"],
        "description": describe(doc["action"]),
        "category": doc.get("category") or "other",
        "actor": {
            "kind": actor.get("kind") or "anonymous",
            "id": str(actor["id"]) if actor.get("id") else None,
            "email": actor.get("email"),
            "name": actor.get("name"),
        },
        "target": {
            "type": target.get("type") or "",
            "id": str(target["id"]) if target.get("id") else None,
            "label": target.get("label"),
        }
        if target
        else None,
        "outcome": doc.get("outcome") or "success",
        "ip": doc.get("ip"),
        "user_agent": doc.get("user_agent"),
        "request_id": doc.get("request_id"),
        "changes": _plain(doc.get("changes")),
        "flags": list(doc.get("flags") or []),
    }


def build_match(f: AuditQuery) -> dict[str, Any]:
    clauses: list[dict[str, Any]] = []
    at: dict[str, Any] = {}
    if f.date_from:
        at["$gte"] = datetime.combine(f.date_from, datetime.min.time(), WAT)
    if f.date_to:
        at["$lt"] = datetime.combine(f.date_to + timedelta(days=1), datetime.min.time(), WAT)
    if at:
        clauses.append({"at": at})
    if f.category:
        clauses.append({"category": f.category})
    if f.outcome:
        clauses.append({"outcome": f.outcome})
    if f.actor and f.actor.strip():
        clauses.append({"actor.email": f.actor.strip().lower()})
    if f.target and f.target.strip():
        clauses.append({"target.label": f.target.strip()})
    if f.q and f.q.strip():
        pattern = {"$regex": re.escape(f.q.strip()), "$options": "i"}
        clauses.append({"$or": [{"actor.email": pattern}, {"target.label": pattern}]})
    if f.user_id:
        try:
            oid = ObjectId(f.user_id)
        except InvalidId as e:
            raise BadRequest("Unknown user.", "invalid-user", field="user_id") from e
        clauses.append({"$or": [{"actor.id": oid}, {"target.id": oid}]})
    if f.suspicious:
        clauses.append({"flags": "suspicious"})
    if not clauses:
        return {}
    return clauses[0] if len(clauses) == 1 else {"$and": clauses}


def _encode_cursor(doc: dict[str, Any]) -> str:
    raw = json.dumps([doc["at"].isoformat(), str(doc["_id"])])
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, ObjectId]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        at, oid = json.loads(raw)
        return datetime.fromisoformat(at), ObjectId(oid)
    except (ValueError, TypeError, binascii.Error, InvalidId) as e:
        raise BadRequest("That page link has expired. Start from the first page.", "invalid-cursor") from e


def page(f: AuditQuery, limit: int, cursor: str | None) -> dict[str, Any]:
    docs = get_repos().audit.search(build_match(f), limit + 1, _decode_cursor(cursor) if cursor else None)
    shown, more = docs[:limit], len(docs) > limit
    return {"items": [entry(d) for d in shown], "next_cursor": _encode_cursor(shown[-1]) if more and shown else None}


def summary() -> dict[str, int]:
    repos = get_repos()
    return {
        "access_requests": repos.access_requests.count_new(),
        "suspicious": repos.audit.count_flagged(datetime.now(WAT) - timedelta(days=7)),
    }


_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: Any) -> str:
    """A CSV cell that a spreadsheet won't run as a formula (names and emails are user-supplied)."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA) else text


COLUMNS = [
    "time_wat",
    "action",
    "action_code",
    "category",
    "outcome",
    "actor_kind",
    "actor_name",
    "actor_email",
    "target_type",
    "target",
    "ip",
    "user_agent",
    "request_id",
    "flags",
    "changes",
]


def export_csv(f: AuditQuery, admin: dict[str, Any], meta: RequestMeta) -> tuple[str, int]:
    """The filtered view as CSV, newest first, EXPORT_MAX rows at most. Logged after the rows are read."""
    docs = get_repos().audit.search(build_match(f), EXPORT_MAX)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(COLUMNS)
    for d in docs:
        e = entry(d)
        t = e["target"] or {}
        writer.writerow(
            [
                _cell(v)
                for v in (
                    e["at"].astimezone(WAT).isoformat(timespec="seconds"),
                    e["description"],
                    e["action"],
                    e["category"],
                    e["outcome"],
                    e["actor"]["kind"],
                    e["actor"]["name"],
                    e["actor"]["email"],
                    t.get("type"),
                    t.get("label"),
                    e["ip"],
                    e["user_agent"],
                    e["request_id"],
                    " ".join(e["flags"]),
                    json.dumps(e["changes"], default=str) if e["changes"] else "",
                )
            ]
        )
    filters = {k: v for k, v in f.model_dump(mode="json", by_alias=True).items() if v not in (None, False, "")}
    audit.record("admin.audit_exported", audit.actor_of(admin), meta, changes={"filters": filters, "rows": len(docs)})
    return out.getvalue(), len(docs)
