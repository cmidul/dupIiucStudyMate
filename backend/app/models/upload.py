"""Uploaded files and extracted content database models."""

import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class UploadedFile(Base, TimestampMixin):
    """Secure private uploaded file record."""

    __tablename__ = "uploaded_files"

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
    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    user = relationship("User", backref="uploaded_files")
    extracted_content = relationship(
        "ExtractedContent",
        uselist=False,
        back_populates="uploaded_file",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<UploadedFile id={self.id} user_id={self.user_id} filename={self.original_filename!r}>"


class ExtractedContent(Base, TimestampMixin):
    """Structured educational content extracted from an uploaded image or document."""

    __tablename__ = "extracted_contents"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    uploaded_file_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("uploaded_files.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Extracted Material",
    )
    subject: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="General",
    )
    topic: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="General",
    )
    subtopics: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",  # JSON array
    )
    extracted_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )
    key_concepts: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",  # JSON array of KeyConcept
    )
    equations: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",  # JSON array
    )
    visual_elements: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",  # JSON array of VisualElement
    )
    uncertainties: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",  # JSON array of uncertainty notes
    )
    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
    )

    user = relationship("User", backref="extracted_contents")
    uploaded_file = relationship("UploadedFile", back_populates="extracted_content")

    def __repr__(self) -> str:
        return f"<ExtractedContent id={self.id} topic={self.topic!r} user_id={self.user_id}>"

