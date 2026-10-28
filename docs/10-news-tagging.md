# 10 — News Tagging (crawler) & News Filters (app)

> Status: **Approved by the owner and built** (2026-10-26) in ngxPro: `shared/news_tagging.py`, `shared/news_aliases.json`, `shared/news_topics.json`, `crawler/app.py`, `shared/news.py`, `scripts/retag_news.py`. **Awaiting:** Azure deploy, then `retag_news.py --write`, then the precision gate (§7.2) before the web app shows news. Decision: D-15.
> Owner of the code: **ngxPro crawler** (`crawler/app.py` news section; `shared/news.py`). The platform only reads the result (ADR-014).

## 1. Why

News in EquityLensNG is only useful if it's **relevant** (it's really about the stock) and **findable** (you can narrow to "dividend news for my banks this week"). Today each article gets `symbols` (substring match), one `sector` (the search query's sector), and an `importance_score`. That's not enough to filter on, and the symbol tags are unreliable.

## 2. Problems found in the current tagger

| # | Problem | Evidence | Effect |
| --- | --- | --- | --- |
| T1 | **Substring matching**: `key in text_upper` | `crawler/app.py::_tag_symbols` | `CAP` matches "market **cap**italisation", `ETI` matches "compet**iti**on", `NB` matches "u**nb**eatable" |
| T2 | **Tickers that are real words or names**, even when matched whole-word | 170 NGX symbols checked: `TOTAL`, `CAP`, `TIP`, `MRS`, `ALEX`, `MEYER`, `IMG`, `NB`, `NCR`, `UPL`, `JULI` | "TOTAL" in an all-caps headline, "Mrs", "N.B.", and NCR/UPL are also *foreign* companies |
| T3 | **Generic company-name keys** after suffix stripping | "ACCESS HOLDINGS" → `ACCESS`, "UNION BANK" stays, but similar cases strip to a common word | "access to finance" tags Access Holdings |
| T4 | **Missing publish date → crawl time** | `pub_dt = … else fetched_at` | Old articles look brand new |
| T5 | **Tags never update**: upsert uses `$setOnInsert` | `build_ops` / `_fetch_sector_news` | A better tagger won't fix existing articles without a re-tag job |
| T6 | **Single `sector`** = the query's sector, not the article's | `"sector": sector` | A banking article found by the "OIL AND GAS" query is labelled oil and gas |
| T7 | **Two taggers**: the crawler's and `shared/news.py::fetch_and_store_symbol_news` (Telegram fallback) | separate `_tag` functions | Inconsistent tags depending on which path stored the article |
| T8 | **General web search, not news search.** Tavily was called without `topic="news"` | Dry run over the 40 newest stored articles: **all 40 had no publish date**, and many weren't news (Wikipedia, Utah.gov, AWS, a dictionary page, Instagram) | Undated, off-topic "news". **Fixed:** the crawler now uses `topic="news", days=7` (bot fallback: `days=30`). A test search returned dated, relevant NGX articles |

## 3. Tag schema v2

All new fields are **additive**. `symbols`, `sector`, and `importance_score` stay, so the Telegram bot keeps working unchanged.

| Field | Type | How it's derived | Used for |
| --- | --- | --- | --- |
| `symbols` | `[str]` | §4 matching rules (fixed) | Back-compat, the stock news panel |
| `symbol_mentions` | `[{symbol, in_title, count, matched_on: ticker\|name\|alias\|ngx_pattern}]` | §4 | **Relevance**: "About MTNN" (in title) vs "Mentions MTNN" (body only) |
| `primary_symbol` | `str \| null` | The symbol in the title with the most mentions; null if the title has no symbol or ≥ 3 symbols | Stock-page ranking, chart markers |
| `sectors` | `[str]` | Union of the tagged symbols' sectors, **plus** the query sector only if no symbol was found | Sector filter (fixes T6) |
| `subsectors` | `[str]` | From the tagged symbols in `industry_data` | Finer filter (e.g. "Banking" within Financial Services) |
| `topics` | `[str]` from a controlled list (§5) | Keyword rules, multi-label | **Topic filter**: the main new filter |
| `scope` | `company` · `multi_company` · `sector` · `market` · `macro` | Rules in §6 | "Company news only" vs "economy" |
| `regulators` | `[str]` | Whole-word match on a fixed list (§5.2) | "What did the CBN/SEC/NCC do?" |
| `content_type` | `news` · `press_release` · `disclosure` · `analysis` · `opinion` | URL path and domain cues (§6) | Hide opinion; find official disclosures |
| `geography` | `nigeria` · `africa` · `global` | Place-name rules, defaulting to `nigeria` | Hide global noise |
| `source_tier` | `1–3` | Existing `_source_tier` | Source filter / ranking |
| `published_at_estimated` | `bool` | `true` when Tavily gives no date (fixes T4) | "Found {date}" label; excluded from "last 24 h" |
| `tagger_version` | `int` | `2` | Re-tagging and audits |
| `tagged_at` | `datetime` | Time of tagging | Re-tagging and audits |

**Deferred deliberately:** `tone` (positive/negative). It's easy to misread as a buy/sell hint (ADR-006) and hard to get right with rules. Reconsider with an LLM classifier and evaluation in v1.1.

## 4. Symbol matching rules (fixes T1–T3)

Run against `title` and `content` separately (to fill `in_title`) with this precedence:

1. **NGX pattern (strongest).** `(NGX: MTNN)`, `NGX:MTNN`, `MTNN.LG` → tag, `matched_on: ngx_pattern`.
2. **Aliases.** A curated `news_aliases.json` (in `ngxPro/shared/`, versioned in git) maps each symbol to strong names, e.g. `GTCO: ["GTCO", "Guaranty Trust", "GTBank"]`, `MTNN: ["MTN Nigeria"]`, `ACCESSCORP: ["Access Holdings", "Access Bank"]`, `DANGCEM: ["Dangote Cement"]`. Matched **case-insensitively, whole words** (`\b…\b`).
3. **Company names** from `industry_data` after suffix stripping, case-insensitive and whole-word, **only if the stripped name has ≥ 2 words or is on no stop-list**. Single generic words like `ACCESS`, `UNION`, `FIDELITY`, `STERLING`, `UNITY` are dropped and must come via aliases (fixes T3).
4. **Tickers**: **case-sensitive** and whole-word (`\bMTNN\b`), so "Total" in a title-case headline never matches `TOTAL`.
5. **Ambiguous tickers** (`TOTAL`, `CAP`, `TIP`, `MRS`, `ALEX`, `MEYER`, `IMG`, `NB`, `NCR`, `UPL`, `JULI`, plus any ticker ≤ 2 letters) count **only with corroboration**: the same article also matches that symbol's alias/name, or the NGX pattern. The list lives in `news_aliases.json` under `"ambiguous"`.
6. **Group vs local entity:** "MTN Group" / "MTN" alone tags `MTNN` only when the text also contains Nigeria-specific context ("Nigeria", "NGX", "Lagos"). Same pattern for other subsidiaries of foreign groups (Airtel Africa, etc.), configured per alias.

All of this lives in **one module, `shared/news_tagging.py`**, which both the crawler and `shared/news.py` import (fixes T7). It's copied to function folders per the CLAUDE.md shared-file rules.

## 5. Controlled vocabularies

### 5.1 Topics (multi-label; whole-word, case-insensitive keyword rules)

| Topic id | Label in app | Example triggers (not exhaustive) |
| --- | --- | --- |
| `earnings` | Earnings & results | results, profit, revenue, PAT, PBT, half-year, H1, Q3, full-year, audited, unaudited, earnings |
| `dividend` | Dividends | dividend, interim dividend, final dividend, qualification date, payout |
| `corporate_action` | Corporate actions | rights issue, bonus issue, share split, buyback, public offer, private placement, share reconstruction |
| `capital_raising` | Capital raising & debt | recapitalisation, capital raise, bond, commercial paper, Eurobond, notes issuance, loan facility |
| `mergers_acquisitions` | Mergers & acquisitions | acquisition, acquire, merger, takeover, stake, divest, tender offer |
| `governance` | Leadership & governance | CEO, managing director, appoints, resigns, board, chairman, AGM, EGM |
| `listing_trading` | Listings & trading status | listing, delisting, IPO, suspension, trading halt, full suspension, migration to main board |
| `regulation` | Regulation & policy | regulator names (§5.2), circular, directive, guideline, licence, sanction |
| `monetary_policy` | Interest rates & CBN | MPC, monetary policy rate, MPR, CRR, rate hike, tightening, easing |
| `fx` | Naira & FX | naira, exchange rate, FX, devaluation, I&E window, dollar |
| `macro` | Economy | inflation, GDP, CPI, NBS, budget, recession, PMI |
| `energy` | Oil, gas & energy | crude, Brent, OPEC, refinery, petrol, PMS, Dangote refinery, gas price |
| `market_wrap` | Market wrap | All-Share, ASI, market capitalisation, gainers, losers, equities market closed |
| `legal` | Legal & investigations | court, lawsuit, tribunal, fine, probe, EFCC, judgment |
| `outlook` | Outlook & guidance | outlook, forecast, guidance, projects, target price, expects |

The rules live as data (`news_topics.json`), not code, so the vocabulary can grow without redeploying logic. Each topic needs **≥ 2 trigger hits, or 1 hit in the title**, which keeps generic words from over-tagging.

### 5.2 Regulators and institutions

`SEC`, `CBN`, `NGX` / `NGX RegCo`, `FMDQ`, `NAICOM`, `PenCom`, `NCC` (telecoms), `NERC` (power), `NUPRC`, `NMDPRA` (oil), `FIRS` (tax), `NDIC`, plus the full names (e.g. "Central Bank of Nigeria"). All whole-word, and `SEC` is case-sensitive.

## 6. Scope, content type, geography

- **scope** (first rule that applies): `company` if `primary_symbol` is set; `market` if the topic is `market_wrap` (wraps name many tickers but are market news); `multi_company` if ≥ 2 symbols; `macro` if the topic is in {`fx`, `macro`, `monetary_policy`} and there are no symbols; `company` if exactly one symbol (body-only); otherwise `sector`.
- **content_type**: `opinion` if the URL path contains `/opinion/`, `/columns/`, `/editorial/` or the title starts with "Opinion:". `analysis` for `/analysis/`, `/research/`, "Analysis:". `disclosure` for the domain `ngxgroup.com` (corporate disclosures) or titles like "Notice of …". `press_release` for `/press-release/`, `/media/`, prnewswire-type domains, or company domains. Otherwise `news`.
- **geography**: `global` if no Nigeria context and the text names non-African markets (US, China, Europe …); `africa` if it names other African countries without Nigeria; otherwise `nigeria`.

## 7. Rollout (Phase 1 crawler work)

1. Build `shared/news_tagging.py` + `news_aliases.json` + `news_topics.json`, with **local** unit tests (tests stay untracked, D-11). The tests must cover each false-positive case from §2 ("market cap", "total revenue", "competition", "Mrs Adeyemi", "N.B.") and each topic.
2. **Quality gate before switching on:** hand-label a sample of 100 recent articles. Targets: symbol precision ≥ 95% for `in_title` mentions and ≥ 90% overall; topic precision ≥ 85%. Record the result in the PR.
3. Switch the crawler and `shared/news.py` to the new tagger. The upsert changes from `$setOnInsert`-only to `$setOnInsert` for content + `$set` for tag fields, so a re-crawled URL gets current tags (fixes T5).
4. Run the **one-off re-tag script** over all stored articles (≤ 90 days; at most ~35k docs at the current fetch rate, likely far fewer after URL de-duplication), batched by `_id`. It's idempotent on `tagger_version`.
5. Add indexes for the filters (M0-safe, all on a small collection): `{topics: 1, published_at: -1}`, `{sectors: 1, published_at: -1}`, `{scope: 1, published_at: -1}`, `{regulators: 1, published_at: -1}`. The existing symbol and sector indexes stay. (A multikey index can't combine two array fields, hence the separate indexes.)
6. Deploy the crawler change on its own (R12 mitigations: the tagger is wrapped, a failure falls back to v1 tags, and it never blocks the crawl).

## 8. What the app does with the tags

- **News page `/app/news` (US-9.8)** with filters for stocks (multi, plus "My watchlist"), sector, subsector, **topic**, **scope**, regulator, content type (opinion hidden by default), source, date range, and "About only" (title mentions). Sort by newest or most important. A text search over headlines. Facet counts next to each filter. Everything is URL state.
- **Stock page news (US-9.1):** "About MTNN" (title mentions) first, then "Mentions MTNN", then "Sector news". Topic chips on each item.
- **Chart markers (US-9.2)** use only `in_title` mentions to avoid clutter.
- **AI (US-9.5)** receives only "About" headlines.
- **Admin data health (US-7.6):** tag coverage (share of articles with ≥ 1 topic and with symbols), reports from US-9.7, and the tagger version distribution.

## 8a. Build notes & first results (2026-10-26)

- **Tests (local, untracked):** 34 tagger tests (every false-positive case in §2, the topics, scope, content type, geography, and date parsing) plus 7 daily-bars tests, all passing. The daily-bars update pipelines were also checked against a throwaway local MongoDB (13 checks): close = latest snapshot (C5), running high/low, older snapshots never overwrite newer, non-trading-day crawls don't duplicate.
- **Real-data dry run** (`retag_news.py --limit 40`, read-only): symbol tags changed on 36 of 40 articles. The old tags attached `CAP`, `TOTAL`, `NCR`, `NGXGROUP` to most articles; v2 drops them, scopes market wraps as `market`, and marks headline subjects (e.g. *"PRESCO Tops on EPS…"* → about PRESCO).
- **Bot compatibility:** `fetch_and_store_symbol_news` still always tags the symbol the user asked about, but marks it `matched_on: "query"` when the text doesn't support it, so the web app can rank it below direct mentions.
- **Failure mode:** if the tagger can't load, the crawler stores articles untagged (with a warning) and never fails the crawl; `retag_news.py` repairs them.

## 9. Open points

| # | Question | Suggested default |
| --- | --- | --- |
| N-1 | Who curates `news_aliases.json` (aliases, ambiguous list)? | Team in git for now; an admin UI later if it changes often |
| N-2 | Add the NGX corporate-disclosures feed as a news source? It's the most authoritative company news | Yes, v1.1 (a crawler addition) |
| N-3 | LLM-assisted topic tagging (Gemini Flash, ~100 articles/day) if rule precision misses the target | Only if the §7 quality gate fails |
