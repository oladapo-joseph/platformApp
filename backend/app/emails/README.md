# Emails

Every email EquityLensNG sends: one module per type, built from the email design system ([docs/11](../../../docs/11-email-design-system.md)) and delivered as Resend templates.

| File | What it is |
| --- | --- |
| `invite.py`, `password_reset.py`, `verify_email.py`, `password_changed.py`, `email_changed.py`, `access_declined.py` | One email each: its `SPEC` (alias, subject, blocks, variables) and `build(...)` |
| `layout.py` | The design system: tokens, blocks (Heading, Paragraph, Details, Button, Callout, Divider), the layout |
| `__init__.py` | `TemplateSpec`, `Var`, `OutgoingEmail`, `make()` (cleans values), `all_specs()` |
| `sync.py` | Creates, updates and publishes templates in Resend; reads and writes the registry |
| `registry.json` | **Every template created in Resend** (alias, id, version, fingerprint, timestamps). Committed; written only by `sync` |
| `preview.py` | Renders all templates with sample values for review |

```bash
uv run python -m app.cli email-templates render     # → email-previews/index.html
uv run python -m app.cli email-templates sync       # needs RESEND_API_KEY
uv run python -m app.cli email-templates status
uv run python -m app.cli send-test-email --to you@example.com
```

Add a module, register it in `all_specs()`, render and review it, sync, and commit the module together with `registry.json`.
