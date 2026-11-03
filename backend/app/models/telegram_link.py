"""Model for Telegram account linking tokens."""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TelegramLinkToken(Base, TimestampMixin):
    """Temporary cryptographic token for linking a Telegram account to a user account."""

    __tablename__ = "telegram_link_tokens"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    is_used: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    claimed_telegram_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationship to user
    user = relationship("User", backref="telegram_link_tokens")

    def __repr__(self) -> str:
        return f"<TelegramLinkToken id={self.id} user_id={self.user_id} is_used={self.is_used}>"

