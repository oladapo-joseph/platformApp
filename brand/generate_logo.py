"""Generate EquityLensNG brand SVGs. Wordmark text is outlined to paths (no font dependency).

Usage:  python brand/generate_logo.py <path/to/IBMPlexSans-SemiBold.ttf> brand
Font:   https://github.com/IBM/plex (packages/plex-sans/fonts/complete/ttf). Requires fonttools.
PNG exports in brand/png/ are rendered from these SVGs with headless Chrome (transparent background).
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)

font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]
UPM = font["head"].unitsPerEm


def text_path(text, x, baseline, size, tracking=0.0):
    """Return (svg path d, advance width) for text at (x, baseline)."""
    s = size / UPM
    pen = SVGPathPen(gs)
    cx = x
    for ch in text:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, cx, baseline))
        gs[g].draw(tp)
        cx += hmtx[g][0] * s + tracking
    return pen.getCommands(), cx - x - tracking


# ── Mark geometry (64×64 grid) ───────────────────────────────────────────────
# Lens ring + handle; three ascending candlesticks inside the lens.
CANDLES = [  # (x_center, wick_top, wick_bottom, body_top, body_bottom)
    (19.5, 26.0, 38.0, 28.5, 35.5),
    (27.0, 20.5, 34.5, 23.0, 31.5),
    (34.5, 15.0, 29.0, 17.5, 26.5),
]


def mark(ring, candle, x=0, y=0, scale=1.0, wicks=True):
    body_w = 5.0
    parts = [f'<g transform="translate({x} {y}) scale({scale})">',
             f'<circle cx="27" cy="27" r="18.25" fill="none" stroke="{ring}" stroke-width="5.5"/>',
             f'<path d="M40.6 40.6 L54.5 54.5" stroke="{ring}" stroke-width="7.5" stroke-linecap="round"/>']
    for cx, wt, wb, bt, bb in CANDLES:
        if wicks:
            parts.append(f'<path d="M{cx} {wt} V{wb}" stroke="{candle}" stroke-width="1.75" stroke-linecap="round"/>')
        parts.append(f'<rect x="{cx - body_w / 2}" y="{bt}" width="{body_w}" height="{bb - bt}" rx="1" fill="{candle}"/>')
    parts.append("</g>")
    return "\n  ".join(parts)


def favicon_mark(ring, candle):
    # Simplified for 16–32px: heavier ring, no wicks, three solid bars.
    bars = [(18.0, 29.0, 37.0), (25.0, 23.0, 37.0), (32.0, 17.0, 37.0)]
    out = [f'<circle cx="27" cy="27" r="17.5" fill="none" stroke="{ring}" stroke-width="7"/>',
           f'<path d="M41 41 L54 54" stroke="{ring}" stroke-width="9" stroke-linecap="round"/>']
    for bx, top, bot in bars:
        out.append(f'<rect x="{bx}" y="{top}" width="5.5" height="{bot - top}" rx="1.25" fill="{candle}"/>')
    return "\n  ".join(out)


def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-labelledby="t">\n  <title id="t">{title}</title>\n  {body}\n</svg>\n')


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)


THEMES = {
    # name: (ring/brand, candles, wordmark text, "Lens"+NG accent)
    "dark":  ("#00C896", "#E9ECF2", "#E9ECF2", "#00C896"),
    "light": ("#009E78", "#0E131C", "#0E131C", "#00805F"),
}

for theme, (ring, candle, ink, accent) in THEMES.items():
    write(f"equitylens-mark-{theme}.svg", svg(64, 64, mark(ring, candle), "EquityLens NG"))
    write(f"equitylens-mark-small-{theme}.svg", svg(64, 64, favicon_mark(ring, candle), "EquityLens NG"))

    # Horizontal lockup: mark + "EquityLens" (Equity = ink, Lens = accent) + NG tag
    size, baseline, tx = 34, 44.5, 76
    d1, w1 = text_path("Equity", tx, baseline, size, tracking=-0.3)
    d2, w2 = text_path("Lens", tx + w1 + 1.5, baseline, size, tracking=-0.3)
    tag_x = tx + w1 + 1.5 + w2 + 10
    d3, w3 = text_path("NG", tag_x + 8, baseline - 3.5, 17, tracking=1.2)
    tag_w = w3 + 16
    total_w = round(tag_x + tag_w + 2)
    body = "\n  ".join([
        mark(ring, candle),
        f'<path d="{d1}" fill="{ink}"/>',
        f'<path d="{d2}" fill="{accent}"/>',
        f'<rect x="{tag_x + 0.75}" y="{baseline - 21.75}" width="{tag_w - 1.5}" height="23.5" rx="5.5" fill="none" stroke="{accent}" stroke-width="1.5"/>',
        f'<path d="{d3}" fill="{accent}"/>',
    ])
    write(f"equitylens-logo-horizontal-{theme}.svg", svg(total_w, 64, body, "EquityLens NG"))

# Monochrome (inherits CSS color) — for single-colour print, watermarks, emails
write("equitylens-mark-mono.svg", svg(64, 64, mark("currentColor", "currentColor"), "EquityLens NG"))

# Favicon / app icon: dark rounded tile so it reads on any browser chrome
tile = '<rect width="64" height="64" rx="14" fill="#0B0E13"/>'
write("favicon.svg", svg(64, 64, tile + "\n  " +
                         f'<g transform="translate(3.5 3.5) scale(0.9)">{favicon_mark("#00C896", "#E9ECF2")}</g>',
                         "EquityLens NG"))
write("app-icon.svg", svg(64, 64, tile + "\n  " + mark("#00C896", "#E9ECF2", x=7, y=7, scale=0.78),
                          "EquityLens NG"))
print("written to", OUT)
