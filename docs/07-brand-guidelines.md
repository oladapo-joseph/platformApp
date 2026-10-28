# 07 — Brand Guidelines & Logo

> Status: **Logo v2 for review** · Colour and type decided (ADR-010) · Assets: [`brand/`](../brand/)

## 1. Name

- In prose: **EquityLensNG**, joined, with capitals E, L, N, G (decided 2026-10-26, D-08). The model is MTNNG: a master brand plus a market code.
- Short form in UI chrome where space is tight: **EquityLens**.
- Tagline (carried over): *Clarity · Insight · Advantage*. Plain-language alternative for the landing page: *See the Nigerian market clearly.*
- Never: "Equity Lens", "EQUITYLENS", "Equitylensng", "EquityLens-NG".
- Screen readers: give the logo the accessible name "EquityLens NG" (with a space) so it's read as "EquityLens N G" rather than as one word. Visible text stays EquityLensNG.

### Scaling to other markets

The name ties the product to Nigeria, which is right for launch. The logo is already built to scale: the wordmark is **`EquityLens` + a market tag**, so a future Ghana or Kenya product becomes `EquityLens` + `GH` / `KE` without a redesign. **EquityLens** could then become the group name, as MTN Group sits above MTNNG. That decision waits until expansion is real.

## 2. Logo review: v1 → v2

| | v1 (`static/logo.png`) | v2 (`brand/*.svg`) |
| --- | --- | --- |
| Format | 467×377 raster PNG | Vector SVG, plus PNG exports |
| Background | Opaque black; can't sit on light surfaces | Transparent; separate dark and light variants |
| Detail | Gradient ring, glow, 4 candles, a white candle, an arrow | Flat ring, 3 ascending candles, no arrow (the rising candles already say "up") |
| Small sizes | Detail turns to noise below ~48 px | Dedicated simplified mark for ≤ 24 px and a favicon tile |
| Wordmark | None (typed text in the app) | Outlined **EquityLens** in IBM Plex Sans SemiBold + `NG` tag. No font dependency |
| Colour | Unspecified greens | Tokens: `#00C896` on dark, `#009E78` ring and `#00805F` text on light |

**What we kept:** the lens + candlestick idea, which says "looking closely at equities", and the green. **What changed:** simplification, a vector source, light/dark versions, a lockup with the name, and small-size legibility.

`static/logo.png` is still used by the live Streamlit app and is **not modified**.

## 3. Asset inventory (`brand/`)

| File | Use |
| --- | --- |
| `equitylens-logo-horizontal-dark.svg` / `-light.svg` | Primary lockup: app top bar, landing page, emails, docs |
| `equitylens-mark-dark.svg` / `-light.svg` | The mark alone, ≥ 32 px: sidebar (collapsed), loading screen, social avatar |
| `equitylens-mark-small-dark.svg` / `-light.svg` | 16–24 px UI use (heavier ring, no wicks) |
| `equitylens-mark-mono.svg` | Single colour via `currentColor`: print, watermarks, chart attribution |
| `favicon.svg` | Browser tab (dark rounded tile, simplified mark) |
| `app-icon.svg` | PWA / home-screen icon source |
| `png/favicon-16.png`, `png/favicon-32.png` | Legacy favicon fallbacks |
| `png/apple-touch-icon-180.png`, `png/icon-192.png`, `png/icon-512.png` | iOS and PWA manifest icons |
| `png/equitylens-mark-{dark,light}-512.png` | Social, app stores, slide decks |
| `png/equitylens-logo-horizontal-{dark,light}@2x.png` | Places that can't take SVG (some email clients, docs tools) |

**Regenerating:** the SVGs are produced by [`brand/generate_logo.py`](../brand/generate_logo.py). fontTools outlines the wordmark from IBM Plex Sans SemiBold, and the geometry is on a 64×64 grid. The PNGs are rendered from the SVGs with headless Chrome on a transparent background. If the mark changes, regenerate every file together and note it in `CHANGELOG.md`.

## 4. Usage rules

- **Clear space:** at least the height of one candle body (≈ ¼ of the mark height) on every side.
- **Minimum size:** horizontal lockup ≥ 120 px wide (24 px tall); full mark ≥ 32 px; below that, use `mark-small` or the favicon.
- **Backgrounds:** use the `-dark` files on `--color-bg-canvas`/`surface` dark (or any background darker than `#3A4254`), and the `-light` files on white or light greys. On photos, place the mark on a solid tile.
- **Do:** use the files as supplied; scale proportionally; use the mono version when only one colour is available.
- **Don't:** recolour the ring outside the brand tokens; add glows, gradients, or shadows; rotate it; re-type the wordmark in another font; put the dark-variant candles (light grey) on a white background; stretch it.

## 5. Brand colour & type (summary)

| | Dark | Light |
| --- | --- | --- |
| Lens Green (brand) | `#00C896` | `#00805F` text/buttons · `#009E78` graphics |
| Ink | `#0B0E13` canvas | `#0E131C` text |
| Typefaces | IBM Plex Sans (UI) · IBM Plex Mono (numbers, tickers) | same |

The full system is in [`06-design-system.md`](06-design-system.md).

## 6. Voice

Calm, plain, specific, and honest about uncertainty. We explain, never hype; we inform, never advise. See [`06-design-system.md` §9](06-design-system.md#9-content--voice).
