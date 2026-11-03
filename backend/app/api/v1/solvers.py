"""Solvers API endpoints for Math and Logic problems (F-08, F-09)."""

from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, get_request_id
from app.core.responses import ApiResponse
from app.models.user import User
from app.schemas.solver import (
    LogicSolveRequest,
    LogicSolveResponse,
    MathSolveRequest,
    MathSolveResponse,
)
from app.services.logic_solver import logic_solver_service
from app.services.math_solver import math_solver_service

router = APIRouter(prefix="/solvers", tags=["Solvers"])


@router.post("/math", response_model=ApiResponse[MathSolveResponse], status_code=status.HTTP_200_OK)
async def solve_math_problem(
    payload: MathSolveRequest,
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[MathSolveResponse]:
    """Solve mathematical problem with deterministic SymPy verification and AI step explanation."""
    result = await math_solver_service.solve(payload)
    return ApiResponse(data=result, request_id=request_id)


@router.post("/logic", response_model=ApiResponse[LogicSolveResponse], status_code=status.HTTP_200_OK)
async def solve_logic_problem(
    payload: LogicSolveRequest,
    current_user: User = Depends(get_current_user),
    request_id: str = Depends(get_request_id),
) -> ApiResponse[LogicSolveResponse]:
    """Solve logical reasoning question with truth-table evaluation or deductive inference."""
    result = await logic_solver_service.solve(payload)
    return ApiResponse(data=result, request_id=request_id)

