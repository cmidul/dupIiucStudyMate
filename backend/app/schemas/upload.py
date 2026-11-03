"""Pydantic schemas for upload, image extraction, and background job responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.ai.schemas import KeyConcept, VisualElement


class UploadedFileResponse(BaseModel):
    """Safe public representation of an uploaded file.
    
    CRITICAL: Never includes storage_path to keep private storage isolated.
    """
    id: str
    user_id: str
    mime_type: str
    file_size: int
    original_filename: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExtractedContentResponse(BaseModel):
    """Structured educational content extracted from an image or document."""
    id: str
    uploaded_file_id: Optional[str] = None
    user_id: str
    title: str
    subject: str
    topic: str
    subtopics: List[str] = Field(default_factory=list)
    extracted_text: str = ""
    key_concepts: List[KeyConcept] = Field(default_factory=list)
    equations: List[str] = Field(default_factory=list)
    visual_elements: List[VisualElement] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    language: str = "en"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BackgroundJobResponse(BaseModel):
    """Status and result of an asynchronous background job."""
    id: str
    user_id: str
    job_type: str
    status: str  # queued, processing, completed, failed
    retry_count: int
    max_retries: int
    result: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ImageUploadResult(BaseModel):
    """Combined upload acknowledgement and background job response."""
    file: UploadedFileResponse
    job: BackgroundJobResponse
    extracted_content: Optional[ExtractedContentResponse] = None

