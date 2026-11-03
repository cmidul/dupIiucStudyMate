"""Groq API Provider adapter for ultra-fast text and reasoning inference.

Uses OpenAI-compatible chat completions endpoint.
"""

from typing import Any, Dict, Optional, Set
import httpx

from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
    AICapabilityError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai.schemas import (
    AICapability,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    TextGenerationRequest,
    TextGenerationResponse,
)
from app.core.config import settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(BaseAIProvider):
    """Adapter for Groq API."""

    name = "groq"
    default_text_model = settings.GROQ_MODEL_TEXT
    default_vision_model = "none"  # Text & reasoning only
    supported_capabilities: Set[AICapability] = {
        AICapability.TEXT,
        AICapability.REASONING,
    }

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.GROQ_API_KEY
        self._timeout_seconds = 20.0

    def _ensure_api_key(self) -> str:
        if not self._api_key or not self._api_key.strip():
            raise AIAuthenticationError(
                provider_name=self.name,
                message="Groq API key is missing. Please configure GROQ_API_KEY in backend/.env.",
            )
        return self._api_key.strip()

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        api_key = self._ensure_api_key()
        model = self.default_text_model

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        if request.response_schema:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(GROQ_API_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AITimeoutError() from exc
        except Exception as exc:
            raise AIProviderError(message=f"Network error contacting Groq API: {exc}") from exc

        self._check_http_status(response)
        data = response.json()
        raw_text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

        structured_data = None
        if request.response_schema:
            structured_data = self.parse_and_validate_json(raw_text, request.response_schema)

        tokens_used = data.get("usage", {}).get("total_tokens")

        return TextGenerationResponse(
            content=raw_text,
            provider=self.name,
            model=model,
            tokens_used=tokens_used,
            structured_data=structured_data,
        )

    async def analyze_image(self, request: ImageAnalysisRequest) -> ImageAnalysisResponse:
        """Groq text models do not support vision analysis."""
        raise AICapabilityError(
            provider_name=self.name,
            capability="vision",
        )

    def _check_http_status(self, response: httpx.Response) -> None:
        if response.status_code == 200:
            return
        if response.status_code in (401, 403):
            raise AIAuthenticationError(
                provider_name=self.name,
                message="Groq authentication failed. Check your GROQ_API_KEY.",
            )
        if response.status_code == 429:
            raise AIRateLimitError(
                message="Groq API rate limit or token quota exceeded. Please wait a moment.",
            )
        if response.status_code in (500, 502, 503, 504):
            raise AIProviderError(
                code="PROVIDER_UNAVAILABLE",
                message="Groq service is temporarily unavailable. Please retry shortly.",
                status_code=502,
            )
        raise AIProviderError(
            code="PROVIDER_ERROR",
            message=f"Groq API returned HTTP {response.status_code}.",
            status_code=502,
        )

