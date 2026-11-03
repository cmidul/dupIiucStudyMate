"""Quiz, QuizQuestion, and QuizAttempt database models."""

from datetime import datetime, timezone
import uuid
from typing import List, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Quiz(Base, TimestampMixin):
    """Quiz container holding generated questions and user attempts."""

    __tablename__ = "quizzes"

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
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    topic: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    difficulty: Mapped[str] = mapped_column(
        String(50),
        default="intermediate",
        nullable=False,
    )
    question_type: Mapped[str] = mapped_column(
        String(50),
        default="mcq",
        nullable=False,
    )

    questions: Mapped[List["QuizQuestion"]] = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.question_order",
    )
    attempts: Mapped[List["QuizAttempt"]] = relationship(
        "QuizAttempt",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="desc(QuizAttempt.created_at)",
    )


class QuizQuestion(Base):
    """Single question within a quiz (answer keys stored securely here)."""

    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    quiz_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    options_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # JSON serialized list of {"id": "A", "text": "..."}
    )
    correct_option_id: Mapped[str] = mapped_column(
        String(10),
        nullable=False,  # e.g. "A", "B" (MUST NEVER be sent to client before submission)
    )
    explanation: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # MUST NEVER be sent to client before submission
    )

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    """A scored user attempt at a quiz."""

    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )
    quiz_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    total_questions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    percentage: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    review_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,  # JSON results with question reviews, explanations, and correctness
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True,
    )

    quiz = relationship("Quiz", back_populates="attempts")

