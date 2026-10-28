"""Company metadata from `industry_data` (crawler-owned, read-only)."""

from typing import Any

from pymongo.database import Database

from app.repositories.bars_repo import num

_DIRECTORY = {
    "symbol": 1,
    "companyname": 1,
    "sector": 1,
    "subsector": 1,
    "sharesoutstanding": 1,
    "similarsector": 1,
    "_id": 0,
}
_PROFILE = {
    **_DIRECTORY,
    "website": 1,
    "logourl": 1,
    "companyprofilesummary": 1,
    "natureofbusiness": 1,
    "datelisted": 1,
    "marketclassification": 1,
}


def _clean(doc: dict[str, Any]) -> dict[str, Any]:
    sim = doc.get("similarsector")
    return {
        "symbol": str(doc.get("symbol") or "").strip().upper(),
        "company": str(doc.get("companyname") or "").strip(),
        "sector": str(doc.get("sector") or "").strip().upper(),
        "subsector": str(doc.get("subsector") or "").strip().strip('"'),
        "shares_outstanding": num(doc.get("sharesoutstanding")),
        "similarsector": {str(k).upper(): float(v) for k, v in sim.items() if num(v) is not None}
        if isinstance(sim, dict)
        else {},
    }


class IndustryRepo:
    def __init__(self, db: Database) -> None:
        self.col = db["industry_data"]

    def directory(self) -> list[dict[str, Any]]:
        """One row per symbol (first wins on duplicates)."""
        seen: dict[str, dict[str, Any]] = {}
        for doc in self.col.find({}, _DIRECTORY):
            row = _clean(doc)
            if row["symbol"] and row["symbol"] not in seen:
                seen[row["symbol"]] = row
        return list(seen.values())

    def profile(self, symbol: str) -> dict[str, Any] | None:
        doc = self.col.find_one({"symbol": {"$in": [symbol, symbol.lower(), symbol.title()]}}, _PROFILE)
        if not doc:
            return None

        def text(key: str) -> str | None:
            v = str(doc.get(key) or "").strip()
            return v or None

        return {
            **_clean(doc),
            "website": text("website"),
            "logo_url": text("logourl"),
            "summary": text("companyprofilesummary"),
            "nature_of_business": text("natureofbusiness"),
            "date_listed": text("datelisted"),
            "market_classification": text("marketclassification"),
        }
