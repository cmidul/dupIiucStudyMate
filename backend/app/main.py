"""FastAPI application entrypoint for AI Learning Assistant.

Provides centralized middleware, exception handling, and API routing.
"""

from contextlib import asynccontextmanager
import logging
import uuid
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import init_db
from app.core.logging_config import setup_safe_logging
from app.core.rate_limit import rate_limiter
from app.core.responses import AppException
from app.core.security import decode_access_token

# Setup safe logging filter (masks passwords, secrets, tokens)
setup_safe_logging()

# Setup logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s",
)
logger = logging.getLogger("learning_assistant")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode")
    # Initialize database tables for local dev / tests
    await init_db()
    yield
    logger.info("Shutting down AI Learning Assistant")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multimodal AI Learning Assistant Backend API",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.is_production else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Ensure every request has a unique request_id in request.state and response headers."""
    incoming_id = request.headers.get("X-Request-ID")
    request_id = incoming_id.strip() if incoming_id and incoming_id.strip() else str(uuid.uuid4())
    request.state.request_id = request_id

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add defensive browser security headers to every response (F-18, SEC-008)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    """Enforce token bucket / sliding window rate limits per user/IP (F-17, SEC-001)."""
    if not settings.RATE_LIMIT_ENABLED:
        return await call_next(request)

    path = request.url.path
    if path in ("/health", "/api/v1/health", "/docs", "/redoc", "/openapi.json"):
        return await call_next(request)

    # Resolve rate limit key
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split("Bearer ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]
    elif "access_token" in request.cookies:
        payload = decode_access_token(request.cookies.get("access_token"))
        if payload and "sub" in payload:
            user_id = payload["sub"]

    if not user_id:
        tg_uid = request.headers.get("X-Telegram-User-Id")
        if tg_uid and tg_uid.strip():
            user_id = f"tg_{tg_uid.strip()}"

    key = f"user:{user_id}" if user_id else f"ip:{request.client.host if request.client else 'unknown'}"
    is_limited, remaining, retry_after = rate_limiter.record_request(
        key=key,
        limit=settings.RATE_LIMIT_REQUESTS_PER_MINUTE,
    )

    if is_limited:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please slow down and try again later.",
                    "details": {"retry_after_seconds": round(retry_after, 1)},
                },
                "request_id": request_id,
            },
            headers={
                "Retry-After": str(int(retry_after) + 1),
                "X-RateLimit-Limit": str(settings.RATE_LIMIT_REQUESTS_PER_MINUTE),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS_PER_MINUTE)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response


# Centralized Exception Handlers (Mandatory: never return stack traces or raw secrets)


@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException) -> JSONResponse:
    """Handle custom application exceptions with structured error envelopes."""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic schema validation errors safely."""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        errors.append(f"{loc}: {err.get('msg')}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": "INVALID_INPUT",
                "message": "The submitted request failed schema validation.",
                "details": {"validation_errors": errors},
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle standard HTTP exceptions with unified error envelopes."""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    code_map = {
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
    }
    code = code_map.get(exc.status_code, "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail),
            },
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def handle_generic_exception(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for unhandled exceptions (masks internals)."""
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.exception(f"Unhandled server error [request_id={request_id}]: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred while processing your request.",
            },
            "request_id": request_id,
        },
    )


# Include API Routers
app.include_router(api_v1_router)


# Root alias health route
@app.get("/health", include_in_schema=False)
async def root_health(request: Request):
    """Direct root health endpoint alias."""
    from app.api.v1.health import health_check

    return await health_check(request_id=getattr(request.state, "request_id", str(uuid.uuid4())))
