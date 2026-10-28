"""
Render every template to files for review: filled with sample values, plus the raw
template exactly as synced to Resend. Open index.html in a browser; switch the OS
theme to see the dark variant.
"""

import html
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.emails import OutgoingEmail, all_specs, make
from app.emails._format import when

_SOON = datetime.now(UTC) + timedelta(days=7)
SAMPLES = {
    "NAME": "Ada",
    "INVITER": "Tunde Bakare",
    "INVITEE_EMAIL": "ada.obi@example.com",
    "ACCOUNT_EMAIL": "ada.obi@example.com",
    "REQUEST_EMAIL": "kemi@example.com",
    "OLD_EMAIL": "ada.obi@example.com",
    "NEW_EMAIL": "ada@obi.ng",
    "EXPIRES_AT": when(_SOON),
    "CHANGED_AT": when(datetime.now(UTC)),
    "MINUTES": "30",
    "ACTION_URL": "https://app.equitylens.ng/sample-link-not-real",
}


def sample(spec_alias: str) -> OutgoingEmail:
    spec = next(s for s in all_specs() if s.alias == spec_alias)
    return make("ada.obi@example.com", spec, **{v.key: SAMPLES.get(v.key) for v in spec.variables})


def render_all(out: Path, logo_url: str | None) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    written, cards = [], []
    for spec in all_specs():
        email = sample(spec.alias)
        (out / f"{spec.alias}.html").write_text(email.html(logo_url), encoding="utf-8")
        (out / f"{spec.alias}.template.html").write_text(spec.html(logo_url), encoding="utf-8")
        (out / f"{spec.alias}.txt").write_text(f"Subject: {email.subject}\n\n{email.text}", encoding="utf-8")
        written.append(out / f"{spec.alias}.html")
        cards.append(
            f"<section><h2>{html.escape(spec.name)} <code>{spec.alias}</code></h2>"
            f"<p><b>Sent when:</b> {html.escape(spec.trigger)} · <b>Subject:</b> {html.escape(spec.subject)} · "
            f"<b>Variables:</b> {', '.join(v.key for v in spec.variables)} · "
            f'<a href="{spec.alias}.txt">plain text</a> · <a href="{spec.alias}.template.html">raw template</a></p>'
            f'<iframe src="{spec.alias}.html" title="{html.escape(spec.name)}" loading="lazy"></iframe></section>'
        )
    (out / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>EquityLensNG emails</title>"
        "<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:760px}"
        "iframe{width:100%;height:900px;border:1px solid #ccc;border-radius:8px}"
        "section{margin:0 0 40px}code{font-size:13px}</style>"
        f"<h1>EquityLensNG emails ({len(cards)})</h1>" + "".join(cards),
        encoding="utf-8",
    )
    return written
