"""Standard API Response Envelopes and Error Definitions.

Complies with feature.md Section 18 (F-14 REST API Contract).
"""

from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error payload."""
    code: str = Field(..., description="Stable error code string")
    message: str = Field(..., description="Human-readable safe error message")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Optional safe validation context")


class ApiResponse(BaseModel, Generic[T]):
    """Standard success response wrapper."""
    data: T
    request_id: str


class ApiErrorResponse(BaseModel):
    """Standard error response wrapper."""
    error: ErrorDetail
    request_id: str


class AppException(Exception):
    """Base application exception with stable error code and status."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details

