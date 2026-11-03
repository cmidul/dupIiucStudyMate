"""Pydantic schemas for conversations, chat messages, and intent classification."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.ai.schemas import TopicDetectionSchema


class MessageBase(BaseModel):
    """Base message attributes."""
    role: str = Field(..., description="Message author role: user, assistant, system")
    content: str = Field(..., min_length=1, description="Message text content")


class MessageCreate(MessageBase):
    """Creation payload for a message."""
    intent: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None


class MessageResponse(MessageBase):
    """Safe public representation of a conversation message."""
    id: str
    conversation_id: str
    intent: Optional[str] = None
    subject: Optional[str] = None
    topic: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(BaseModel):
    """Create a new conversation session."""
    title: Optional[str] = Field(None, max_length=255, description="Optional title")


class ConversationResponse(BaseModel):
    """Summary representation of a user conversation."""
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(ConversationResponse):
    """Full representation of a conversation including ordered messages."""
    messages: List[MessageResponse] = Field(default_factory=list)


class ChatMessageRequest(BaseModel):
    """User request to send a message to the AI assistant."""
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID or null to create new")
    message: str = Field(..., min_length=1, max_length=8000, description="User prompt or question")
    source_content_id: Optional[str] = Field(None, description="Optional extracted source content ID")


class ChatMessageResponse(BaseModel):
    """Structured response to a chat message."""
    conversation_id: str
    user_message: MessageResponse
    assistant_message: MessageResponse
    topic_metadata: Optional[TopicDetectionSchema] = None

