"""Aggregated API v1 router."""

from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.health import router as health_router
from app.api.v1.quizzes import router as quizzes_router
from app.api.v1.solvers import router as solvers_router
from app.api.v1.summaries import router as summaries_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(conversations_router)
api_v1_router.include_router(chat_router)
api_v1_router.include_router(summaries_router)
api_v1_router.include_router(quizzes_router)
api_v1_router.include_router(solvers_router)


