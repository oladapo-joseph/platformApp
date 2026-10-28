"""
Operator commands. The first admin is created here, never from environment
variables or defaults (P2 acceptance #7).

    uv run python -m app.cli create-admin --email you@example.com --name "Your Name"
    uv run python -m app.cli promote --email someone@example.com
    uv run python -m app.cli email-templates render            # previews in email-previews/
    uv run python -m app.cli email-templates status            # registry vs Resend
    uv run python -m app.cli email-templates sync [--dry-run]  # create/update + publish in Resend
    uv run python -m app.cli send-test-email --to you@example.com [--template el-invite]
"""

import argparse
import getpass
import sys

from app.core.config import get_settings
from app.core.errors import ProblemError
from app.db import mongo
from app.repositories import ensure_indexes, get_repos, init_repos
from app.repositories.users_repo import EmailTaken
from app.services import audit_service as audit
from app.services.audit_service import RequestMeta
from app.services.auth_service import check_password, normalize_email, now, password_fields

CLI_META = RequestMeta(ip=None, user_agent="app.cli", request_id=None)


def _password(email: str, name: str) -> str:
    while True:
        first = getpass.getpass("Password (≥ 10 characters, not a common one): ")
        try:
            check_password(first, email, name)
        except ProblemError as exc:
            print(f"  {exc.detail}")
            continue
        if getpass.getpass("Repeat it: ") == first:
            return first
        print("  The two don't match; try again.")


def create_admin(email: str, name: str) -> int:
    repos = get_repos()
    if repos.users.by_email(email) or repos.users.by_identifier(email):
        print(f"{email} already has an account. Use `promote` to make it an admin.")
        return 1
    password = _password(email, name)
    at = now()
    try:
        user_id = repos.users.create(
            {
                "email": email,
                "email_verified_at": at,
                "username": email,
                "display_name": name,
                "role": "admin",
                "is_active": True,
                "created_at": at,
                "source": "cli",
                **password_fields(password, get_settings()),
            }
        )
    except EmailTaken:
        print(f"{email} already has an account.")
        return 1
    audit.record("admin.admin_created", audit.SYSTEM_ACTOR, CLI_META, target=audit.target("user", user_id, email))
    print(f"Admin {email} created. Sign in at {get_settings().public_base_url}/login")
    return 0


def promote(email: str) -> int:
    repos = get_repos()
    user = repos.users.by_email(email) or repos.users.by_identifier(email)
    if user is None:
        print(f"No account for {email}.")
        return 1
    repos.users.update(user["_id"], {"role": "admin", "is_active": True})
    audit.record(
        "admin.role_changed",
        audit.SYSTEM_ACTOR,
        CLI_META,
        target=audit.target("user", user["_id"], email),
        changes={"before": user.get("role", "user"), "after": "admin", "via": "cli"},
    )
    print(f"{email} is now an admin.")
    return 0


def email_command(args: argparse.Namespace) -> int:
    """email-templates render|status|sync and send-test-email: no database needed."""
    import dataclasses
    from pathlib import Path

    from app.emails import all_specs
    from app.emails.preview import render_all, sample
    from app.emails.sync import ResendError, ResendTemplates, status, sync, template_defaults
    from app.services.email import build_sender

    settings = get_settings()
    logo = settings.logo_url
    if args.command == "email-templates" and args.action == "render":
        out = Path(args.out).resolve()
        render_all(out, logo)
        print(f"Wrote {len(all_specs())} previews to {out} (open index.html)")
        return 0
    if args.command == "send-test-email":
        chosen = [s for s in all_specs() if args.template in ("all", s.alias)]
        if not chosen:
            print(f"Unknown template {args.template}. Known: {', '.join(s.alias for s in all_specs())}")
            return 1
        mailer = build_sender(settings)
        for spec in chosen:
            email = dataclasses.replace(sample(spec.alias), to=args.to)
            email = dataclasses.replace(email, spec=dataclasses.replace(spec, subject=f"[Test] {spec.subject}"))
            mailer.send(email)
            print(f"Sent {spec.alias} to {args.to} via {settings.email_provider}")
        return 0

    if settings.resend_api_key is None:
        print("Set RESEND_API_KEY in backend/.env first.")
        return 1
    if logo is None:
        print(
            "Note: no public logo URL (PUBLIC_BASE_URL isn't https and EMAIL_LOGO_URL is unset), so templates "
            "show the name as text instead of the logo. Sync again once the app has a public URL."
        )
    defaults = template_defaults(settings.email_from, settings.email_reply_to)
    if "from" not in defaults:
        print("Note: EMAIL_FROM is a localhost address, so templates get no default sender (sends still set it).")
    api = ResendTemplates(settings.resend_api_key.get_secret_value())
    try:
        if args.action == "status":
            for state, aliases in status(api, logo, defaults).items():
                print(f"{state:>30}: {', '.join(aliases)}")
            return 0
        changes = sync(api, logo, dry_run=args.dry_run, defaults=defaults)
    except ResendError as exc:
        print(f"Resend error: {exc}")
        return 1
    for c in changes:
        print(f"{c.action:>10}  {c.alias}  v{c.version}")
    print("Dry run: nothing changed." if args.dry_run else "Registry updated: app/emails/registry.json")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    ca = sub.add_parser("create-admin", help="create the first (or another) admin account")
    ca.add_argument("--email", required=True)
    ca.add_argument("--name", required=True)
    pr = sub.add_parser("promote", help="make an existing account an admin")
    pr.add_argument("--email", required=True)
    et = sub.add_parser("email-templates", help="preview, check or sync the Resend email templates")
    et.add_argument("action", choices=["render", "status", "sync"])
    et.add_argument("--dry-run", action="store_true", help="sync: show what would change")
    et.add_argument("--out", default="email-previews", help="render: output folder")
    te = sub.add_parser("send-test-email", help="send sample emails (subject prefixed [Test])")
    te.add_argument("--to", required=True)
    te.add_argument("--template", default="all", help="alias, e.g. el-invite, or 'all'")
    args = parser.parse_args(argv)

    if args.command in ("email-templates", "send-test-email"):
        return email_command(args)

    settings = get_settings()
    mongo.connect(settings)
    try:
        ensure_indexes(init_repos(mongo.get_db(), settings))
        email = normalize_email(args.email)
        if args.command == "create-admin":
            return create_admin(email, " ".join(args.name.split())[:60])
        return promote(email)
    except ProblemError as exc:
        print(exc.detail)
        return 1
    finally:
        mongo.close()


if __name__ == "__main__":
    sys.exit(main())
