# 06 — Design System: "Lens"

> Status: **v0.2 (2026-10-28)**. Colour and typography were **decided 2026-10-26**: palette A · Lens Green with IBM Plex Sans + Plex Mono (ADR-010; the options compared are in [`design/options.html`](../design/options.html)). **v0.2 is the owner's "Depth + Editorial headline" direction:** layered navy surfaces with soft elevation in dark mode, sparklines, solid change pills, and a **Fraunces** display serif for page headlines and card titles (ADR-010 amended). The directions compared are on the owner's private design canvas: https://claude.ai/artifact/CMSSf8YwJtVn8d5Yfv2NHF
> Tokens: [`design/tokens.css`](../design/tokens.css) · Visual reference: open [`design/preview.html`](../design/preview.html) in a browser · Brand: [`07-brand-guidelines.md`](07-brand-guidelines.md)

## 1. Design principles

1. **Clarity before density.** Lead with the one number that matters (price, change, freshness), then reveal depth on demand. Ada and Tunde use the same screens: progressive disclosure, not separate modes.
2. **Honest data.** Always show *when* the data is from (WAT). Never imply real-time. Show empty, partial, and stale states plainly.
3. **Direction is never colour alone.** Every gain or loss pairs colour with a sign (`+`/`−`) **and** an arrow (▲/▼). About 1 in 12 men has a red–green colour vision deficiency.
4. **AI is labelled.** Anything model-generated sits in the violet AI treatment, with disclaimer, model, and timestamp.
5. **Calm by default, with depth.** Layered navy surfaces lifted by soft elevation rather than outlines; colour is reserved for meaning (brand action, gain/loss, AI, alerts). The one glow is the active navigation item (dark mode). No gradients or glows on data.
7. **Tell the day like an editor.** A page leads with a plain-language headline in the display serif and a one-sentence standfirst built from the numbers by template (never AI), then the detail.
6. **Mobile is first-class.** Design at 360 px first, then enhance. Touch targets ≥ 44 px.

## 2. Colour

All values are in [`tokens.css`](../design/tokens.css). Contrast was checked against WCAG 2.2: text ≥ 4.5:1, UI boundaries ≥ 3:1.

### 2.1 Neutrals

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--color-bg-canvas` | `#070B14` (deep navy) | `#F3F5F9` | Page background |
| `--color-bg-surface` | `#0F1626` | `#FFFFFF` | Cards, panels |
| `--color-bg-nav` | `#0A101C` | `#FFFFFF` | Sidebar, bottom nav |
| `--color-bg-raised` | `#141D31` | `#FFFFFF` + shadow | Menus, popovers, dialogs |
| `--color-bg-sunken` | `#0A101C` | `#EEF2F7` | Chart plot area, inset wells, bar tracks |
| `--color-bg-selected` | `#10241F` | `#EBF8F3` | Selected row, active nav item, lead story |
| `--color-border-subtle` / `-default` | `#172033` / `#1F2A40` | `#E8ECF2` / `#DCE1EA` | Dividers / outlines (cards use elevation, §5) |
| `--color-border-input` | `#61708F` (3.5:1) | `#848C9C` (3.4:1) | Form-field boundaries |
| `--color-text-primary` | `#EDF1F8` (17.5:1) | `#0E1526` (18.6:1) | Body, headings, numbers |
| `--color-text-secondary` | `#B4BED0` (9.6:1) | `#3A4660` (9.6:1) | Supporting text, labels |
| `--color-text-muted` | `#8D98AE` (6.2:1) | `#5B6780` (5.9:1) | Captions, timestamps, axis labels. **Lowest allowed text colour** |

The legacy muted `#6B7280` (3.96:1 on the old background) is retired.

### 2.2 Brand, market, and feedback colours

| Token | Dark | Light | Meaning |
| --- | --- | --- | --- |
| `--color-brand` | `#00C896` | `#00805F` | Lens Green: primary action, active nav, focus ring, links |
| `--color-gain` | `#2FD38F` | `#047A4E` | Price up (+ ▲) |
| `--color-loss` | `#FF6B81` | `#C42343` | Price down (− ▼) |
| `--color-unchanged` | `#B4BED0` | `#3A4660` | No change (0.00% ■) |
| `--color-gain-pill` / `--color-on-gain-pill` | `#2FD38F` / `#04130E` | `#D9F3E7` / `#035C3B` | Solid change pill in ranked lists (movers, stock header) |
| `--color-loss-pill` / `--color-on-loss-pill` | `#FF7A8E` / `#1A0509` | `#FBE1E6` / `#9E1A35` | Same, for falls |
| `--color-brand-glow` | `rgb(0 200 150 / 0.18)` | none | The active nav item's halo (the only glow) |
| `--color-danger` | `#FF6B81` | `#C42343` | Errors, destructive actions |
| `--color-warning` | `#F5B841` | `#8F5B00` | Stale data, quota near limit |
| `--color-info` | `#6CB2FF` | `#1D63C9` | Neutral notices |
| `--color-ai` | `#B49CFF` | `#6D4ED8` | AI-generated content |

Each also has a `-subtle` variant (10–18% alpha) for tinted backgrounds such as badges, banners, and the selected row.

**Brand vs gain.** Lens Green and gain green are the same hue family on purpose: the brand is about growth. To avoid confusion, primary buttons never sit inside price data, and gain text always carries `+`/▲.

### 2.3 Chart palette

| Series | Token | Dark | Light |
| --- | --- | --- | --- |
| Up candle / down candle | `--chart-up` / `--chart-down` | `#2FD38F` / `#FF6B81` | `#0E9F6A` / `#D9334F` |
| Line (close) | `--chart-line` | `#00C896` | `#009E78` |
| SMA 50 / SMA 200 | `--chart-sma-50` / `-200` | `#F5B841` / `#FF9F1C` | `#B07A00` / `#C2410C` |
| EMA 12 / EMA 26 | `--chart-ema-12` / `-26` | `#B49CFF` / `#6CB2FF` | `#6D4ED8` / `#1D63C9` |
| Bollinger bands | `--chart-bollinger` | `#8A91A2` dashed | `#848C9C` dashed |
| Buy / sell markers | `--chart-signal-buy` / `-sell` | ▲ below bar / ▼ above bar | same, light values |
| Sector heat (treemap) | loss → `--chart-heat-neutral` → gain | diverging, clamped at ±5% | same, light values |
| Compare lines, in order | `--chart-series-1` … `-4` | `#00A87E` `#4A8EDE` `#BC8820` `#8E78E2` | `#009E78` `#1D63C9` `#B07A00` `#6D4ED8` |

Overlay lines also differ by **dash pattern** (SMA solid, EMA dashed, BB dotted), so they stay distinguishable without colour.

Compare (US-3.10) uses the series tokens in fixed order, never cycled: a stock keeps its colour while others are added or removed after it. They are the existing chart hues, stepped into each theme's lightness band and checked for colour-blind separation (adjacent ΔE ≥ 15 for deuteranopia, contrast ≥ 3:1 on the chart background). Stocks are solid; a sector average is dashed in its stock's colour; the all-stock average is dotted `--chart-axis`. A legend names every line, so colour is never the only cue.

## 3. Typography

| Role | Font | Size/line | Weight | Notes |
| --- | --- | --- | --- | --- |
| Headline (market headline, landing hero) | **Fraunces** (`font-headline`) | 48–60/1.05 | 600 | `--tracking-tight`; one per page |
| Page and card titles | **Fraunces** (`font-headline`) | 30–36 page, 20 card | 600 | Never body copy, labels, numbers or tickers |
| Price headline | **Plex Mono** | 36/40 (`4xl`) | 500 | tabular-nums |
| Body | Plex Sans | 16/24 | 400 | |
| Secondary / table cell | Plex Sans | 14/20 | 400 | numbers in table cells use Mono |
| Overline / label | Plex Sans | 12/16 | 500 | UPPERCASE, `--tracking-overline`. Short labels only |
| Numbers, tickers, prices, % | **Plex Mono** | inherits | 400–500 | `font-variant-numeric: tabular-nums` and right-aligned in tables |
| Caption, timestamps, axis | Plex Sans | 12/16 | 400 | `--color-text-muted` |

**Rules:** 12 px is the floor. Avoid letter-spacing beyond overlines. Fonts are self-hosted with Fontsource (`display: swap`, unicode-range subsets; the CSP allows no third-party fonts): Sans 400/500/600, Mono 400/500, Fraunces 600 only. `index.html` preloads the three files the first screen needs: Fraunces 600 and Plex Sans 400 (Latin), plus Plex Sans 400 latin-ext, which holds ₦ (U+20A6). Without the preloads the headline reflows when they swap in and shifts the page.

### Number formatting (`lib/format.ts`)

| Kind | Format | Example |
| --- | --- | --- |
| Price | `₦` + 2 dp, grouped | ₦1,234.50 |
| Change | sign + 2 dp, arrow | ▲ +12.40 · ▼ −3.10 |
| Percent | sign + 2 dp + `%` | +2.31% · −0.45% · 0.00% |
| Large money | compact, 1 dp | ₦1.2B · ₦845.3M · ₦12.4K |
| Volume | compact, no currency | 12.4M |
| Date | `26 Oct 2026` · time `14:35 WAT` | always label WAT |
| Missing | em dash | — |

Use the true minus sign `−` (U+2212) in display. Screen-reader text reads "down 3.10 naira, minus 0.45 percent".

## 4. Spacing, layout & grid

- **4 px base grid.** Tokens `--space-1` (4) to `--space-20` (80). Component padding uses 8/12/16; section gaps 24/32.
- **Breakpoints** (Tailwind defaults): `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536.
- **App shell:**
  - **< 768** — top bar (logo, search icon, freshness, avatar) + **bottom nav** (Market · News · Watchlist · Account). Search lives in the top bar. 16 px gutters. Single column.
  - **768–1023** — top bar + collapsible icon rail (72 px). 24 px gutters. Two-column where useful.
  - **≥ 1024** — 240 px sidebar + 56 px top bar with persistent search. 32 px gutters. 12-column content grid, max 1440 px.
- **Density:** comfortable by default. Tables offer a "Compact" toggle (row height 40 → 32 px, pointer: fine only).

## 5. Shape, elevation & motion

- **Radius:** 4 badges · 8 buttons/inputs · 16 cards (`rounded-lg`) · 20 hero panels and dialogs (`rounded-xl`) · full pills.
- **Elevation:** surfaces separate by depth, not outlines. Cards and tiles use `shadow-elev-1` (`--shadow-card`: a hairline top highlight plus a soft shadow in dark, a soft shadow in light); the page's lead panel (market headline, stock header) uses `shadow-elev-2` (`--shadow-hero`). Overlays keep `--shadow-md`/`-lg`. Cards keep a transparent border so forced-colors mode still outlines them.
- **Motion:** 80–320 ms with `--ease-standard`. Animate opacity and transform only. Number changes may flash a subtle tint (`-subtle` background) for 600 ms, *never* blink. All durations drop to 0 under `prefers-reduced-motion`.

## 6. Components

Each component is built on a Radix primitive where one exists, lives in `frontend/src/components/ui/`, and uses only tokens (no raw hex). States: default · hover · focus-visible · active · disabled · loading · error, where applicable.

| Component | Variants / sizes | Key behaviour & accessibility |
| --- | --- | --- |
| **Button** | `primary` (brand fill), `secondary` (outline), `ghost`, `danger`; sm 32 / md 40 / lg 44 | `<button>`; loading keeps width and sets `aria-busy`; icon-only buttons require `aria-label`; never disabled without an explanation nearby |
| **Input / PasswordInput** | default, error; with label, hint, error text | Label always visible (no placeholder-as-label); error linked via `aria-describedby`; password show/hide toggle |
| **SymbolSearch** (combobox) | inline (top bar), command palette (`/`, ⌘K / Ctrl K) | Radix-style combobox, `role="combobox"`; matches ticker + company name; arrow keys + Enter; recent searches |
| **SegmentedControl** | text, icon | Radix ToggleGroup (single). Used for range `1M 3M 6M 1Y ALL`, Candle/Line, Snapshot/Range |
| **DateRangePicker** | presets + custom | Presets first; calendar in a popover; WAT dates; min/max from `/market/status` |
| **Card** | default, interactive (link), inset | Interactive cards are a single `<a>`, not nested buttons |
| **StatTile** (KPI) | default, with delta, with sparkline | Label (overline) · value (Mono 30) · `PriceChange` · optional sparkline (`aria-hidden`, with the value in text) |
| **PriceChange** | inline, pill; sm/md | Arrow + sign + value + % in gain/loss/unchanged colour; SR text spells out the direction |
| **TickerChip** | default, with change | Mono ticker, links to the stock page |
| **DataTable** | default, compact; sortable; sticky header | `<table>` semantics; `aria-sort` on headers; numbers right-aligned in Mono; virtualised > 100 rows; horizontal scroll inside the card on mobile with the first column sticky |
| **Tabs** | line | Radix Tabs; URL-synced where they change the view |
| **Badge** | neutral, brand, gain, loss, warning, info, ai | Text always readable at 12 px; never the only carrier of meaning |
| **Banner** | info, warning (stale data), danger, ai-disclaimer | `role="status"` (or `alert` for errors); dismissible only when non-critical |
| **Toast** | success, error, info | `aria-live="polite"`; auto-dismiss 5 s, pausing on hover/focus; never for errors that need action |
| **Dialog / Sheet** | centred (desktop), bottom sheet (mobile) | Radix Dialog; focus trap; Esc closes; returns focus |
| **Tooltip** | default | Never holds essential info; also opens on focus |
| **Skeleton** | text, block, chart | Matches final layout to avoid shift; `aria-busy` on the region |
| **EmptyState** | no data, no results, first-run | Icon + one sentence + one action |
| **ErrorState** | inline, full-panel | Plain-language cause + retry; includes a request ID for support |
| **FreshnessStamp** | inline, banner when stale | "Data as of 14:35 WAT · 26 Oct". Turns warning when older than 2 h during market hours |
| **AIInsightCard** | loading, result, quota-exceeded, error | Violet AI treatment, ✦ icon, "AI signal interpretation" title; stance badge; summary; drivers; key levels; confidence; "Headlines considered" list (US-9.5); footer: model · generated time · data date · disclaimer (always visible, not collapsed) |
| **NewsItem** | default, compact (chart tooltip), with ticker chips | Headline (an external link, ↗ icon, `aria-label` "… (opens in a new tab)"), source domain, published time in WAT (relative, absolute on hover/focus) or "Found {date}" when estimated, a 2-line plain-text snippet, and a "Mentions MTNN" or "Sector · ICT" badge. Never full article text |
| **NewsList** | stock panel, top stories, watchlist feed | Groups "Mentions {SYMBOL}" above "Sector news" with headings; empty state; "See all news" link; footer note "News is collected automatically and may be incomplete" |
| **NewsMarker** (chart) | single, count | A small neutral-coloured "N" glyph in the bottom axis band, never on top of signal markers; focusable; tooltip lists the day's headlines |
| **FilterPanel** | desktop rail, mobile bottom sheet | Groups of checkbox/radio facets with counts ("Dividends (12)"); zero-count options disabled but visible; group headings collapsible; mobile sheet ends with "Apply (23 results)". Built on Radix Dialog (sheet) + native fieldset/legend for groups |
| **FilterChips** | active filters, quick filters | Removable chips for active filters ("Topic: Dividends ✕") + "Clear all"; the quick-filter row (Topic, My watchlist, Date) above lists on mobile |
| **TopicChip** | default, active | Neutral chip with the topic label (from the controlled list in [10 §5](10-news-tagging.md#5-controlled-vocabularies)); acts as a link to the filtered News page |
| **AuditLogTable** | desktop table, mobile card list | Time (WAT) · actor · action sentence · target · outcome badge · IP; a row opens a detail drawer (Dialog/Sheet); "Suspicious" uses the warning badge; filter bar synced to the URL |
| **PriceChart** | candle, line; with panes (Volume, RSI, MACD) | Lightweight Charts; theme from tokens; keyboard: ←/→ move crosshair, +/− zoom; a "View as table" toggle exposes the same data; `aria-label` summary e.g. "MTNN, 6 months, up 12.4%, last ₦245.00" |
| **SectorTreemap / MoversScatter** | — | ECharts; same diverging scale; legend in text; table alternative |
| **AppShell** | sidebar, rail, bottom nav | Skip-to-content link; landmarks (`header`, `nav`, `main`); current page `aria-current="page"` |
| **Avatar / UserMenu** | initials | Radix DropdownMenu: Account, Theme, Sign out |

Icons: **Lucide** (ISC licence), 20 px default, 1.75 stroke, `aria-hidden` unless standalone. No emoji in UI chrome.

## 7. Interaction patterns

| Pattern | Rule |
| --- | --- |
| **URL is state** | Symbol, range, strategy, overlays, panels, and market mode live in the query string. Back/forward and sharing work. |
| **Loading** | Skeletons for first load. Keep stale data visible with a subtle progress bar while refetching. Never blank a chart that has data. |
| **Freshness** | Every data screen shows a `FreshnessStamp`. After 15:55 WAT (the close), label it "Closing data". On weekends and holidays, "Last trading day: Fri 24 Oct". |
| **Empty first-run** | The stock page with no symbol shows a search + "Popular: MTNN · DANGCEM · ZENITHBANK · GTCO". Nothing is shown disabled. |
| **Progressive disclosure** | Defaults: candle chart, 6M, volume pane on; RSI/MACD and overlays a tap away under "Indicators". |
| **Signals on the chart** | Selected-strategy markers on the price chart; the list underneath links each marker ↔ row (focus syncs). |
| **AI on demand** | "Explain these signals" button; show the quota left ("3 of 5 today"); cached results appear instantly with "Generated 09:12 WAT". |
| **News & external links** | News always shows its source and date. External links open in a new tab, are marked with ↗, and say so to screen readers. Relevance is never overstated: "About MTNN" (headline), "Mentions MTNN" (body), otherwise "Sector news". |
| **Filtering lists** | Facet counts always reflect the current result set. Every filter and the search live in the URL. Applying filters keeps scroll position on desktop and returns to the top on mobile. An empty result names the most restrictive filter with a one-tap remove. |
| **Forms** | Validate on blur, then on change; submit stays enabled; on error, focus the first invalid field and show a summary. |
| **Destructive actions** | Confirm dialog naming the object ("Delete your account?"), with the destructive button on the right and `danger` variant. |
| **Keyboard** | `/` or ⌘K search · `g m` market · `g w` watchlist · `?` shortcut sheet. All discoverable, all optional. |
| **Errors** | Explain in plain English what happened and what to do; never show raw exceptions. |

## 8. Accessibility baseline (WCAG 2.2 AA)

- Contrast as tokenised. Focus: `--focus-ring-width` solid `--color-focus` with a 2 px offset, on every interactive element, via `:focus-visible`.
- Target size ≥ 24 px everywhere and ≥ 44 px on `(pointer: coarse)`.
- All charts have a text summary and a data-table alternative. Colour is never the only signal (§1.3).
- Live regions: price refresh is **not** announced (too noisy); errors and AI-ready are announced politely.
- Reduced motion honoured; no auto-playing animation on data.
- Language `en-NG`; the currency symbol ₦ has SR text "naira".
- Test: axe in CI (zero serious/critical); manual NVDA + Chrome and VoiceOver + Safari on J1–J4 before launch.

## 9. Content & voice

- **Plain, calm, specific.** "MTNN rose 2.3% today on ₦4.1B traded", not "MTNN is skyrocketing! 🚀".
- Explain indicators in one line on hover/tap ("RSI above 70 often means the stock has risen fast and may cool off").
- **Never imperative advice.** Don't write "Buy now"; write "MACD crossed above its signal line on 21 Oct, a pattern traders read as bullish momentum."
- Standard disclaimer (pending legal review, D-06):
  > *EquityLensNG provides market data and educational analysis, not investment advice. Signals and AI interpretations can be wrong. Do your own research or consult a licensed adviser.*

## 10. Implementation notes (Tailwind v4)

```css
/* frontend/src/styles/globals.css */
@import "tailwindcss";
@import "./tokens.css";              /* copied from /design/tokens.css at build */

/* Theming is done by the CSS variables themselves (data-theme / OS preference),
   so utilities like bg-surface switch automatically. `dark:` variants are rarely needed. */
@theme inline {
  --color-canvas:   var(--color-bg-canvas);
  --color-surface:  var(--color-bg-surface);
  --color-raised:   var(--color-bg-raised);
  --color-fg:       var(--color-text-primary);
  --color-fg-2:     var(--color-text-secondary);
  --color-fg-muted: var(--color-text-muted);
  --color-brand:    var(--color-brand);
  --color-gain:     var(--color-gain);
  --color-loss:     var(--color-loss);
  --color-ai:       var(--color-ai);
  --font-sans:      var(--font-sans);
  --font-mono:      var(--font-mono);
  --radius-card:    var(--radius-lg);
}
```

Chart adapters read tokens at runtime (`getComputedStyle(document.documentElement).getPropertyValue('--chart-up')`) and re-apply on theme change.

**Governance.** Tokens change only via a PR that updates `tokens.css`, this document, and `preview.html` together, bumps the version in the `tokens.css` header, and adds a `CHANGELOG.md` entry. Hard-coded hex values in `frontend/src` are blocked by a lint rule.
