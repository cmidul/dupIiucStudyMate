"""Add uploaded files, extracted contents, and background jobs tables

Revision ID: 0004_uploads_and_jobs
Revises: 0003_summaries_and_quizzes
Create Date: 2026-11-03 14:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_uploads_and_jobs"
down_revision: Union[str, None] = "0003_summaries_and_quizzes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # uploaded_files
    op.create_table(
        "uploaded_files",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
    )
    op.create_index("ix_uploaded_files_id", "uploaded_files", ["id"])
    op.create_index("ix_uploaded_files_user_id", "uploaded_files", ["user_id"])

    # extracted_contents
    op.create_table(
        "extracted_contents",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("uploaded_file_id", sa.String(length=36), sa.ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=100), nullable=False),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("subtopics", sa.Text(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("key_concepts", sa.Text(), nullable=False),
        sa.Column("equations", sa.Text(), nullable=False),
        sa.Column("visual_elements", sa.Text(), nullable=False),
        sa.Column("uncertainties", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
    )
    op.create_index("ix_extracted_contents_id", "extracted_contents", ["id"])
    op.create_index("ix_extracted_contents_user_id", "extracted_contents", ["user_id"])
    op.create_index("ix_extracted_contents_uploaded_file_id", "extracted_contents", ["uploaded_file_id"])

    # background_jobs
    op.create_table(
        "background_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
    )
    op.create_index("ix_background_jobs_id", "background_jobs", ["id"])
    op.create_index("ix_background_jobs_user_id", "background_jobs", ["user_id"])
    op.create_index("ix_background_jobs_job_type", "background_jobs", ["job_type"])
    op.create_index("ix_background_jobs_status", "background_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("background_jobs")
    op.drop_table("extracted_contents")
    op.drop_table("uploaded_files")

