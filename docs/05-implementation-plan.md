# 05 — Implementation Plan

> Status: **For review** · Estimates assume 1–2 engineers and are ranges, not commitments. They'll be re-estimated at the end of Phase 1.

## Phase overview

```text
P0 Foundations ──► P1 Backend core ──► P2 Auth ──────────────┐
  (this phase)        & data             & accounts           ├─► P4 Insights, ──► P5 Hardening
                         └──────────► P3 Frontend core ───────┘     watchlist,        & launch
                                        (starts once P1 API          admin
                                         schemas are frozen)
```

| Phase | Theme | Est. | Gate to exit |
| --- | --- | --- | --- |
| **P0** | Assessment, scope, architecture, design system, brand, docs, user stories, repo hygiene | 1 wk | Owner sign-off on docs and user stories (D-01, D-07, D-08 ✅; D-03 deferred) |
| **P1** | Backend skeleton, domain port, market and stock APIs, `daily_bars` | 2 wks | API parity tests green; OpenAPI v1 schemas frozen |
| **P2** | Invites + access requests, sessions, reset, legacy-user migration, admin CLI (self-serve sign-up built but off) | 1.5 wks | Auth security checklist passes |
| **P3** | Frontend shell, design-system components, auth screens, market, stock page, landing | 3 wks (overlaps P2) | Journeys J1–J3, J6–J7 pass e2e + axe |
| **P4** | AI insights, watchlist, admin console, usage metrics | 1.5 wks | J4, J5, J8 pass e2e; quota and cache verified |
| **P5** | Security/a11y/perf audits, legal review, staging soak, cutover, retire Streamlit | 1.5 wks | Launch checklist complete |

**Total: ~10–11 weeks.**

---

## P0 — Foundations (current phase)

**Deliverables:**

- [x] Legacy app copied to `streamlitApp/`
- [x] Current-state assessment ([01](01-current-state-assessment.md))
- [x] Scope, users, journeys ([02](02-project-scope.md))
- [x] Target architecture ([03](03-architecture.md)) and ADR log ([04](04-technical-decisions.md))
- [x] This plan
- [x] Design system docs, `design/tokens.css`, `design/preview.html` ([06](06-design-system.md))
- [x] Refreshed logo set in `brand/` + guidelines ([07](07-brand-guidelines.md))
- [x] Dev setup guide ([08](08-development-setup.md)), `CHANGELOG.md`, root `README.md`
- [x] Owner decisions 2026-10-26: invite-only (D-01), crawler owns `daily_bars` (D-07), name **EquityLensNG** (D-08), "interpretation" AI wording (D-06), Gemini as interim AI provider (D-09), palette and type (ADR-010). Hosting deferred (D-03)
- [x] Trimmed `requirements.txt` from ~130 pinned packages to the 10 the app imports, plus `requirements-dev.txt` for pytest (root and `streamlitApp/`)
- [x] User stories for UX ([09](09-user-stories.md)), including news (E9) and the admin audit log
- [x] Later decisions 2026-10-26: audit log in v1.0 (D-14), ASI later (D-12), manual approval for all invites (D-13), **Resend** for email (D-04), **Azure Container Apps** direction (D-03), **no tests tracked** (D-11, `.gitignore` updated), crawler news tagging approved and extended (D-15, design in [10](10-news-tagging.md))
- [x] Owner reviewed the stories and the news-tagging design (2026-10-26); D-05 = **5 AI readings/day**, D-16 = **no on-demand news**
- [ ] Repo hygiene: fix `test_warmup_nans`, rewrite `test_recommender.py` without LangChain, rewrite or remove `test_gemini.py` (it uses LangChain, now uninstalled), rotate keys in `.env`
- [ ] CI skeleton (GitHub Actions): lint, types, and builds only, since tests aren't in the repo
- [ ] Private backup location for the untracked test folders (ADR-011 mitigation)

**Acceptance criteria:**

- Every finding in the assessment has an owner phase.
- All 🔴 findings are mapped to a phase that fixes them before launch.
- Open decisions D-01, D-03, D-07, D-08 are answered (the others can wait for their phases).

---

## P1 — Backend core & data

**Scope.** `backend/` scaffold (uv, ruff, mypy, pytest), config, logging, problem+json errors, Mongo lifecycle, and index creation. Port `indicators`, `signals`, and `similarity` into `domain/` with their tests. Repositories for market, bars, and industry data. Endpoints: `/market/*`, `/stocks/*` (bars, indicators, signals, similar), and `/healthz`/`/readyz`. TTL caching and ETags. Temporary dev-only API-key auth until P2.

News read endpoints (`/stocks/{symbol}/news`, `/news/top`, and the filterable `/news` with facets) over the crawler's `news_articles` (ADR-014).

**Backend status 2026-10-28: built; API frozen as v1.** `backend/` exists with every P1 endpoint (17 paths, OpenAPI at `/api/v1/openapi.json`). Local results against the acceptance criteria:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Parity with the Streamlit loader | ✅ `tests/parity_check.py`, production data, 5 symbols (incl. illiquid AVACAP) × 3M/1Y/3Y: API bars, period stats and all 3 strategies' signals equal an independent recomputation from raw snapshots on every day. All 433 legacy differences (14% of 2,996 symbol-days) are explained: crawl-day blending and shifted labels (C2, verified), ₦0 highs/lows (C6). C5 days fall inside those buckets |
| 2 | Correctness | ✅ Signals per chosen strategy on full history, then sliced (C1). One bar per (symbol, `TradeDate`) (C2). Close = latest priced snapshot (C5). Empty/NaN session-start rows ignored (C6) |
| 3 | Project rules | ✅ Tests assert `adjust=False` EMA and Wilder RSI, plus parity with the legacy functions |
| 4 | Performance | ⚠️ Warm `/market/snapshot` p95 27 ms ✅. Cold 3-year bars 1.1–3.7 s ❌, because `daily_bars` isn't backfilled yet so history aggregates raw `tradesData` (no `fetched_at` index). **Re-measure on staging after `backfill_daily_bars.py --write`** |
| 5 | M0 safety | ✅ `tests/test_m0_pipelines.py` records every pipeline the repositories send; none sorts before `$group` |
| 6 | Coverage, lint, types | ✅ domain 98–100% (94% overall, 43 tests); ruff + mypy green; CI workflow added (`.github/workflows/ci.yml`) |
| 6a | News tagger quality gate | ⏳ needs the owner's hand-labelled sample (`retag_news.py --export`) |
| 7 | OpenAPI frozen as v1 | ✅ Owner sign-off 2026-10-28. Snapshot `backend/openapi-v1.json` (17 paths, 32 schemas); CI fails if the live schema drifts from it. Additive changes only, with the snapshot updated in the same PR |

Changes from the plan: `market_repo` was folded into `bars_repo` (the market views are per-day and per-range bar reads); a small `GET /strategies` endpoint lists the signal strategies; health checks live at `/api/v1/healthz` and `/readyz`.

**Crawler work (ngxPro), shipped separately.** Status 2026-10-26: **built and tested locally; awaiting the owner's Azure deploy**, then `scripts/backfill_daily_bars.py --write` and `scripts/retag_news.py --write`.

1. ADR-007: add the `daily_bars` bulk upsert to `crawler/app.py::run` and deploy it on its own. Then run the one-off per-symbol backfill script, and only then switch platform reads to `daily_bars`.
2. **D-15 (approved): news tagger v2.** One `shared/news_tagging.py` module plus `news_aliases.json` and `news_topics.json`, used by the crawler and `shared/news.py` (copied to function folders per CLAUDE.md). Whole-word, case-aware symbols with corroboration for ambiguous tickers; the `published_at_estimated` flag; topics, scope, regulators, sectors/subsectors, content type, geography, and title-vs-body mentions. The upsert sets tag fields on re-crawl, followed by a one-off re-tag of stored articles and new filter indexes. Full design and rollout: [10 §7](10-news-tagging.md#7-rollout-phase-1-crawler-work).

**Acceptance criteria:**

1. **Parity**: for 5 reference symbols (e.g. MTNN, DANGCEM, ZENITHBANK, OKOMUOIL, plus one illiquid stock) and 3 date ranges, API bars, indicators, signals, and period stats match the Streamlit loader output (numeric tolerance 1e-9; the same signal dates). **Except closes affected by C5**, where every difference is listed and explained by intraday-max vs latest-snapshot.
2. **Correctness**: chart signals follow the selected strategy and are computed on full history (fixes C1). `daily_bars` has exactly one row per (symbol, NGX trade date) (fixes C2) and its close is the latest snapshot (fixes C5). The crawler's `daily_bars` write adds < 2 s to a crawl run.
3. **Project rules**: tests assert `adjust=False` EMA and Wilder RSI (`com=window-1`).
4. **Performance** (staging, warm cache): p95 < 300 ms on `/market/snapshot`; p95 < 800 ms on a cold `/stocks/{s}/bars` for 3 years of data.
5. **M0 safety**: no pipeline sorts raw documents before `$group` (enforced by a repository unit test that inspects pipelines).
6. Domain coverage ≥ 85% (pytest run locally; tests aren't in the repo, D-11). `ruff` and `mypy` are green in CI.
6a. **News tagger v2 quality gate:** on a hand-labelled sample of 100 recent articles, symbol precision is ≥ 95% for headline mentions and ≥ 90% overall, and topic precision is ≥ 85%. None of the documented false-positive cases (e.g. "market cap", "total revenue", "competition", "Mrs …") produce a tag. Results are recorded in the PR.
7. The OpenAPI schema is reviewed and **frozen as v1** (additive changes only afterwards).

---

## P2 — Auth & accounts

**Scope.** **Invites** (admin send, resend, revoke, expiry) and **access requests** (public "request an invite" form, admin approve/decline), accept-invite onboarding, login (email or legacy username), logout, sessions + CSRF, forgot/reset password, change password, delete account, rate limiting and lockout, **audit-event recording** for every access and account event (D-14), admin CLI bootstrap, and the `EmailSender` interface with the **Resend** adapter (D-04) plus a console sender for local development. "Copy invite link" remains available as a fallback channel. Verify the sending domain (SPF, DKIM, DMARC). Self-serve sign-up and verification are built behind `SIGNUP_MODE=open` and stay off.

**Status 2026-10-28: built, in review.** 20 new routes (37 total; contract snapshot updated, every v1 route unchanged except the removed P1 dev-key header). 31 local tests on the in-memory mongod, mapped to the criteria below:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Invite → email → link → name + password → signed in; expired / revoked / reused links | ✅ Plus resend (old link dies), revoke, batch skips (members, duplicates, bad emails), "Copy invite link" when the email fails |
| 1a | Sign-up 403 while invite-only; access requests acknowledged, never enumerate, queued for admins | ✅ Approve sends an invite; decline can send a polite email; 3 requests / IP / hour |
| 2 | Legacy users sign in with username; argon2id upgrade; email prompt | ✅ `needs_email` flag + confirm-email flow. **The Streamlit app keeps working for them** (D-17) |
| 3 | Reset: no enumeration, single-use, 30 min | ✅ Signs out other sessions; a weak new password doesn't burn the link |
| 4 | Cookie `HttpOnly; Secure; SameSite=Lax`; deactivation ends sessions ≤ 60 s | ✅ Immediately (sessions deleted on deactivation) |
| 5 | CSRF | ✅ Signed double-submit token (`el_csrf` + `X-CSRF-Token`) |
| 6 | 6th failed login in a minute → 429 | ✅ Exponential lockout (1, 2, 4 … 15 min); ≥ 10 failures in 15 min flagged suspicious |
| 7 | No default credentials; admin via CLI | ✅ `python -m app.cli create-admin` / `promote` |
| 8 | OWASP ASVS L1 auth/session review | ✅ 2026-10-28, against ASVS 5.0 ([doc 12](12-security-review.md)): 51 applicable Level 1 requirements; 34 passed as built, 9 fixed (cookie prefixes, session rotation, tokens out of URLs, per-IP and current-password throttles, CSP, documentation, dependency audit); 4 are P3 frontend rules and 4 deployment settings. Invite routes now take the token in the body |

Also recorded: every access and account event in `audit_log`, strictly append-only (no passwords, tokens or session IDs; covered by a test). A deleted account's events keep its email (D-18). Still to do outside code: verify the sending domain on Resend (SPF, DKIM, DMARC) and set `SESSION_SECRET`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` in staging.

**Acceptance criteria:**

1. An admin invites an email address. The invitee receives the email, opens the link, sets a name and password, and lands in the app signed in, all within 7 days of sending. Expired, revoked, or reused links show a clear message and a "request a new invite" action.
1a. With `SIGNUP_MODE=invite`, `POST /auth/signup` returns 403 and the UI shows no sign-up form. A "Request an invite" submission is stored, acknowledged on screen, never reveals whether the email already has an account, and appears in the admin queue.
2. Existing `app_users` sign in with their current username and password. Their hash is upgraded to argon2id (`hash_scheme` changes), and they are prompted once to add an email.
3. Forgot-password responds identically for known and unknown emails (no enumeration). Reset tokens are single-use and expire in 30 minutes.
4. The session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`. Deactivating a user invalidates their sessions within 60 s.
5. Mutating requests without a valid CSRF token are rejected with 403.
6. Brute force: the 6th failed login in a minute for one account+IP returns 429.
7. No default credentials anywhere in code or docs; the admin is created only via the CLI.
8. Security checklist (OWASP ASVS L1 auth and session sections) is reviewed and recorded in the PR.

---

## P3 — Frontend core

**Status 2026-10-28: P3a–P3d built; P3e checks run, performance open.** P3 ships in slices, each checked in a browser against the API before the next:

| Slice | Contents | Status |
| --- | --- | --- |
| P3a | Scaffold, tokens, API client + generated types, routing, session, app shell, core components, all auth and invite screens, placeholder routes | ✅ Built. 18 local unit tests; Playwright run of sign-in, invite acceptance, legacy banner and sign-out at 390, 900 and 1440 px in both themes with **zero axe violations**; first-load JS 157 KB gzipped |
| P3b | Market Today (snapshot and range), SymbolSearch | ✅ Built. Headline, tiles with deltas vs the previous session, movers computed to US-2.2 (traded stocks only; most traded by value), sector heatmap + ranked bars + table, top stories, the full price list, period presets and custom dates, all view state in the URL; search palette (`/`, Ctrl/⌘ K). 27 local unit tests; Playwright at 390 and 1440 px in both themes with zero axe violations. Market chunk 15 KB gzipped |
| P3c | Stock page | ✅ Built. Header + key stats, Lightweight Charts (candle/line, 1M–ALL, SMA/EMA/Bollinger overlays with colour + dash, volume/RSI/MACD panes, signal markers, OHLC readout, ←/→ keyboard reading announced to screen readers, "View as table"), signals list linked both ways with the markers, news grouped About / Mentions / Sector, peers with match breakdown, OHLCV data + CSV, Share, unknown-ticker state; whole view in the URL with back/forward. 36 local unit tests; Playwright at 390 and 1440 px in both themes with zero axe violations. Chart library is a lazy 60 KB-gzipped chunk |
| P3d | News page, Account page, full landing page | ✅ Built. **News** (US-9.8): newest / most important, headline search, filters for topic, stocks (+ headline-only), date (presets and custom, 90-day archive), sector, subsector, scope, regulator, type (opinion hidden by default) and source, each with counts and disabled-at-zero options; removable chips, "Clear all", a no-results state that names the filter to drop, "Show more news"; a left rail on desktop, topic chips and a bottom sheet with "Apply (N articles)" on phones; all in the URL. **Account** (E6): name, email (add or change, confirmation pending, `#email` for migrated accounts), password (signs out other devices), theme saved to the account, sign out of all devices, delete with typed confirmation. **Landing** (US-1.1): hero, three features with screenshots in both themes (static images, no chart code), how access works, disclaimer / privacy / terms links, Open Graph tags; signed-in visitors go to the market. Additive v1 API changes: news facets ignore their own filter, `total` on the first page, untagged articles count as news, `theme` on `/auth/me`. 44 local unit tests, 100 backend tests; Playwright at 390 and 1440 px in both themes with zero axe violations |
| P3e | Playwright journeys J1–J3, J6, J7; axe on every route; Lighthouse; parity checklist | 🟡 Criteria 1, 2 and 4–7 met; **3 (performance) open**. 19 Playwright specs (journeys J1, J2, J3, J6, J7; axe on all 20 routes in both themes with CSP-violation checks; visible focus; reduced motion) on Chromium + WebKit at 390×844 and 1440×900, against FastAPI serving the build: in the last full parallel run 72 passed, 2 were skipped by design (keyboard focus is desktop-only) and 2 WebKit journeys hit the 60 s timeout under load; both pass on re-run, and the timeout is now 120 s. Found and fixed three light-theme contrast failures. Added the SPA CSP (doc 12 §6.7) and self-hosted IBM Plex. Parity checklist below. Lighthouse (mobile) on `/app/market`: initial JS 182 KB gzipped (≤ 250 ✅), accessibility and best practices 100, but performance 45 / LCP 5.5 s with the default 4× CPU, and 63 / 4.4 s calibrated to this machine (benchmark 340–500, busy). Needs a reliable host (staging) and likely work on JS start-up; see PENDING-ACTIONS. **2026-10-29:** route prefetch (session and Market Today's requests start with the page code) and a static first paint in `index.html` bring it to 75–80 / LCP 3.7–3.9 s calibrated (FCP 3.3 → 2.5 s). Then the theme script inline by CSP hash (doc 12 amended), the hero fonts preloaded (no more layout shift), the previous session fetched off `/market/status`, and the treemap, stories and price list rendered after the headline paints: **79–84**, CLS 0, LCP still about 3.8 s (on this machine, at a CPU benchmark of 260–700). Later the same day, the boot script in `index.html` began starting the page chunks (modulepreload, map written at build), the session check and Market Today's data while the entry downloads. Every request now begins within about 0.1 s of the HTML, with first paint 1.0–2.1 s. Result: Market **81–83**, News 83–89, LCP still about 3.9 s. What's left is CPU, not requests: about 1.4 s of main-thread work on this machine (scripting 0.7 s, mostly React rendering; style/layout 0.4 s), plus about 255 KB over the simulated mobile link. Needs a staging measurement |

**Scope.** `frontend/` scaffold (Vite, TS strict, Tailwind v4 + tokens, Radix), app shell (desktop sidebar, mobile bottom nav, top bar with search), design-system components ([06 §6](06-design-system.md#6-components)), auth screens, Market Today (snapshot and range modes), the stock page (chart, overlays, panels, strategy signals, **news panel** (US-9.1), peers, data table with CSV export), and the landing page. Theme switch. Generated API types.

**Acceptance criteria:**

1. Journeys **J1, J2, J3, J6, J7** pass in Playwright on Chromium + WebKit at 390×844 (mobile) and 1440×900 (desktop).
1a. **News panel**: "Mentions" and "Sector news" are visibly separate. Snippets are plain text ≤ 200 chars. Links open externally with `noopener noreferrer`. An empty state exists for stocks without news. With fixture data, no article tagged only through a substring false positive appears under "Mentions" (D-15 test).
2. **Accessibility**: axe reports zero serious or critical violations on every route. Full keyboard operation (search, chart range, overlay toggles, tables). Visible focus. Charts have a text summary and an accessible data-table alternative.
3. **Performance**: Lighthouse (mobile, throttled) Performance ≥ 85 and LCP < 2.5 s on `/app/market`. Initial JS ≤ 250 KB gzipped, with chart libraries code-split.
4. View state is in the URL: refreshing or sharing `/app/stocks/MTNN?range=6M&strategy=rsi&overlays=sma50,ema12` restores the exact view.
5. Every data view shows a freshness stamp ("Data as of 14:35 WAT, 26 Oct") and handles loading (skeleton), empty, and error states.
6. Both themes pass the contrast checks in `design/preview.html`. `prefers-reduced-motion` is respected.
7. Feature parity checklist vs [01 §1](01-current-state-assessment.md#1-what-the-app-does-today) is complete (drawing tools explicitly deferred).

### P3 parity checklist (2026-10-28)

Every feature of the Streamlit app ([01 §1](01-current-state-assessment.md#1-what-the-app-does-today)), and where it now lives. ✅ = in the new app now · P4 = due in Phase 4, before cutover · Later = deliberately deferred (the Streamlit app stays live until cutover, so nothing is lost meanwhile).

| Area | Streamlit feature | New app | Status |
| --- | --- | --- | --- |
| Auth | Username/password login gate | Sign in with email **or** the legacy username (US-1.5, US-1.7); legacy PBKDF2 hashes kept in step (D-17) | ✅ |
| Auth | No self sign-up, no password reset | Invite-only access with requests (US-1.2, 1.3), forgot/reset, change password, sign out everywhere, delete account (J7) | ✅ (beyond parity) |
| Admin | Create users, revoke/restore, roles | API built in P2 (invites, access requests, user search, role, deactivate); admin screens | API ✅ · UI P4 (US-7.1 – 7.4) |
| Market | Two modes: last trading day and date range | "Last session · Period" with presets and custom dates, in the URL (US-2.5) | ✅ |
| Market | Stat cards | Breadth, value, volume, deals with change vs the previous session; trading days in a period (US-2.1) | ✅ |
| Market | Top gainers / losers / most traded | Same three lists, to US-2.2's stricter rules (traded stocks only; most traded by value) (US-2.2) | ✅ |
| Market | Sector treemap and bar | Heatmap (treemap), ranked diverging bars and a table; click to filter (US-2.4) | ✅ |
| Market | Price-change scatter | US-2.7, scheduled for v1.1 in the story map | Later |
| Market | Searchable, sortable price table | Price list with search, sort and sector filter, in the URL (US-2.6) | ✅ |
| Stock | Symbol picker | Search palette (`/`, Ctrl/⌘ K) with ranked matches and recents (US-3.1) | ✅ |
| Stock | Candle/line chart, quick ranges 1M–ALL | Lightweight Charts, candle/line, 1M · 3M · 6M · YTD · 1Y · ALL (US-3.3) | ✅ |
| Stock | SMA/EMA overlays | SMA 50/200, EMA 12/26, plus Bollinger 20 (US-3.4) | ✅ |
| Stock | Volume, MACD, RSI panels | Volume, RSI 14, MACD panes (US-3.4) | ✅ |
| Stock | Drawing tools (horizontal, trend, vertical lines) | Deferred by decision (02 §5, story map "Later") | Later |
| Signals | MACD crossover, RSI reversal, SMA 50/200 cross; buy/sell counts and chart | Same three strategies on full history (parity-tested in P1), summary sentence, markers linked to a described list (US-3.5) | ✅ |
| AI | On-demand BUY/SELL/HOLD recommendation | Replaced by a cached "signal interpretation", never a buy/sell call (ADR-006, US-4.x) | P4 |
| Similar stocks | Weighted similarity (industry 35 %, market cap 30 %, traded value 20 %, volume 15 %) | Same weights (`domain/similarity.py`), with the breakdown shown and sortable (US-3.7) | ✅ |
| Raw data | Expandable OHLCV table | Data tab with OHLCV, "View as table" for the chart, CSV download (US-3.8) | ✅ (beyond parity) |

Cutover therefore waits on P4 (admin screens, AI); the price-change scatter and drawing tools follow in v1.1.

---

## P4 — AI insights, watchlist, admin

**Scope.** Insight service behind the provider interface: Gemini adapter as default, Anthropic adapter ready (ADR-012). Bounded input, structured output, shared cache, per-user quota, timeout/retry. AI card UI with disclaimer; watchlist (API + star toggle + page); admin console (users search, role, deactivate, access-request queue, invites, AI usage, data freshness, and the **audit log viewer** with filters, detail drawer, CSV export, and the suspicious-activity flag, per US-7.7).

**Acceptance criteria:**

1. Insight responses validate against the pydantic schema **for both providers** (contract tests with recorded responses). Malformed model output gets one retry and then a friendly error, never raw text. Switching `AI_PROVIDER` needs no code change.
2. A second request for the same (symbol, strategy, range, data date) is served from cache (no API call; verified by a mock call count) and doesn't consume quota.
3. Quota exhaustion returns 429 with the reset time; the UI explains it.
4. Every insight shows the disclaimer, model, `generated_at` (WAT), and data date. The words "buy", "sell", or "recommend" never appear as an imperative in UI copy.
5. Watchlist add/remove is optimistic and survives reload. The watchlist page shows day and period change.
6. **Audit log**: every event type listed in US-7.7 produces exactly one entry, verified by a test per event type. Admins can filter, open details, and export. There's no API path that updates or deletes an entry, and the app's DB role is insert/find-only on `audit_log`. Non-admins get 403 from the API and never see admin UI.
6a. No access request becomes an account without an explicit admin approval; there's no auto-approval code path (D-13).
7. Journeys J4, J5, J8, J10 pass e2e.
8. **News in P4**: the **News page with filters and facet counts** (US-9.8; all filters in the URL), chart news markers (US-9.2), top stories (US-9.3), watchlist news (US-9.4). AI readings list the headlines considered, and every cited source is one of the headlines sent (US-9.5, verified by a contract test).

---

## P5 — Hardening & launch

**Scope.** Security review, manual accessibility pass (NVDA + VoiceOver on core journeys), load test, legal review of the AI and disclaimer copy (D-06), Atlas tier upgrade (D-10), monitoring and alerts, runbook, staging soak (1 week of trading days), cutover, Streamlit retirement.

**Launch checklist (acceptance criteria):**

- [ ] Zero open 🔴 findings; 🟠 findings either fixed or explicitly accepted
- [ ] Load test: 200 concurrent users on market + stock endpoints at p95 within P1 targets, with no Atlas throttling
- [ ] Data-freshness alert fires in staging when the crawler is paused
- [ ] Backups/restore verified for platform-owned collections
- [ ] Legal sign-off on disclaimer, privacy policy, and terms; cookie notice in place
- [ ] Runbook: deploy, rollback, rotate secrets, and handling "crawler down" and "Anthropic down"
- [ ] Cutover done; `legacy.` subdomain live for 2 weeks; then Streamlit retired and root legacy files removed
- [ ] `CHANGELOG.md` has a `1.0.0` entry

---

## Risks

| # | Risk | L | I | Mitigation | Owner phase |
| --- | --- | --- | --- | --- | --- |
| R1 | **Regulatory**: AI output read as investment advice (SEC Nigeria) | M | H | ADR-006 framing, disclaimer everywhere, legal review (D-06), no personalised advice, audit of UI copy | P4–P5 |
| R2 | **Atlas shared-tier limits** (throughput throttling, connection cap, storage, 32 MB in-memory sort) under public traffic | H | H | `daily_bars` (ADR-007), caching, a single client per process, the group-before-sort rule, move to a paid tier (D-10) | P1, P5 |
| R3 | **Upstream data dependency**: crawler outages or NGX endpoint changes leave stale data | M | H | Freshness stamp in the UI, freshness alert, honest "data delayed" banner, crawler owner on the alert route | P1, P5 |
| R4 | **Data quality**: duplicate or missing days, stale `TradeDate` (C2) | M | M | Parity tests, `daily_bars` unique index, data-quality checks in the refresh job | P1 |
| R5 | **Account security** (credential stuffing; bot sign-ups once opened) | L at launch (invite-only) · M later | H | Invite-only (ADR-013), rate limits, lockout, CAPTCHA (Turnstile) on the request-an-invite form behind a flag | P2 |
| R6 | **AI cost spike** | M | M | Shared cache, quota, `max_tokens` cap, usage dashboard plus a daily spend alert | P4 |
| R7 | **Scope creep** (alerts, portfolios, payments) | H | M | Out-of-scope list in [02 §5](02-project-scope.md#5-scope); changes go through this plan | All |
| R8 | **Parity gaps** discovered late | M | M | Parity checklist in the P3 exit criteria; Streamlit stays live until cutover | P3, P5 |
| R9 | **Legacy-user migration** friction | L | M | Username login keeps working, email prompt is non-blocking, admin can resend invites | P2 |
| R10 | Third-party licence terms (TradingView attribution, fonts) | L | L | Attribution link in the chart footer; Plex is OFL | P3 |
| R11 | **AI provider availability**: Claude unavailable now; Gemini quality or model changes | M | M | Provider interface (ADR-012), schema validation, contract tests, model name stored per insight, feature degrades gracefully ("AI unavailable") | P4 |
| R12 | **Crawler change** (ADR-007) breaks the production crawl | L | H | A separate small deploy, the `daily_bars` write wrapped so a failure is logged and never blocks the `tradesData` write or alerts, and a rollback by reverting one function | P1 |
| R13 | **Hosting setup pending** (Azure Container Apps chosen, not provisioned) delays staging | M | M | A portable container; local dev covers P1–P3; provision ACA, Key Vault, and App Insights before the P3 e2e runs on staging | P1–P3 |
| R14 | **Irrelevant or mis-dated news** next to a stock erodes trust (substring tagging, estimated dates) | H (until D-15) | M | D-15 crawler fixes, the "Mentions" vs "Sector news" split, the "Found {date}" label, user reports (US-9.7) | P1, P3 |
| R15 | **Content rights**: showing third-party article text | L | M | Headline + ≤ 200-char snippet + link out only (ADR-014); no full text, images, or paywall bypass | P3 |
| R17 | **Untracked tests** (D-11): regressions slip through CI; the suite is lost with a machine; new collaborators have none | M | M | Local pre-merge runs stated in each PR, a pre-push hook, and a private backup of test folders | All |
| R18 | **Rule-based topic tags miss or mislabel** articles | M | L | Precision gate (P1 AC 6a), vocabulary as data so it can be tuned without code, US-9.7 reports, LLM tagging only if the gate fails (10 N-3) | P1, P4 |
| R16 | **Thin news coverage** for smaller stocks (sector-level queries, 5 per sector every ~4 h) | H | L | Sector news fallback; honest empty state; nightly watchlist fetch later (D-16) | P3 |

L = likelihood, I = impact (L/M/H).

## Dependencies

| Dependency | Needed for | Status |
| --- | --- | --- |
| MongoDB Atlas cluster + a read-only DB user for `tradesData`/`industry_data` and a read-write user for platform collections | P1 | Cluster exists; users to create |
| ngxPro crawler running on schedule | All | In production |
| Gemini API key (`google-genai`), separate for the platform | P4 | Interim provider (ADR-012) |
| Anthropic API key | Later | Unavailable for now |
| ngxPro crawler deploy access (for the `daily_bars` change and D-15 news fixes) | P1 | Owner |
| Crawler news pipeline keeps running (Tavily key, HF token for embeddings) | P3 onward | In production |
| Resend account + verified sending domain (invites, resets) | P2 | D-04 decided |
| Domain + DNS | P5 (staging earlier) | To confirm |
| Hosting account (container host, secrets vault, monitoring) | Staging | D-03 deferred |
| GitHub Actions on `oladapo-joseph/platformApp` | P0 | Repo exists |
| Legal counsel (disclaimer, privacy, terms) | P5 | To engage |
