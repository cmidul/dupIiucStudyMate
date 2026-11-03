"""Abstract base class and contract for all AI provider adapters."""

from abc import ABC, abstractmethod
import json
import re
from typing import Any, Dict, Set, Type
from pydantic import BaseModel, ValidationError

from app.ai.exceptions import AICapabilityError, AIStructuredOutputError
from app.ai.schemas import (
    AICapability,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    TextGenerationRequest,
    TextGenerationResponse,
)


class BaseAIProvider(ABC):
    """Abstract interface that every AI provider adapter must implement."""

    name: str
    default_text_model: str
    default_vision_model: str
    supported_capabilities: Set[AICapability]

    def has_capability(self, capability: AICapability) -> bool:
        """Check whether this provider supports a requested capability."""
        return capability in self.supported_capabilities

    @abstractmethod
    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        """Generate text from a prompt, optionally validated against a response_schema."""
        pass

    @abstractmethod
    async def analyze_image(self, request: ImageAnalysisRequest) -> ImageAnalysisResponse:
        """Analyze an image, optionally validated against a response_schema."""
        pass

    def parse_and_validate_json(
        self,
        raw_text: str,
        schema: Type[BaseModel],
    ) -> Dict[str, Any]:
        """Extract JSON from raw text and validate against a Pydantic schema.

        Handles markdown code fences (```json ... ```) automatically.
        """
        cleaned = raw_text.strip()
        # Strip markdown fences if present
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise AIStructuredOutputError(
                message=f"Model output is not valid JSON: {exc}",
                details={"raw_output": raw_text[:500]},
            ) from exc

        try:
            validated = schema.model_validate(parsed)
            return validated.model_dump()
        except ValidationError as val_exc:
            raise AIStructuredOutputError(
                message=f"Model output failed schema validation: {val_exc.error_count()} error(s)",
                details={"validation_errors": val_exc.errors()},
            ) from val_exc

