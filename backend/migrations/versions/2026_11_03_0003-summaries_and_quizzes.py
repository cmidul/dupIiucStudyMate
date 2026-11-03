"""Add summaries and quizzes tables

Revision ID: 0003_summaries_and_quizzes
Revises: 0002_conversations_and_messages
Create Date: 2026-11-03 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_summaries_and_quizzes"
down_revision: Union[str, None] = "0002_conversations_and_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # summaries
    op.create_table(
        "summaries",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_content_id", sa.String(length=36), nullable=True),
        sa.Column("conversation_id", sa.String(length=36), sa.ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("style", sa.String(length=50), nullable=False),
        sa.Column("overview", sa.Text(), nullable=False),
        sa.Column("structured_content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_summaries_id", "summaries", ["id"], unique=False)
    op.create_index("ix_summaries_user_id", "summaries", ["user_id"], unique=False)
    op.create_index("ix_summaries_source_content_id", "summaries", ["source_content_id"], unique=False)

    # quizzes
    op.create_table(
        "quizzes",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_content_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("difficulty", sa.String(length=50), nullable=False, server_default="intermediate"),
        sa.Column("question_type", sa.String(length=50), nullable=False, server_default="mcq"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_quizzes_id", "quizzes", ["id"], unique=False)
    op.create_index("ix_quizzes_user_id", "quizzes", ["user_id"], unique=False)
    op.create_index("ix_quizzes_source_content_id", "quizzes", ["source_content_id"], unique=False)

    # quiz_questions
    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("quiz_id", sa.String(length=36), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("options_json", sa.Text(), nullable=False),
        sa.Column("correct_option_id", sa.String(length=10), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
    )
    op.create_index("ix_quiz_questions_id", "quiz_questions", ["id"], unique=False)
    op.create_index("ix_quiz_questions_quiz_id", "quiz_questions", ["quiz_id"], unique=False)

    # quiz_attempts
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("quiz_id", sa.String(length=36), sa.ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("percentage", sa.Float(), nullable=False),
        sa.Column("review_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_quiz_attempts_id", "quiz_attempts", ["id"], unique=False)
    op.create_index("ix_quiz_attempts_quiz_id", "quiz_attempts", ["quiz_id"], unique=False)
    op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("quiz_attempts")
    op.drop_table("quiz_questions")
    op.drop_table("quizzes")
    op.drop_table("summaries")

