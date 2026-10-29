# 12 — Security Review: Auth & Accounts (OWASP ASVS 5.0, Level 1)

> Status: **Reviewed and fixed 2026-10-28** · Scope: Phase 2 backend (`backend/app/`) · Standard: [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/master/5.0/en), Level 1 · Closes P2 acceptance criterion 8 ([05](05-implementation-plan.md))

## 1. Summary

ASVS 5.0 has **70 Level 1 requirements**. **19 don't apply**: no file uploads, no self-contained tokens (JWT), no OAuth, no XML, no WebSockets, no OS commands, and no encryption done by the app. The other **51** were checked against the code:

| Result | Count | Meaning |
| --- | --- | --- |
| ✅ Pass | 34 | Met by the code as it was |
| 🔧 Fixed in this review | 9 | Gaps found and fixed now (§2); each is covered by a local test |
| 🖥 Frontend (P3) | 4 | Browser-side rules the React app must follow (§6) |
| ☁ Deployment | 4 | Met by how the container is hosted (§4) |

No Level 1 requirement is open in the backend. Three further fixes go beyond Level 1, and §7 lists the Level 2 gaps for the owner to decide on.

**One contract change:** the two public invite routes moved from `GET /invites/{token}` and `POST /invites/{token}/accept` to `POST /invites/lookup` and `POST /invites/accept`, with the token in the JSON body (finding F3). They are P2 routes, still in review and with no client yet. Every frozen P1 route is unchanged, and `openapi-v1.json` has been regenerated.

## 2. Findings fixed

| # | ASVS | Finding | Fix |
| --- | --- | --- | --- |
| F1 | 3.3.1 | Session and CSRF cookies had `Secure` but no `__Host-` prefix, so a sibling subdomain could plant a cookie for the app | Outside `ENV=local` they're `__Host-el_session` and `__Host-el_csrf` (Secure, `Path=/`, no `Domain`). Locally they keep their plain names, because http can't use the prefix |
| F2 | 7.2.4 | Signing in issued a new session but left the browser's previous session alive in the database | Sign-in, password reset and invite acceptance now delete the session the browser arrived with (`start_session_cookie`) |
| F3 | 14.2.1 | Invite, reset and confirm-email tokens travelled in URLs (`/invite/<token>`, `?token=`), where access logs, proxies and Application Insights record them | Email links carry the token in the **fragment** (`/invite#token=…`, `/reset#token=…`, `/verify#token=…`), which browsers never send to a server. The invite API takes the token in the body |
| F4 | 3.5.3 | `GET /invites/{token}` changed state (it marks an invite expired) through a "safe" method | It's now `POST /invites/lookup`, behind CSRF like every other POST |
| F5 | 6.3.1 | Brute-force limits were per account+IP only, so one IP could try a few passwords on each of thousands of accounts (credential stuffing) | Added a per-IP cap: 100 failed sign-ins in 15 minutes, across all accounts, pauses that IP (§3) |
| F6 | 6.3.1 | `PATCH /auth/me` checked the current password with no throttle, so a borrowed session could guess it at full speed | It's throttled like sign-in: 5 wrong guesses lock it for 1, 2, 4… up to 15 minutes |
| F7 | 3.2.1 | API JSON had `nosniff` but no CSP, so a browser opening an API URL directly could still frame or render it | API responses send `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`. Swagger UI and the SPA get `frame-ancestors 'none'` |
| F8 | 6.1.1 | Anti-automation controls weren't documented, including how they avoid malicious lockout | §3 |
| F9 | 15.1.1, 15.2.1 | No dependency update policy or vulnerability check | §5 sets timeframes. CI runs `pip-audit` on the lockfile (it found no known vulnerabilities on 2026-10-28), and Dependabot opens weekly update PRs |

Beyond Level 1, also fixed:

- **Forgot-password enumeration (6.3.8, L3).** The reset email was sent before responding. Known addresses were therefore slower than unknown ones, and a mail outage gave a 500 only for real accounts. The email now goes after the response (`BackgroundTasks`), so every address gets the same 202 at the same speed.
- **Clickjacking (3.4.6, L2).** `X-Frame-Options: DENY` and `frame-ancestors 'none'` are set on every response.
- **Weak session secret.** Outside local, a `SESSION_SECRET` under 32 characters is refused at boot.

## 3. Anti-automation controls (ASVS 6.1.1)

All limits are in-process ([`app/core/ratelimit.py`](../backend/app/core/ratelimit.py)) and answer `429` with `Retry-After`.

| Control | Keyed on | Limit | Response |
| --- | --- | --- | --- |
| Sign-in lockout | account + IP | 5 failures within 60 s | Locked for 1 min, then 2, 4, 8, up to 15 min on repeats within the hour. A correct password is refused during the lock |
| Sign-in IP cap | IP | 100 failures in 15 min, any accounts | All sign-ins from that IP pause until the window ends |
| Current-password check | user | 5 wrong within 60 s (`PATCH /auth/me`) | Same lockout curve as sign-in |
| Forgot password | IP + email | 5 per minute | 429 (the response never says whether the email exists) |
| Request an invite | IP | 3 per hour | 429 |
| Self-serve sign-up (off) | IP | 3 per hour | 429 |
| Invite lookup | IP | 30 per minute | 429 |
| Detection | account | ≥ 10 failed sign-ins in 15 min | The audit event is flagged `suspicious` (admin viewer in P4) |

**How these avoid malicious lockout:**

- **Sign-in lockout:** it's keyed on the account *and* the IP, so failures from an attacker's address never lock out the real user signing in from theirs.
- **IP cap:** it can only pause the IP that's failing. It's set high (100), because Nigerian mobile networks put many subscribers behind one carrier-grade NAT address, and a lower cap would pause innocent neighbours.
- **Current-password throttle:** it needs a signed-in session to trigger.
- **Passwords:** none is guessable cheaply. The minimum is 10 characters, and 9,973 common passwords are rejected.

**These limits rest on two conditions** (both are in §4):

- **The app must see the real client IP.** Behind the Container Apps ingress, uvicorn must run with `--proxy-headers`. Otherwise every request appears to come from the ingress, and each per-IP limit becomes a single limit shared by everyone.
- **Counters live in each replica's memory.** With more than one replica, each would keep its own counts. Stay on one replica until the limiter moves to a shared store (Mongo or Redis).

## 4. Deployment requirements (☁)

These belong to the Azure Container Apps setup (D-03). They're tracked in `PENDING-ACTIONS.md`.

| ASVS | Requirement | How |
| --- | --- | --- |
| 12.1.1 | TLS 1.2 or 1.3 only | ACA ingress minimum TLS 1.2 (the default) |
| 12.2.1 | HTTPS only, no plain-http fallback | Ingress `allowInsecure: false`; the app sends HSTS (2 years, `includeSubDomains`) outside local. Atlas (`mongodb+srv`) and Resend are TLS already |
| 12.2.2 | Publicly trusted certificate | ACA managed certificate on the custom domain |
| 13.4.1 | No `.git` or other source-control metadata in the image | `.dockerignore` excludes `.git`, `tests/`, `.env`, `email-previews/` |
| (§3) | Real client IP | `uvicorn app.main:create_app --factory --proxy-headers --forwarded-allow-ips="*"`. `*` is safe only because the container is reachable solely through the ingress, so don't expose it any other way |
| (§3) | One replica | `minReplicas: 1`, `maxReplicas: 1` until the limiter is shared |
| — | Secrets | `ENV=production`, `SESSION_SECRET` (≥ 32 chars, `openssl rand -hex 32`), `MONGODB_URI`, `RESEND_API_KEY` from Key Vault (13.3.1 is L2, but planned anyway) |

## 5. Dependency policy (ASVS 15.1.1, 15.2.1)

- **Lockfile always.** `uv.lock` is committed, and CI installs with `uv sync --locked`.
- **Known vulnerabilities block merges.** CI runs `pip-audit` on the locked runtime dependencies. A finding that can't be fixed yet needs a written exception (in the PR, with a review date) and an `--ignore-vuln` entry.
- **Remediation timeframes**, from disclosure (or the advisory reaching us):

  | Severity (CVSS) | Fix or mitigate within |
  | --- | --- |
  | Critical (9.0+) | 3 days |
  | High (7.0–8.9) | 14 days |
  | Medium (4.0–6.9) | 30 days |
  | Low | Next routine update |

- **Routine updates.** Dependabot opens weekly PRs (minor and patch versions grouped) for backend packages and GitHub Actions. Merge them within 2 weeks, after the local test run. Python stays on a supported 3.12 patch release.

## 6. Frontend requirements (🖥, Phase 3)

The React app must:

1. **6.2.6:** use `type="password"` on every password field (a show/hide toggle is fine).
2. **6.2.7:** allow paste and password managers: `autocomplete="current-password"` on sign-in and `"new-password"` on set/change, with no paste blocking.
3. **3.2.2:** render user-supplied text as text (React's default). No `dangerouslySetInnerHTML` unless the content is sanitised.
4. **14.3.1:** on sign-out or a `401 session-expired`, clear cached account data: the query cache, plus any per-user data in storage.
5. **Token links:** read `#token=` from `location.hash`, then remove it at once with `history.replaceState`, so the token isn't left in history or a screenshot.
6. **CSRF:** call `GET /auth/csrf` before the first POST and send `X-CSRF-Token` on every POST, PUT, PATCH and DELETE.
7. **Good practice (L2 3.4.3):** a real CSP for the SPA: `script-src 'self'`, no inline scripts, `connect-src 'self'`. ✅ **Done in P3e (2026-10-28):** non-API responses send `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Inline *styles* stay allowed because Radix's scroll lock injects a `<style>` element; scripts never are. Fonts are self-hosted, so nothing loads from a third party. The e2e suite fails on any CSP violation.

**Phase 4:** the watchlist and AI endpoints must scope every query to the signed-in user's id (8.2.2, no IDOR). That needs a test per endpoint that tries another user's id.

## 7. Level 2 gaps (owner decisions)

None is required for Level 1. Each is a sensible step before open sign-up.

| ASVS (L2) | Gap | Recommendation |
| --- | --- | --- |
| 7.5.1 | Deleting an account only asks you to type your email (changing the password or email already asks for the current password) | Also ask for the password. This adds a required field to `DELETE /auth/me` |
| 6.3.3 | No multi-factor sign-in | TOTP for admins first, then optional for everyone |
| 7.3.1 · 7.3.2 | "Keep me signed in" slides forever (30 days from last use) | Add an absolute cap, e.g. 90 days, after which you sign in again |
| 7.5.2 · 7.4.5 | Users can't see their sessions, only "sign out everywhere"; admins can end a user's sessions only by deactivating them | A sessions list on the account page, and an admin "sign out this user" action |
| 13.3.1 | Secrets come from environment variables | Key Vault references in Container Apps (already planned with D-03) |

## 8. Accepted risks and notes

- **CSRF token isn't tied to the session.** That's acceptable here: the token is HMAC-signed, its cookie is `__Host-`, and with no CORS a cross-site page can't send the header.
- **Timing differences that remain** are small and reveal little:
  - Legacy PBKDF2 and argon2id take different times, but that only reveals which hash scheme an account has.
  - On self-serve sign-up (off) an existing email returns sooner. If sign-up is turned on, hash first.
- **Swagger UI** is public at `/api/v1/docs` in every environment. It shows the schema, not data. Turn it off in production if you'd rather not publish the API surface.
- **Rate-limit counters reset when the app restarts.**
- **Request-an-invite limit.** 3 per IP per hour may be tight behind carrier NAT. Watch the 429 rate after launch.
- **Tests:** each fix has a local test (`tests/test_auth.py`, "ASVS L1 review" section). Per D-11, tests aren't committed.
