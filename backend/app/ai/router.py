"""AI Router implementing capability routing, bounded fallback, and controlled repairs."""

import logging
from typing import Dict, List, Optional
from pydantic import BaseModel

from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AICapabilityError,
    AIProviderError,
    AIRateLimitError,
    AIStructuredOutputError,
    AITimeoutError,
)
from app.ai.mock_provider import MockAIProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.groq import GroqProvider
from app.ai.schemas import (
    AICapability,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    TextGenerationRequest,
    TextGenerationResponse,
)
from app.core.config import settings

logger = logging.getLogger("learning_assistant.ai.router")


class AIRouter:
    """Capability-based router managing provider selection, fallback, and structured repairs."""

    def __init__(self):
        self._providers: Dict[str, BaseAIProvider] = {}
        self._register_default_providers()

    def register_provider(self, provider: BaseAIProvider) -> None:
        """Register a provider adapter."""
        self._providers[provider.name.lower()] = provider

    def _register_default_providers(self) -> None:
        self.register_provider(MockAIProvider())
        self.register_provider(GeminiProvider())
        self.register_provider(GroqProvider())

    def get_provider(self, name: str) -> Optional[BaseAIProvider]:
        """Look up provider by name."""
        return self._providers.get(name.lower())

    def resolve_provider(
        self,
        capability: AICapability,
        preferred_name: Optional[str] = None,
    ) -> BaseAIProvider:
        """Resolve a suitable provider supporting the requested capability."""
        name = preferred_name or settings.AI_DEFAULT_PROVIDER
        provider = self.get_provider(name)

        if provider and provider.has_capability(capability):
            return provider

        # If preferred provider does not support capability (e.g. groq for vision),
        # fallback to a provider that does
        for p in self._providers.values():
            if p.has_capability(capability):
                logger.info(
                    f"Selected provider '{p.name}' for capability '{capability.value}' "
                    f"since '{name}' is unsupported or unavailable"
                )
                return p

        raise AICapabilityError(provider_name=name, capability=capability.value)

    async def generate_text(
        self,
        request: TextGenerationRequest,
        preferred_provider: Optional[str] = None,
    ) -> TextGenerationResponse:
        """Execute text generation with bounded fallback and at most one structured repair."""
        provider = self.resolve_provider(AICapability.TEXT, preferred_name=preferred_provider)
        try:
            return await self._execute_text_with_repair(provider, request)
        except (AITimeoutError, AIRateLimitError, AIProviderError) as primary_err:
            fallback_name = settings.AI_FALLBACK_PROVIDER
            if fallback_name and fallback_name.lower() != provider.name.lower():
                fallback_provider = self.get_provider(fallback_name)
                if fallback_provider and fallback_provider.has_capability(AICapability.TEXT):
                    logger.warning(
                        f"Primary provider '{provider.name}' failed ({primary_err}). "
                        f"Attempting fallback to '{fallback_provider.name}'."
                    )
                    return await self._execute_text_with_repair(fallback_provider, request)
            raise primary_err

    async def _execute_text_with_repair(
        self,
        provider: BaseAIProvider,
        request: TextGenerationRequest,
    ) -> TextGenerationResponse:
        """Execute generation and perform at most one controlled repair if structured output is invalid."""
        try:
            res = await provider.generate_text(request)
            if request.response_schema and res.structured_data is None:
                res.structured_data = provider.parse_and_validate_json(res.content, request.response_schema)
            return res
        except AIStructuredOutputError as schema_err:
            if not request.response_schema:
                raise schema_err

            logger.warning(f"Structured output failed for {provider.name}. Attempting 1 controlled repair.")
            repair_prompt = (
                f"{request.prompt}\n\n"
                f"IMPORTANT REPAIR INSTRUCTION: Your previous output was invalid JSON or failed schema validation: "
                f"{schema_err.message}. Output ONLY valid JSON matching the required schema with no commentary."
            )
            repair_req = request.model_copy(update={"prompt": repair_prompt})
            res2 = await provider.generate_text(repair_req)
            if request.response_schema and res2.structured_data is None:
                res2.structured_data = provider.parse_and_validate_json(res2.content, request.response_schema)
            return res2

    async def analyze_image(
        self,
        request: ImageAnalysisRequest,
        preferred_provider: Optional[str] = None,
    ) -> ImageAnalysisResponse:
        """Execute vision analysis ensuring only vision-capable providers are invoked."""
        provider = self.resolve_provider(AICapability.VISION, preferred_name=preferred_provider)
        try:
            return await provider.analyze_image(request)
        except (AITimeoutError, AIRateLimitError, AIProviderError) as primary_err:
            fallback_name = settings.AI_FALLBACK_PROVIDER
            if fallback_name and fallback_name.lower() != provider.name.lower():
                fallback_provider = self.get_provider(fallback_name)
                if fallback_provider and fallback_provider.has_capability(AICapability.VISION):
                    logger.warning(
                        f"Vision provider '{provider.name}' failed ({primary_err}). "
                        f"Attempting fallback to '{fallback_provider.name}'."
                    )
                    return await fallback_provider.analyze_image(request)
            raise primary_err


ai_router = AIRouter()
