"""Authentication API endpoints for registration, login, logout, and current user profile."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.config import settings
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UserResponse]:
    """Register a new website user account."""
    user = await auth_service.register(db=db, data=payload)
    return ApiResponse(
        data=UserResponse.model_validate(user),
        request_id=request_id,
    )


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
)
async def login(
    payload: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[TokenResponse]:
    """Authenticate with email and password, returning an access token."""
    token, user = await auth_service.login(db=db, data=payload)

    # Set secure HTTP-only cookie for browser-safe session persistence
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return ApiResponse(
        data=TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        ),
        request_id=request_id,
    )


@router.post(
    "/logout",
    response_model=ApiResponse[Dict[str, Any]],
)
async def logout(
    response: Response,
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Clear session cookie and log out."""
    response.delete_cookie(key="access_token")
    return ApiResponse(
        data={"message": "Logged out successfully."},
        request_id=request_id,
    )


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
)
async def get_me(
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UserResponse]:
    """Return the profile of the currently authenticated user."""
    return ApiResponse(
        data=UserResponse.model_validate(current_user),
        request_id=request_id,
    )

