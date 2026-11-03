"""Pydantic schemas for Telegram linking and Telegram bot interactions."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TelegramLinkTokenResponse(BaseModel):
    """Response returned when an authenticated user requests a linking token."""

    token: str = Field(..., description="Single-use secret linking token")
    deep_link: str = Field(..., description="Telegram bot deep-link URL")
    expires_at: datetime = Field(..., description="UTC expiration time")
    expires_in_seconds: int = Field(default=600, description="Remaining validity window in seconds")


class TelegramCompleteLinkRequest(BaseModel):
    """Payload submitted by the trusted bot service when a user opens the deep link."""

    token: str = Field(..., min_length=10, max_length=128, description="The linking token from deep link")
    telegram_id: str = Field(..., min_length=1, max_length=64, description="Verified Telegram user ID")
    telegram_username: Optional[str] = Field(default=None, max_length=100, description="Telegram username if available")


class TelegramCompleteLinkResponse(BaseModel):
    """Response confirming account link."""

    success: bool = True
    message: str = "Telegram account linked successfully."
    user_id: str
    telegram_id: str


class TelegramStatusResponse(BaseModel):
    """Status indicating whether the user has linked a Telegram account."""

    is_linked: bool
    telegram_id: Optional[str] = None
    user_id: str


class TelegramUserLookupResponse(BaseModel):
    """Internal user profile for Telegram bot request context."""

    id: str
    email: str
    name: Optional[str] = None
    telegram_id: Optional[str] = None
    is_active: bool

