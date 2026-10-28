# 04 — Technical Decisions (ADR log)

> Status legend: **Proposed** (awaiting review) · **Accepted** · **Superseded**
> Each record: context → decision → consequences → alternatives considered. Add new ADRs at the bottom; never rewrite an accepted one, supersede it instead.

---

## ADR-001 — Monorepo layout; freeze the Streamlit app as `streamlitApp/`

**Status:** Accepted (copy done 2026-10-25)

**Context.** We need the old app as a reference and a rollback while building the new one. Production may deploy from the `platformApp/` root.

**Decision.** Keep everything in the existing `platformApp` git repository. The legacy app is **copied** (not moved) to `streamlitApp/`. New code goes in `backend/` and `frontend/`. The root-level legacy files are deleted at cutover (Phase 5).

**Consequences.** There is temporary duplication at the root until Phase 5. One repo means one PR can change the API contract and its consumer together.

**Alternatives.** Separate repos for backend and frontend: rejected, because the coordination overhead isn't worth it for a small team.

---

## ADR-002 — Frontend: React + Vite + TypeScript, Tailwind v4 + Radix, Lightweight Charts + ECharts

**Status:** Accepted; scaffold built 2026-10-28 (P3a). Versions: React 19, React Router 8, Vite 8, Tailwind 4.3, TanStack Query 5, the `radix-ui` package. **TypeScript is pinned to 5.9**: 7.0 is out, but `openapi-typescript` and `typescript-eslint` don't support it yet; revisit when they do.

**Amended 2026-10-28 (P3b):** the sector treemap is drawn with `d3-hierarchy` (layout only) as plain SVG instead of ECharts: about a tenth of the size, and every cell is a focusable button with a spoken label. TanStack Table is not used: lists are ~150 rows, so a semantic `<table>` sorted in memory is simpler. ECharts remains the plan for the v1.1 movers scatter (US-2.7).

**Context.** We need a fast, accessible, responsive SPA with finance-grade charts. The team is small.

**Decision.** Use Vite + React 19 + TS strict, TanStack Query, React Router, Tailwind CSS v4 driven by our CSS-variable tokens, and Radix primitives wrapped in our components. For charts: **TradingView Lightweight Charts** for all price/indicator time series (purpose-built, ~45 KB gzipped, smooth on phones) and **Apache ECharts** (modular) for the treemap, bar, and scatter.

**Consequences.** Two chart libraries means two theming adapters, but both read from `tokens.css`. Lightweight Charts requires a visible TradingView attribution link. The free-hand drawing tools are deferred to v1.1.

**Alternatives.** *Plotly.js* (re-use the existing figures): ~1 MB+ and sluggish on mobile, rejected. *ECharts only*: viable fallback if we want one library, but its candlestick UX is weaker. *Next.js*: SSR adds little to an authenticated dashboard. The public landing page is static and small enough to live in the SPA, and we can revisit for SEO.

---

## ADR-003 — Backend: FastAPI with synchronous PyMongo in threadpool handlers

**Status:** Proposed

**Context.** The existing data layer is sync PyMongo + pandas with 30+ mocked tests. Pandas is CPU-bound and sync.

**Decision.** Use FastAPI with `def` (not `async def`) route handlers for data endpoints, run on FastAPI's threadpool, with sync `MongoClient` (one per process). pydantic v2 for schemas, pydantic-settings for config. Dependencies and tooling via **uv**, plus ruff and mypy.

**Consequences.** We port the pipelines and tests nearly verbatim, with lower risk and faster parity. Throughput is bounded by the threadpool size (default 40), which is ample for expected v1 load. We can switch to PyMongo's `AsyncMongoClient` later behind the repository interface.

**Alternatives.** Async throughout (PyMongo Async / Motor): a rewrite of the data layer for no v1 benefit. Django REST: heavier, and its ORM doesn't fit Mongo.

---

## ADR-004 — Cookie-based server sessions instead of JWTs

**Status:** Proposed

**Context.** A browser-only client served from the same origin, where admin "revoke user" must take effect immediately.

**Decision.** Opaque random session token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only `sha256(token)` is stored in a `sessions` collection with a TTL index. Double-submit CSRF token on mutating requests. 30-day sliding expiry.

**Consequences.** One Mongo lookup per request (cached for 60 s in-process). Instant revocation. No tokens in JS-readable storage. A future native app would need a token flow; we'd add it then.

**Alternatives.** JWT access + refresh: revocation needs a denylist anyway, and it's more moving parts. Managed auth (Clerk, Auth0, Entra External ID): faster social login and MFA, but adds monthly cost per active user, vendor lock-in, and splits user data from Mongo. Reconsider if D-02 (social login) becomes a hard launch requirement.

---

## ADR-005 — argon2id passwords with transparent PBKDF2 migration; email becomes the identity

**Status:** Accepted, built in P2 (2026-10-28); coexistence details in D-17

**Decision.** New hashes use argon2id (`pwdlib`). Existing PBKDF2-SHA256 (260k iterations) hashes are verified with constant-time compare and upgraded on next successful login (`hash_scheme` field). Email (unique, verified) becomes the login identity. Legacy `username` remains a valid login identifier until each user adds an email. Admin bootstrap moves to an explicit CLI command; env-var seeding with empty defaults is removed.

**Consequences.** No forced password resets for existing users. A partial unique index is needed on `email` while legacy users lack one.

---

## ADR-006 — AI output is a structured, dated "signal interpretation", not a recommendation

**Status:** Accepted (owner, 2026-10-26). The "interpretation" framing is approved. A legal review of the disclaimer copy is still recommended before sign-ups open to the public (D-06).

**Context.** The current output is "Recommendation: BUY/SELL/HOLD" in free text. Even with invite-only access, the audience is retail investors in a regulated market.

**Decision.** The insight service sends a bounded feature summary (≤ 10 recent signals, indicator snapshot, period stats) and requests **JSON** matching a pydantic schema: `stance`, `summary`, `drivers`, `key_levels`, `confidence`, `caveats`. The UI labels it "AI signal interpretation", always shows a disclaimer, model name, generated time (WAT), and data date. Results are cached and shared per (symbol, strategy, range, `data_as_of`). Each user gets a daily quota.

**Consequences.** Lower cost and latency, predictable rendering, and a reduced regulatory surface. `stance` replaces BUY/SELL/HOLD in the UI.

**Alternatives.** Keep BUY/SELL/HOLD behind a disclaimer: rejected by the owner.

The model provider sits behind an interface; see ADR-012.

---

## ADR-007 — The ngxPro crawler writes a `daily_bars` collection

**Status:** Accepted (owner, 2026-10-26). The crawler already holds every price, so we don't duplicate the work in the backend.

**Context.** Every stock page today aggregates ~3 years of raw 35-minute crawl documents (≈ 15k docs) into daily bars per request. Range queries do the same across all symbols. On the Atlas shared tier this is the dominant cost and the main latency risk. The crawler (`ngxPro/crawler/app.py::run`) already bulk-upserts one snapshot per symbol into `tradesData` every 35 minutes, so it's the natural single writer.

**Decision.** Right after its `tradesData` bulk write, the crawler does a second `bulk_write` of ~150 upserts into `daily_bars`, keyed by **(`symbol`, `trade_date`)**. `trade_date` is NGX's `TradeDate` session date, not the crawl date, so a crawl on a non-trading day updates the existing session instead of creating a duplicate (fixes C2). Per snapshot:

| Field | Update rule | Why |
| --- | --- | --- |
| `open`, `prev_close`, `sector` | `$set` | NGX reports the session's values |
| `high` / `low` | `$max` / `$min` | Running session extremes |
| `close`, `change`, `pct_change` | `$set` latest | Intraday `ClosePrice` is the *latest* price. Fixes C5: the current `$max` biases closes upward on down days |
| `volume`, `value`, `trades` | `$set` latest | NGX reports cumulative daily totals |
| `updated_at` | `$set` = `fetched_at` | Freshness. The filter includes `updated_at < fetched_at` so an older snapshot never overwrites a newer one |

There is also a **one-off backfill script**. It processes history one symbol at a time in Python, taking the latest snapshot per `TradeDate`, rather than running one large pipeline. That respects the M0 32 MB sort limit. The platform reads `daily_bars` and falls back to the live aggregation for any missing day.

**Consequences.** Stock history reads drop from ~15k documents to ~750, at a cost of one extra small bulk write per crawl. It is a change to a production Azure Function, so ship it on its own: the crawler deploy goes first, then the backfill, then the platform reads. The change lives in `crawler/` only and does not touch `shared/`. Storage is ≈ 11 MB/year. Parity tests must account for C5: new closes may legitimately differ from the Streamlit app's.

**Alternatives.** A backend scheduled job aggregating `tradesData` → `daily_bars`: rejected by the owner because it repeats work the crawler already does and needs a second scheduler.

---

## ADR-008 — One container, one origin

**Status:** Accepted. The owner is targeting **Azure Container Apps** (D-03, 2026-10-26), with setup later. The container stays portable.

**Decision.** A multi-stage Docker image builds the SPA and serves it from FastAPI (static files + `index.html` fallback) alongside `/api/v1`. A single portable container can run on any container host (Azure Container Apps, App Service, Render, Fly, a VM). Run at least one replica so there are no cold starts in market hours.

**Consequences.** No CORS, simple cookies, and a single deploy and rollback unit. Static assets are served by Python (fine at v1 scale; put Azure Front Door/CDN in front later).

**Alternatives.** SPA on Azure Static Web Apps + API on Container Apps: better edge caching but needs a cross-origin or linked-backend setup. Vercel + Render/Fly: an extra vendor.

---

## ADR-009 — Indicators and signals are computed only on the server

**Status:** Proposed

**Decision.** `domain/indicators.py` and `domain/signals.py` are the single implementation. They compute on **full history**, then slice to the requested range. This fixes Streamlit finding C1, where the chart used cold EMAs on the sliced range. The client never recomputes indicators.

**Consequences.** One tested implementation that obeys the project rules (`adjust=False` EMA, Wilder RSI). Toggling an overlay costs one request, mitigated by fetching the standard indicator set in one call and caching it.

---

## ADR-010 — Design system: IBM Plex Sans + Plex Mono, CSS-variable tokens, dark-first with light theme

**Status:** Accepted (2026-10-26). The owner chose palette **A · Lens Green** and type pairing **1 · IBM Plex Sans + Plex Mono** from the options in `design/options.html`. The alternatives considered were B · Naira Green & Gold, C · Indigo Lens, Inter + JetBrains Mono, Geist + Geist Mono, and DM Sans + DM Mono.

**Decision.** Tokens live in `design/tokens.css` as CSS custom properties, which are the single source for Tailwind and both chart libraries. IBM Plex Sans for UI text, IBM Plex Mono with tabular figures for numbers and tickers, preserving continuity with today's all-Mono look. The brand green `#00C896` is kept for dark mode, with a contrast-safe `#00805F` for text on light. See [`06-design-system.md`](06-design-system.md).

---

## ADR-011 — Quality gates

**Status:** Accepted, amended 2026-10-26. The owner decided **no tests are tracked in git** (D-11).

**Decision.**

- Tests are written and kept locally, but never committed: legacy, backend (`tests/`), and frontend (`*.test.*`, `*.spec.*`, `__tests__/`, `e2e/`), all covered by `.gitignore`.
- **CI** (when set up) blocks merge on what lives in the repo: ruff, mypy (strict on `domain/` and `services/`), eslint, `tsc --noEmit`, the production build, and a Docker build.
- **Tests run locally before every merge.** That's pytest (≥ 85% coverage on `domain/`), vitest, and Playwright + axe. Each PR description states the command run and the result.
- Fix or rewrite the two broken legacy tests while porting. Conventional commits; `CHANGELOG.md` updated per PR.

**Consequences.** CI can't catch regressions in behaviour, only in style, types, and builds. That puts discipline on the local run. Tests exist only on the developer machines that have them, so a lost laptop loses the suite, and new collaborators start without tests. **Mitigation:** keep a private backup of the test folders (e.g. a separate private repo or cloud-synced folder) and agree a local pre-push hook that runs the fast suite. Acceptance criteria elsewhere that say "in CI" mean "run locally before merge".

---

## ADR-012 — AI provider behind an interface; Gemini (`google-genai`) is the interim default

**Status:** Accepted (owner, 2026-10-26). The Claude API is currently unavailable to the team.

**Context.** The project rule was "Anthropic SDK only". The owner reports the Claude API isn't available for now, and earlier work used Gemini via `google-genai`.

**Decision.** `services/ai/` defines one `InsightProvider` interface (`generate(features) -> InsightResult`) with two adapters: `GeminiProvider` (`google-genai`, the **default**) and `AnthropicProvider` (`anthropic`, used when a key is available). The provider and model are config (`AI_PROVIDER`, `AI_MODEL`). Both adapters request **JSON matching the same pydantic schema** (Gemini via `response_schema`, Claude via a JSON tool or instructions), so the UI and cache don't care which model answered. The model name is stored with every cached insight and shown in the UI. Direct SDKs only; **no LangChain**.

**Consequences.** Switching provider is a config change plus a short quality check, not a code change. Two adapters to test (contract tests with recorded responses). The default `AI_MODEL` is `gemini-2.5-flash`, matching the earlier smoke test; confirm the current model line-up when Phase 4 starts.

**Alternatives.** Hard-wire Gemini: simplest, but it repeats the earlier Gemini ↔ Anthropic churn. LangChain as the abstraction: rejected; the project has already removed it once.

---

## ADR-013 — Invite-only access at launch, built to switch to open sign-up

**Status:** Accepted (owner, 2026-10-26)

**Decision.** `SIGNUP_MODE=invite` (default) or `open`. In invite mode, `POST /auth/signup` is disabled. Accounts are created only by **accepting an invite**: an admin enters an email, the system sends a single-use link (7-day expiry), and the invitee sets a name and password. Opening the link proves ownership of the email, so it counts as verified. The public landing page offers **"Request an invite"**, which stores the email in `access_requests` for admins to approve (approval sends the invite). **Every invite requires a manual admin decision** (owner, 2026-10-26). There's no auto-approval, referral code, or domain allow-list, and users can't invite others directly. Each approval is recorded in the audit log with the approving admin. Switching to `open` later enables the self-serve sign-up and email-verification flow already designed in [03 §3.6](03-architecture.md#36-auth--security-adr-004-adr-005), with no schema change.

**Consequences.** Lower launch risk: no bot sign-ups, a controlled load on Atlas, and a known audience during the legal review. Admins need invite tooling in P2/P4. Email delivery (D-04) is needed for invites, so it's still in P2.

---

## ADR-014 — News: read the crawler's `news_articles`; show headlines and link out

**Status:** Accepted (owner, 2026-10-26). The crawler tagging fixes and the richer tags for filtering (D-15) are designed in [`10-news-tagging.md`](10-news-tagging.md).

**Context.** The ngxPro crawler already runs a Tavily search per sector about every 4 hours (5 results each) and upserts into `news_articles` (unique `url`). Fields: `title`, `url`, `source`, `content` (≤ 1,000 chars), `published_at`, `symbols[]`, `sector`, `importance_score`, `embedding` (384-dim, nullable), `fetched_at`. There's a 90-day TTL. Indexes on (`symbols`, `published_at`, `importance_score`) and (`sector`, …) already exist, and `ngxPro/shared/news.py::get_news_for_symbol` shows the query pattern: direct symbol hits first, then related-sector fill-ins.

**Decision.**

1. The platform **reads** `news_articles` (read-only, like `tradesData`) through a `news_repo`, with endpoints `GET /news` (filterable News page, US-9.8), `GET /stocks/{symbol}/news`, `GET /news/top`, `GET /me/watchlist/news`, and `GET /market/sectors/{sector}/news`. Cached for 10 minutes, since news changes about every 4 hours.
2. **Display policy:** headline, source domain, published time (WAT), and a ≤ 200-character plain-text snippet, with a link to the original in a new tab. **Never reproduce full article text.** Snippets are HTML-stripped server-side.
3. A stock's news shows three relevance tiers: **"About {SYMBOL}"** (named in the headline), **"Mentions {SYMBOL}"** (body only), and **"Sector news"** (sector match only). Relevance is never overstated. The tiers come from the crawler's tag schema v2 (`symbol_mentions.in_title`, [10 §3](10-news-tagging.md#3-tag-schema-v2)).
4. The AI insight may receive up to 5 headlines (title, source, date) and must cite which ones it used (US-9.5). Headlines are context, not causes.
5. The platform never fetches news itself at launch (D-16). User reports of mis-tagged items go into a platform-owned `news_feedback` collection (US-9.7) and never modify `news_articles`.

**Consequences.** No new fetching cost or scheduler, and news arrives "free" from the crawler. Quality depends on the crawler's tagging and dates. The known issues (T1–T7 in [10 §2](10-news-tagging.md#2-problems-found-in-the-current-tagger)) are fixed by tagger v2 before news ships. Coverage is sector-level, so smaller stocks will often show only sector news. News is limited to the last 90 days.

**Alternatives.** Platform-side news fetching: rejected; it duplicates the crawler (the same principle as ADR-007). Semantic "related news" via the existing embeddings and Atlas Vector Search (`news_vector_idx`): deferred to v1.1. It needs the vector index confirmed on the cluster.

---

## Decisions log

| ID | Question | Status | Outcome / recommendation | Needed by |
| --- | --- | --- | --- | --- |
| **D-01** | Launch access model | ✅ **Decided 2026-10-26** | **Invite-only** now; switch to open sign-up once the product is final (ADR-013) | — |
| **D-02** | Social login at launch | Open | Recommend deferring to v1.1; less valuable while invite-only | Phase 2 |
| **D-03** | Hosting | **Direction set 2026-10-26: Azure Container Apps.** Account and setup later | One portable container (ADR-008). Azure Key Vault for secrets and Application Insights for monitoring fit the same choice | Before Phase 1 staging |
| **D-04** | Transactional email (needed for invites and resets) | ✅ **Decided 2026-10-26: Resend** | Start on Resend (free tier). **Azure Communication Services Email** is the planned alternative adapter once the app runs on Azure (see [options](#d-04-email-provider-options)) | Phase 2 |
| **D-05** | AI quota per user | ✅ **Decided 2026-10-26: 5 per user per day** | Configurable per role (`AI_DAILY_QUOTA=5`); cached readings don't count (US-4.3) | — |
| **D-06** | AI wording & legal review | ✅ Wording decided 2026-10-26 | **"Signal interpretation"**, no BUY/SELL/HOLD (ADR-006). Legal review of the disclaimer still recommended before sign-ups open to the public | Before open sign-up |
| **D-07** | `daily_bars` ownership | ✅ **Decided and built 2026-10-26** | **The ngxPro crawler writes it** (ADR-007; `crawler/daily_bars.py`, awaiting deploy + backfill run) | — |
| **D-08** | Brand name styling | ✅ **Decided 2026-10-26** | **"EquityLensNG"** (joined, like MTNNG). Wordmark keeps `EquityLens` + `NG` tag. Revisit if expanding to other markets | — |
| **D-09** | AI provider & model | ✅ **Decided 2026-10-26** | **Gemini via `google-genai`** while the Claude API is unavailable; provider-agnostic interface (ADR-012) | — |
| **D-10** | Atlas tier | Open | Move to a paid tier before open sign-up. Invite-only reduces the urgency at launch | Before open sign-up |
| **D-11** | Are tests tracked in git? | ✅ **Decided 2026-10-26: no tests are tracked** | `.gitignore` covers Python and React test conventions. CI checks lint, types, and builds; tests run locally before merge (ADR-011) | — |
| **D-12** | NGX All-Share Index (ASI) | ✅ **Decided 2026-10-26** | **Added later** via the crawler; launch without it, with the layout ready for it (US-2.8) | Post-launch |
| **D-13** | Access-request approval | ✅ **Decided 2026-10-26** | **Manual admin approval for all invites**; no auto-approval (ADR-013) | — |
| **D-14** | Admin audit log | ✅ **Decided 2026-10-26** | **In v1.0**: a viewable, filterable, exportable, append-only audit log for admins (US-7.7) | Phase 4 (events from Phase 2) |
| **D-15** | Crawler news tagging (ADR-014) | ✅ **Approved and built 2026-10-26** (ngxPro; awaiting deploy + re-tag run) | (a) Whole-word, case-aware symbol tagging with aliases and corroboration for ambiguous tickers. (b) The `published_at_estimated` flag. (c) **Richer tags for filtering**: topics, scope, regulators, sectors/subsectors, content type, geography, and title-vs-body mentions. One shared tagger module, a re-tag script for existing articles, and a precision gate before switch-on. Design: [`10-news-tagging.md`](10-news-tagging.md) | Phase 1 (crawler), before US-9.1 |
| **D-16** | On-demand news fetch for stocks with no recent news | ✅ **Decided 2026-10-26: no** | The platform never fetches news; it shows sector news and an honest empty state | — |
| **D-17** | Sharing `app_users` with the live Streamlit app until cutover | ✅ **Built 2026-10-28 (P2)** · for owner review | Streamlit verifies `password_hash` + `salt` and creates a plain unique index on `username` at every start. So the new app (a) stores argon2id in **`password_argon2`** and never removes the PBKDF2 fields, (b) with `LEGACY_PASSWORD_SYNC=true` also rewrites them whenever a password is set, so both apps accept the same password, and (c) gives every new user **`username` = email**, since a second user without a username would collide on that index's null key. Turn the sync off and drop the legacy fields at cutover (P5) | P5 cutover |
| **D-18** | Audit log vs. account deletion | ✅ **Decided 2026-10-28 (owner)** | A deleted account's audit events **keep their real email**; nothing is anonymised or rewritten. The log is strictly append-only: the app's DB role needs only `insert` and `find` on `audit_log`. Entries expire with the 365-day retention. The privacy notice should say this | Before the privacy notice |
| **D-19** | Name of the platform's watchlist collection | ✅ **Decided 2026-10-28 (owner)** | **`app_watchlists`**, matching `app_users`. `watchlists` already belongs to the ngxPro Telegram bot (`chat_id`, `symbol` rows) | Phase 4 |

### D-04 email provider options

Checked 2026-10-26 from third-party pricing round-ups, since providers rarely publish full tables. **Confirm on each provider's pricing page before signing up.** Expected volume while invite-only: invites, resets, and approval notices, roughly **< 1,000 emails/month**.

| Provider | Entry cost | Fit for EquityLensNG |
| --- | --- | --- |
| **SendGrid** (owner's current pick) | The permanent free plan was retired in 2025; new accounts get a **60-day trial** (100/day), then **Essentials from ~$19.95/month** | Mature and well known, but you pay ~$20/month for volume a free tier covers |
| **Resend** | **Free: 3,000/month, 100/day**, 1 domain, no surprise overage; Pro ~$20/month for 50k | **Recommended now.** $0 during invite-only, simplest API, official Python SDK. Upgrade or switch at open sign-up |
| **Zoho ZeptoMail** | **Pay-as-you-go: ~$2.50 per 10,000** emails (credits expire after 6 months); first 10,000 free | **Cheapest paid option at growth scale** with no monthly fee; transactional-only |
| **Amazon SES** | ~**$0.10 per 1,000** (à la carte); new accounts default to the bundled "Essentials" plan (~$0.16/1k) since July 2026 | Cheapest at very high volume, but the most setup (AWS account, leaving the sandbox, DNS) |
| **Brevo** | Free **300/day**; paid from ~$9/month | Workable free tier, but free emails may carry Brevo branding |
| **Azure Communication Services Email** | Pay-per-use: third-party sources list **~$0.25 per 1,000 emails + ~$0.12 per GB** (unconfirmed on Microsoft's page). No monthly fee | **Natural fit once on Azure**: one bill, Key Vault/managed identity. But **default limits on a custom domain are 30 emails/minute and 100/hour per subscription** (Microsoft service-limits table). Increases go through a support ticket and are granted gradually over 2–4 weeks with a low failure rate. Azure-managed `*.azurecomm.net` sender domains are lower and unbranded, so a custom domain is required |

**Decision (owner, 2026-10-26):** **Resend** now. **Why not ACS from day one:** hosting isn't set up yet, and Resend works from local development with nothing to provision. ACS's default 100/hour cap could also bite a bulk approval of 50 invites alongside password resets until a quota increase is granted. **When the app moves onto Azure Container Apps,** add an ACS adapter behind `EmailSender` and switch if the single-bill and Key Vault benefits matter. That's a config change plus DNS records. At open-sign-up volumes, re-compare ACS, ZeptoMail and Resend paid on cost.

The backend sends mail through an `EmailSender` interface, mirroring the AI providers (ADR-012), so changing provider is a config change plus DNS records (SPF, DKIM, DMARC) on the sending domain. Until a provider is chosen, the admin "Copy invite link" action (US-7.1) lets invites go out over WhatsApp or other channels.
