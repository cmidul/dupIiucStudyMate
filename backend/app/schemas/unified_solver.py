"""Pydantic schemas for the unified 'Solve Questions' feature.

Integrates mathematical solving, logical reasoning, summarization, and
general educational question-answering under a single contract.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.solver import LogicSolveResponse, MathSolveResponse
from app.schemas.summary import SummaryResponse


class TaskType(str, Enum):
    """Detected task classification for unified solving."""
    MATHEMATICS = "mathematics"
    LOGICAL_REASONING = "logical_reasoning"
    SUMMARIZATION = "summarization"
    GENERAL_EDUCATIONAL = "general_educational"


class EducationalConcept(BaseModel):
    """Concept explanation item for general educational questions."""
    concept: str
    explanation: str


class EducationalStep(BaseModel):
    """Step-by-step point for educational explanations."""
    step: int
    title: str
    explanation: str


class EducationalSolution(BaseModel):
    """Structured solution for general educational questions."""
    subject: str = "General"
    topic: str = "Educational Topic"
    steps: List[EducationalStep] = Field(default_factory=list)
    key_concepts: List[EducationalConcept] = Field(default_factory=list)
    conclusion: str
    takeaways: List[str] = Field(default_factory=list)


class UnifiedSolveRequest(BaseModel):
    """Request payload for the unified Solve Questions feature."""
    input_text: Optional[str] = Field(
        None,
        max_length=8000,
        description="Text-based problem, question, mathematical expression, or passage to summarize",
    )
    source_content_id: Optional[str] = Field(
        None,
        description="Optional ID of extracted image content or document",
    )
    conversation_id: Optional[str] = Field(
        None,
        description="Optional conversation ID to link solution and support follow-ups",
    )
    preferred_style: Optional[str] = Field(
        "exam_notes",
        description="Preferred summarization style if the input is a passage ('short', 'detailed', 'exam_notes')",
    )
    domain: Optional[str] = Field(
        "real",
        description="Mathematical domain ('real' or 'complex')",
    )


class UnifiedSolveResponse(BaseModel):
    """Unified response envelope returned by the Solve Questions feature."""
    task_type: TaskType
    task_label: str
    title: str
    summary_or_answer: str
    confidence: float = 1.0
    conversation_id: str
    source_content_id: Optional[str] = None

    # Dedicated structured payload based on task_type
    math_solution: Optional[MathSolveResponse] = None
    logic_solution: Optional[LogicSolveResponse] = None
    summary_solution: Optional[SummaryResponse] = None
    educational_solution: Optional[EducationalSolution] = None

    # Clarification if input is ambiguous
    clarification_needed: bool = False
    clarification_question: Optional[str] = None


class UnifiedFollowUpRequest(BaseModel):
    """Request for asking follow-up questions within a solved context."""
    conversation_id: str = Field(..., description="Target conversation ID")
    message: str = Field(..., min_length=1, max_length=4000, description="Follow-up question")
    source_content_id: Optional[str] = Field(None, description="Optional attached source content ID")


class UnifiedFollowUpResponse(BaseModel):
    """Response to a follow-up question."""
    conversation_id: str
    user_message: str
    assistant_message: str
    topic_metadata: Optional[Dict[str, Any]] = None

