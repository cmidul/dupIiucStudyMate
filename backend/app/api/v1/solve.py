"""API endpoints for the unified 'Solve Questions' feature."""

from typing import Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_request_id
from app.core.responses import ApiResponse, AppException
from app.models.user import User
from app.schemas.unified_solver import (
    UnifiedFollowUpRequest,
    UnifiedFollowUpResponse,
    UnifiedSolveRequest,
    UnifiedSolveResponse,
)
from app.services.image_service import image_service
from app.services.unified_solver import unified_solver_service

router = APIRouter(prefix="/solve", tags=["Solve Questions"])


@router.post("", response_model=ApiResponse[UnifiedSolveResponse], status_code=status.HTTP_200_OK)
async def solve_question(
    payload: UnifiedSolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UnifiedSolveResponse]:
    """Solve math/logic problems, generate summaries, or explain educational questions automatically."""
    result = await unified_solver_service.solve_question(
        db=db,
        user_id=current_user.id,
        data=payload,
    )
    return ApiResponse(data=result, request_id=request_id)


@router.post("/upload", response_model=ApiResponse[UnifiedSolveResponse], status_code=status.HTTP_200_OK)
async def upload_and_solve_question(
    file: UploadFile = File(...),
    input_text: Optional[str] = Form(None),
    preferred_style: Optional[str] = Form("exam_notes"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UnifiedSolveResponse]:
    """Upload an image (notes, equation, diagram, problem) and solve/summarize it immediately."""
    file_bytes = await file.read()
    upload_result = await image_service.upload_image(
        db=db,
        user_id=current_user.id,
        file_bytes=file_bytes,
        filename=file.filename or "uploaded_problem.png",
        client_mime=file.content_type,
        process_synchronously=True,
    )

    if not upload_result.extracted_content:
        if upload_result.job.error_code == "PROVIDER_RATE_LIMITED":
            raise AppException(
                status_code=429,
                code="PROVIDER_RATE_LIMITED",
                message="Image analysis reached the provider's rate or quota limit. Try again later.",
            )
        if upload_result.job.error_code == "IMAGE_TRANSCRIPTION_TOO_LONG":
            raise AppException(
                status_code=422,
                code="IMAGE_TRANSCRIPTION_TOO_LONG",
                message=upload_result.job.error_message or "Crop the page into smaller sections and try again.",
            )
        raise AppException(
            status_code=502,
            code="IMAGE_EXTRACTION_FAILED",
            message="Image analysis failed. Check the vision provider configuration or try again shortly.",
        )
    solve_req = UnifiedSolveRequest(
        input_text=input_text,
        source_content_id=upload_result.extracted_content.id,
        preferred_style=preferred_style,
    )
    result = await unified_solver_service.solve_question(
        db=db,
        user_id=current_user.id,
        data=solve_req,
    )
    return ApiResponse(data=result, request_id=request_id)


@router.post("/follow-up", response_model=ApiResponse[UnifiedFollowUpResponse], status_code=status.HTTP_200_OK)
async def ask_solve_follow_up(
    payload: UnifiedFollowUpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UnifiedFollowUpResponse]:
    """Ask a follow-up question within an existing solved question conversation."""
    result = await unified_solver_service.ask_follow_up(
        db=db,
        user_id=current_user.id,
        data=payload,
    )
    return ApiResponse(data=result, request_id=request_id)

