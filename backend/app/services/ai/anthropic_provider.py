"""Claude (Anthropic SDK), the default provider: JSON constrained by structured outputs."""

from typing import Any

import anthropic

from app.services.ai import Completion, ProviderError

# Models that take the server-side refusal fallback (`fallbacks: "default"`); others (Haiku) answer alone,
# and a refusal there is a failed attempt like any other.
_FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout: float) -> None:
        self.model = model
        # one SDK retry covers a timeout, 429 or 5xx; insight_service retries invalid output once more
        self._client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=1)

    def complete(self, system: str, prompt: str, schema: dict[str, Any], max_tokens: int) -> Completion:
        extra: dict[str, Any] = {}
        if self.model in _FALLBACK_MODELS:
            extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
        try:
            message = self._client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
                # a short, bounded reading: low effort keeps it within the ~10 s the story asks for
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
                **extra,
            )
        except anthropic.APIError as exc:
            raise ProviderError(f"anthropic: {type(exc).__name__}") from exc
        if message.stop_reason in ("refusal", "max_tokens"):
            raise ProviderError(f"anthropic: stopped ({message.stop_reason})")
        text = next((b.text for b in message.content if b.type == "text"), "")
        usage = message.usage
        tokens_in = usage.input_tokens + (usage.cache_read_input_tokens or 0) + (usage.cache_creation_input_tokens or 0)
        return Completion(text=text, model=message.model, tokens_in=tokens_in, tokens_out=usage.output_tokens)
