"""
The email design system (docs/11-email-design-system.md): one layout, a few blocks.

Email clients are not browsers. Gmail strips <style> in some views, Outlook for
Windows renders with Word, and images are often blocked. So:
  * layout is nested tables, 600 px wide, every style inline;
  * the light theme is the base (it survives clients that force-invert colours);
    a dark theme is layered on with prefers-color-scheme for clients that honour it;
  * the logo is the official PNG lockup with alt text; nothing depends on it loading;
  * every block also renders as plain text, so the text part says exactly the same.
Colours come from design/tokens.css; subtle tints are pre-blended onto the surface.
"""

import re
from dataclasses import dataclass
from html import escape

# ── tokens (design/tokens.css; light = base, dark = override) ────────────────

LIGHT = {
    "canvas": "#F6F7F9",
    "surface": "#FFFFFF",
    "border": "#E6E9EF",
    "text": "#0E131C",
    "text2": "#465063",
    "muted": "#5E677A",
    "brand": "#00805F",
    "on_brand": "#FFFFFF",
    "info_bg": "#E8EFFA",
    "info_bar": "#1D63C9",
    "warn_bg": "#FDF2DD",
    "warn_bar": "#8F5B00",
    "sunken": "#EEF0F4",
}
DARK = {
    "canvas": "#0B0E13",
    "surface": "#12161D",
    "border": "#2C3240",
    "text": "#E9ECF2",
    "text2": "#AEB4C2",
    "muted": "#8A91A2",
    "brand": "#00C896",
    "on_brand": "#04130E",
    "info_bg": "#1D2938",
    "info_bar": "#6CB2FF",
    "warn_bg": "#2D2921",
    "warn_bar": "#F5B841",
    "sunken": "#080A0E",
}
FONT = "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "'IBM Plex Mono',ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace"
WIDTH = 600
LOGO_W, LOGO_H = 152, 32  # @2x PNGs are 606×128; brand minimum is 120 px wide

DISCLAIMER = (
    "EquityLensNG provides market data and educational analysis, not investment advice. "
    "Signals and AI interpretations can be wrong."
)


def _t(key: str) -> str:
    return LIGHT[key]


# ── blocks ───────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Heading:
    """One per email, first in the card: what this email is about, in a few words."""

    text: str

    def html(self) -> str:
        return (
            f'<h1 class="el-text" style="margin:0 0 16px;font-family:{FONT};font-size:22px;line-height:30px;'
            f'font-weight:600;color:{_t("text")}">{escape(self.text)}</h1>'
        )

    def plain(self) -> str:
        return self.text


@dataclass(frozen=True)
class Paragraph:
    text: str
    muted: bool = False

    def html(self) -> str:
        color, cls = (_t("text2"), "el-text2") if self.muted else (_t("text"), "el-text")
        size = "15px;line-height:22px" if self.muted else "16px;line-height:24px"
        return (
            f'<p class="{cls}" style="margin:0 0 16px;font-family:{FONT};font-size:{size};color:{color}">'
            f"{escape(self.text)}</p>"
        )

    def plain(self) -> str:
        return self.text


@dataclass(frozen=True)
class Button:
    """The single primary action. Bulletproof: the coloured cell is the button, so it shows without images/CSS."""

    label: str
    url: str

    def html(self) -> str:
        url, label = escape(self.url, quote=True), escape(self.label)
        return (
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">'
            f'<tr><td class="el-btn" align="center" bgcolor="{_t("brand")}" style="border-radius:8px;'
            f'background:{_t("brand")}">'
            f'<a class="el-btn-a" href="{url}" target="_blank" style="display:inline-block;padding:13px 24px;'
            f"font-family:{FONT};font-size:16px;line-height:20px;font-weight:600;color:{_t('on_brand')};"
            f'text-decoration:none;border-radius:8px">{label}</a></td></tr></table>'
            # copy-paste fallback: some clients mangle buttons, and people forward emails
            f'<p class="el-muted" style="margin:0 0 16px;font-family:{FONT};font-size:13px;line-height:20px;'
            f'color:{_t("muted")}">Button not working? Copy this link into your browser:<br>'
            f'<a class="el-link" href="{url}" style="color:{_t("brand")};word-break:break-all">{escape(self.url)}</a>'
            "</p>"
        )

    def plain(self) -> str:
        return f"{self.label}:\n{self.url}"


@dataclass(frozen=True)
class Details:
    """Facts the reader may need to act: who invited them, when a link expires."""

    rows: tuple[tuple[str, str], ...]

    def html(self) -> str:
        cells = "".join(
            f'<tr><td class="el-text2" style="padding:6px 16px 6px 0;font-family:{FONT};font-size:14px;'
            f'line-height:20px;color:{_t("text2")};white-space:nowrap;vertical-align:top">{escape(k)}</td>'
            f'<td class="el-text" style="padding:6px 0;font-family:{FONT};font-size:14px;line-height:20px;'
            f'font-weight:600;color:{_t("text")}">{escape(v)}</td></tr>'
            for k, v in self.rows
        )
        return (
            f'<table role="presentation" class="el-sunken" cellpadding="0" cellspacing="0" border="0" '
            f'width="100%" style="margin:0 0 20px;background:{_t("sunken")};border-radius:8px">'
            f'<tr><td style="padding:10px 16px"><table role="presentation" cellpadding="0" cellspacing="0" '
            f'border="0">{cells}</table></td></tr></table>'
        )

    def plain(self) -> str:
        return "\n".join(f"{k}: {v}" for k, v in self.rows)


@dataclass(frozen=True)
class Callout:
    """A short aside. info: reassurance or context. warning: security ("Wasn't you? …")."""

    text: str
    tone: str = "info"

    def html(self) -> str:
        bg, bar = (_t("warn_bg"), _t("warn_bar")) if self.tone == "warning" else (_t("info_bg"), _t("info_bar"))
        cls = "el-warn" if self.tone == "warning" else "el-info"
        return (
            f'<table role="presentation" class="{cls}" cellpadding="0" cellspacing="0" border="0" width="100%" '
            f'style="margin:0 0 20px;background:{bg};border-left:4px solid {bar};border-radius:4px">'
            f'<tr><td class="el-text" style="padding:12px 16px;font-family:{FONT};font-size:14px;'
            f'line-height:21px;color:{_t("text")}">{escape(self.text)}</td></tr></table>'
        )

    def plain(self) -> str:
        return self.text


@dataclass(frozen=True)
class Divider:
    def html(self) -> str:
        return (
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td class="el-border" style="border-top:1px solid {_t("border")};font-size:0;line-height:0;'
            'height:1px;padding:0 0 20px">&nbsp;</td></tr></table>'
        )

    def plain(self) -> str:
        return "—"


Block = Heading | Paragraph | Button | Details | Callout | Divider


# ── the layout ───────────────────────────────────────────────────────────────

_DARK_CSS = f"""
:root {{ color-scheme: light dark; supported-color-schemes: light dark; }}
@media (prefers-color-scheme: dark) {{
  .el-canvas {{ background:{DARK["canvas"]} !important; }}
  .el-card {{ background:{DARK["surface"]} !important; border-color:{DARK["border"]} !important; }}
  .el-text {{ color:{DARK["text"]} !important; }}
  .el-text2 {{ color:{DARK["text2"]} !important; }}
  .el-muted {{ color:{DARK["muted"]} !important; }}
  .el-link {{ color:{DARK["brand"]} !important; }}
  .el-btn {{ background:{DARK["brand"]} !important; }}
  .el-btn-a {{ color:{DARK["on_brand"]} !important; }}
  .el-sunken {{ background:{DARK["sunken"]} !important; }}
  .el-info {{ background:{DARK["info_bg"]} !important; border-left-color:{DARK["info_bar"]} !important; }}
  .el-warn {{ background:{DARK["warn_bg"]} !important; border-left-color:{DARK["warn_bar"]} !important; }}
  .el-border {{ border-top-color:{DARK["border"]} !important; }}
  .el-logo-light {{ display:none !important; }}
  .el-logo-dark {{ display:block !important; width:{LOGO_W}px !important; height:{LOGO_H}px !important;
                  max-height:none !important; overflow:visible !important; }}
}}
@media (max-width: 620px) {{
  .el-card-pad {{ padding:28px 20px !important; }}
  .el-outer-pad {{ padding:16px 12px !important; }}
}}
a {{ text-decoration-skip-ink:auto; }}
"""


def render_html(subject: str, preheader: str, blocks: tuple[Block, ...], reason: str, logo_url: str | None) -> str:
    body = "".join(b.html() for b in blocks)
    # Preheader: the inbox preview line. Padding stops clients pulling body text in after it.
    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;'
        f'color:{_t("canvas")}">{escape(preheader)}{"&#8199;&#65279;&#847; " * 40}</div>'
    )
    if logo_url:
        dark_url = re.sub(r"-light(?=(@|%40)2x)", "-dark", logo_url)  # @ may arrive URL-encoded
        logo = (
            f'<img class="el-logo-light" src="{escape(logo_url, quote=True)}" width="{LOGO_W}" height="{LOGO_H}" '
            f'alt="EquityLens NG" style="display:block;border:0;outline:none;width:{LOGO_W}px;height:{LOGO_H}px;'
            f'font-family:{FONT};font-size:18px;font-weight:600;color:{_t("brand")}">'
            f'<img class="el-logo-dark" src="{escape(dark_url, quote=True)}" width="{LOGO_W}" height="{LOGO_H}" '
            f'alt="EquityLens NG" style="display:none;mso-hide:all;border:0;width:0;height:0;max-height:0;'
            f'overflow:hidden">'
        )
    else:  # no public asset host (local dev): the name, in brand colour, never a re-typed wordmark
        logo = (
            f'<span class="el-link" style="font-family:{FONT};font-size:18px;font-weight:600;'
            f'color:{_t("brand")}">EquityLensNG</span>'
        )
    footer = (
        f'<p class="el-muted" style="margin:0 0 8px;font-family:{FONT};font-size:13px;line-height:20px;'
        f'color:{_t("muted")}">{escape(reason)}</p>'
        f'<p class="el-muted" style="margin:0;font-family:{FONT};font-size:12px;line-height:18px;'
        f'color:{_t("muted")}">{escape(DISCLAIMER)}</p>'
    )
    return f"""<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{escape(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&amp;display=swap" rel="stylesheet">
<style>{_DARK_CSS}</style>
</head>
<body class="el-canvas" style="margin:0;padding:0;background:{_t("canvas")};-webkit-text-size-adjust:100%">
{pre}
<table role="presentation" class="el-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_t("canvas")}" style="background:{_t("canvas")}">
<tr><td align="center" class="el-outer-pad" style="padding:32px 16px">
<table role="presentation" width="{WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:{WIDTH}px">
<tr><td style="padding:0 4px 20px">{logo}</td></tr>
<tr><td class="el-card el-card-pad" bgcolor="{_t("surface")}" style="background:{_t("surface")};border:1px solid {_t("border")};border-radius:12px;padding:36px 36px 20px">{body}</td></tr>
<tr><td style="padding:20px 4px 0">{footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"""


def render_text(blocks: tuple[Block, ...], reason: str) -> str:
    parts = [b.plain() for b in blocks]
    return "\n\n".join(parts) + f"\n\n--\n{reason}\n{DISCLAIMER}\n"
