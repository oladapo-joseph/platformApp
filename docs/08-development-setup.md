# 08 — Development Setup

> Sections marked **(planned)** describe the target workflow. The backend landed in Phase 1; the frontend folder is created in Phase 3, and this guide gets updated as it lands.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Python | 3.12+ (3.14 works locally today) | Backend, legacy app |
| [uv](https://docs.astral.sh/uv/) | 0.8+ | Backend dependency management (installs Python 3.12 for the backend) |
| Node.js | 22 LTS or newer (24 tested) | Frontend **(planned)** |
| Git | any recent | Repo `oladapo-joseph/platformApp` |
| Access | MongoDB Atlas URI, Anthropic API key (a Gemini key only if you switch provider) | Data and AI |

## Repository map

```text
platformApp/
├── streamlitApp/   legacy app snapshot (runs today)
├── backend/        FastAPI (P1: market, stock, news read APIs)
├── frontend/       React (planned, P3)
├── design/         tokens.css, preview.html, options.html
├── brand/          logo SVGs, PNGs, generate_logo.py
└── docs/           01–08 project docs
```

## 1. Run the legacy Streamlit app (today)

```bash
cd platformApp/streamlitApp
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt   # runtime deps + pytest (use requirements.txt for runtime only)
streamlit run app.py            # http://localhost:8501
```

`streamlitApp/.env` was copied from the original app (it's git-ignored). Required keys: `MONGODB_URI`, `MONGODB_DB`, `COLLECTION_NAME`, `ANTHROPIC_API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`. `DB_PATH` and `NGX_ENDPOINT` are unused. `GEMINI_API_KEY` is unused by the current code but kept, because Gemini is the interim AI provider.

Tests: `python -m pytest -q --ignore=tests/test_recommender.py`. As of 2026-10-25 that's 75 passed and 1 failed (the failure is an outdated RSI warm-up test). `test_recommender.py` needs rewriting for the Anthropic SDK. See [assessment Q2](01-current-state-assessment.md).

> The original files at the `platformApp/` root are identical and still run (`streamlit run app.py` from `platformApp/`). Keep them until cutover in case production deploys from that path.

## 2. Preview the design system (today)

Open `design/preview.html` in a browser. It loads `tokens.css` and the `brand/` SVGs by relative path, so no server is needed. Use the Auto/Dark/Light toggle; the live contrast table recalculates for the active theme.

## 3. Backend (P1 market, stock and news APIs · P2 accounts)

```bash
cd platformApp/backend
uv sync                                          # .venv from pyproject.toml + uv.lock (Python 3.12)
cp .env.example .env                             # fill in MONGODB_URI and MONGODB_DB
uv run uvicorn app.main:create_app --factory --reload   # http://localhost:8000 · docs at /api/v1/docs
uv run ruff check app && uv run ruff format --check app && uv run mypy   # what CI runs
```

**Local tests (untracked, D-11).** `backend/tests/` is git-ignored; keep your own copy (ADR-011).

```bash
uv run pytest                                    # domain + API against an in-memory mongod (~25 s; first run downloads mongod)
uv run --with pytz python -m tests.parity_check  # P1 parity vs the Streamlit loader on production data (read-only)
uv run python -m tests.perf_check                # endpoint timings against production (read-only)
```

The API tests use `pymongo-inmemory`, which downloads a `mongod` binary into `%TEMP%\mim` on first use (a short path, because Windows' path limit breaks the extraction otherwise).

| Variable | Default | Notes |
| --- | --- | --- |
| `ENV` | `local` | `local` · `staging` · `production`. Outside `local`: secure cookies and HSTS, and `SESSION_SECRET` plus a real email provider are required |
| `MONGODB_URI` | — | Required. Use a **read-only** user for the crawler collections in staging/prod |
| `MONGODB_DB` | `ngx` | |
| `TRADES_COLLECTION` | `tradesData` | Replaces the legacy `COLLECTION_NAME` |
| `BARS_SOURCE` | `auto` | `auto`: `daily_bars` from its first trade date, `tradesData` before it. `trades`: always aggregate `tradesData` (parity checks). `daily_bars`: only `daily_bars` (after the backfill) |
| `SIGNUP_MODE` | `invite` | `invite` (launch) or `open` (ADR-013) |
| `SESSION_SECRET` | random per process on `local` | Signs CSRF tokens. **Required outside `local`** |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Email links point here (the React app) |
| `INVITE_TTL_DAYS` · `SESSION_DAYS` | `7` · `30` | Invite lifetime; "Keep me signed in" lifetime |
| `LEGACY_PASSWORD_SYNC` | `true` | Keeps the Streamlit app's PBKDF2 fields in step until cutover (D-17) |
| `EMAIL_PROVIDER` | `console` | `console` (local: emails are logged with their links) · `resend` (D-04) |
| `RESEND_API_KEY` · `EMAIL_FROM` | — | Required with `resend`; the sending domain needs SPF, DKIM and DMARC |
| `EMAIL_REPLY_TO` · `EMAIL_LOGO_URL` | unset | Optional reply inbox; logo for templates (default: `PUBLIC_BASE_URL/email-assets/…` when that URL is https) |
| `FRONTEND_DIST` | `../frontend/dist` | Built SPA served at `/`; skipped when missing |
| `LOG_LEVEL` | `INFO` | JSON logs with request IDs |

Added in Phase 4:

| Variable | Example | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | `anthropic` | `anthropic` (default), `gemini`, or `off` to hide AI readings (ADR-012) |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | A separate key for the platform (cost attribution). Required outside local unless `AI_PROVIDER` is `off` or `gemini`; locally, without it AI is simply off |
| `GEMINI_API_KEY` | | Only when `AI_PROVIDER=gemini`; install the extra with `uv sync --extra gemini` |
| `AI_MODEL` | `claude-opus-5-5` | Unset: `claude-opus-5-5` (anthropic) or `gemini-2.5-flash` (gemini). A cheaper Claude (`claude-sonnet-5-5`, `claude-haiku-5-5`) is a config change |
| `AI_DAILY_QUOTA` | `5` | New readings per user per WAT day (D-05); cached readings are free |
| `AI_ADMIN_DAILY_QUOTA` | `25` | The same for admins (US-4.4) |
| `AI_TIMEOUT_SECONDS` | `30` | Per provider call; the SDK retries once on a timeout, 429 or 5xx |

Tests never call a real AI API: the test client sets `AI_PROVIDER=off` and AI tests install a fake provider; the e2e server (`e2e/serve.py`) answers with a stand-in.

**Accounts.** Create the first admin (it prompts for a password; there are no default credentials):

```bash
uv run python -m app.cli create-admin --email you@example.com --name "Your Name"
uv run python -m app.cli promote --email someone@example.com     # make an existing account an admin
```

To try it in the API docs: `GET /api/v1/auth/csrf`, send its token as the `X-CSRF-Token` header, then `POST /api/v1/auth/login`. With `EMAIL_PROVIDER=console`, invite and reset emails, links included, appear in the server log.

**Emails** are Resend templates kept in `backend/app/emails/` and tracked in its `registry.json` ([doc 11](11-email-design-system.md)):

```bash
uv run python -m app.cli email-templates render           # previews → email-previews/index.html
uv run python -m app.cli email-templates sync --dry-run   # then without --dry-run to create/publish in Resend
uv run python -m app.cli send-test-email --to you@example.com
```

> **Pointing the backend at the production database** creates the platform's own collections (`sessions`, `email_tokens`, `invites`, `access_requests`, `audit_log`) and a partial unique index on `app_users.email` at startup. Both are additive and the Streamlit app is unaffected (D-17), but use a separate `MONGODB_DB` for experiments.

## 4. Frontend (Phase 3)

Needs Node ≥ 22. TypeScript is pinned to 5.9 (ADR-002).

```bash
cd platformApp/frontend
npm ci
npm run dev              # http://localhost:5173; Vite proxies /api to :8000 (set API_URL to change it)
npm run gen:api          # regenerate src/api/schema.d.ts from backend/openapi-v1.json
npm run lint && npm run format:check && npm run typecheck
npm run build            # dist/, which FastAPI serves at / (FRONTEND_DIST)
npm run test             # vitest (tests are local only, D-11)
```

**End-to-end checks (local only, D-11).** `frontend/e2e/` is git-ignored. `npx playwright install chromium webkit` once, then `npx playwright test -c e2e` builds the app, starts `e2e/serve.py` (FastAPI on :8000 over an in-memory MongoDB with synthetic market data; emails land in `e2e/.outbox.jsonl`) and runs the journeys on Chromium and WebKit at phone and desktop sizes; the HTML report is in `e2e/.report`. If something already listens on :8000 (your own `serve.py`), run the suite beside it with `E2E_PORT=8001 npx playwright test -c e2e`. With that server running, `node e2e/lighthouse.mjs [--cpu=N]` runs Lighthouse (mobile) on four pages; pass `--cpu` ≈ the printed host benchmark ÷ 375 on a slow machine.

**Landing images.** `public/landing/*.jpg` (screenshots in each theme) and `public/og-image.png` (the link preview) are captured from a running app: `EL_EMAIL=… EL_PASSWORD=… node scripts/landing-shots.mjs [base-url]` (default `http://localhost:4173`, i.e. `npm run preview` with the backend on :8000). Recapture them from production data before launch.

`src/styles/tokens.css` and `public/brand/` are copied from `design/` and `brand/` by `npm run sync:tokens` (run automatically before `dev` and `build`). They're git-ignored: edit the originals.

**Colours come only from tokens.** Use the Tailwind names mapped in `src/styles/globals.css` (`bg-surface`, `text-fg-2`, `text-gain`, `border-line`, …). Tailwind's default palette is switched off and ESLint rejects hex literals.

**Trying the app without touching production data:** point the backend at a separate database (`MONGODB_DB=equitylens_dev`) or a local mongod, not the shared Atlas `ngx` database, because signing in writes sessions and audit events.

## 5. Full stack in one container (planned)

```bash
docker build -t equitylens .
docker run --env-file backend/.env -p 8000:8000 equitylens   # SPA + API on http://localhost:8000
```

## 6. Conventions

- **Branches:** `main` is deployable. Use feature branches `feat/…`, `fix/…`, `docs/…`; PRs need green CI.
- **Commits:** Conventional Commits (`feat(api): add /market/status`).
- **Changelog:** every PR adds a line under `## [Unreleased]` in `CHANGELOG.md`.
- **Tests are never committed** (D-11). `.gitignore` excludes `tests/`, `test*`, `*.test.*`, `*.spec.*`, `__tests__/` and `e2e/`. Run `uv run pytest`, `npm run test` and `npm run e2e` locally before every merge, and state the result in the PR. Keep a private backup of your test folders (ADR-011).
- **Project rules** (see the repo `CLAUDE.md`): AI provider SDKs are called directly, never through LangChain (ADR-012); EMA uses `ewm(span, adjust=False)`; RSI uses `ewm(com=window-1, adjust=False)`; MongoDB pipelines group before they sort; all times are WAT.
- **Secrets:** never commit `.env`. Rotate the keys in the current `.env` before the repo is opened to more collaborators.
