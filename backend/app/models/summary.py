"""Summary database model for persistent learning summaries."""

import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class Summary(Base, TimestampMixin):
    """Summary entity generated from learning materials or topic prompts."""

    __tablename__ = "summaries"

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
    source_content_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    topic: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    style: Mapped[str] = mapped_column(
        String(50),
        nullable=False,  # "short", "detailed", "exam_notes"
    )
    overview: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    structured_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # JSON serialized full SummarySchema
    )

    user = relationship("User", backref="summaries")

    def __repr__(self) -> str:
        return f"<Summary id={self.id} user_id={self.user_id} title={self.title!r} style={self.style}>"

