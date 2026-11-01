# 11 — Email Design System

> Status: **Built 2026-10-28** · Code: [`backend/app/emails/`](../backend/app/emails/) · Delivery: Resend templates (D-04) · Extends [06 Design System](06-design-system.md) and [07 Brand](07-brand-guidelines.md)

Every email EquityLensNG sends is built from the same layout and a small set of blocks, stored as a **Resend template**, and recorded in a committed registry. This page is the standard for writing, styling and shipping them.

## 1. Principles

1. **One email, one job.** Each email has one heading and at most one button. If two actions matter, send two emails, or link the second from the app.
2. **Works without images or CSS.** Many inboxes block images and strip `<style>`. The layout uses inline styles and tables; the logo has alt text; the button is a coloured table cell, so it shows even when images are off.
3. **Plain text says the same thing.** Every email has a text part generated from the same blocks: the same words and the same link.
4. **Personal data only in variables, never in subjects.** Subjects are static ("Reset your EquityLensNG password"), so inbox previews on shared screens reveal nothing.
5. **Calm and specific** (06 §9). Say what happened, what to do, and when the link expires. No hype, no advice, no exclamation marks.
6. **Every email says why you got it.** The footer always carries a reason line and the standard disclaimer.

## 2. Anatomy

```text
┌ canvas #F6F7F9 ──────────────────────────────────────────┐
│  [logo lockup 152×32]                                     │
│ ┌ card #FFFFFF · 1px #E6E9EF · radius 12 · pad 36 ─────┐  │
│ │ Heading            22/30 semibold                    │  │
│ │ Paragraph(s)       16/24                             │  │
│ │ Details            sunken #EEF0F4 · label / value    │  │
│ │ [ Button ]         brand #00805F · white · radius 8  │  │
│ │ "Button not working?" + full link   13/20 muted      │  │
│ │ Callout            info or warning, 4px left bar     │  │
│ └──────────────────────────────────────────────────────┘  │
│  Reason line                         13/20 muted          │
│  Disclaimer                          12/18 muted          │
└───────────────────────────────────────────────────────────┘
```

Max width is **600 px**, centred. Below 620 px the card padding drops to 28/20 and the outer padding to 16/12. Security notices put the warning **Callout before the Button**, because the button is the remedy.

## 3. Tokens

The light theme is the base: it survives clients that force-invert colours (Gmail app, Outlook). A dark theme is layered on with `prefers-color-scheme` for clients that honour it (Apple Mail, iOS Mail, Outlook for Mac). Values come from `design/tokens.css`; subtle tints are pre-blended onto the surface because many clients ignore alpha.

| Role | Light (base) | Dark |
| --- | --- | --- |
| Canvas | `#F6F7F9` | `#0B0E13` |
| Card surface · border | `#FFFFFF` · `#E6E9EF` | `#12161D` · `#2C3240` |
| Text · secondary · muted | `#0E131C` · `#465063` · `#5E677A` | `#E9ECF2` · `#AEB4C2` · `#8A91A2` |
| Brand (button, links) · on-brand text | `#00805F` · `#FFFFFF` (4.9:1) | `#00C896` · `#04130E` (8.8:1) |
| Details well | `#EEF0F4` | `#080A0E` |
| Info callout bg · bar | `#E8EFFA` · `#1D63C9` | `#1D2938` · `#6CB2FF` |
| Warning callout bg · bar | `#FDF2DD` · `#8F5B00` | `#2D2921` · `#F5B841` |

**Type:** IBM Plex Sans where the client loads web fonts (Apple Mail, iOS), otherwise `-apple-system, Segoe UI, Roboto, Helvetica, Arial`. Sizes: heading 22/30 · body 16/24 · details 14/20 · callout 14/21 · fine print 13/20 and 12/18. Nothing smaller than 12 px.

**Logo:** the official `equitylens-logo-horizontal-{light,dark}@2x.png` (606×128, shown at 152×32, above the 120 px brand minimum), served by the app at `PUBLIC_BASE_URL/email-assets/`. The dark file swaps in under dark mode. With no public URL (local development) the layout shows the name in brand green instead; it never re-types the wordmark (07 §4).

## 4. Blocks

All are in [`layout.py`](../backend/app/emails/layout.py). Each renders inline-styled HTML and a plain-text equivalent.

| Block | Use | Rules |
| --- | --- | --- |
| `Heading(text)` | First line of the card: what this is about | One per email; ≤ 6 words; sentence case |
| `Paragraph(text, muted=False)` | Body copy | ≤ 3 sentences each; ≤ 2 paragraphs after the greeting |
| `Details(rows)` | Facts the reader needs to act: account, who invited, expiry | 2–3 rows; labels are nouns ("Link expires"), values are bold |
| `Button(label, url)` | The single action | Verb first ("Accept your invite"); always followed by the copy-paste link |
| `Callout(text, tone)` | `info`: reassurance ("Not expecting this? …") · `warning`: security ("Wasn't you? …") | One per email; one or two sentences |
| `Divider()` | Separate a secondary section | Rarely needed |

Dates are written `Wed 4 Nov 2026, 14:05 WAT` (`app/emails/_format.when`): never numeric, so readers can't confuse day and month.

## 5. Variables (Resend templates)

Templates live in Resend; the app sends `template: {id: <alias>, variables: {...}}`. Placeholders are written `{{{KEY}}}`.

- **Keys:** upper snake case (ASCII letters, digits, underscores), ≤ 50 characters. Never Resend's reserved names (`FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`, `RESEND_UNSUBSCRIBE_URL`, `contact`, `this`).
- **Limits** ([Resend](https://resend.com/docs/dashboard/templates/template-variables)): template name ≤ 50 characters including the `EquityLensNG · ` prefix; up to 50 variables per template; types are `string` or `number` only; a string value is at most 2,000 characters. `check()` enforces the count and `make()` refuses longer values rather than truncating them, because a cut-off link is worse than an error.
- **Defaults on the template:** each template stores `subject` and, when configured, a default `from` (`EMAIL_FROM`, unless it's a localhost address) and `reply_to` (`EMAIL_REPLY_TO`), so a test send from the Resend dashboard works as-is. Every send still passes its own `from` and `subject`, which take precedence over the template's. The send payload never carries `html` or `text`; Resend rejects that alongside a template.
- **Preview text:** Resend's API has no preheader field, so the layout carries it as a hidden first line (`TemplateSpec.preheader`).
- **Conventions:** `ACTION_URL` is always the button link. `NAME` is a first name, with fallback `there` ("Hi there,"). Dates are pre-formatted strings (`EXPIRES_AT`, `CHANGED_AT`).
- **Fallbacks** cover optional values (for example `INVITER` → "The EquityLensNG team"). A variable without a fallback must always be sent, and Resend rejects the email otherwise.
- **Safety:** Resend's triple braces insert values **unescaped**. `make()` strips `<`, `>` and `"` from every value, so a name typed into a form can't inject markup or break out of an attribute.
- **Checked automatically:** each spec's declared variables must equal the placeholders it uses (`TemplateSpec.check()`, run on every load and in tests).

## 6. Catalogue

| Alias | Name | Sent when | Variables |
| --- | --- | --- | --- |
| `el-invite` | Invite | Admin invites or resends, or approves an access request | `NAME`, `INVITER`, `INVITEE_EMAIL`, `EXPIRES_AT`, `ACTION_URL` |
| `el-password-reset` | Password reset | Reset requested for a confirmed email | `ACCOUNT_EMAIL`, `EXPIRES_AT`, `MINUTES`, `ACTION_URL` |
| `el-verify-email` | Confirm email | Email added or changed (or open sign-up) | `ACCOUNT_EMAIL`, `EXPIRES_AT`, `ACTION_URL` |
| `el-password-changed` | Password changed (security) | Password changed or reset | `NAME`, `ACCOUNT_EMAIL`, `CHANGED_AT`, `ACTION_URL` |
| `el-email-changed` | Email changed (security notice; to the old address) | A confirmed email is replaced | `OLD_EMAIL`, `NEW_EMAIL`, `CHANGED_AT`, `ACTION_URL` |
| `el-access-declined` | Access request declined | Admin declines with "send a polite email" | `NAME`, `REQUEST_EMAIL` |

Security notices are best-effort: if the email fails, the password change still stands, and the failure is logged.

## 7. Tracking: the registry

`backend/app/emails/registry.json` is **git-ignored** (owner decision), so it exists only on the machine that runs `sync`; keep a private backup. It records every template created in Resend: alias, Resend ID, version, content fingerprint, status, subject, trigger, variables, and when it was created, updated and published. Only `email-templates sync` writes it, after each template, so an interrupted sync still leaves an accurate record. `email-templates status` compares the registry and the specs with what's live in Resend, and flags drift: unpublished edits made in the dashboard, templates missing from Resend, or `el-*` templates that no spec owns.

**Aliases never change:** they're how the app sends. To retire an email, remove its module, then archive the template in Resend by hand.

## 8. Workflow

```bash
cd platformApp/backend
uv run python -m app.cli email-templates render            # previews → email-previews/index.html (git-ignored)
uv run python -m app.cli email-templates sync --dry-run    # what would change in Resend
uv run python -m app.cli email-templates sync              # create/update + publish; updates registry.json
uv run python -m app.cli email-templates status            # registry vs Resend
uv run python -m app.cli send-test-email --to you@example.com [--template el-invite]   # real send, "[Test]" subject
```

**Adding an email:** create `app/emails/<name>.py` with a `SPEC` (alias `el-<name>`) and a `build(...)`, add it to `all_specs()`, render and review it in light and dark, sync, then commit the module (`registry.json` stays local).

**Changing an email:** edit the module, render, then sync. The fingerprint changes, so sync updates and republishes it in Resend and bumps its version.

**When the app gets its public URL:** set `PUBLIC_BASE_URL` (or `EMAIL_LOGO_URL`) and sync again, so the templates pick up the hosted logo. Every template moves up a version. The same happens when `EMAIL_FROM` or `EMAIL_REPLY_TO` changes, since the defaults are part of the fingerprint, and the registry records the `from`/`reply_to` each version was published with.

**Edit in code, not the dashboard.** Resend's editor can change a template, but sync would overwrite it on the next change, and `status` reports any dashboard edit as drift. Publishing a template creates a new Resend version; sends always use the latest published one, and drafts never reach users.

## 9. Deliverability checklist

- [ ] Verify the sending domain in Resend: SPF, DKIM, and a DMARC policy (start with `p=none`, then tighten).
- [ ] `EMAIL_FROM` uses that domain (e.g. `EquityLensNG <no-reply@equitylens.ng>`). Until the domain is verified, Resend only delivers to the account owner's own address.
- [ ] Optional `EMAIL_REPLY_TO` pointing at a monitored inbox.
- [ ] Open and click tracking **off** for these transactional emails (privacy, and tracked links look suspicious in security emails).
- [ ] Each email stays under ~100 KB of HTML (Gmail clips at 102 KB); this is checked in the tests.
- [ ] Before a template change ships, `send-test-email` it to a Gmail, an Outlook.com and an Apple Mail inbox, in light and dark.
