"""Background job database model for asynchronous processing."""

import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class BackgroundJob(Base, TimestampMixin):
    """Background job record tracking status, retries, and results."""

    __tablename__ = "background_jobs"

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
    job_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,  # image_extraction, summarization, quiz_generation
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",  # queued, processing, completed, failed
        index=True,
    )
    payload: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",  # JSON dict input params
    )
    result: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,  # JSON dict result or ID reference
    )
    error_code: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
    )

    user = relationship("User", backref="background_jobs")

    def __repr__(self) -> str:
        return f"<BackgroundJob id={self.id} type={self.job_type} status={self.status} retries={self.retry_count}>"

