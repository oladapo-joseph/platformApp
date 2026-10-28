# 02 — Project Overview & Scope

> Status: **For review** · Owner: project owner (EquityLensNG) · Last updated: 2026-10-26

## 1. Vision

**EquityLensNG makes the Nigerian Exchange understandable.** Anyone should be able to get in quickly, see what the market did today, and look into any listed stock with clear charts, plain-language signal explanations, and comparable peers. No Bloomberg terminal or finance degree required.

The project rebuilds the internal Streamlit dashboard as a **FastAPI backend + React frontend** product that is reliable and approachable. It launches **invite-only** (ADR-013) and opens to self-service sign-up once the product is final.

## 2. Goals & success measures

| # | Goal | Measured by (target at public launch) |
| --- | --- | --- |
| G1 | **Easy to start** | Invite link → first stock page in ≤ 60 s (median); ≥ 80% of sent invites accepted within 7 days; ≥ 70% of new users view a stock page in their first session |
| G2 | **Fast** | API p95 < 300 ms for cached market endpoints and < 800 ms for a cold stock history; Largest Contentful Paint < 2.5 s on a mid-range Android phone over 4G |
| G3 | **Reliable** | 99.5% monthly availability during NGX trading hours (10:00–14:30 WAT); a data-freshness indicator is always visible and accurate |
| G4 | **Trustworthy** | Every AI output is labelled, dated, and carries a disclaimer; zero 🔴 findings from the security review open at launch |
| G5 | **Accessible** | WCAG 2.2 AA on all core journeys (automated axe checks pass, plus a manual keyboard and screen-reader pass) |
| G6 | **Parity** | Every current Streamlit feature is available (or deliberately retired) before the Streamlit app is switched off |
| G7 | **Maintainable** | CI on every PR (lint, types, builds); tests run locally before merge; ≥ 85% coverage on domain logic (indicators, signals, similarity) |

## 3. Key users

| Persona | Who | Needs | Primary surfaces |
| --- | --- | --- | --- |
| **Ada, the curious first-timer** | 25–35, salaried, has a brokerage app, owns 2–3 stocks, mostly on mobile | "Is my stock up? Why? Is it a good time?" Plain language, no jargon walls | Market today, stock page, AI explainer |
| **Tunde, the active retail trader** | Checks the market daily, uses technical indicators, desktop and mobile | Fast charts, overlays, signals, date ranges, watchlist, shareable links | Deep-dive chart, strategies, watchlist |
| **Ngozi, the analyst / advisor** | Researches sectors and peers for clients | Sector performance over ranges, peer comparison, exportable data | Market range view, similar stocks, raw data |
| **Admin / operator** | The EquityLens team | Manage users and roles, watch AI usage and cost, check data freshness | Admin console |

## 4. Core user journeys

| ID | Journey | Steps (happy path) | Phase |
| --- | --- | --- | --- |
| J0 | **Request access** | Landing → "Request an invite" → name + email → confirmation ("we'll email you") → admin approves → invite email | P2–P3 |
| J1 | **Accept invite & first value** | Invite email → link → set name + password (email already proven) → optional "pick 3 stocks you follow" → market today with those stocks pinned | P2–P3 |
| J2 | **Daily check-in** | Open app → market today: breadth, value traded, top gainers/losers/most traded, sector heatmap → top stories → data-freshness stamp ("as of 14:35 WAT"). The All-Share index headline is **added later**, once the crawler has an index feed (D-12) | P3 |
| J3 | **Research a stock** | Search (`/` or ⌘K) → stock page: price + change, candle chart, ranges → toggle overlays and panels → pick a strategy → see signals on the chart → recent news → peers | P3 |
| J4 | **Ask for an AI read** | On a stock page → "Explain these signals" → structured insight (stance, rationale, key levels, confidence) with disclaimer, timestamp, model → cached for everyone for the day | P4 |
| J5 | **Watchlist** | ☆ on any stock → watchlist page with day/period performance → remove | P4 |
| J6 | **Sector & period analysis** | Market → switch to a date range → sector performance and leaders for the period → drill into a sector | P3 |
| J7 | **Account self-service** | Forgot password → email link → reset; change password; delete account | P2 |
| J8 | **Admin** | Review and **manually approve** every access request (D-13) and send invites; users list → search → change role / deactivate; **audit log** (who did what, when, from where; D-14); AI usage per day; data-freshness health | P2–P4 |
| J9 | **Existing user migration** | Current username-only user logs in → prompted once to add and verify an email | P2 |
| J10 | **News behind the move** | On a stock page → News panel: recent articles mentioning the stock, then sector news → open the source article → (later) news markers on the chart line up with price moves; the AI reading lists the headlines it considered | P3–P4 |

## 5. Scope

### In scope (v1.0 launch, invite-only)

- FastAPI backend: versioned REST API, OpenAPI schema, auth, market/stock/signal/similarity/AI endpoints, admin endpoints, health checks.
- React SPA: public landing page, auth flows, market overview, stock page, watchlist, account, admin console.
- **Invite-only access**: request-an-invite, admin invites, accept-invite onboarding, password reset, and a migration path for existing users. Self-serve sign-up is built behind `SIGNUP_MODE` but stays off.
- Feature parity with the Streamlit app, *except* free-hand drawing tools (see below).
- AI "signal interpretation" with disclaimer, quotas, and shared caching. It can consider recent headlines and lists them.
- **News** from the crawler's `news_articles`: a filterable **News page**, the stock page, top market stories, watchlist news, and news markers on the chart (ADR-014, tagging in [10](10-news-tagging.md)). Headline, source, snippet, and a link out only.
- **Admin audit log** viewable in the console (D-14).
- Design system (tokens, components, patterns) and refreshed brand.
- Light **and** dark themes; responsive from 360 px phones to wide desktops.
- CI (lint, types, builds), automated tests run locally (not tracked in git, D-11), staging + production environments, error monitoring.

### Out of scope (v1.0)

- Order placement, brokerage integration, or anything that moves money.
- Real-time tick streaming. Data stays at the crawler's ~35-minute cadence; we show freshness honestly.
- Portfolio P&L tracking with cost basis (candidate for v1.x).
- Paid plans and billing (the architecture leaves room for plan-based quotas; see D-05).
- Native mobile apps (the web app is responsive and installable as a PWA in v1.x).
- Price alerts in the web app (they already exist in the ngxPro Telegram bot; deep-linking to the bot is in scope).
- Changes to the ngxPro crawler, **except** writing `daily_bars` (ADR-007, agreed 2026-10-26) and the news tagger v2 (D-15, approved): whole-word tagging, estimated-date flag, and richer tags for filtering.
- The platform fetching news itself, or reproducing full article text. The crawler fetches; we link out.
- The NGX All-Share Index headline (added later, D-12).
- Opening self-serve sign-up to the public (a later switch, not part of v1.0).

### Deliberately deferred

- **Drawing tools** (horizontal line, trendline, vertical line). They're rarely used, costly to rebuild accessibly, and Lightweight Charts supports them via plugins later. Target: v1.1.

## 6. Constraints & assumptions

- **Data** comes from the shared MongoDB Atlas cluster that the ngxPro crawler writes. The platform reads `tradesData`, `daily_bars`, `industry_data` and `news_articles` and **never writes to them**.
- **Timezone**: all market dates and times are WAT (Africa/Lagos). The API returns ISO-8601 with `+01:00`.
- **AI**: direct SDKs behind a provider interface. **Gemini (`google-genai`) for now**, because the Claude API is unavailable; `anthropic` when it is. No LangChain (ADR-012).
- **Indicators**: RSI uses `ewm(com=window-1, adjust=False)` and EMA uses `ewm(span=window, adjust=False)` (project rule; enforced by tests).
- **Small team**: choose boring, well-documented technology over novel stacks.
- The Streamlit app **stays in production** until the cutover in Phase 5.

## 7. Decisions

Full log with reasoning: [`04-technical-decisions.md`](04-technical-decisions.md#decisions-log).

| ID | Decision | Status |
| --- | --- | --- |
| D-01 | Access model | ✅ Invite-only now; open later |
| D-02 | "Continue with Google" | Open (recommend v1.1) |
| D-03 | Hosting | ✅ Direction: Azure Container Apps (setup later) |
| D-04 | Email provider (invites, resets) | ✅ Resend (Azure Communication Services as the later alternative) |
| D-05 | AI quota | ✅ 5 per user per day |
| D-06 | AI wording | ✅ "Signal interpretation"; legal review before open sign-up |
| D-07 | `daily_bars` owner | ✅ The ngxPro crawler |
| D-08 | Name styling | ✅ EquityLensNG |
| D-09 | AI provider | ✅ Gemini (`google-genai`) for now; provider-agnostic |
| D-10 | Atlas tier | Open (before open sign-up) |
| D-11 | Tests in git | ✅ Not tracked at all; run locally before merge |
| D-12 | All-Share Index | ✅ Added later via the crawler |
| D-13 | Access-request approval | ✅ Manual admin approval for all invites |
| D-14 | Admin audit log | ✅ In v1.0 |
| D-15 | Crawler news tagging | ✅ Approved and extended for filtering ([10](10-news-tagging.md)) |
| D-16 | On-demand news fetch | ✅ No |

User stories for building the UX: [`09-user-stories.md`](09-user-stories.md).
