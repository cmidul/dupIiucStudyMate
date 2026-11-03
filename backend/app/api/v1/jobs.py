"""Background jobs API endpoints (JOB-001..007)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_request_id
from app.core.database import get_db
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.upload import BackgroundJobResponse
from app.services.job_service import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/{job_id}", response_model=ApiResponse[BackgroundJobResponse])
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[BackgroundJobResponse]:
    """Inspect background job status and results (strictly scoped to owner)."""
    job = await job_service.get_job(
        db=db,
        job_id=job_id,
        user_id=current_user.id,
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Background job not found or access denied.",
        )
    return ApiResponse(data=job, request_id=request_id)

