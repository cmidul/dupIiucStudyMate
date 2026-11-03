"""User schemas for request validation and safe response serialization."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    """Shared user properties."""
    email: EmailStr
    name: Optional[str] = None


class UserCreate(UserBase):
    """User registration request."""
    password: str = Field(..., min_length=8, max_length=128, description="Password (minimum 8 characters)")


class UserLogin(BaseModel):
    """User login request."""
    email: EmailStr
    password: str = Field(..., min_length=1, description="Password")


class UserResponse(UserBase):
    """Safe public user representation. Never contains password or hash."""
    id: str
    telegram_id: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Authentication token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

