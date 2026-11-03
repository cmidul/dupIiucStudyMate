"""Pydantic schemas for Math and Logic Solver requests and responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.ai.schemas import MathStep, MathVerification


class MathSolveRequest(BaseModel):
    """Request to solve a mathematical problem."""
    problem: str = Field(..., min_length=1, max_length=500, description="Mathematical expression or equation")
    domain: str = Field("real", description="Mathematical domain: 'real' or 'complex'")
    source_content_id: Optional[str] = Field(None, description="Optional ID of extracted image source")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID to link explanation")


class MathSolveResponse(BaseModel):
    """Result of solving and verifying a mathematical problem."""
    problem: str
    category: str
    status: str  # solved, ambiguous, unsupported, error
    steps: List[MathStep] = Field(default_factory=list)
    final_answer: str
    verification: MathVerification
    clarification_needed: bool = False
    clarification_question: Optional[str] = None


class LogicSolveRequest(BaseModel):
    """Request to solve a logical reasoning or truth table problem."""
    problem: str = Field(..., min_length=1, max_length=1000, description="Logical problem or propositional expression")
    category: Optional[str] = Field(None, description="deductive_reasoning, truth_table, syllogism, sequence")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID to link explanation")


class TruthTableRow(BaseModel):
    """Single row in a propositional truth table."""
    assignment: Dict[str, bool]
    result: bool


class TruthTableData(BaseModel):
    """Deterministic truth table data."""
    variables: List[str]
    rows: List[TruthTableRow]
    classification: str  # tautology, contradiction, contingent


class LogicSolveResponse(BaseModel):
    """Result of logical reasoning solving."""
    problem: str
    category: str
    status: str  # solved, invalid_argument, ambiguous, unsupported
    reasoning_steps: List[str] = Field(default_factory=list)
    final_answer: str
    assumptions: List[str] = Field(default_factory=list)
    confidence: float = 0.95
    truth_table: Optional[TruthTableData] = None
    clarification_needed: bool = False
    clarification_question: Optional[str] = None

