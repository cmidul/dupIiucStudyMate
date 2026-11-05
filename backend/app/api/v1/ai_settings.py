"""AI provider configuration and connection health check endpoint."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.api.deps import get_request_id
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.groq import GroqProvider
from app.ai.router import ai_router
from app.ai.schemas import TextGenerationRequest
from app.core.config import settings
from app.core.responses import ApiResponse, AppException

router = APIRouter(prefix="/ai", tags=["AI Settings"])


class AIConfigRequest(BaseModel):
    provider: str = Field(..., description="Provider name: gemini, groq, or mock")
    api_key: Optional[str] = Field(None, description="API key to configure for the provider")


@router.get("/status", response_model=ApiResponse[Dict[str, Any]])
async def get_ai_status(request_id: str = Depends(get_request_id)) -> ApiResponse[Dict[str, Any]]:
    has_gemini = settings.is_gemini_configured
    has_groq = settings.is_groq_configured

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
                    "description": "Live text and image analysis",
                },
                "groq": {
                    "name": "Groq",
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

    if provider_name == "mock" or settings.is_production:
        raise AppException(
            status_code=403,
            code="SERVER_CONFIG_REQUIRED",
            message="Set the AI provider in the backend environment and restart the backend.",
        )

    key = (payload.api_key or "").strip() or None
    provider = GeminiProvider(api_key=key) if provider_name == "gemini" else GroqProvider(api_key=key)
    # Verify the selected adapter directly so another provider cannot mask a failure.
    await provider.generate_text(TextGenerationRequest(prompt="Reply with OK.", max_tokens=1024))
    if key:
        if provider_name == "gemini":
            settings.GEMINI_API_KEY = key
        else:
            settings.GROQ_API_KEY = key
    ai_router.register_provider(provider)
    settings.AI_DEFAULT_PROVIDER = provider_name

    return ApiResponse(
        data={
            "status": "success",
            "active_provider": settings.AI_DEFAULT_PROVIDER,
            "message": f"Successfully activated '{settings.AI_DEFAULT_PROVIDER}' as primary AI engine.",
        },
        request_id=request_id,
    )

