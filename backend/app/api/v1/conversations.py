"""Conversation management API endpoints."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.chat import ConversationCreate, ConversationDetailResponse, ConversationResponse
from app.services.chat_service import chat_service

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", response_model=ApiResponse[List[ConversationResponse]])
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[List[ConversationResponse]]:
    """List authenticated user's conversations in reverse chronological order."""
    conversations = await chat_service.list_conversations(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=conversations, request_id=request_id)


@router.post("", response_model=ApiResponse[ConversationResponse], status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[ConversationResponse]:
    """Create a new conversation session."""
    from app.repositories.chat_repo import chat_repo

    conv = await chat_repo.create_conversation(db=db, user_id=current_user.id, title=payload.title)
    return ApiResponse(
        data=ConversationResponse.model_validate(conv),
        request_id=request_id,
    )


@router.get("/{conversation_id}", response_model=ApiResponse[ConversationDetailResponse])
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[ConversationDetailResponse]:
    """Retrieve conversation details and ordered message history."""
    detail = await chat_service.get_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    return ApiResponse(data=detail, request_id=request_id)


@router.delete("/{conversation_id}", response_model=ApiResponse[Dict[str, Any]])
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Delete a conversation belonging to the user."""
    await chat_service.delete_conversation(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    return ApiResponse(
        data={"message": "Conversation deleted successfully.", "id": conversation_id},
        request_id=request_id,
    )

