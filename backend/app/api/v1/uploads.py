"""Image and document upload endpoints (F-04)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.upload import (
    ExtractedContentResponse,
    ImageUploadResult,
    UploadedFileResponse,
)
from app.services.image_service import image_service

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/image", response_model=ApiResponse[ImageUploadResult], status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    process_now: bool = Form(True, description="Process image synchronously or queue in background"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[ImageUploadResult]:
    """Upload an educational image for validation, secure storage, and vision extraction."""
    file_bytes = await file.read()
    result = await image_service.upload_image(
        db=db,
        user_id=current_user.id,
        file_bytes=file_bytes,
        filename=file.filename or "uploaded_image.png",
        client_mime=file.content_type,
        process_synchronously=process_now,
    )
    return ApiResponse(data=result, request_id=request_id)


@router.get("/{file_id}", response_model=ApiResponse[UploadedFileResponse])
async def get_upload_metadata(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[UploadedFileResponse]:
    """Get metadata for an uploaded file (strictly scoped to owner)."""
    file_record = await image_service.get_uploaded_file(
        db=db,
        file_id=file_id,
        user_id=current_user.id,
    )
    return ApiResponse(data=file_record, request_id=request_id)


@router.get("/{file_id}/content", response_model=ApiResponse[ExtractedContentResponse])
async def get_extracted_content(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[ExtractedContentResponse]:
    """Get AI extracted content associated with an uploaded file."""
    content = await image_service.get_content_by_file_id(
        db=db,
        file_id=file_id,
        user_id=current_user.id,
    )
    return ApiResponse(data=content, request_id=request_id)


@router.delete("/{file_id}", response_model=ApiResponse[dict])
async def delete_upload(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[dict]:
    """Delete an uploaded file, private disk storage, and associated extracted content (SEC-007)."""
    await image_service.delete_uploaded_file(
        db=db,
        file_id=file_id,
        user_id=current_user.id,
    )
    return ApiResponse(data={"deleted": True, "file_id": file_id}, request_id=request_id)


@router.delete("/content/{content_id}", response_model=ApiResponse[dict])
async def delete_content(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[dict]:
    """Delete an extracted content record scoped to owner (SEC-007)."""
    await image_service.delete_extracted_content(
        db=db,
        content_id=content_id,
        user_id=current_user.id,
    )
    return ApiResponse(data={"deleted": True, "content_id": content_id}, request_id=request_id)

