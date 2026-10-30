# 09 — User Stories

> Status: **v1, for review** · Created 2026-10-26 · Builds on: [scope & journeys](02-project-scope.md) · [design system](06-design-system.md) · [plan](05-implementation-plan.md)
>
> These stories drive UX design and build order. Each one is small enough to design, build, and test on its own, and each states what "done" looks like from the user's side.

## 1. How to read this document

**Format.** Each story has:

- **Story**: *As a* (who) *I want* (what) *so that* (why).
- **Tag line**: `Priority · Phase · Journey · Persona`.
  - **Must** means v1.0 can't ship without it. **Should** means v1.0 if time allows. **Could** means later or opportunistic.
  - Phases: see [05](05-implementation-plan.md). Journeys: see [02 §4](02-project-scope.md#4-core-user-journeys).
- **Acceptance criteria**: *Given / When / Then*, written to become Playwright or API tests.
- **UX notes**: states (empty, loading, error), mobile behaviour, accessibility, and copy that matters.

**Personas** (from [02 §3](02-project-scope.md#3-key-users)):

| Persona | Short |
| --- | --- |
| **Visitor**: someone who heard about EquityLensNG and has no account | Visitor |
| **Ada**: curious first-timer, mobile, owns 2–3 stocks, wants plain language | Ada |
| **Tunde**: active retail trader, uses indicators daily, desktop and mobile | Tunde |
| **Ngozi**: analyst/advisor, compares sectors and peers, exports data | Ngozi |
| **Admin**: EquityLensNG team member who runs access, users, and health | Admin |

"User" means any signed-in persona.

**IDs** are stable (`US-<epic>.<n>`). Reference them in PRs, tests, and design files (e.g. `test("US-2.3 freshness stamp …")`).

## 2. Definition of Done (every story)

A story is done only when **all** of these hold. They're not repeated per story.

1. Acceptance criteria are automated (API test and/or Playwright) and **pass locally before merge**. Tests are deliberately not tracked in git (D-11), so the PR states that they were run and the result.
2. **Responsive**: works at 360 px, 768 px, and 1440 px wide, with no horizontal page scroll and touch targets ≥ 44 px.
3. **States designed and built**: loading (skeleton matching the final layout), empty, error (plain language and a retry), and, for data views, stale data.
4. **Accessible**: axe shows no serious or critical issues; fully keyboard operable; visible focus; colour never the only signal (▲/▼, +/−); screen-reader labels on icons and charts.
5. **Tokens only**: no raw hex or ad-hoc spacing ([06](06-design-system.md)). Both themes checked.
6. **Copy**: plain English; WAT on every time; ₦ and number formats per [06 §3](06-design-system.md#number-formatting-libformatts); no imperative investment advice.
7. **Light on data**: route code-split; no chart library loaded until a chart is on screen; API responses cached per [03 §3.5](03-architecture.md#35-caching).
8. `CHANGELOG.md` updated.

## 3. Story map

The backbone runs left to right through what people do; the slices run top to bottom in build order.

| | Discover & get in | Check the market | Research a stock | Get an AI read | Track | Manage account | Operate (Admin) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Slice 1: walking skeleton** (P1–P3) | US-1.5 sign in · US-1.9 sign out | US-2.1 at a glance · US-2.3 freshness | US-3.1 search · US-3.2 header · US-3.3 chart | | | | CLI admin bootstrap |
| **Slice 2: invite-only launch core** (P2–P3) | US-1.1 landing · US-1.2 request invite · US-1.3 accept invite · US-1.4 invalid invite · US-1.6 reset · US-1.7 migration | US-2.2 movers · US-2.4 sectors · US-2.5 range · US-2.6 price list · US-8.5 closed | US-3.4 indicators · US-3.5 signals · US-3.7 peers · US-3.9 share · US-3.11 accessible chart · **US-9.1 stock news** · **US-9.8 news page** | | | US-6.1 profile · US-6.2 theme | US-7.1 invite · US-7.2 manage invites · US-7.3 requests · US-7.4 users |
| **Slice 3: complete v1.0** (P4) | US-1.8 onboarding picks | US-5.3 pinned watchlist · US-9.3 top stories | US-3.6 strategy explainers · US-3.8 export · US-9.2 news on chart | US-4.1 – US-4.5 · US-9.5 headlines in AI | US-5.1 · US-5.2 · US-5.4 · US-9.4 watchlist news | US-6.4 delete · US-6.5 help | US-7.5 AI usage · US-7.6 data health · **US-7.7 audit log** |
| **Later** (v1.1+) | open sign-up (ADR-013) · Google sign-in | US-2.7 scatter · US-2.8 index (when the crawler adds ASI) · US-9.6 sector news | US-3.10 vs sector · drawing tools · US-9.7 report mis-tagged news | US-4.6 feedback | US-5.5 Telegram link | US-6.3 all devices | — |

Cross-cutting from Slice 1 onward: **US-8.1 – US-8.6**.

---

## E1 · Discover & get access (invite-only)

### US-1.1 · Understand the product before asking for access

**Story:** As a Visitor, I want to see what EquityLensNG does and who it's for, so that I can decide whether to request an invite.
`Must · P3 · J0 · Visitor`

**Acceptance criteria:**

- Given I open `/`, then I see the value proposition, 3–4 feature highlights with real product screenshots, a "Request an invite" primary action, a "Sign in" secondary action, and the disclaimer in the footer.
- Given I'm already signed in, when I open `/`, then I'm taken to `/app/market`.
- The page is usable with the JS chart libraries **not** loaded (static images only).

**UX notes:** One scroll on mobile to reach the CTA, never more. Avoid jargon in the hero: "See the Nigerian market clearly", not "Technical analysis suite". The footer links to the disclaimer, privacy, and terms. Use Open Graph tags so a link shared on WhatsApp shows the logo, a one-line description, and a preview image.

---

### US-1.2 · Request an invite

**Story:** As a Visitor, I want to request access with my name and email, so that I can try EquityLensNG when a place opens.
`Must · P2–P3 · J0 · Visitor`

**Acceptance criteria:**

- Given I submit a valid name and email, then I see "Thanks — we'll email you when your invite is ready" and the request appears in the admin queue (US-7.3).
- Given the email already has an account or a pending request, when I submit it, then I see **the same** confirmation (no account enumeration). No duplicate request is created.
- Given I submit more than 3 times from one IP in an hour, then I get a friendly "Please try again later".
- A request **never** grants access by itself. Every request waits for an admin's manual approval (owner decision, 2026-10-26). No auto-approval, referral code, or domain allow-list exists.
- Given the email field is invalid, then the error appears inline on blur and focus moves to it on submit.

**UX notes:** Fields: name, email, and optional "How will you use EquityLensNG?" (a 200-character note that helps admins prioritise). No password at this step. Checkbox: "I understand EquityLensNG provides educational analysis, not investment advice." The CAPTCHA stays behind a flag and is enabled only if spam appears (R5).

---

### US-1.3 · Accept an invite and set up my account

**Story:** As Ada, invited by the team, I want to open my invite link and set my name and password, so that I can start using the app without a separate email-verification step.
`Must · P2–P3 · J1 · Ada`

**Acceptance criteria:**

- Given a valid invite link, when I open it, then I see my email (read-only), name, password, and confirm-password fields, plus acceptance of the terms and disclaimer.
- Given I submit a valid form, then my account is created with the email marked verified, I'm signed in, the invite becomes `accepted`, and I land on onboarding (US-1.8) or, if I skip it, `/app/market`.
- The password needs ≥ 10 characters and must not be on the common-password list. A strength hint updates as I type and errors say how to fix them.
- The whole flow from opening the link to the market page takes ≤ 60 s for a typical user (G1).

**UX notes:** Headline "Welcome to EquityLensNG, Ada" (the name comes from the invite if the admin entered one). A show/hide password toggle. No "verify your email" step: the link already proved ownership. On mobile, use the `new-password` autocomplete so password managers offer to save it.

---

### US-1.4 · Handle an expired, used, or revoked invite

**Story:** As an invitee whose link no longer works, I want to understand why and know what to do next, so that I'm not stuck.
`Must · P2 · J1 · Ada`

**Acceptance criteria:**

- Given an **expired** link, then I see "This invite has expired" with a "Request a new invite" action that pre-fills my email (US-1.2).
- Given an **already-used** link, then I see "This invite has already been used" with a "Sign in" action.
- Given a **revoked** or unknown link, then I see a generic "This invite link isn't valid" with "Request an invite". It never reveals whether the email has an account.

**UX notes:** Use a full-page friendly state with the logo; don't show an error code to the user. The request ID goes in small print for support.

---

### US-1.5 · Sign in

**Story:** As a User, I want to sign in with my email (or my old username) and password, so that I can get back to my market view.
`Must · P2 (Slice 1 uses CLI-created admin) · — · All`

**Acceptance criteria:**

- Given valid credentials, then I'm signed in and returned to the page I originally requested (or `/app/market`).
- Given invalid credentials, then I see "Email or password is incorrect" (never which one), and the password field is cleared and focused.
- Given 5 failed attempts in a minute for the same account+IP, then further attempts get "Too many attempts — try again in N minutes".
- Given my account was deactivated, then sign-in fails with the same generic message.
- No "Sign up" link appears while `SIGNUP_MODE=invite`. "Don't have access? Request an invite" appears instead.

**UX notes:** One field labelled "Email or username" for the migration period, then "Email" only. "Forgot password?" sits next to the password label. A "Keep me signed in" checkbox controls the 30-day session (unchecked means a browser-session cookie).

---

### US-1.6 · Reset a forgotten password

**Story:** As a User who forgot my password, I want to reset it by email, so that I can regain access without contacting the team.
`Must · P2 · J7 · All`

**Acceptance criteria:**

- Given I enter any email, then I always see "If that email has an account, we've sent a reset link" (no enumeration).
- Given a valid reset link (≤ 30 min old, unused), when I set a new valid password, then all my other sessions are signed out and I'm signed in here.
- Given an expired or used link, then I see a clear message with "Send a new link".

**UX notes:** The email subject line is "Reset your EquityLensNG password" and the body is plain text first, with a single button. The email says the link expires in 30 minutes and gives a "Didn't ask for this? You can ignore this email" line.

---

### US-1.7 · Existing Streamlit users move over smoothly

**Story:** As an existing user with only a username, I want to sign in as before and add my email once, so that I keep access and can reset my password in future.
`Must · P2 · J9 · Tunde`

**Acceptance criteria:**

- Given my legacy username and password, then sign-in succeeds, my password hash is upgraded silently, and a non-blocking banner asks "Add your email to secure your account".
- Given I add an email, then a confirmation link is sent. Once confirmed, I can sign in with email and the banner disappears.
- Given I dismiss the banner, then it returns on my next session until an email is confirmed. The app stays fully usable meanwhile.

**UX notes:** The banner uses the info style, not the warning style. One sentence on why: "so you can reset your password if you forget it".

---

### US-1.8 · Pick a few stocks I follow (first run)

**Story:** As Ada on my first visit, I want to pick the stocks I own or watch, so that the app opens on what I care about.
`Should · P4 · J1 · Ada`

**Acceptance criteria:**

- Given I've just accepted my invite, then I see "Which stocks do you follow?" with search, popular chips (e.g. MTNN, DANGCEM, ZENITHBANK, GTCO, AIRTELAFRI), and "Skip for now".
- Given I pick 1–10 stocks and continue, then they're added to my watchlist (US-5.1) and pinned on the market page (US-5.3).
- Given I skip, then I land on `/app/market` and onboarding doesn't appear again. An empty-watchlist hint invites me later (US-5.4).

**UX notes:** One screen, not a multi-step wizard. Chips show the ticker and company name. The popular list comes from the most-traded symbols, not hard-coded, with a fallback list if data is missing.

---

### US-1.9 · Sign out and session expiry

**Story:** As a User, I want to sign out, and to be told clearly when my session expires, so that my account stays safe on shared devices and I never lose my place.
`Must · P2 · — · All`

**Acceptance criteria:**

- Given I choose "Sign out" from the user menu, then my session is revoked server-side and I land on `/login` with "You've signed out".
- Given my session expires or was revoked while the app is open, when my next request fails, then I see "Your session has ended. Please sign in again." After signing in I'm returned to the same URL with my view intact.

---

## E2 · Market today

### US-2.1 · See today's market at a glance

**Story:** As Ada, I want a quick summary of how the market did today, so that I know in a few seconds whether it was a good or bad day.
`Must · P3 · J2 · Ada`

**Acceptance criteria:**

- Given trading data exists for the latest session, then I see stat tiles for **breadth** (advancers / decliners / unchanged), **value traded** (₦, compact), **volume**, and **deals**, each with the change vs the previous session where available.
- Given I'm on a phone, then the tiles appear in a 2×2 grid above the fold.
- A one-line plain-language summary appears above the tiles, e.g. "More stocks rose than fell today (38 up, 21 down). ₦12.4B traded." It's generated from the numbers by a template, **not AI**.

**UX notes:** The headline should feel like a newspaper standfirst, not a dashboard. Tiles link to the relevant list (e.g. tapping "38 up" opens gainers). Index headline: see US-2.8.

---

### US-2.2 · See top gainers, losers, and most traded

**Story:** As Tunde, I want the day's biggest movers and most active stocks, so that I can spot opportunities and news-driven moves quickly.
`Must · P3 · J2 · Tunde`

**Acceptance criteria:**

- Given the latest session, then I see three lists, **Top gainers**, **Top losers**, and **Most traded (by value)**, with 5 items each and a "See all" link to the full price list pre-sorted (US-2.6).
- Each row shows ticker, company name (truncated with full name on hover/focus), price, % change with ▲/▼, and value traded.
- Tapping a row opens that stock's page (US-3.2).
- On mobile the three lists become tabs (one list visible at a time); on desktop they're side by side.

**UX notes:** Exclude stocks with zero trades from gainers and losers (a price move on no trades is noise). A footnote says so. Show "No losers today" (or similar) as a positive empty state.

---

### US-2.3 · Know how fresh the data is and whether the market is open

**Story:** As a User, I want to see when the data was last updated and whether the market is open, so that I don't act on stale numbers.
`Must · P3 · J2 · All`

**Acceptance criteria:**

- Every data screen shows a freshness stamp: "Data as of 14:35 WAT · 26 Oct".
- Given the market is open and the data is more than 2 h old, then the stamp turns to the warning style with "Data may be delayed".
- Given it's after the close (14:30 WAT), then the label reads "Closing data". On weekends and holidays: "Markets closed · showing Fri 24 Oct".
- Given new data arrives while the page is open, then views refresh in the background without losing scroll position or filters. A subtle "Updated 14:35" appears.

**UX notes:** The stamp sits in the page header on mobile and top-right on desktop. Never use the word "live" or "real-time".

---

### US-2.4 · See which sectors are up or down

**Story:** As Ngozi, I want sector performance for the session, so that I can see where money is moving.
`Must · P3 · J2, J6 · Ngozi`

**Acceptance criteria:**

- Given the latest session, then I see a sector heatmap (treemap sized by value traded, coloured by average % change) and a ranked bar list of sector % change.
- When I select a sector, then the price list (US-2.6) filters to that sector and the URL updates (`?sector=…`).
- A "View as table" toggle shows sector, avg % change, value traded, volume, and number of stocks.

**UX notes:** On phones, show the ranked bar list by default (treemaps are hard to read at 360 px), with the heatmap behind a toggle. The diverging colour scale is clamped at ±5% and has a legend.

---

### US-2.5 · Look at a date range instead of one day

**Story:** As Ngozi, I want to choose a period (e.g. this month, year to date, or custom dates), so that I can see cumulative performance rather than one session.
`Must · P3 · J6 · Ngozi`

**Acceptance criteria:**

- Given I switch from "Last session" to "Period" and pick a preset (1W, 1M, 3M, YTD, 1Y) or custom dates, then all market panels recalculate for the period: period % change, total value/volume, trading days, and sector performance.
- Dates outside the available data are disabled in the picker, and the min/max come from the data bounds.
- The URL holds the mode and dates (`?start=2026-09-01&end=2026-10-24`). Reloading restores them.

**UX notes:** Use a segmented control "Last session | Period". Presets come first, with "Custom" opening the calendar. Show the period clearly in the page title: "Market · 1 Sep – 24 Oct 2026".

---

### US-2.6 · Browse, search, and sort every listed stock

**Story:** As Tunde, I want the full price list with search, sort, and sector filter, so that I can scan the whole market my way.
`Must · P3 · J2, J6 · Tunde`

**Acceptance criteria:**

- Given the list, when I type in the filter, then rows match ticker or company name as I type (debounced, no reload).
- I can sort by ticker, price, change, % change, volume, and value. Column headers announce the sort direction to screen readers.
- I can filter by sector, and the filter chips are removable.
- Sort, filter, and search persist in the URL.
- On phones, the list shows ticker + name, price, and % change by default; other columns are available via horizontal scroll inside the card with the ticker column sticky.

**UX notes:** About 150 rows, virtualised. Numbers are right-aligned in Plex Mono. The row hover/focus state opens the stock on Enter.

---

### US-2.7 · See price change versus trading activity

**Story:** As Tunde, I want a scatter of % change vs value traded, so that I can tell moves backed by real money from thin ones.
`Could · v1.1 · J2 · Tunde`

**Acceptance criteria:** It plots every traded stock, labels outliers, and points open the stock page. A table alternative is available.

---

### US-2.8 · See the NGX All-Share Index headline

**Story:** As Ada, I want the All-Share Index level and change, so that I know how "the market" did in the number the news uses.
`Could · TBD · J2 · Ada`

**Acceptance criteria:** It shows the ASI level, point change, and % change, with freshness.

**Deferred (owner, 2026-10-26):** the ASI will be added later. `tradesData` holds per-stock data only, so this needs an index feed added to the crawler first. Leave room for a headline tile in the Market Today layout (US-2.1) so adding it later needs no redesign.

---

## E3 · Research a stock

### US-3.1 · Find any stock fast

**Story:** As Tunde, I want to search by ticker or company name from anywhere, so that I can jump straight to a stock.
`Must · P3 · J3 · Tunde`

**Acceptance criteria:**

- Given I'm anywhere in the app, when I press `/` or Ctrl/⌘ K (desktop) or tap the search icon (mobile), then a search opens with focus in the input.
- Typing "dang" shows DANGCEM and DANGSUGAR with company names. Typing "zenith" finds ZENITHBANK. Matches are highlighted.
- Arrow keys move through results, Enter opens one, and Esc closes the search.
- With an empty query, I see my **recent stocks** (up to 5) and my watchlist.
- Given no match, then I see "No stocks match 'xyz'" and popular stocks.

**UX notes:** Full-screen sheet on mobile, centred palette on desktop. The symbol directory is cached for an hour, so search is instant and offline-tolerant.

---

### US-3.2 · See a stock's key facts at the top

**Story:** As Ada, I want the price, today's change, and the basics about the company up front, so that I understand the stock before diving into charts.
`Must · P3 · J3 · Ada`

**Acceptance criteria:**

- Given I open `/app/stocks/MTNN`, then the header shows ticker, company name, sector/subsector, last price (large, Mono), change and % change (▲/▼), and the freshness stamp.
- A key-stats row shows: previous close, day range (low–high), volume, value, deals, market cap (when shares outstanding are known), and 52-week range when there are enough days.
- The ☆ watchlist toggle (US-5.1) and a "Share" action (US-3.9) sit in the header.
- Given an unknown symbol, then I see "We couldn't find 'XYZ'" with search open.

**UX notes:** On mobile the key stats are a 2-column grid that collapses to "Show more stats". Show "—" for missing values, never 0 or NaN.

---

### US-3.3 · Read the price chart over the period I choose

**Story:** As Tunde, I want an interactive candlestick or line chart with quick ranges, so that I can read the trend for my time horizon.
`Must · P3 · J3 · Tunde`

**Acceptance criteria:**

- The default is a candlestick over **6M** with the volume pane on. Range presets: 1M, 3M, 6M, YTD, 1Y, ALL, plus custom.
- I can switch Candle / Line. The crosshair shows date, O/H/L/C, volume, and change for that day.
- Pinch/scroll zoom and drag-pan work. "Reset" returns to the selected range.
- Given there are fewer days than the range (a newly listed or illiquid stock), then the chart shows what exists, labelled "Showing 34 trading days".
- Range and type are in the URL.

**UX notes:** Chart height is ~55% of the viewport on mobile with the range control directly above it (thumb-reachable). Don't animate the chart on load. Lazy-load the chart library while showing a skeleton.

---

### US-3.4 · Add indicators and understand them

**Story:** As Tunde, I want to toggle moving averages, Bollinger Bands, RSI, and MACD, and as Ada I want a one-line explanation of each, so that the chart answers my question without a finance course.
`Must · P3 · J3 · Tunde, Ada`

**Acceptance criteria:**

- An "Indicators" control offers overlays (SMA 50, SMA 200, EMA 12, EMA 26, Bollinger 20) and panes (Volume, RSI 14, MACD 12/26/9). Choices persist in the URL.
- Every indicator has an ⓘ explainer, e.g. "RSI above 70 often means a stock has risen quickly and may cool off; below 30, it may be oversold."
- Indicators are computed on full history and then shown for the visible range, so there's no "warm-up gap" at the start of short ranges (ADR-009).
- Each overlay has a distinct colour **and** dash style, and a legend that toggles it.

**UX notes:** A bottom sheet on mobile, a popover on desktop. Group the options as "Trend (on price)" and "Momentum (below price)". Default off for Ada-like first sessions except Volume.

---

### US-3.5 · See trading signals on the chart

**Story:** As Tunde, I want to pick a strategy and see where it fired buy/sell signals, so that I can judge how it has behaved on this stock.
`Must · P3 · J3 · Tunde`

**Acceptance criteria:**

- I can choose a strategy (MACD crossover, RSI reversal, SMA golden/death cross), and its markers appear on the price chart (▲ below the bar for buy, ▼ above it for sell).
- Below the chart, a signal list shows date, type, price, and "price since signal (%)". Selecting a row highlights the marker and moves the crosshair there, and the reverse also works.
- The summary shows counts in range ("3 buy, 2 sell signals in 6 months") and the most recent signal with how long ago it fired.
- Given no signals in range, then I see "No signals in this period" with a hint to widen the range.

**UX notes:** Signal wording is descriptive ("MACD crossed above its signal line"), never instructional. Call the list "Signals", not "Trades".

---

### US-3.6 · Understand what a strategy is looking for

**Story:** As Ada, I want a short explanation of each strategy, so that I know what a "signal" means before I trust it.
`Should · P4 · J3 · Ada`

**Acceptance criteria:** Each strategy has a 2–3 sentence explainer with a small diagram, a "what it's good at / where it fails" line, and a link to the glossary (US-6.5).

---

### US-3.7 · Find similar stocks

**Story:** As Ngozi, I want stocks similar to this one, with the reason they're similar, so that I can compare peers quickly.
`Must · P3 · J3 · Ngozi`

**Acceptance criteria:**

- I see up to 8 peers with ticker, company, subsector, market cap, period value, period % change, and an overall match %.
- I can sort by overall match, industry, market cap, or traded value. Each row shows a small breakdown of why it matched.
- Selecting a peer opens its page. A "Compare" action (later, US-3.10) is visible but marked "coming soon" only if it's planned for the next release; otherwise hidden.

**UX notes:** Explain the score once in an ⓘ: "Based on industry, size, and trading activity over the selected period". On mobile, use cards instead of a table.

---

### US-3.8 · See and export the underlying data

**Story:** As Ngozi, I want the daily OHLCV table and a CSV download, so that I can do my own analysis.
`Should · P3–P4 · J3 · Ngozi`

**Acceptance criteria:** A "Data" tab shows date, open, high, low, close, change %, volume, value, and deals for the selected range, newest first. "Download CSV" exports exactly that range, with a filename like `MTNN_2026-04-24_2026-10-24.csv` and dates in WAT.

---

### US-3.9 · Share or bookmark exactly what I'm looking at

**Story:** As Tunde, I want the URL to capture my stock, range, indicators, and strategy, so that I can bookmark it or send it to a friend.
`Must · P3 · J3 · Tunde`

**Acceptance criteria:**

- Given any change to view settings, then the URL updates, and back/forward step through meaningful view changes.
- "Share" uses the device share sheet on mobile (WhatsApp, etc.) and "Copy link" on desktop, with a toast "Link copied".
- Given a recipient without an account opens the link, then they see sign-in with "Request an invite", and after signing in they land on that exact view.

---

### US-3.10 · Compare a stock with its sector or a peer

**Story:** As Ngozi, I want to overlay a stock's performance against its sector average or a peer, so that I can see relative strength.
`Could · v1.1 · J3 · Ngozi`

**Acceptance criteria:** It plots % performance from a common start date for up to 3 series, with a legend and a table.

---

### US-3.11 · Get chart information without seeing the chart

**Story:** As a screen-reader user, I want a text summary and a table for every chart, so that I get the same information as sighted users.
`Must · P3 · J3 · All`

**Acceptance criteria:**

- Every chart has an accessible name summarising it: "MTNN, 6 months, up 12.4%, last ₦245.00, 3 buy and 2 sell signals".
- A "View as table" toggle exposes the same data as a semantic table.
- The chart crosshair can be moved with ←/→ when focused, and the values are announced politely.

---

## E4 · AI signal interpretation

### US-4.1 · Get a plain-language reading of the signals

**Story:** As Ada, I want the app to explain what the current signals and indicators suggest, in plain English, so that I understand the picture without interpreting charts myself.
`Must · P4 · J4 · Ada`

**Acceptance criteria:**

- Given I'm on a stock page with a strategy selected, when I tap "Explain these signals", then within ~10 s I get a card with **stance** (bullish / bearish / neutral), a summary of ≤ 60 words, 2–4 drivers, key levels (support/resistance), confidence (low / medium / high), and caveats.
- The text never says "buy", "sell", or "you should". It describes what the signals indicate.
- A loading state shows progress ("Reading 6 months of MTNN data…"), not a bare spinner.

**UX notes:** Use the violet AI treatment and the ✦ icon throughout. The card sits next to the chart on desktop and below the signal list on mobile.

---

### US-4.2 · Know it's AI, when it was made, and what it's based on

**Story:** As a User, I want every AI reading clearly labelled with its source data, time, and limits, so that I can weigh it properly.
`Must · P4 · J4 · All`

**Acceptance criteria:**

- Every AI card shows the title "AI signal interpretation", the model name, "Generated 09:12 WAT · 26 Oct", "Based on data up to 24 Oct close", and the strategy and range used.
- The disclaimer is always visible inside the card (never collapsed or hidden behind a tooltip).
- Given the underlying data has updated since the reading was made, then the card shows "Newer data available — refresh".

---

### US-4.3 · Get instant results when others asked the same question

**Story:** As a User, I want readings that already exist for today to load instantly, so that I'm not waiting, and the team isn't paying for duplicates.
`Must · P4 · J4 · All`

**Acceptance criteria:**

- Given someone already generated a reading for the same stock, strategy, range, and data date, when I tap "Explain", then it appears in < 1 s, is labelled with its original generation time, and **doesn't count against my quota**.
- I can force a fresh reading only when the data has changed.

---

### US-4.4 · See my AI allowance

**Story:** As a User, I want to know how many AI readings I have left today, so that I can use them where they matter.
`Must · P4 · J4 · All`

**Acceptance criteria:**

- The Explain button shows "3 of 5 left today" (quota: **5 per day**, D-05).
- Given I've used my allowance, then the button is replaced by "You've used today's 5 readings — they reset at midnight WAT", and cached readings remain viewable.
- Admins aren't limited (or have a higher, configurable limit).

---

### US-4.5 · Cope when the AI is unavailable

**Story:** As a User, I want a clear message if the AI service fails, so that I know the rest of the app still works.
`Must · P4 · J4 · All`

**Acceptance criteria:**

- Given the provider times out or returns invalid output (after one automatic retry), then I see "AI readings are unavailable right now. Charts and signals still work." with a "Try again" action. **No quota is consumed.**
- Given AI is turned off by config, then the Explain button is hidden, not broken.

---

### US-4.6 · Tell the team if a reading was useful

**Story:** As a User, I want to rate a reading 👍/👎 with an optional reason, so that the team can improve it.
`Could · v1.1 · J4 · All`

**Acceptance criteria:** One tap to rate; an optional reason from a short list ("Too vague", "Wrong", "Helpful", …). Ratings are visible in admin usage (US-7.5).

---

## E5 · Watchlist

### US-5.1 · Add or remove a stock from my watchlist anywhere

**Story:** As Tunde, I want to star stocks from any list, search result, or stock page, so that building my watchlist is effortless.
`Must · P4 · J5 · Tunde`

**Acceptance criteria:**

- A ☆/★ toggle appears on stock pages, price-list rows, mover lists, and peer cards. Toggling updates instantly (optimistic) and persists. On failure it reverts with a toast.
- The toggle has an accessible name ("Add MTNN to watchlist" / "Remove MTNN from watchlist") and `aria-pressed`.
- There's a limit of 50 stocks, with a friendly message at the limit.

---

### US-5.2 · See how my watchlist is doing

**Story:** As Ada, I want one page showing all my stocks' latest price and change, so that I check everything I care about at once.
`Must · P4 · J5 · Ada`

**Acceptance criteria:**

- `/app/watchlist` lists my stocks with price, day change (▲/▼), period change for a selectable range (1W/1M/3M/YTD), a sparkline, and the latest signal for my preferred strategy.
- I can sort the list and remove stocks (with "Undo" in a toast for 5 s).
- A summary line reads "4 of 6 up today".

---

### US-5.3 · See my stocks first on the market page

**Story:** As Ada, I want my watchlist pinned at the top of "Market today", so that the first thing I see is what I own.
`Should · P4 · J2, J5 · Ada`

**Acceptance criteria:** Given I have ≥ 1 watchlist stock, then a horizontal "Your stocks" strip of compact cards appears above the market summary. It scrolls sideways on mobile and links to the watchlist page.

---

### US-5.4 · Know what to do with an empty watchlist

**Story:** As a new user, I want guidance when my watchlist is empty, so that I know how to start.
`Must · P4 · J5 · Ada`

**Acceptance criteria:** The empty state shows "Star stocks to follow them here", a search field, and popular stock chips with one-tap ☆.

---

### US-5.5 · Get price alerts on Telegram

**Story:** As Tunde, I want to link to the EquityLensNG Telegram bot from a stock, so that I can set price alerts where I already get them.
`Could · v1.1 · J5 · Tunde`

**Acceptance criteria:** A "Set alert in Telegram" action opens the bot with the symbol pre-filled (deep link). It's shown only if the bot is configured.

---

## E6 · Account & preferences

### US-6.1 · Manage my profile and password

**Story:** As a User, I want to update my name and change my password, so that my account stays current and secure.
`Must · P2–P3 · J7 · All`

**Acceptance criteria:** I can edit my display name. Changing the password requires the current password, and on success all other sessions are signed out with a confirmation "Password changed. Other devices have been signed out."

---

### US-6.2 · Choose light, dark, or automatic theme

**Story:** As a User, I want to choose the theme, so that the app is comfortable in daylight and at night.
`Must · P3 · — · All`

**Acceptance criteria:** Auto (follow device) / Dark / Light in the user menu and on the account page. The choice is saved to my account and applied before first paint (no flash of the wrong theme). Charts recolour without reloading.

---

### US-6.3 · Sign out everywhere

**Story:** As a User who lost a phone, I want to sign out of all devices, so that nobody else can use my account.
`Should · P4 · J7 · All`

**Acceptance criteria:** "Sign out of all devices" revokes every session, including the current one, after confirmation.

---

### US-6.4 · Delete my account

**Story:** As a User, I want to delete my account and data, so that I'm in control of my information.
`Must · P4 · J7 · All`

**Acceptance criteria:** It requires typing my email to confirm. It deletes my user record, sessions, watchlist, and AI usage counts. My audit-log entries are kept as they are, with my email, until the 365-day retention removes them (D-18). I'm signed out with "Your account has been deleted". Cached AI readings (not personal) remain.

---

### US-6.5 · Learn the terms and read the fine print

**Story:** As Ada, I want a glossary and a help page, so that I can look up terms like RSI, market cap, or "golden cross".
`Should · P4 · — · Ada`

**Acceptance criteria:** `/app/help` has a searchable glossary (≥ 25 terms at launch), "How EquityLensNG works", data sources and freshness, the disclaimer, privacy, and terms. In-app ⓘ explainers link to the matching glossary entry.

---

## E7 · Admin & operations

### US-7.1 · Invite people

**Story:** As Admin, I want to invite one or several people by email, so that I control who joins during the invite-only phase.
`Must · P2 · J8 · Admin`

**Acceptance criteria:**

- I can enter one email, or paste several (comma/newline separated, up to 50), optionally with a name and a role (user/admin).
- Invalid emails, existing users, and duplicates are flagged before sending and skipped, with a summary: "Sent 12 · skipped 2 (already members)".
- Each invite sends an email. **"Copy invite link"** is also available for sharing via WhatsApp when email is unreliable.
- Invites expire after 7 days (configurable).

---

### US-7.2 · Manage pending invites

**Story:** As Admin, I want to see invite status and resend or revoke invites, so that nobody is stuck and old links can't be misused.
`Must · P2–P4 · J8 · Admin`

**Acceptance criteria:** The list shows email, invited by, sent date, status (pending / accepted / expired / revoked), and resend count. Filter by status. "Resend" issues a new link and invalidates the old one. "Revoke" invalidates it immediately. All actions are audit-logged.

---

### US-7.3 · Review access requests

**Story:** As Admin, I want a queue of people who requested invites, so that I can approve good fits quickly.
`Must · P2–P4 · J0, J8 · Admin`

**Acceptance criteria:** The queue shows name, email, note, and date. "Approve" sends an invite (US-7.1) in one click. "Decline" removes the request without emailing (optional polite email via a checkbox). Bulk approve is available, but each request is still an explicit admin choice; nothing is approved automatically. A badge on the admin nav shows the count of new requests. Every approval and decline records the admin who made it in the audit log (US-7.7).

---

### US-7.4 · Manage users

**Story:** As Admin, I want to find users, change roles, and deactivate accounts, so that access stays appropriate.
`Must · P2–P4 · J8 · Admin`

**Acceptance criteria:** Search by name or email. Each row shows role, status, joined date, last active, and AI readings in the last 7 days. "Deactivate" signs the user out everywhere within 60 s, and they can't sign in. "Reactivate" restores access. I can't deactivate myself or demote the last admin. Every change is audit-logged.

---

### US-7.5 · Watch AI usage and cost

**Story:** As Admin, I want daily AI usage, so that I can manage cost and spot abuse.
`Should · P4 · J8 · Admin`

**Acceptance criteria:** A chart of readings per day (generated vs served from cache) plus a table, top users, estimated token usage per provider and model, and the cache hit rate. Data covers the last 30 days.

---

### US-7.6 · Check data health

**Story:** As Admin, I want to see when the crawler last ran and whether daily data is complete, so that I catch problems before users do.
`Should · P4 · J8 · Admin`

**Acceptance criteria:** It shows the last `tradesData` fetch and last `daily_bars` update (WAT), a "stale" warning if > 2 h old during market hours, symbols with no data today, and missing sessions in the last 30 days.

---

### US-7.7 · Review the audit log

**Story:** As Admin, I want a searchable audit log of every access and account event, so that I can answer "who did what, to whom, when, and from where" and spot suspicious activity.
`Must · P4 (events recorded from P2) · J8 · Admin`

**Acceptance criteria:**

- Given I open **Admin → Audit log**, then I see the newest events first: time (WAT), actor (name/email, "System", or "Anonymous"), action in plain words ("Approved access request", "Deactivated user"), target, outcome (success/failed), and IP address.
- **Events recorded:** sign-in success and failure; sign-out; sign-out-all; password change and reset; access request submitted, approved, or declined; invite sent, resent, revoked, accepted, or expired; role changed; user deactivated or reactivated; account deleted; admin settings changed (e.g. `SIGNUP_MODE`, AI quota); audit-log export.
- I can filter by date range, action category (Access & invites · Sign-in · Account · Admin changes), actor, target, and outcome, and search by email. Filters live in the URL.
- Selecting a row opens a detail drawer with all fields (before/after values for changes, user agent, request ID). Passwords and tokens are **never** recorded.
- "Export CSV" downloads the current filtered view, and the export itself is logged.
- Entries can't be edited or deleted through the app or API. The app's database user may only insert into and read `audit_log`. Retention is 365 days.
- From a user's row in **Users** (US-7.4), "View activity" opens the log filtered to that user.
- Given a burst of failed sign-ins (≥ 10 for one account in 15 min), then the row is flagged "Suspicious" and the admin nav shows a badge.

**UX notes:** Use the dense table on desktop and a stacked card list on mobile. Write actions as sentences, not codes ("Ada Obi approved `tunde@example.com`'s access request"). Relative time on hover/focus ("3 h ago"). An empty state for a filter with no results.

### US-7.8 · See how people use the app

**Story:** As the owner, I want to see which pages and features people use and how they move through the app, so that I know the typical flow and where to invest.
`Must · P4 · J8 · Admin` (added 2026-10-29, owner)

**Acceptance criteria:**

- **Admin → Usage** shows, for the last 7, 30 or 90 days: active users, sessions, page views and pages per session; active users per day (with a table view); the most visited pages with people and average time on the page; the most used features; where sessions start; the most common page-to-page moves; the most common first three pages of a session; phone vs desktop.
- Events come from the signed-in app only: a page view per screen (route template such as "Stock page", plus the ticker) and named feature events (starred a stock, opened search, changed chart range…). Nothing typed is sent.
- It's **pseudonymous**: a random ID per browser session and a keyed hash of the user, no IP address, no user agent. Kept 90 days. It's separate from the audit log (US-7.7), which is a security record.
- Anyone can turn it off in **Account → Privacy**; from then on nothing is kept, whatever the browser sends. Deleting the account deletes its usage events. The privacy notice says all this.

---

## E8 · Cross-cutting experience

### US-8.1 · Navigate comfortably on my phone

**Story:** As Ada on my phone, I want navigation within thumb reach, so that I can move around one-handed.
`Must · P3 · — · Ada`

**Acceptance criteria:** Below 768 px, a bottom nav shows **Market · News · Watchlist · Account** (Admin appears inside Account for admins), with the current item marked (`aria-current`). The top bar shows the logo, a search icon (US-3.1), and the freshness stamp. Above 1024 px, the left sidebar (Market, News, Watchlist, Admin) replaces the bottom nav, and search sits in the top bar.

---

### US-8.2 · Use the whole app with a keyboard or screen reader

**Story:** As a keyboard or screen-reader user, I want every feature to be operable and announced, so that I'm not excluded.
`Must · P3 onward · — · All`

**Acceptance criteria:** A skip-to-content link; logical focus order; landmarks; all controls named; dialogs trap and return focus; live regions announce errors and "AI reading ready". A manual NVDA and VoiceOver pass on journeys J1–J4 before launch.

---

### US-8.3 · Work well on slow or expensive mobile data

**Story:** As Ada on a patchy 3G/4G connection with limited data, I want the app to load fast and use little data, so that it's usable anywhere and doesn't eat my bundle.
`Must · P3 · — · Ada`

**Acceptance criteria:**

- First load of `/app/market` is ≤ 250 KB of JS (gzipped), with LCP < 2.5 s on a throttled mid-range Android.
- The chart libraries load only on pages with charts. Images are optimised. Fonts are subset (Plex Sans 400/500/600, Mono 400/500).
- Failed requests retry automatically with backoff. When offline, the last loaded data stays visible with an "You're offline — showing last loaded data" banner.

---

### US-8.4 · Understand errors and recover

**Story:** As a User, I want errors explained in plain language with a way forward, so that I'm never stuck.
`Must · P3 onward · — · All`

**Acceptance criteria:** No raw exceptions or codes in the main text. Each error says what happened and what to do, plus a "Try again" where relevant. A small request ID is shown for support. Errors inside one panel don't break the rest of the page.

---

### US-8.5 · Know when the market is closed

**Story:** As a User checking on a weekend or holiday, I want the app to say the market is closed and show the last session, so that I'm not confused by "no change".
`Must · P3 · J2 · All`

**Acceptance criteria:** On non-trading days and outside hours, a neutral banner reads "Markets are closed. Showing the last trading day, Fri 24 Oct". Freshness labels follow US-2.3. Nothing shows as "0.00% today" for a day with no session.

---

### US-8.6 · Read numbers and dates consistently

**Story:** As a User, I want prices, changes, and dates formatted the same way everywhere, so that I can scan without second-guessing.
`Must · P3 · — · All`

**Acceptance criteria:** All formatting goes through `lib/format.ts` per [06 §3](06-design-system.md#number-formatting-libformatts): ₦ with 2 dp, compact ₦1.2B, signed % with a true minus, ▲/▼, and dates as "26 Oct 2026" with times in WAT. Unit tests cover each formatter, including negative, zero, null, and very large values.

---

## E9 · News (added 2026-10-26)

The ngxPro crawler already collects news into `news_articles` roughly every 4 hours, with 5 results per sector, symbol tags, an importance score, an embedding, and 90-day retention. The platform **only reads it** (ADR-014). News answers the question charts can't: *why did it move?*

### US-9.1 · See recent news while analysing a stock

**Story:** As Ada, I want the latest news about a stock next to its chart and analysis, so that I understand what might be behind the price move.
`Must · P3 · J3, J10 · Ada, Tunde`

**Acceptance criteria:**

- Given I'm on `/app/stocks/MTNN`, then a **News** panel lists up to 5 recent articles (last 30 days) that mention MTNN, newest first by default, with "Most important" as an alternative sort.
- Each item shows the headline, source domain (e.g. *businessday.ng*), published time ("3 h ago", or "24 Oct" with the full WAT time on hover/focus), and a 2-line snippet. The headline opens the original article in a new tab, marked as external.
- Items are grouped by relevance using the tag schema in [10 §3](10-news-tagging.md#3-tag-schema-v2): **"About MTNN"** (named in the headline) first, then **"Mentions MTNN"** (body only), then a separate **"Sector news · ICT"** group. It's always clear how strongly each item relates to this company.
- Each item shows up to 2 topic chips (e.g. *Dividends*, *Regulation*), and tapping a chip opens the News page filtered to this stock and topic (US-9.8).
- Given no article mentions the stock, then I see "No recent news mentioning MTNN" followed by sector news, or "No recent news" if there's none.
- Given an article's publish date was estimated (`published_at_estimated`), then it shows "Found 24 Oct" instead of a published time.
- "See all news" opens the News page (US-9.8) pre-filtered to this stock.

**UX notes:** On desktop, the panel sits beside the chart; on mobile, it's a tab next to Signals and Peers. Show headline, source, and snippet only; **never reproduce full articles**. Strip HTML from snippets. External links use `rel="noopener noreferrer nofollow"`. A small "News is collected automatically and may be incomplete" note sits in the panel footer.

---

### US-9.2 · See news on the price chart

**Story:** As Tunde, I want markers on the chart on days with news about the stock, so that I can connect price moves to events.
`Should · P4 · J3, J10 · Tunde`

**Acceptance criteria:**

- Given the chart range includes days with articles mentioning the stock, then a small news marker appears on each such day (one marker per day, with a count when > 1).
- Hovering, focusing, or tapping a marker shows the day's headlines; selecting one scrolls to and highlights it in the News panel.
- A "News" toggle in the chart's Indicators control turns markers on/off (default on). Markers never obscure signal markers (news sits on the bottom axis band).
- Markers appear only within news retention (last 90 days). Older ranges show none, with a note "News available for the last 90 days".

---

### US-9.3 · See the top market stories on Market Today

**Story:** As Ada, I want the most important market news of the day on the Market page, so that I get the story behind the numbers in one place.
`Should · P3–P4 · J2, J10 · Ada`

**Acceptance criteria:**

- "Top stories" shows the 5 highest-importance articles from the last 48 hours across all sectors, each with tagged ticker chips that link to stock pages.
- Given a sector is selected (US-2.4), then the stories filter to that sector.
- Given there are no articles in 48 hours, then the section shows the latest 5 with their dates, or hides if there are none in 7 days.

---

### US-9.4 · Catch up on news for my watchlist

**Story:** As Ada, I want news for the stocks I follow in one feed, so that I don't have to open each stock.
`Should · P4 · J5, J10 · Ada`

**Acceptance criteria:**

- The watchlist page has a "News" tab listing articles mentioning any of my stocks (last 7 days), newest first, each tagged with which of my stocks it mentions.
- An empty state says "No news for your stocks this week" and suggests Top stories.

---

### US-9.5 · AI interpretation considers recent headlines

**Story:** As Ada, I want the AI reading to take recent news into account and show which headlines it used, so that the explanation reflects what's happening, not only the chart.
`Should · P4 · J4, J10 · Ada`

**Acceptance criteria:**

- The insight service includes up to 5 recent headlines that mention the stock (title, source, date only; no full text) alongside the signal features.
- The AI card lists **"Headlines considered"** with links, or "No recent headlines were available" when there were none.
- The model is instructed to treat headlines as context, never to state they caused a move as fact, and never to advise. The output schema gains `news_context` (a 1-sentence summary) and `sources[]` (article IDs). Both are validated: a cited ID must be one of the headlines sent.
- The cache key includes the newest included article's ID, so new headlines produce a new reading.

---

### US-9.6 · Read sector news from the sector view

**Story:** As Ngozi, I want news for a sector when I drill into it, so that I see sector-wide themes (policy, FX, regulation).
`Could · v1.1 · J6, J10 · Ngozi`

**Acceptance criteria:**

Selecting a sector on Market Today shows its last 7 days of news, ranked by importance, with ticker chips.

---

### US-9.7 · Report news tagged to the wrong stock

**Story:** As a User, I want to flag an article that doesn't belong to a stock, so that the news stays relevant.
`Could · v1.1 · J10 · All`

**Acceptance criteria:**

- "Not about MTNN?" on an item records a report. The platform stores it in its own `news_feedback` collection and never edits `news_articles`.
- Given an article–symbol pair gets reports from ≥ 2 users or 1 admin, then it's hidden from that stock's news.
- Admins see reported pairs in data health (US-7.6), which helps tune the crawler's tagging.

---

### US-9.8 · Browse and filter all news

**Story:** As Ngozi, I want a News page where I can narrow articles by stock, sector, topic, and date, so that I can answer questions like "what dividend news came out for banks this week?" in seconds.
`Must · P3–P4 · J10 · Ngozi, Tunde, Ada`

**Acceptance criteria:**

- `/app/news` lists articles newest first (or "Most important"), using the same `NewsItem` as the stock page, with ticker and topic chips.
- **Filters**, using the tags in [10 §3](10-news-tagging.md#3-tag-schema-v2):
  - stocks (multi-select, plus a "My watchlist" toggle)
  - sector and subsector
  - **topic** (Earnings, Dividends, Corporate actions, Capital raising, M&A, Leadership, Listings & trading status, Regulation, Interest rates & CBN, Naira & FX, Economy, Energy, Market wrap, Legal, Outlook)
  - **scope** (Company · Several companies · Sector · Market · Economy)
  - regulator (CBN, SEC, NGX, NCC, …)
  - content type (Opinion is hidden by default)
  - source
  - date (24 h · 7 d · 30 d · 90 d · custom)
  - "Headline mentions only"
- Each filter option shows a count for the current result set (e.g. "Dividends (12)"), and options with zero results are disabled but visible.
- A search box matches headline words. Every filter and the search live in the URL, so a filtered view can be bookmarked or shared.
- Active filters appear as removable chips, with a "Clear all".
- Given no results, then I see "No news matches these filters", with the most restrictive filter named and a one-tap way to remove it.

**UX notes:** On mobile, the filters open in a bottom sheet with an "Apply (23 results)" button, and the most-used filters (Topic, My watchlist, Date) sit as chips above the list. Desktop shows a left filter rail. News only goes back 90 days, so say so in the date filter. Opinion pieces carry an "Opinion" badge when shown.

---

## 4. Traceability: journeys → stories

| Journey | Stories |
| --- | --- |
| J0 Request access | US-1.1, US-1.2, US-7.3 |
| J1 Accept invite & first value | US-1.3, US-1.4, US-1.8, US-7.1 |
| J2 Daily check-in | US-2.1 – US-2.4, US-2.6, US-5.3, US-8.5 |
| J3 Research a stock | US-3.1 – US-3.11 |
| J4 AI read | US-4.1 – US-4.6 |
| J5 Watchlist | US-5.1 – US-5.5 |
| J6 Sector & period | US-2.4, US-2.5, US-2.6 |
| J7 Account self-service | US-1.6, US-6.1, US-6.3, US-6.4 |
| J8 Admin | US-7.1 – US-7.7 |
| J9 Legacy migration | US-1.7 |
| J10 News behind the move | US-9.1 – US-9.8 |

## 5. Open questions raised by the stories

| # | Question | Affects | Suggested default |
| --- | --- | --- | --- |
| Q-1 | Add an index (ASI) data source to the crawler? | US-2.8, US-2.1 | ✅ **Decided 2026-10-26:** yes, later; launch without it |
| Q-2 | Should admins approve every access request, or auto-approve some (e.g. a referral code)? | US-1.2, US-7.3 | ✅ **Decided 2026-10-26:** manual admin approval for **all** invites, with no auto-approval |
| Q-3 | Can existing users invite others, and how many? | US-7.1 | Follows from Q-2: no direct invites. A future "suggest someone" would just create an access request for an admin to approve |
| Q-4 | AI quota per day (D-05) and an admin limit | US-4.4 | ✅ **Decided 2026-10-26: 5/day per user**; admin limit configurable (suggest 25) |
| Q-5 | Who writes the glossary and help content? | US-6.5, US-3.6 | Owner drafts; we format |
| Q-6 | Watchlist size limit | US-5.1 | 50 |
| Q-7 | Holiday calendar source for "market closed" | US-2.3, US-8.5 | Infer from crawl data (no new `TradeDate`), plus a small manual holiday list |
| Q-8 | Email provider (D-04): needed for invites in P2 | US-1.3, US-1.6, US-7.1 | ✅ **Decided 2026-10-26: Resend**, with Azure Communication Services as the planned alternative once on Azure (see D-04) |
| Q-9 | Fix the crawler's symbol tagging to match **whole words** (and drop over-generic company-name keys)? Today `CAP`, `TOTAL`, `ETI`, `NB`, `ACCESS` match inside ordinary words | US-9.1 – US-9.5 | ✅ **Approved 2026-10-26 (D-15)**, extended into a full tag schema for filtering. See [10-news-tagging.md](10-news-tagging.md) |
| Q-10 | Fetch news on demand (Tavily) when a user opens a stock with no recent news? | US-9.1 | ✅ **Decided 2026-10-26: no** (D-16). Sector news and an honest empty state instead |
| Q-11 | Flag estimated publish dates in the crawler (`published_at_estimated: true` when Tavily gives none)? | US-9.1, US-9.2 | ✅ **Approved 2026-10-26 (D-15)** |
