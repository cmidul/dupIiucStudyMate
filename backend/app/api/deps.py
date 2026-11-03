"""FastAPI endpoint dependencies for authentication and request context."""

from typing import Optional
import uuid
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

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

