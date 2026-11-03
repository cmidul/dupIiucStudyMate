"""Authentication service handling registration, login, and token verification."""

from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import AppException
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repo import user_repo
from app.schemas.user import UserCreate, UserLogin


class AuthService:
    """Service providing core authentication business logic."""

    async def register(self, db: AsyncSession, data: UserCreate) -> User:
        """Register a new user account.

        Raises AppException with code EMAIL_ALREADY_EXISTS if email is taken.
        """
        existing = await user_repo.get_by_email(db, data.email)
        if existing:
            raise AppException(
                code="EMAIL_ALREADY_EXISTS",
                message="An account with this email address already exists.",
                status_code=409,
            )

        hashed = hash_password(data.password)
        user = await user_repo.create(
            db=db,
            email=data.email,
            hashed_password=hashed,
            name=data.name,
        )
        return user

    async def login(self, db: AsyncSession, data: UserLogin) -> Tuple[str, User]:
        """Authenticate user and return (access_token, user).

        Raises AppException with generic INVALID_CREDENTIALS for both bad email and bad password.
        """
        user = await user_repo.get_by_email(db, data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise AppException(
                code="INVALID_CREDENTIALS",
                message="Invalid email or password.",
                status_code=401,
            )

        if not user.is_active:
            raise AppException(
                code="ACCOUNT_INACTIVE",
                message="This account is currently deactivated.",
                status_code=403,
            )

        token = create_access_token(subject=user.id)
        return token, user

    async def get_current_user_from_token(self, db: AsyncSession, token: str) -> User:
        """Validate an access token and return the authenticated user."""
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            raise AppException(
                code="UNAUTHENTICATED",
                message="Invalid, expired, or missing authentication token.",
                status_code=401,
            )

        user_id = str(payload["sub"])
        user = await user_repo.get_by_id(db, user_id)
        if not user or not user.is_active:
            raise AppException(
                code="UNAUTHENTICATED",
                message="User associated with this token is not active or no longer exists.",
                status_code=401,
            )

        return user


auth_service = AuthService()

