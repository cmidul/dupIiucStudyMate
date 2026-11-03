"""AI provider configuration and connection health check endpoint."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.api.deps import get_request_id
from app.ai.router import ai_router
from app.core.config import settings
from app.core.responses import ApiResponse, AppException

router = APIRouter(prefix="/ai", tags=["AI Settings"])


class AIConfigRequest(BaseModel):
    provider: str = Field(..., description="Provider name: gemini, groq, or mock")
    api_key: Optional[str] = Field(None, description="API key to configure for the provider")


@router.get("/status", response_model=ApiResponse[Dict[str, Any]])
async def get_ai_status(request_id: str = Depends(get_request_id)) -> ApiResponse[Dict[str, Any]]:
    gemini_provider = ai_router.get_provider("gemini")
    groq_provider = ai_router.get_provider("groq")

    has_gemini = bool(gemini_provider and getattr(gemini_provider, "_api_key", None))
    has_groq = bool(groq_provider and getattr(groq_provider, "_api_key", None))

    return ApiResponse(
        data={
            "active_provider": settings.AI_DEFAULT_PROVIDER,
            "providers": {
                "mock": {
                    "name": "Mock Engine",
                    "status": "active" if settings.AI_DEFAULT_PROVIDER == "mock" else "available",
                    "configured": True,
                    "description": "Deterministic offline educational models for instant local testing",
                },
                "gemini": {
                    "name": "Google Gemini",
                    "status": "active" if settings.AI_DEFAULT_PROVIDER == "gemini" else ("configured" if has_gemini else "unconfigured"),
                    "configured": has_gemini,
                    "model": settings.AI_MODEL_TEXT,
                    "vision_model": settings.AI_MODEL_VISION,
                    "description": "Live multimodal reasoning via Gemini 2.0 Flash",
                },
                "groq": {
                    "name": "Groq Llama 3.3",
                    "status": "active" if settings.AI_DEFAULT_PROVIDER == "groq" else ("configured" if has_groq else "unconfigured"),
                    "configured": has_groq,
                    "model": settings.GROQ_MODEL_TEXT,
                    "description": "Ultra high-speed open-source inference",
                },
            },
        },
        request_id=request_id,
    )


@router.post("/configure", response_model=ApiResponse[Dict[str, Any]])
async def configure_ai_provider(
    payload: AIConfigRequest,
    request_id: str = Depends(get_request_id),
) -> ApiResponse[Dict[str, Any]]:
    provider_name = payload.provider.lower().strip()
    if provider_name not in ["mock", "gemini", "groq"]:
        raise AppException(
            status_code=400,
            code="INVALID_PROVIDER",
            message=f"Unsupported provider '{payload.provider}'. Must be 'gemini', 'groq', or 'mock'.",
        )

    if provider_name == "gemini":
        if payload.api_key and payload.api_key.strip():
            settings.GEMINI_API_KEY = payload.api_key.strip()
            p = ai_router.get_provider("gemini")
            if p:
                p._api_key = payload.api_key.strip()
        gemini_provider = ai_router.get_provider("gemini")
        if not gemini_provider or not getattr(gemini_provider, "_api_key", None):
            raise AppException(
                status_code=400,
                code="MISSING_API_KEY",
                message="Cannot activate Gemini without an API key. Please provide a valid GEMINI_API_KEY.",
            )
        settings.AI_DEFAULT_PROVIDER = "gemini"

    elif provider_name == "groq":
        if payload.api_key and payload.api_key.strip():
            settings.GROQ_API_KEY = payload.api_key.strip()
            p = ai_router.get_provider("groq")
            if p:
                p._api_key = payload.api_key.strip()
        groq_provider = ai_router.get_provider("groq")
        if not groq_provider or not getattr(groq_provider, "_api_key", None):
            raise AppException(
                status_code=400,
                code="MISSING_API_KEY",
                message="Cannot activate Groq without an API key. Please provide a valid GROQ_API_KEY.",
            )
        settings.AI_DEFAULT_PROVIDER = "groq"

    elif provider_name == "mock":
        settings.AI_DEFAULT_PROVIDER = "mock"

    return ApiResponse(
        data={
            "status": "success",
            "active_provider": settings.AI_DEFAULT_PROVIDER,
            "message": f"Successfully activated '{settings.AI_DEFAULT_PROVIDER}' as primary AI engine.",
        },
        request_id=request_id,
    )

