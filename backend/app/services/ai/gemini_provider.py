"""Gemini (google-genai), optional: used only when AI_PROVIDER=gemini (`uv sync --extra gemini`)."""

import logging
from typing import Any

from app.services.ai import Completion, ProviderError

log = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
except ImportError as exc:  # pragma: no cover - depends on the install
    raise RuntimeError("AI_PROVIDER=gemini needs google-genai: run `uv sync --extra gemini`") from exc


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout: float) -> None:
        self.model = model
        self._client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=int(timeout * 1000)))

    def complete(self, system: str, prompt: str, schema: dict[str, Any], max_tokens: int) -> Completion:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            max_output_tokens=max_tokens,
        )
        try:
            response = self._client.models.generate_content(model=self.model, contents=prompt, config=config)
        except Exception as exc:  # the SDK raises its own errors and the HTTP client's timeouts
            log.warning("gemini call failed: %s", type(exc).__name__)
            raise ProviderError(f"gemini: {type(exc).__name__}") from exc
        usage = response.usage_metadata
        tokens_in = (usage.prompt_token_count or 0) if usage else 0
        tokens_out = ((usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0)) if usage else 0
        return Completion(text=response.text or "", model=self.model, tokens_in=tokens_in, tokens_out=tokens_out)
