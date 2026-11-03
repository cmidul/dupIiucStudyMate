"""Pydantic schemas for summary requests and responses."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ai.schemas import SummarySchema


class SummaryGenerateRequest(BaseModel):
    """Request to generate a learning summary."""
    source_text: Optional[str] = Field(None, description="Text passage or note to summarize")
    source_content_id: Optional[str] = Field(None, description="Optional extracted source ID")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID")
    style: str = Field("exam_notes", description="Summary style: short, detailed, exam_notes")

    @field_validator("style")
    @classmethod
    def validate_style(cls, v: str) -> str:
        allowed = {"short", "detailed", "exam_notes"}
        cleaned = v.lower().strip()
        if cleaned not in allowed:
            raise ValueError(f"Invalid style '{v}'. Allowed styles: {', '.join(sorted(allowed))}")
        return cleaned


class SummaryResponse(BaseModel):
    """Public representation of a saved summary."""
    id: str
    user_id: str
    source_content_id: Optional[str] = None
    conversation_id: Optional[str] = None
    title: str
    topic: str
    style: str
    overview: str
    content: SummarySchema
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

