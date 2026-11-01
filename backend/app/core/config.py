"""Settings from the environment (or backend/.env), validated once at boot."""

import logging
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    env: Literal["local", "staging", "production"] = "local"
    log_level: str = "INFO"

    mongodb_uri: SecretStr
    mongodb_db: str = "ngx"
    trades_collection: str = "tradesData"

    # auto: daily_bars from its first trade date on, tradesData before it (ADR-007).
    # trades: always aggregate tradesData (parity checks against the Streamlit app).
    bars_source: Literal["auto", "daily_bars", "trades"] = "auto"

    # ── accounts (ADR-004, ADR-005, ADR-013) ─────────────────────────────────
    signup_mode: Literal["invite", "open"] = "invite"
    # Signs CSRF tokens. Required outside local; a random per-process value otherwise.
    session_secret: SecretStr | None = None
    session_days: int = 30  # "Keep me signed in"
    session_hours_short: int = 12  # browser-session cookie; server-side expiry
    invite_ttl_days: int = 7
    reset_ttl_minutes: int = 30
    verify_ttl_hours: int = 48
    public_base_url: str = "http://localhost:5173"  # email links point at the SPA
    # Until cutover the Streamlit app reads app_users too: keep its PBKDF2 fields in step
    # whenever a password is set here, and give new users username = email (D-17).
    legacy_password_sync: bool = True

    email_provider: Literal["console", "resend"] = "console"
    resend_api_key: SecretStr | None = None
    email_from: str = "EquityLensNG <no-reply@localhost>"
    email_reply_to: str | None = None  # where replies go (e.g. a support inbox); unset = no Reply-To
    # Logo in emails. Default: served by this app at PUBLIC_BASE_URL/email-assets/ when that URL is public
    # (https); locally the name is shown as text, since mail clients can't fetch from localhost.
    email_logo_url: str | None = None

    # ── AI signal interpretation (ADR-006, ADR-012, D-05, D-09) ────────────────
    # anthropic (Claude, the default) or gemini (optional: `uv sync --extra gemini`); off hides the feature.
    ai_provider: Literal["anthropic", "gemini", "off"] = "anthropic"
    ai_model: str | None = None  # unset: claude-haiku-5-5 (anthropic) or gemini-2.5-flash (gemini)
    anthropic_api_key: SecretStr | None = None
    gemini_api_key: SecretStr | None = None
    ai_daily_quota: int = 5  # new readings per user per WAT day; cached readings are free
    ai_admin_daily_quota: int = 25
    ai_timeout_seconds: float = 30.0

    # Built SPA (frontend/dist) to serve at "/"; skipped when the folder is missing.
    frontend_dist: Path = Field(default=BACKEND_DIR.parent / "frontend" / "dist")

    @property
    def secure_cookies(self) -> bool:
        return self.env != "local"

    # __Host- (ASVS 3.3.1): the browser only accepts it over https, with Path=/ and no Domain,
    # so a sibling subdomain can't plant or overwrite it. Plain http locally can't use the prefix.
    @property
    def session_cookie(self) -> str:
        return "__Host-el_session" if self.secure_cookies else "el_session"

    @property
    def csrf_cookie(self) -> str:
        return "__Host-el_csrf" if self.secure_cookies else "el_csrf"

    @property
    def logo_url(self) -> str | None:
        if self.email_logo_url:
            return self.email_logo_url
        if self.public_base_url.startswith("https://"):
            return f"{self.public_base_url.rstrip('/')}/email-assets/equitylens-logo-horizontal-light@2x.png"
        return None

    @property
    def ai_key(self) -> SecretStr | None:
        return {"anthropic": self.anthropic_api_key, "gemini": self.gemini_api_key}.get(self.ai_provider)

    @property
    def ai_model_id(self) -> str:
        return self.ai_model or ("gemini-2.5-flash" if self.ai_provider == "gemini" else "claude-haiku-5-5")

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if self.session_secret is None:
            if self.env != "local":
                raise ValueError("SESSION_SECRET is required outside ENV=local")
            logging.getLogger(__name__).warning(
                "SESSION_SECRET unset: using a random one (CSRF tokens reset on restart)"
            )
            self.session_secret = SecretStr(secrets.token_hex(32))
        elif self.env != "local" and len(self.session_secret.get_secret_value()) < 32:
            raise ValueError("SESSION_SECRET must be at least 32 characters (e.g. `openssl rand -hex 32`)")
        if self.email_provider == "resend" and self.resend_api_key is None:
            raise ValueError("RESEND_API_KEY is required when EMAIL_PROVIDER=resend")
        if self.env != "local" and self.email_provider == "console":
            raise ValueError("EMAIL_PROVIDER=console only works on ENV=local")
        if self.ai_provider != "off" and self.ai_key is None:
            if self.env != "local":
                name = "ANTHROPIC_API_KEY" if self.ai_provider == "anthropic" else "GEMINI_API_KEY"
                raise ValueError(f"{name} is required when AI_PROVIDER={self.ai_provider} (or set AI_PROVIDER=off)")
            logging.getLogger(__name__).warning("AI_PROVIDER=%s has no API key: AI readings are off", self.ai_provider)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # required fields come from the environment
