"""Telegram account linking service.

Handles cryptographically secure token generation, hash verification, single-use enforcement,
and Telegram user identity mapping.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.responses import AppException
from app.models.telegram_link import TelegramLinkToken
from app.models.user import User
from app.schemas.telegram import (
    TelegramCompleteLinkResponse,
    TelegramLinkTokenResponse,
    TelegramStatusResponse,
)


class TelegramLinkService:
    """Service handling Telegram account linking logic."""

    TOKEN_EXPIRY_MINUTES = 10

    def _hash_token(self, token: str) -> str:
        """Hash raw token with SHA-256 for secure storage."""
        return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()

    async def create_linking_token(
        self,
        db: AsyncSession,
        user_id: str,
    ) -> TelegramLinkTokenResponse:
        """Create a single-use cryptographically random linking token.

        Raw token is never saved in plaintext; only its SHA-256 hash is persisted.
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=self.TOKEN_EXPIRY_MINUTES)

        link_record = TelegramLinkToken(
            user_id=user_id,
            token_hash=token_hash,
            is_used=False,
            expires_at=expires_at,
        )
        db.add(link_record)
        await db.commit()

        bot_username = settings.TELEGRAM_BOT_USERNAME or "ai_learning_assistant_bot"
        deep_link = f"https://t.me/{bot_username}?start=link_{raw_token}"

        return TelegramLinkTokenResponse(
            token=raw_token,
            deep_link=deep_link,
            expires_at=expires_at,
            expires_in_seconds=self.TOKEN_EXPIRY_MINUTES * 60,
        )

    async def complete_linking(
        self,
        db: AsyncSession,
        token: str,
        telegram_id: str,
        telegram_username: Optional[str] = None,
    ) -> TelegramCompleteLinkResponse:
        """Validate linking token and bind the verified Telegram ID to the application user."""
        norm_tg_id = str(telegram_id).strip()
        if not norm_tg_id:
            raise AppException(
                code="INVALID_TELEGRAM_ID",
                message="A valid Telegram ID is required.",
                status_code=400,
            )

        token_hash = self._hash_token(token)

        # 1. Fetch token record
        stmt = select(TelegramLinkToken).where(TelegramLinkToken.token_hash == token_hash)
        result = await db.execute(stmt)
        token_record = result.scalar_one_or_none()

        if not token_record:
            raise AppException(
                code="INVALID_LINK_TOKEN",
                message="Linking token is invalid or malformed.",
                status_code=400,
            )

        # 2. Check if already used
        if token_record.is_used:
            raise AppException(
                code="TOKEN_ALREADY_USED",
                message="This linking token has already been used.",
                status_code=400,
            )

        # 3. Check expiration
        now = datetime.now(timezone.utc)
        record_expiry = token_record.expires_at
        if record_expiry.tzinfo is None:
            record_expiry = record_expiry.replace(tzinfo=timezone.utc)

        if record_expiry < now:
            raise AppException(
                code="TOKEN_EXPIRED",
                message="Linking token has expired. Please request a new link on the website.",
                status_code=400,
            )

        # 4. Check if telegram_id is already linked to another application user
        user_stmt = select(User).where(
            User.telegram_id == norm_tg_id,
            User.id != token_record.user_id,
        )
        existing_res = await db.execute(user_stmt)
        conflict_user = existing_res.scalar_one_or_none()

        if conflict_user:
            raise AppException(
                code="TELEGRAM_ID_ALREADY_LINKED",
                message="This Telegram account is already linked to another user account.",
                status_code=409,
            )

        # 5. Fetch target user
        target_stmt = select(User).where(User.id == token_record.user_id)
        user_res = await db.execute(target_stmt)
        target_user = user_res.scalar_one_or_none()

        if not target_user:
            raise AppException(
                code="USER_NOT_FOUND",
                message="User account associated with this token no longer exists.",
                status_code=404,
            )

        # 6. Apply link and consume token
        target_user.telegram_id = norm_tg_id
        token_record.is_used = True
        token_record.used_at = now
        token_record.claimed_telegram_id = norm_tg_id

        await db.commit()

        return TelegramCompleteLinkResponse(
            success=True,
            message="Telegram account linked successfully.",
            user_id=target_user.id,
            telegram_id=norm_tg_id,
        )

    async def unlink_telegram(
        self,
        db: AsyncSession,
        current_user: User,
    ) -> None:
        """Unlink the currently linked Telegram account."""
        if not current_user.telegram_id:
            raise AppException(
                code="NOT_LINKED",
                message="No Telegram account is currently linked.",
                status_code=400,
            )

        current_user.telegram_id = None
        await db.commit()

    async def get_status(
        self,
        current_user: User,
    ) -> TelegramStatusResponse:
        """Return the linking status of the user."""
        return TelegramStatusResponse(
            is_linked=bool(current_user.telegram_id),
            telegram_id=current_user.telegram_id,
            user_id=current_user.id,
        )

    async def get_user_by_telegram_id(
        self,
        db: AsyncSession,
        telegram_id: str,
    ) -> Optional[User]:
        """Look up internal application user by linked Telegram ID."""
        norm_tg_id = str(telegram_id).strip()
        stmt = select(User).where(User.telegram_id == norm_tg_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


telegram_link_service = TelegramLinkService()

