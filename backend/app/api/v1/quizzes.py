"""Quizzes API endpoints."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.quiz import (
    QuizAttemptResponse,
    QuizAttemptSubmitRequest,
    QuizDeliveryResponse,
    QuizGenerateRequest,
    QuizListItemResponse,
)
from app.services.quiz_service import quiz_service

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


@router.post("/generate", response_model=ApiResponse[QuizDeliveryResponse], status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    payload: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[QuizDeliveryResponse]:
    """Generate an MCQ quiz and return safe delivery DTO with answer keys stripped."""
    quiz_delivery = await quiz_service.generate_quiz(
        db=db,
        user_id=current_user.id,
        data=payload,
    )
    return ApiResponse(data=quiz_delivery, request_id=request_id)


@router.get("", response_model=ApiResponse[List[QuizListItemResponse]])
async def list_quizzes(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[List[QuizListItemResponse]]:
    """List authenticated user's quizzes in reverse chronological order."""
    quizzes = await quiz_service.list_quizzes(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=quizzes, request_id=request_id)


@router.get("/{quiz_id}", response_model=ApiResponse[QuizDeliveryResponse])
async def get_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[QuizDeliveryResponse]:
    """Retrieve quiz questions for taking. STRICTLY excludes answer keys and explanations."""
    quiz_delivery = await quiz_service.get_quiz_for_taking(
        db=db,
        quiz_id=quiz_id,
        user_id=current_user.id,
    )
    return ApiResponse(data=quiz_delivery, request_id=request_id)


@router.post("/{quiz_id}/attempts", response_model=ApiResponse[QuizAttemptResponse], status_code=status.HTTP_200_OK)
async def submit_quiz_attempt(
    quiz_id: str,
    payload: QuizAttemptSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[QuizAttemptResponse]:
    """Submit quiz answers, compute authoritative score, and return review with explanations."""
    attempt_result = await quiz_service.submit_attempt(
        db=db,
        quiz_id=quiz_id,
        user_id=current_user.id,
        submission=payload,
    )
    return ApiResponse(data=attempt_result, request_id=request_id)


@router.delete("/{quiz_id}", response_model=ApiResponse[Dict[str, Any]])
async def delete_quiz(
    quiz_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Delete a quiz belonging to the user."""
    await quiz_service.delete_quiz(
        db=db,
        quiz_id=quiz_id,
        user_id=current_user.id,
    )
    return ApiResponse(
        data={"message": "Quiz deleted successfully.", "id": quiz_id},
        request_id=request_id,
    )

