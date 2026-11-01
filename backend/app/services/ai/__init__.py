"""
AI providers behind one interface (ADR-012): Claude via the Anthropic SDK by default, Gemini via
google-genai when AI_PROVIDER=gemini. Only the adapters in this package import an AI SDK; no
LangChain. An adapter returns the model's JSON text and token counts; insight_service validates it,
so both providers produce the same schema.
"""

import logging
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import Settings

log = logging.getLogger(__name__)


class ProviderError(Exception):
    """The provider failed, timed out, refused, or was cut off: no usable answer."""


@dataclass(frozen=True)
class Completion:
    text: str
    model: str  # the model that actually answered (a fallback may differ from the one asked for)
    tokens_in: int
    tokens_out: int


class Provider(Protocol):
    name: str
    model: str

    def complete(self, system: str, prompt: str, schema: dict[str, Any], max_tokens: int) -> Completion: ...


_provider: Provider | None = None


def build_provider(settings: Settings) -> Provider | None:
    key = settings.ai_key
    if settings.ai_provider == "off" or key is None:
        return None
    if settings.ai_provider == "gemini":
        from app.services.ai.gemini_provider import GeminiProvider  # optional dependency

        return GeminiProvider(key.get_secret_value(), settings.ai_model_id, settings.ai_timeout_seconds)
    from app.services.ai.anthropic_provider import AnthropicProvider

    return AnthropicProvider(key.get_secret_value(), settings.ai_model_id, settings.ai_timeout_seconds)


def use_provider(provider: Provider | None) -> None:
    global _provider
    _provider = provider
    if provider:
        log.info("AI readings: %s %s", provider.name, provider.model)


def get_provider() -> Provider | None:
    return _provider
