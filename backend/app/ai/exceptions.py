"""AI Provider domain exceptions with normalized application error codes."""

from typing import Any, Dict, Optional
from app.core.responses import AppException


class AIProviderError(AppException):
    """Base exception for all AI provider failures."""

    def __init__(
        self,
        code: str = "PROVIDER_UNAVAILABLE",
        message: str = "The AI service is temporarily unavailable. Please try again shortly.",
        status_code: int = 502,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(code=code, message=message, status_code=status_code, details=details)


class AIRateLimitError(AIProviderError):
    """Raised when an AI provider returns HTTP 429 / quota exceeded."""

    def __init__(
        self,
        message: str = "AI rate limit or free-tier quota reached. Please wait a moment before retrying.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            code="PROVIDER_RATE_LIMITED",
            message=message,
            status_code=429,
            details=details,
        )


class AITimeoutError(AIProviderError):
    """Raised when an AI provider call times out."""

    def __init__(
        self,
        message: str = "The AI request timed out. Please try again with a shorter input or later.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            code="PROVIDER_UNAVAILABLE",
            message=message,
            status_code=504,
            details=details,
        )


class AIAuthenticationError(AIProviderError):
    """Raised when an AI provider API key is missing or invalid."""

    def __init__(
        self,
        provider_name: str,
        message: Optional[str] = None,
    ):
        safe_message = message or f"AI provider '{provider_name}' authentication failed. Check configuration."
        super().__init__(
            code="PROVIDER_UNAVAILABLE",
            message=safe_message,
            status_code=500,
            details={"provider": provider_name},
        )


class AICapabilityError(AIProviderError):
    """Raised when requesting a capability (e.g. vision) from a model that lacks it."""

    def __init__(
        self,
        provider_name: str,
        capability: str,
    ):
        super().__init__(
            code="CAPABILITY_UNSUPPORTED",
            message=f"Provider '{provider_name}' does not support the requested '{capability}' capability.",
            status_code=400,
            details={"provider": provider_name, "capability": capability},
        )


class AIStructuredOutputError(AIProviderError):
    """Raised when model output fails JSON schema validation even after repair attempts."""

    def __init__(
        self,
        message: str = "AI response could not be parsed into the required structured format.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            code="INVALID_AI_OUTPUT",
            message=message,
            status_code=502,
            details=details,
        )

