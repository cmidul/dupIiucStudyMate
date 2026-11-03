"""Telegram integration and account linking API endpoints."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id, verify_bot_service_auth
from app.core.config import settings
from app.core.database import get_db
from app.core.responses import ApiResponse, AppException
from app.models.user import User
from app.schemas.telegram import (
    TelegramCompleteLinkRequest,
    TelegramCompleteLinkResponse,
    TelegramLinkTokenResponse,
    TelegramStatusResponse,
    TelegramUserLookupResponse,
)
from app.services.telegram_bot_service import telegram_bot_service
from app.services.telegram_link_service import telegram_link_service

router = APIRouter(prefix="/telegram", tags=["Telegram Integration"])


@router.post(
    "/link-token",
    response_model=ApiResponse[TelegramLinkTokenResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_link_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[TelegramLinkTokenResponse]:
    """Generate a single-use cryptographically random linking token and deep link for the user."""
    token_response = await telegram_link_service.create_linking_token(
        db=db,
        user_id=current_user.id,
    )
    return ApiResponse(
        data=token_response,
        request_id=request_id,
    )


@router.post(
    "/complete-link",
    response_model=ApiResponse[TelegramCompleteLinkResponse],
)
async def complete_link(
    payload: TelegramCompleteLinkRequest,
    _authorized_bot: bool = Depends(verify_bot_service_auth),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[TelegramCompleteLinkResponse]:
    """Verify linking token and link verified Telegram identity to application user.

    Can only be invoked by the trusted Telegram bot integration.
    """
    result = await telegram_link_service.complete_linking(
        db=db,
        token=payload.token,
        telegram_id=payload.telegram_id,
        telegram_username=payload.telegram_username,
    )
    return ApiResponse(
        data=result,
        request_id=request_id,
    )


@router.delete(
    "/link",
    response_model=ApiResponse[Dict[str, Any]],
)
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Unlink the currently authenticated user's Telegram account."""
    await telegram_link_service.unlink_telegram(
        db=db,
        current_user=current_user,
    )
    return ApiResponse(
        data={"message": "Telegram account unlinked successfully."},
        request_id=request_id,
    )


@router.get(
    "/status",
    response_model=ApiResponse[TelegramStatusResponse],
)
async def get_telegram_status(
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[TelegramStatusResponse]:
    """Check whether the current user has a linked Telegram account."""
    status_response = await telegram_link_service.get_status(current_user=current_user)
    return ApiResponse(
        data=status_response,
        request_id=request_id,
    )


@router.get(
    "/user/{telegram_id}",
    response_model=ApiResponse[TelegramUserLookupResponse],
)
async def get_user_by_telegram(
    telegram_id: str,
    _authorized_bot: bool = Depends(verify_bot_service_auth),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[TelegramUserLookupResponse]:
    """Look up an internal application user by linked Telegram ID (trusted bot service only)."""
    user = await telegram_link_service.get_user_by_telegram_id(db=db, telegram_id=telegram_id)
    if not user:
        raise AppException(
            code="USER_NOT_FOUND",
            message="No application user is linked to this Telegram ID.",
            status_code=404,
        )
    return ApiResponse(
        data=TelegramUserLookupResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            telegram_id=user.telegram_id,
            is_active=user.is_active,
        ),
        request_id=request_id,
    )


@router.post(
    "/webhook",
    response_model=ApiResponse[Dict[str, Any]],
)
async def handle_telegram_webhook(
    request: Request,
    payload: Dict[str, Any],
    x_telegram_secret: Optional[str] = Header(None, alias="X-Telegram-Bot-Api-Secret-Token"),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Receive and process webhook updates directly from Telegram Bot API."""
    expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
    if expected_secret and expected_secret.strip():
        if not x_telegram_secret or x_telegram_secret.strip() != expected_secret.strip():
            raise AppException(
                code="INVALID_WEBHOOK_SECRET",
                message="Invalid or missing Telegram webhook secret token.",
                status_code=403,
            )

    result = await telegram_bot_service.process_update(db=db, update=payload)
    return ApiResponse(
        data=result,
        request_id=request_id,
    )


