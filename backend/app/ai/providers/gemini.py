"""Google Gemini API Provider adapter.

Supports multimodal vision and structured JSON outputs via official REST endpoints.
Never prints or leaks API keys.
"""

import base64
from typing import Any, Dict, Optional, Set
import httpx

from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
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

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(BaseAIProvider):
    """Adapter for Google Gemini API."""

    name = "gemini"
    default_text_model = settings.AI_MODEL_TEXT
    default_vision_model = settings.AI_MODEL_VISION
    supported_capabilities: Set[AICapability] = {
        AICapability.TEXT,
        AICapability.VISION,
        AICapability.REASONING,
    }

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._timeout_seconds = 60.0

    def _ensure_api_key(self) -> str:
        key = self._api_key or settings.GEMINI_API_KEY
        if not key or not key.strip() or key.strip() == "your_gemini_api_key_here":
            raise AIAuthenticationError(
                provider_name=self.name,
                message="Google Gemini API key is missing. Please configure GEMINI_API_KEY in backend/.env.",
            )
        return key.strip()

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        api_key = self._ensure_api_key()
        model = self.default_text_model
        url = f"{GEMINI_API_BASE_URL}/models/{model}:generateContent"

        gen_config: Dict[str, Any] = {
            "temperature": request.temperature,
            "maxOutputTokens": request.max_tokens,
        }
        if request.response_schema:
            gen_config["responseMimeType"] = "application/json"
            gen_config["responseJsonSchema"] = request.response_schema.model_json_schema()

        payload = {
            "contents": [{"role": "user", "parts": [{"text": request.prompt}]}],
            "generationConfig": gen_config,
        }
        if request.system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": request.system_prompt}]}
        if model == "gemini-3.5-flash":
            gen_config["thinkingConfig"] = {"thinkingLevel": "low"}

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"x-goog-api-key": api_key},
                )
        except httpx.TimeoutException as exc:
            raise AITimeoutError() from exc
        except Exception as exc:
            raise AIProviderError(message=f"Network error contacting Gemini API: {exc}") from exc

        self._check_http_status(response, model)
        data = response.json()
        raw_text = self._extract_text_from_response(data)

        structured_data = None
        if request.response_schema:
            structured_data = self.parse_and_validate_json(raw_text, request.response_schema)

        tokens_used = data.get("usageMetadata", {}).get("totalTokenCount")

        return TextGenerationResponse(
            content=raw_text,
            provider=self.name,
            model=model,
            tokens_used=tokens_used,
            structured_data=structured_data,
        )

    async def analyze_image(self, request: ImageAnalysisRequest) -> ImageAnalysisResponse:
        api_key = self._ensure_api_key()
        model = self.default_vision_model
        url = f"{GEMINI_API_BASE_URL}/models/{model}:generateContent"

        b64_image = base64.b64encode(request.image_bytes).decode("utf-8")
        parts = [
            {"inline_data": {"mime_type": request.mime_type, "data": b64_image}},
        ]
        if request.prompt:
            parts.append({"text": request.prompt})
        else:
            parts.append({"text": "Extract all text, diagrams, key concepts, formulas, and educational content from this image."})

        contents = [{"parts": parts}]
        gen_config: Dict[str, Any] = {
            "temperature": 0.1,
            "maxOutputTokens": 4096,
        }
        if request.response_schema:
            gen_config["responseMimeType"] = "application/json"
            gen_config["responseJsonSchema"] = request.response_schema.model_json_schema()
        if model == "gemini-3.5-flash":
            gen_config["thinkingConfig"] = {"thinkingLevel": "low"}

        payload = {
            "contents": contents,
            "generationConfig": gen_config,
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                for attempt in range(2):
                    response = await client.post(url, json=payload, headers={"x-goog-api-key": api_key})
                    if attempt == 0 and response.status_code in (502, 503, 504):
                        continue
                    self._check_http_status(response, model)
                    data = response.json()
                    candidate = next(iter(data.get("candidates") or []), {})
                    if candidate.get("finishReason") != "MAX_TOKENS":
                        break
                    gen_config["maxOutputTokens"] = 8192
        except AIProviderError:
            raise
        except httpx.TimeoutException as exc:
            raise AITimeoutError() from exc
        except Exception as exc:
            raise AIProviderError(message=f"Network error contacting Gemini Vision API: {exc}") from exc

        if candidate.get("finishReason") == "MAX_TOKENS":
            raise AIProviderError(
                code="IMAGE_TRANSCRIPTION_TOO_LONG",
                message="The page has too much text to read in one request. Crop it into smaller sections and upload each section separately.",
            )
        raw_text = self._extract_text_from_response(data)

        structured_data = None
        if request.response_schema:
            structured_data = self.parse_and_validate_json(raw_text, request.response_schema)

        tokens_used = data.get("usageMetadata", {}).get("totalTokenCount")

        return ImageAnalysisResponse(
            content=raw_text,
            provider=self.name,
            model=model,
            tokens_used=tokens_used,
            structured_data=structured_data,
        )

    def _check_http_status(self, response: httpx.Response, model: str) -> None:
        """Inspect HTTP status and map to normalized domain exceptions."""
        if response.status_code == 200:
            return
        if response.status_code in (401, 403):
            raise AIAuthenticationError(
                provider_name=self.name,
                message="Google Gemini authentication failed. The supplied API key is invalid or unauthorized.",
            )
        if response.status_code == 404:
            raise AIProviderError(
                code="PROVIDER_MODEL_NOT_FOUND",
                message=f"Gemini model '{model}' is unavailable. Check the configured model ID.",
                status_code=502,
            )
        if response.status_code == 429:
            raise AIRateLimitError(
                message="Google Gemini API rate limit or quota exceeded. Please wait a moment before trying again.",
            )
        if response.status_code in (500, 502, 503, 504):
            raise AIProviderError(
                code="PROVIDER_UNAVAILABLE",
                message="Google Gemini service is temporarily unavailable. Please retry shortly.",
                status_code=502,
            )
        raise AIProviderError(
            code="PROVIDER_ERROR",
            message=f"Google Gemini returned unexpected HTTP status {response.status_code}.",
            status_code=502,
        )

    def _extract_text_from_response(self, data: Dict[str, Any]) -> str:
        candidate = next(iter(data.get("candidates") or []), {})
        parts = candidate.get("content", {}).get("parts", [])
        content = "\n".join(part.get("text", "") for part in parts if not part.get("thought")).strip()
        if not content or candidate.get("finishReason") not in (None, "STOP"):
            raise AIProviderError(message="Gemini did not return a complete answer.")
        return content

