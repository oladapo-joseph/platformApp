"""
Audit events for every access and account action (D-14, US-7.7). Recording
starts in P2; the admin viewer ships in P4.

Never pass passwords, tokens or full session IDs in `changes` or labels.
A failed write is logged, never raised: an audit outage must not lock users out.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal

from bson import ObjectId

from app.db.mongo import WAT
from app.repositories import get_repos

log = logging.getLogger(__name__)

Outcome = Literal["success", "failure"]
SUSPICIOUS_FAILURES, SUSPICIOUS_WINDOW = 10, timedelta(minutes=15)

CATEGORY = {"access_request": "access", "invite": "access", "auth": "sign_in", "account": "account", "admin": "admin"}


@dataclass(frozen=True)
class RequestMeta:
    ip: str | None
    user_agent: str | None
    request_id: str | None

    @staticmethod
    def system() -> "RequestMeta":
        return RequestMeta(None, None, None)


def actor_of(user: dict[str, Any] | None) -> dict[str, Any]:
    if not user:
        return {"kind": "anonymous", "id": None, "email": None, "name": None}
    return {
        "kind": "admin" if user.get("role") == "admin" else "user",
        "id": user["_id"],
        "email": user.get("email") or user.get("username"),
        "name": user.get("display_name"),
    }


SYSTEM_ACTOR = {"kind": "system", "id": None, "email": None, "name": "System"}


def target(kind: str, target_id: ObjectId | None, label: str | None) -> dict[str, Any]:
    return {"type": kind, "id": target_id, "label": label}


def record(
    action: str,
    actor: dict[str, Any],
    meta: RequestMeta,
    *,
    target: dict[str, Any] | None = None,
    outcome: Outcome = "success",
    changes: dict[str, Any] | None = None,
) -> None:
    now = datetime.now(WAT)
    event: dict[str, Any] = {
        "at": now,
        "action": action,
        "category": CATEGORY.get(action.split(".")[0], "other"),
        "actor": actor,
        "target": target,
        "outcome": outcome,
        "ip": meta.ip,
        "user_agent": (meta.user_agent or "")[:300] or None,
        "request_id": meta.request_id,
        "changes": changes,
        "flags": [],
    }
    try:
        repo = get_repos().audit
        if (
            action == "auth.login_failed"
            and target
            and target.get("label")
            and repo.count(action, target["label"], now - SUSPICIOUS_WINDOW) + 1 >= SUSPICIOUS_FAILURES
        ):
            event["flags"] = ["suspicious"]
        repo.insert(event)
    except Exception:
        log.exception("audit write failed for %s", action)
