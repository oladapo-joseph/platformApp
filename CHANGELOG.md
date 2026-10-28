# Changelog

All notable changes to EquityLensNG are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (the new platform starts at `0.x` until public launch as `1.0.0`).

## [Unreleased]

### Added — Phase 0: foundations for the FastAPI + React platform (2026-10-25 → 26)
- `streamlitApp/`: frozen copy of the legacy Streamlit app (reference and rollback). The root-level originals are unchanged until cutover.
- `docs/01-current-state-assessment.md`: feature inventory and findings (correctness, security, AI, quality, UX, brand), each with a severity.
- `docs/02-project-scope.md`: vision, goals and success measures, personas, user journeys J1–J9, in/out of scope.
- `docs/03-architecture.md`: target FastAPI + React architecture, API surface, data model, caching, auth, AI service, deployment.
- `docs/04-technical-decisions.md`: ADR-001 to ADR-013 and the decisions log D-01 to D-11.
- `docs/05-implementation-plan.md`: phases P0–P5 with acceptance criteria, risks, and dependencies.
- `docs/06-design-system.md`, `design/tokens.css` (v0.1.0), `design/preview.html`: the "Lens" design system.
- `design/options.html`: palette and typography comparison (decision record).
- `docs/07-brand-guidelines.md` and `brand/`: logo v2 (vector mark, dark/light lockups, small mark, favicon, app icons, PNG exports) and `brand/generate_logo.py`.
- `docs/08-development-setup.md`: setup for the legacy app and the planned backend/frontend.
- `docs/09-user-stories.md`: 65 user stories across 9 epics, with Given/When/Then criteria, UX notes, a story map with release slices, a Definition of Done, and traceability to journeys.
- **News epic (E9, US-9.1 – 9.7)**: recent news on the stock page, news markers on the chart, top stories, watchlist news, AI readings that list the headlines they considered, sector news, and reporting mis-tagged articles. ADR-014 covers how the platform reads the crawler's `news_articles`; journey J10 added.
- **Admin audit log** promoted to v1.0 (US-7.7 rewritten: event list, filters, detail drawer, CSV export, append-only, suspicious-sign-in flag); architecture and plan updated.
- D-04 email provider comparison (SendGrid, Resend, ZeptoMail, Amazon SES, Brevo, Azure Communication Services) in `docs/04-technical-decisions.md`.
- `docs/10-news-tagging.md`: problems in the crawler's current news tagger (T1–T7, including 11 real NGX tickers that are ordinary words or names), **tag schema v2** (relevance tiers, topics, scope, regulators, sectors/subsectors, content type, geography, estimated dates), matching rules, controlled vocabularies, rollout with a precision gate, and how the app uses the tags.
- **US-9.8 News page** with filters and facet counts; the bottom nav becomes Market · News · Watchlist · Account (search moves to the top bar); FilterPanel, FilterChips and TopicChip components.

### Security — ASVS 5.0 Level 1 review of auth & accounts (2026-10-28)
- `docs/12-security-review.md`: all 70 Level 1 requirements assessed (51 apply: 34 passed as built, 9 fixed, 4 for the frontend, 4 for deployment), the anti-automation controls, deployment and frontend requirements, the dependency policy, and Level 2 gaps for the owner.
- **Cookies** are `__Host-el_session` / `__Host-el_csrf` outside local. **Signing in** (also reset and invite acceptance) ends the session the browser arrived with.
- **Tokens never in URLs:** email links put them in the fragment (`/invite#token=`, `/reset#token=`, `/verify#token=`). **Breaking (P2 routes, not yet released):** `GET /invites/{token}` → `POST /invites/lookup` and `POST /invites/{token}/accept` → `POST /invites/accept`, token in the body. `openapi-v1.json` regenerated; P1 routes unchanged.
- **Brute force:** a per-IP cap on failed sign-ins across accounts (100 / 15 min) and a throttle on the current-password check in `PATCH /auth/me`.
- **Forgot password** sends its email after responding, so known and unknown addresses look identical in status, body and timing, even during a mail outage.
- `X-Frame-Options: DENY` and a CSP (`default-src 'none'` on API JSON, `frame-ancestors 'none'` everywhere); `SESSION_SECRET` must be ≥ 32 characters outside local.
- CI runs `pip-audit` on the lockfile; Dependabot opens weekly update PRs (`.github/dependabot.yml`).

### Built — Email design system and Resend templates (2026-10-28)
- `docs/11-email-design-system.md`: principles, anatomy, light/dark tokens, blocks, variable rules, catalogue, workflow and deliverability checklist.
- `backend/app/emails/`: one module per email (invite, password reset, confirm email, password changed, sign-in email changed, access declined), built from shared blocks with an inline-styled, table-based layout that works without images or CSS, has a dark mode, and the official logo lockup (served at `/email-assets/`).
- Emails are **Resend templates**: `python -m app.cli email-templates sync` creates, updates and publishes them, and records each in the committed `app/emails/registry.json` (alias, Resend ID, version, fingerprint, timestamps). `status` reports drift; `render` writes previews; `send-test-email` sends samples. Sending passes only the alias and variables, and values are cleaned of `<`, `>` and `"` because Resend inserts them unescaped.
- Checked against Resend's template guide: templates now store a default `from` and `reply_to` (taken from `EMAIL_FROM`/`EMAIL_REPLY_TO`, skipped for a localhost sender), so dashboard test sends work, while sends still set their own. Resend's limits are enforced locally: ≤ 50 variables per template, string values ≤ 2,000 characters (refused, not truncated, so links never break).
- New **security notices**: "Your password was changed" (after a change or reset) and "Your sign-in email changed" (to the old address); both best-effort.

### Built — Phase 2 accounts (2026-10-28, in review)
- **Invite-only access** (ADR-013, D-13): admin invites (batches of 50, resend, revoke, 7-day single-use links, "copy invite link" fallback), the public "request an invite" form with admin approve/decline, and accepting an invite (account created with the email already proven, signed straight in). Self-serve sign-up is built behind `SIGNUP_MODE=open` and stays off.
- **Sessions** (ADR-004): opaque tokens in an `HttpOnly; SameSite=Lax` (Secure outside local) cookie, only their SHA-256 stored; 30-day sliding or browser-session; sign out / sign out everywhere; deactivation revokes sessions immediately. **CSRF**: signed double-submit token.
- **Passwords** (ADR-005): argon2id; ≥ 10 characters, not among 9,973 common passwords, not containing your name or email. Legacy Streamlit users sign in with their username and are upgraded silently, while the Streamlit app keeps working for them until cutover (D-17). Forgot/reset (30-minute single-use link, no enumeration), change password, add/confirm email, delete account.
- **Abuse limits**: lockout after 5 failed sign-ins per account and IP in a minute (1 → 15 min, exponential); 3 access requests per IP per hour; ≥ 10 failures in 15 min flagged suspicious.
- **Audit events** for every access and account action into `audit_log`, strictly append-only; a deleted account's events keep its email (D-18). The viewer ships in P4.
- **Email** behind `EmailSender`: Resend adapter and a console sender for local development; plain-text-first templates.
- **Admin**: `python -m app.cli create-admin` / `promote` (no default credentials anywhere); admin endpoints for users (search, role, deactivate, with last-admin and self-protection), invites and access requests.
- 20 new API routes (37 total). The P1 `X-API-Key` dev key is gone; the v1 contract snapshot is updated and otherwise unchanged.

### Built — Phase 1 backend (2026-10-26, in review)
- **`backend/`** (FastAPI, uv, Python 3.12): config, JSON logs with request IDs, RFC 9457 problem+json errors, TTL caches, weak ETags with 304s, gzip, security headers, and a Phase 1 dev API key (`X-API-Key`) until P2 sessions. Run with `uv run uvicorn app.main:create_app --factory`.
- **Endpoints** (`/api/v1`, OpenAPI at `/api/v1/openapi.json`): `market/status|snapshot|range|sectors`, `stocks`, `stocks/{symbol}` (profile + quote), `/bars`, `/indicators` (`set=sma50,ema12,rsi14,macd,bb20`), `/signals`, `/similar`, `/news`, `/news/markers`, `strategies`, `news/top`, the filterable `news` page with facets and cursors, and `healthz`/`readyz`.
- **Domain** ported from `streamlitApp/` with parity tests: indicators (+ Bollinger bands), the three signal strategies, peer similarity, market and period summaries.
- **Bars** read `daily_bars` and fall back to `tradesData` before its first trade date (`BARS_SOURCE=auto`), grouped by NGX `TradeDate` with the latest priced snapshot as close, M0-safe (`$top`, no pre-group sort).
- **Parity verified on production data**: the API equals an independent recomputation on every day; the legacy loader was wrong on 14% of symbol-days (C2 verified, new C6).
- `.github/workflows/ci.yml`: ruff, format, mypy and an API contract check against `backend/openapi-v1.json` (tests stay local, D-11).
- **API frozen as v1** (2026-10-28, owner sign-off): `backend/openapi-v1.json` is the contract the frontend's types are generated from.

### Fixed — ngxPro crawler (2026-10-26)
- `daily_bars` no longer creates a day's bar from NGX's all-null session-start rows (C6).

### Built — ngxPro crawler, Phase 1 start (2026-10-26; separate repo, awaiting deploy)
- **`daily_bars`** (ADR-007): `crawler/daily_bars.py` upserts one bar per symbol per NGX trade date after every crawl (close = latest snapshot, which fixes C5; keyed on TradeDate, which fixes C2; an older snapshot never overwrites a newer one; a failure never blocks alerts or news). `scripts/backfill_daily_bars.py` rebuilds history (dry run by default). C5 is **confirmed on live data**: wrong closes on 3.3% of days across 5 stocks, up to 7.6% for ZENITHBANK.
- **News tagger v2** (D-15): `shared/news_tagging.py` + `news_aliases.json` + `news_topics.json`, used by the crawler and the bot's live fetch. Whole-word, case-aware symbols with corroboration for ambiguous tickers and global brands; title-vs-body mentions; topics, scope, regulators, sectors/subsectors, content type, geography, source tier; `published_at_estimated`. Tags refresh on re-crawl. `scripts/retag_news.py` re-tags stored articles and exports a CSV for the precision check.
- **Tavily switched to news search** (`topic="news"`): previously every stored article was undated and many weren't news (T8).
- Verified: 41 local unit tests, 13 checks against a throwaway MongoDB, read-only dry runs on production data, and an import check of every function folder.

### Decided (2026-10-26)
- ADR-010: palette **A · Lens Green** and type pairing **IBM Plex Sans + IBM Plex Mono**.
- ADR-006: AI output is a **signal interpretation**; no BUY/SELL/HOLD.
- ADR-007: the **ngxPro crawler writes `daily_bars`** (no duplicate backend job). It also fixes C2 (duplicate days) and C5 (close taken as the intraday max).
- ADR-012: AI provider behind an interface; **Gemini (`google-genai`) is the interim default** while the Claude API is unavailable.
- ADR-013: **invite-only access** at launch, with a request-an-invite form; open sign-up later.
- D-08: product name **EquityLensNG** (joined). The wordmark keeps the `EquityLens` + `NG` tag, which leaves room for other markets later.
- D-03 hosting: **targeting Azure Container Apps** (setup later). D-11: **no tests are tracked in git at all**. CI checks lint, types, and builds; tests run locally before merge (ADR-011).
- D-12: the **All-Share Index is added later** via the crawler. D-13: **manual admin approval for every invite**, with no auto-approval. D-14: **admin audit log in v1.0**.
- ADR-014: **news** in the app, read from the crawler's `news_articles`, showing headline, snippet and link only. D-15 **approved and extended**: crawler news tagger v2 for relevance and filtering. D-04: **Resend** for email, with Azure Communication Services as the later alternative. Then: D-05 **AI limit 5 per user per day**; D-16 **no on-demand news fetching**; owner approved the user stories and the tagging design.

### Changed
- `README.md` now describes the platform initiative. The legacy README lives at `streamlitApp/README.md`.
- `.gitignore`: added Node, Python venv, and build-output entries for the new apps, and **all test-file patterns** (`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`) so no tests are tracked anywhere.
- **`requirements.txt` trimmed** from ~130 pinned packages to the 10 direct imports (root and `streamlitApp/`), plus a new `requirements-dev.txt` (pytest). LangChain, OpenAI, Flask, Azure Functions, Telegram, Jupyter, SQLAlchemy and other unused packages are gone; `google-genai` is kept. Verified in a fresh virtualenv: all modules import, and tests are unchanged at 75 passed and 1 pre-existing failure.
- Renamed "EquityLens NG" → "EquityLensNG" across the docs and design files. Logo accessible names stay "EquityLens NG" for screen readers.
- Docs 01–08 updated for the decisions above; new finding **C5** (daily close uses the intraday max).

### Known
- `test_gemini.py` imports LangChain, which is no longer installed; rewrite it for `google-genai` or delete it.
- The crawler's news tagging uses substring matching (e.g. `CAP`, `TOTAL`, `ETI` match ordinary words), and a missing publish date silently becomes the crawl time. Fix approved as D-15; designed in `docs/10-news-tagging.md`; to be built in Phase 1.

## Legacy Streamlit app

History before this initiative is in git (`git log` on `main` and feature branches, last commit `1e46a33` "fixed last trading day bug").
