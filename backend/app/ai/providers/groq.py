"""Groq API Provider adapter for ultra-fast text and reasoning inference.

Uses OpenAI-compatible chat completions endpoint.
"""

import asyncio
import base64
import json
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
    ExtractedContentSchema,
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
    supported_capabilities: Set[AICapability] = {
        AICapability.TEXT,
        AICapability.REASONING,
    }

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.GROQ_API_KEY
        self._timeout_seconds = 45.0

    @property
    def default_vision_model(self) -> str:
        return self.default_text_model if self.default_text_model == "qwen/qwen3.8-27b" else "none"

    def has_capability(self, capability: AICapability) -> bool:
        if capability == AICapability.VISION:
            return self.default_vision_model != "none"
        return super().has_capability(capability)

    def _ensure_api_key(self) -> str:
        key = self._api_key or settings.GROQ_API_KEY
        if not key or not key.strip() or key.strip() == "your_groq_api_key_here":
            raise AIAuthenticationError(
                provider_name=self.name,
                message="Groq API key is missing. Please configure GROQ_API_KEY in backend/.env.",
            )
        return key.strip()

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        model = self.default_text_model

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": request.temperature,
            "max_completion_tokens": request.max_tokens,
        }
        if model == "qwen/qwen3.8-27b":
            payload["reasoning_format"] = "hidden"
        if request.response_schema:
            payload["response_format"] = {"type": "json_object"}

        raw_text, tokens_used = await self._complete(payload)
        return TextGenerationResponse(
            content=raw_text,
            provider=self.name,
            model=model,
            tokens_used=tokens_used,
            structured_data=self.parse_and_validate_json(raw_text, request.response_schema)
            if request.response_schema else None,
        )

    async def _complete(self, payload: Dict[str, Any]) -> tuple[str, Optional[int]]:
        api_key = self._ensure_api_key()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(GROQ_API_URL, json=payload, headers=headers)
                retry_after = response.headers.get("retry-after", "")
                if response.status_code == 429 and retry_after.isdecimal() and int(retry_after) <= 55:
                    await asyncio.sleep(max(1, int(retry_after)))
                    response = await client.post(GROQ_API_URL, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AITimeoutError() from exc
        except Exception as exc:
            raise AIProviderError(message=f"Network error contacting Groq API: {exc}") from exc

        self._check_http_status(response)
        data = response.json()
        choice = next(iter(data.get("choices") or []), {})
        raw_text = (choice.get("message", {}).get("content") or "").strip()
        if not raw_text or choice.get("finish_reason") not in (None, "stop"):
            raise AIProviderError(message="Groq did not return a complete answer.")

        return raw_text, data.get("usage", {}).get("total_tokens")

    async def analyze_image(self, request: ImageAnalysisRequest) -> ImageAnalysisResponse:
        if not self.has_capability(AICapability.VISION):
            raise AICapabilityError(provider_name=self.name, capability="vision")

        prompt = request.prompt or "Transcribe and describe this educational image."
        if request.response_schema is ExtractedContentSchema:
            prompt = (
                "Read this educational image. Return a JSON object with extracted_text as a string. "
                "For a question sheet, write each labeled question and alternative on its own line. "
                "Condense the wording while keeping every task, value, code instruction, and table entry. "
                "Skip marks, course outcome labels, and decorative text. Use compact rows for tables. "
                "For a standalone equation, also return equations as a list of strings. "
                "For other images, include relevant metadata only when useful. Flag unreadable parts."
            )
        elif request.response_schema:
            schema = json.dumps(request.response_schema.model_json_schema(), separators=(",", ":"))
            prompt += f"\nReturn a JSON object matching this schema: {schema}"
        image = base64.b64encode(request.image_bytes).decode("ascii")
        payload = {
            "model": self.default_vision_model,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{request.mime_type};base64,{image}"}},
            ]}],
            "temperature": 0.1,
            "max_completion_tokens": 980,
            "reasoning_effort": "none",
        }
        if request.response_schema:
            payload["response_format"] = {"type": "json_object"}
        raw_text, tokens_used = await self._complete(payload)
        return ImageAnalysisResponse(
            content=raw_text,
            provider=self.name,
            model=self.default_vision_model,
            tokens_used=tokens_used,
            structured_data=self.parse_and_validate_json(raw_text, request.response_schema)
            if request.response_schema else None,
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

