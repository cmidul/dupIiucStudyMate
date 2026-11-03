"""Summaries API endpoints."""

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.summary import SummaryGenerateRequest, SummaryResponse
from app.services.summarizer import summarizer_service

router = APIRouter(prefix="/summaries", tags=["Summaries"])


@router.post("", response_model=ApiResponse[SummaryResponse], status_code=status.HTTP_201_CREATED)
async def generate_summary(
    payload: SummaryGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[SummaryResponse]:
    """Generate and persist a structured learning summary."""
    summary = await summarizer_service.generate_summary(
        db=db,
        user_id=current_user.id,
        data=payload,
    )
    return ApiResponse(data=summary, request_id=request_id)


@router.get("", response_model=ApiResponse[List[SummaryResponse]])
async def list_summaries(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[List[SummaryResponse]]:
    """List authenticated user's summaries in reverse chronological order."""
    summaries = await summarizer_service.list_summaries(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(data=summaries, request_id=request_id)


@router.get("/{summary_id}", response_model=ApiResponse[SummaryResponse])
async def get_summary(
    summary_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[SummaryResponse]:
    """Retrieve details of a single summary."""
    summary = await summarizer_service.get_summary(
        db=db,
        summary_id=summary_id,
        user_id=current_user.id,
    )
    return ApiResponse(data=summary, request_id=request_id)


@router.delete("/{summary_id}", response_model=ApiResponse[Dict[str, Any]])
async def delete_summary(
    summary_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    """Delete a summary belonging to the user."""
    await summarizer_service.delete_summary(
        db=db,
        summary_id=summary_id,
        user_id=current_user.id,
    )
    return ApiResponse(
        data={"message": "Summary deleted successfully.", "id": summary_id},
        request_id=request_id,
    )

