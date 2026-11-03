"""Chat and question answering API endpoints."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.services.chat_service import chat_service

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/messages", response_model=ApiResponse[ChatMessageResponse], status_code=status.HTTP_200_OK)
async def send_chat_message(
    payload: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[ChatMessageResponse]:
    """Send a message to the AI learning assistant.

    Classifies topic/intent, assembles conversation context, generates an answer,
    and records messages under the authenticated user.
    """
    response_data = await chat_service.send_message(
        db=db,
        user_id=current_user.id,
        data=payload,
    )
    return ApiResponse(data=response_data, request_id=request_id)

