"""Health check and service status endpoints."""

from typing import Any, Dict
from fastapi import APIRouter, Depends
from app.api.deps import get_request_id
from app.core.config import settings
from app.core.responses import ApiResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=ApiResponse[Dict[str, Any]])
async def health_check(request_id: str = Depends(get_request_id)) -> ApiResponse[Dict[str, Any]]:
    """Health status endpoint for uptime monitoring and container checks."""
    return ApiResponse(
        data={
            "status": "ok",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "ai_default_provider": settings.AI_DEFAULT_PROVIDER,
        },
        request_id=request_id,
    )

