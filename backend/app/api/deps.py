"""FastAPI endpoint dependencies for authentication and request context."""

from typing import Optional
import uuid
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.responses import AppException
from app.models.user import User
from app.services.auth_service import auth_service


def get_request_id(
    request: Request,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> str:
    """Return existing or freshly generated request ID."""
    if hasattr(request.state, "request_id") and request.state.request_id:
        return str(request.state.request_id)
    req_id = x_request_id.strip() if x_request_id and x_request_id.strip() else str(uuid.uuid4())
    request.state.request_id = req_id
    return req_id


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate authenticated user from Authorization header or cookie."""
    token: Optional[str] = None

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise AppException(
            code="UNAUTHENTICATED",
            message="Sign-in required to access this resource.",
            status_code=401,
        )

    return await auth_service.get_current_user_from_token(db=db, token=token)


async def verify_bot_service_auth(
    x_telegram_bot_secret: Optional[str] = Header(None, alias="X-Telegram-Bot-Secret"),
    authorization: Optional[str] = Header(None),
) -> bool:
    """Verify that request originates from the trusted Telegram bot integration.

    Arbitrary untrusted clients cannot supply Telegram user IDs directly.
    """
    bot_key = None
    if x_telegram_bot_secret and x_telegram_bot_secret.strip():
        bot_key = x_telegram_bot_secret.strip()
    elif authorization and authorization.startswith("Bearer "):
        bot_key = authorization.split("Bearer ", 1)[1].strip()

    valid_secrets = {
        s for s in [
            settings.TELEGRAM_BOT_SECRET,
            settings.TELEGRAM_WEBHOOK_SECRET,
            settings.TELEGRAM_BOT_TOKEN,
        ] if s and s.strip()
    }

    if not valid_secrets:
        # Default fallback secret for development and testing
        valid_secrets.add("dev-telegram-bot-secret")

    if not bot_key or bot_key not in valid_secrets:
        raise AppException(
            code="UNAUTHORIZED_BOT_CLIENT",
            message="Request must originate from the trusted Telegram bot service.",
            status_code=401,
        )
    return True


