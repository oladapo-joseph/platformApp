# 01 — Current-State Assessment (Streamlit app)

> Status: **For review** · Assessed: 2026-10-25 · Snapshot preserved in [`streamlitApp/`](../streamlitApp/)

This document records what the existing EquityLensNG Streamlit app does, how it is built, and what we must fix, keep, or drop when moving to FastAPI + React. Everything here was checked against the code on branch `newdesign` (HEAD `1e46a33`).

---

## 1. What the app does today

| Area | Features | Code |
| --- | --- | --- |
| **Auth** | Username/password login gate. Admin-only user creation, revoke/restore, and roles (`admin`, `user`). No self sign-up and no password reset. | `utility/auth.py`, `views/login.py`, `views/admin.py` |
| **Market Overview** | Two modes: **Last Trading Day** (snapshot) and **Date Range** (cumulative). Stat cards, top gainers/losers/most-traded tables, sector treemap and bar, price-change scatter, and a searchable, sortable price table. | `views/market_overview.py`, `charts/market_overview.py` |
| **Stock Deep Dive** | Symbol picker, candle/line chart, SMA/EMA overlays, Volume/MACD/RSI panels, quick ranges (1M–ALL), and drawing tools (horizontal line, trendline, vertical line). | `views/deep_dive.py`, `charts/deep_dive.py` |
| **Signals** | Three strategies: MACD crossover, RSI reversal, SMA 50/200 golden cross. Shows buy/sell counts and a signal chart. | `analysis/signals.py` |
| **AI recommendation** | On-demand Claude call (`claude-sonnet-4-6`, 200 tokens) that returns `BUY / SELL / HOLD` plus a reason, cached in the session only. | `analysis/recommender.py` |
| **Similar stocks** | Weighted similarity: industry 35%, market cap 30%, traded value 20%, volume 15%. Uses the `industry_data` collection and `utility/industry_sm.json`. | `views/deep_dive.py::_find_similar` |
| **Raw data** | Expandable OHLCV table. | `views/deep_dive.py` |

### Data sources (shared with ngxPro)

- **`tradesData`**: one document per symbol per crawl, every ~35 minutes in market hours. Fields: `Symbol, Sector, TradeDate, fetched_at, OpeningPrice, HighPrice, LowPrice, ClosePrice, Volume, Value, PrevClosingPrice, Change, PercChange, Trades`. Daily bars are rebuilt **on every request** by grouping on `$dateToString($fetched_at, WAT)` with `$max`/`$min` accumulators.
- **`industry_data`**: company name, sector, subsector, shares outstanding, and the `similarsector` score map.
- **`app_users`**: platform users (PBKDF2-HMAC-SHA256, 260k iterations, per-user salt).
- The collection name comes from the `COLLECTION_NAME` env var; the README calls it `tradesData`.

---

## 2. Architecture today

```text
Streamlit script (app.py) ── reruns the whole script on every widget interaction
   ├── views/*         HTML strings + st.* widgets (69 unsafe_allow_html blocks)
   ├── charts/*        Plotly figures built server-side
   ├── data/loader.py  PyMongo aggregations, @st.cache_data (per-process, 5–60 min TTL)
   ├── data/indicators.py, analysis/signals.py   pure pandas (good, portable)
   └── analysis/recommender.py                   anthropic SDK
```

**What's worth keeping.** The domain layer is clean and framework-free: `indicators.py`, `signals.py`, and the similarity scoring are pure pandas, so they port to FastAPI almost unchanged. The MongoDB pipelines already follow the M0 rule of grouping before sorting.

---

## 3. Findings

Severity key: 🔴 must fix before public sign-up · 🟠 fix during the migration · 🟡 clean-up

### Correctness

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| C1 | 🟠 | The main price chart **always plots MACD signals**, whatever strategy the user picks, and computes them on the *sliced* range (cold EMAs). The signal panel below uses the chosen strategy on full history, so the two views can disagree. | `charts/deep_dive.py:178-179` |
| C2 | 🟠 | The daily-bar index is `TradeDate` while grouping uses the `fetched_at` date. **Verified 2026-10-26, and worse than duplicates:** NGX publishes final end-of-day figures after the close, so the late-night and next-morning (09:00) crawls still carry the previous session's `TradeDate`. Grouping by crawl day therefore (a) blends the previous session's final snapshot into the next day's high, low, volume and value, and (b) labels a day with `$first` `TradeDate`, which often belongs to the previous session, so whole rows shift by a day. The P1 parity check (MTNN, DANGCEM, ZENITHBANK, OKOMUOIL, AVACAP; 2,996 symbol-days) found **433 days (14%) wrong**: 221 blended, 201 shifted, 9 with ₦0 highs/lows (C6), plus 2 legacy-only dates. The new API groups by `TradeDate` and matches an independent recomputation on every day. | `data/loader.py::load_stock_data`, `load_range_market`; `backend/tests/parity_check.py` |
| C3 | 🟡 | The recommender stamps the prompt with server-local `datetime.now().date()`, not WAT. | `analysis/recommender.py` |
| C4 | 🟡 | `datetime.utcnow()` is deprecated. `utility/logger.py` calls `basicConfig` on every log call. | `utility/auth.py`, `utility/logger.py` |
| C5 | 🟠 | **Daily close is the intraday maximum, not the last price.** The crawler stores a snapshot every 35 min, and NGX's intraday `ClosePrice` is the latest price. The loader groups the day's snapshots with `ClosePrice: {$max}` (and `$max` for `Change`/`PercChange`), so on a day when a stock falls the stored close is too high. This skews charts, indicators, signals, and period returns. Added 2026-10-26 and **verified on live data**: across MTNN, DANGCEM, ZENITHBANK, OKOMUOIL and FIDELITYBK (5,930 trading days), the stored close differed from the last price on **196 days (3.3%)**, up to 7.6% for ZENITHBANK and 6.1% for FIDELITYBK. Fixed by ADR-007: the crawler writes the latest snapshot, and the backfill corrects history. | `data/loader.py::load_stock_data`, `_SNAP_FIELDS`, `load_range_market` |
| C6 | 🟡 | **Empty and zero rows from NGX.** The first crawls of a session (~09:35–10:35) return rows with every price null or `NaN`, and some days (e.g. 2024-08-21 to 23) report `0.0` highs and lows for every stock. The legacy loader counts them, so it can show ₦0 as a period low. The API ignores snapshots without a positive close and treats non-positive highs and lows as missing. The crawler now skips no-price rows when writing `daily_bars`. | `tradesData`; `backend/app/repositories/bars_repo.py` (`_HAS_PRICE`, `_positive`) |

### Security & access

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| S1 | 🔴 | User-controlled strings (usernames) are interpolated into raw HTML via `unsafe_allow_html`. An admin-created username containing markup would render as HTML. | `app.py` sidebar user card, `views/admin.py` table |
| S2 | 🔴 | Password check uses `==` instead of a constant-time compare. | `utility/auth.py::verify_user` |
| S3 | 🟠 | Admin seeding reads `ADMIN_USERNAME`/`ADMIN_PASSWORD` with **empty-string defaults**. The README claims a default of `admin`/`admin123`, which the code does not implement. A missing env var seeds an admin with an empty username and password. The login form blocks empty input, but this must not carry over. | `utility/auth.py::init_users_collection` |
| S4 | 🟠 | There is no login rate-limiting or lockout, and no audit log, although the README mentions one. | — |
| S5 | 🟠 | There is no invite flow, email verification, or password reset. Every account is admin-created with a shared password. The new platform launches invite-only (ADR-013), so invites, resets, and request-an-invite replace this. | — |
| S6 | 🟡 | `.env` carries keys (incl. `GEMINI_API_KEY`) that have been on disk for a long time. Rotate them before more collaborators join. `GEMINI_API_KEY` is **kept**, since Gemini is the interim AI provider (ADR-012); `DB_PATH` is unused. | `.env` |

### AI recommendation

| # | Sev | Finding |
| --- | --- | --- |
| A1 | 🔴 | It outputs **"Recommendation: BUY/SELL/HOLD"** with no disclaimer. For a product aimed at Nigerian retail investors, this is a regulatory exposure (SEC Nigeria investment-adviser rules). **Owner decision 2026-10-26:** reframe as *signal interpretation* with a persistent disclaimer (ADR-006). A legal review of the copy is still recommended before open sign-up. |
| A2 | 🟠 | The whole buy/sell DataFrame is sent as `to_dict()`, which is unbounded. Output is free text and the verdict is regex-matched in the view. Move to a bounded input and structured JSON output. |
| A3 | 🟠 | There is no per-user quota or shared cache. Every click on "Generate" costs an API call, and identical requests from different users are not reused. |

### Quality, tooling & hygiene

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| Q1 | 🟡 | **The test suite is not in git.** `.gitignore` ignores `tests/` and `test**`. **Owner decision 2026-10-26:** the legacy tests stay untracked and run locally. Because the patterns also match new test folders, D-11 decides their scope at Phase 1. | `git check-ignore -v tests/test_loader.py` → `.gitignore:13:test**` |
| Q2 | 🟠 | Test baseline: **75 pass, 1 fail, 1 file errors on import.** `test_indicators.py::test_warmup_nans` expects rolling-mean RSI warm-up; the code correctly uses Wilder EWM, so the test is outdated. `test_recommender.py` imports `_build_llm`, a LangChain-era function that no longer exists. | `pytest -q` on 2026-10-25 |
| Q3 | ✅ | ~~`requirements.txt` pins ~130 packages, many unrelated: LangChain ×5, `openai`, Flask, `azure-functions`, `python-telegram-bot`, Jupyter/IPython, SQLAlchemy, `pyodbc`, `asyncpg`, APScheduler.~~ **Fixed 2026-10-26:** trimmed to the 10 packages the app imports (`google-genai` kept as the interim AI SDK), plus `requirements-dev.txt` for pytest. Verified in a fresh virtualenv. | `requirements.txt` |
| Q4 | 🟡 | Dead code and artifacts: `test_gemini.py` (imports LangChain, which is no longer installed; rewrite it for `google-genai` or delete it), `utility/db.py`, and a **26 MB `utility/ngx.sqlite` committed to git**. | `git ls-files` |
| Q5 | 🟡 | There is no CI, linting, or type checking. | — |

### UX, design & accessibility

| # | Sev | Finding |
| --- | --- | --- |
| U1 | 🟠 | Every interaction reruns the full Streamlit script, so filters feel sluggish and the scroll position resets. |
| U2 | 🟠 | Desktop-only layout. The fixed 210px sidebar and multi-column forms collapse poorly on phones, and most NGX retail investors are mobile-first. |
| U3 | 🟠 | Muted text `#6B7280` on `#0D0F14` is **3.96:1**, which fails WCAG AA for body text. Labels are 8–10px with heavy letter-spacing. |
| U4 | 🟠 | The entire UI is set in IBM Plex Mono. It works for numbers, but long-form text and labels get harder to scan. |
| U5 | 🟡 | Emoji are used as navigation icons (🌍 📈 ⚙️), and the styling depends on Streamlit's internal `data-testid` selectors, which can break on any Streamlit upgrade. |
| U6 | 🟡 | Deep Dive filters stay *disabled* until a stock is chosen. An empty state with search front and centre would be better. |
| U7 | 🟡 | View state lives only in the session: you can't bookmark or share a stock + range + strategy. |

### Brand

| # | Finding |
| --- | --- |
| B1 | `static/logo.png` is a 467×377 raster with an **opaque black background**, soft gradients, and a glow. It can't sit on light surfaces, blurs when scaled, and at favicon size (16–32px) the candles and arrow turn to noise. There's no wordmark lockup and no vector source. Addressed in [`07-brand-guidelines.md`](07-brand-guidelines.md). |

---

## 4. Keep / change / drop

| Keep (port as-is, with tests) | Change | Drop |
| --- | --- | --- |
| `indicators.py` (Wilder RSI, `adjust=False` EMA) | Daily-bar aggregation → crawler-written `daily_bars` (ADR-007) | Streamlit, all HTML-string views |
| `signals.py` strategies + `STRATEGIES` registry | Auth → invite-only access, sessions, argon2id with PBKDF2 migration | LangChain/OpenAI deps (Gemini SDK kept, ADR-012), LangChain-based `test_gemini.py` |
| Similarity scoring + `industry_sm.json` | AI → structured "signal interpretation", quota, shared cache | `utility/db.py`, `ngx.sqlite` |
| M0-safe aggregation pipelines | Charts → client-side (Lightweight Charts / ECharts) | Server-side Plotly figures |
| WAT-everywhere convention | Brand colour, tuned for contrast; Plex Sans + Plex Mono | Emoji navigation |
