# EquityLensNG

![EquityLens NG](brand/png/equitylens-logo-horizontal-light@2x.png#gh-light-mode-only)
![EquityLens NG](brand/png/equitylens-logo-horizontal-dark@2x.png#gh-dark-mode-only)

**See the Nigerian market clearly.** EquityLensNG is a market-insight platform for equities listed on the Nigerian Exchange (NGX): daily market overviews, sector performance, technical charts and indicators, rule-based trading signals, peer comparison, and AI signal interpretation.

> **Status (Oct 2026): Phase 2, accounts.** We're rebuilding the production Streamlit dashboard as a **FastAPI backend + React frontend** with invite-only access at launch. Phase 0 (planning, design system, brand, user stories) is done. The backend's market, stock and news APIs are frozen as v1, and invite-only accounts (invites, access requests, sessions, password reset, audit events) are built and **in review**; the frontend starts in Phase 3.

## Where things are

| Path | What |
| --- | --- |
| [`docs/`](docs/) | Project documentation (start here) |
| [`design/`](design/) | Design tokens (`tokens.css`), live visual reference (`preview.html`), palette/type decision record (`options.html`) |
| [`brand/`](brand/) | Logo v2: SVG + PNG assets and generator |
| [`streamlitApp/`](streamlitApp/) | Frozen copy of the current Streamlit app ([its README](streamlitApp/README.md)) |
| `backend/` | New FastAPI service: market, stock and news APIs (P1) and invite-only accounts (P2). Setup in [doc 08, section 3](docs/08-development-setup.md) |
| `frontend/` | New React app (from Phase 3) |
| root `app.py`, `views/`, … | The live Streamlit app, kept in place until cutover (Phase 5) |
| [`CHANGELOG.md`](CHANGELOG.md) | Change history |

## Documentation

1. [Current-state assessment](docs/01-current-state-assessment.md): what the Streamlit app does and what must change
2. [Project overview & scope](docs/02-project-scope.md): vision, goals, users, journeys, scope
3. [Target architecture](docs/03-architecture.md): FastAPI + React, API, data, auth, AI, deployment
4. [Technical decisions](docs/04-technical-decisions.md): ADR log and decisions log
5. [Implementation plan](docs/05-implementation-plan.md): phases, acceptance criteria, risks, dependencies
6. [Design system](docs/06-design-system.md): tokens, typography, components, patterns, accessibility
7. [Brand guidelines](docs/07-brand-guidelines.md): name, logo review, asset usage
8. [Development setup](docs/08-development-setup.md): running the legacy app today; backend/frontend workflow
9. [User stories](docs/09-user-stories.md): 65 stories (incl. news and audit log) with acceptance criteria and UX notes, story map, and release slices
10. [News tagging](docs/10-news-tagging.md): crawler tag schema v2 (topics, scope, regulators, relevance) and the News page filters
11. [Email design system](docs/11-email-design-system.md): layout, tokens, blocks and copy rules for every email; Resend templates and their registry
12. [Security review](docs/12-security-review.md): OWASP ASVS 5.0 Level 1 review of auth and accounts; anti-automation controls, deployment and frontend security requirements, dependency policy

## Target stack

FastAPI · PyMongo · pandas · Gemini via `google-genai` (interim; provider-agnostic, Claude-ready) · MongoDB Atlas (shared with the ngxPro crawler) | React 19 · Vite · TypeScript · TanStack Query · Tailwind CSS v4 · Radix UI · TradingView Lightweight Charts · Apache ECharts | Docker · Azure Container Apps (planned) · Resend (email) · GitHub Actions

## Run the current app

```bash
cd streamlitApp && pip install -r requirements.txt && streamlit run app.py
```

Details are in [docs/08-development-setup.md](docs/08-development-setup.md).

---

*EquityLensNG provides market data and educational analysis, not investment advice.* · Licence: see [LICENSE](LICENSE).
