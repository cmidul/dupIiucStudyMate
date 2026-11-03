"""Pydantic schemas for quiz generation, safe delivery without answer keys, and attempt grading."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ai.schemas import QuizOption


class QuizGenerateRequest(BaseModel):
    """User request to generate an MCQ quiz."""
    topic: Optional[str] = Field(None, description="Topic name to generate quiz for")
    source_text: Optional[str] = Field(None, description="Source notes or material text")
    source_content_id: Optional[str] = Field(None, description="Optional extracted source ID")
    question_count: int = Field(5, ge=1, le=20, description="Number of questions (1-20)")
    difficulty: str = Field("beginner", description="Difficulty level: beginner, intermediate, advanced")
    question_type: str = Field("mcq", description="Question format (mcq in MVP)")

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        allowed = {"beginner", "intermediate", "advanced"}
        cleaned = v.lower().strip()
        if cleaned not in allowed:
            raise ValueError(f"Invalid difficulty '{v}'. Allowed: {', '.join(sorted(allowed))}")
        return cleaned


# SAFE DELIVERY SCHEMAS (Answer key strictly omitted before submission)


class QuizQuestionDelivery(BaseModel):
    """Safe question DTO sent to client before submission. NEVER contains correct option or explanation."""
    id: str
    question_order: int
    question: str
    options: List[QuizOption]


class QuizDeliveryResponse(BaseModel):
    """Public quiz representation for taking the quiz."""
    id: str
    user_id: str
    title: str
    topic: str
    difficulty: str
    question_type: str
    questions: List[QuizQuestionDelivery]
    created_at: datetime


class QuizListItemResponse(BaseModel):
    """Summary item for quiz listing."""
    id: str
    user_id: str
    title: str
    topic: str
    difficulty: str
    question_type: str
    question_count: int
    created_at: datetime


# ATTEMPT & GRADING SCHEMAS


class AnswerSubmission(BaseModel):
    """User answer for a single question."""
    question_id: str
    selected_option_id: str


class QuizAttemptSubmitRequest(BaseModel):
    """Submission payload containing user choices."""
    answers: List[AnswerSubmission] = Field(..., description="List of chosen options")


class QuestionReview(BaseModel):
    """Review item returned AFTER submission with correct answer and explanation."""
    question_id: str
    question: str
    options: List[QuizOption]
    selected_option_id: Optional[str]
    correct_option_id: str
    is_correct: bool
    explanation: str


class QuizAttemptResponse(BaseModel):
    """Final graded quiz attempt."""
    id: str
    quiz_id: str
    user_id: str
    score: int
    total_questions: int
    percentage: float
    reviews: List[QuestionReview]
    created_at: datetime

