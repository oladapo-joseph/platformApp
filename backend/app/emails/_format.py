"""Value formatting shared by the email modules."""

from datetime import datetime

from app.db.mongo import WAT


def when(dt: datetime) -> str:
    """'Tue 4 Nov 2026, 14:05 WAT': unambiguous for every reader (no 04/11 vs 11/04)."""
    local = dt.astimezone(WAT)
    return f"{local:%a} {local.day} {local:%b %Y, %H:%M} WAT"


def first_name(name: str | None) -> str | None:
    return name.split()[0] if name and name.strip() else None
