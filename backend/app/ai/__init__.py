"""AI Provider Abstraction subsystem exports."""

from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
    AICapabilityError,
    AIProviderError,
    AIRateLimitError,
    AIStructuredOutputError,
    AITimeoutError,
)
from app.ai.mock_provider import MockAIProvider
from app.ai.router import AIRouter, ai_router
from app.ai.schemas import (
    AICapability,
    ExtractedContentSchema,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    LogicSolutionSchema,
    MathSolutionSchema,
    QuizSchema,
    SummarySchema,
    TextGenerationRequest,
    TextGenerationResponse,
    TopicDetectionSchema,
)

__all__ = [
    "BaseAIProvider",
    "MockAIProvider",
    "AIRouter",
    "ai_router",
    "AICapability",
    "TextGenerationRequest",
    "TextGenerationResponse",
    "ImageAnalysisRequest",
    "ImageAnalysisResponse",
    "ExtractedContentSchema",
    "TopicDetectionSchema",
    "SummarySchema",
    "QuizSchema",
    "MathSolutionSchema",
    "LogicSolutionSchema",
    "AIProviderError",
    "AIRateLimitError",
    "AITimeoutError",
    "AIAuthenticationError",
    "AICapabilityError",
    "AIStructuredOutputError",
]

