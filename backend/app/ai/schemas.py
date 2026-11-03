"""AI Provider and Router request/response schemas.

Defines the normalized internal representation for AI inputs and outputs.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T", bound=BaseModel)


class AICapability(str, Enum):
    """Capabilities supported by providers/models."""
    TEXT = "text"
    VISION = "vision"
    REASONING = "reasoning"


class TextGenerationRequest(BaseModel):
    """Input request for text and reasoning models."""
    prompt: str = Field(..., min_length=1, description="User instruction or prompt")
    system_prompt: Optional[str] = Field(None, description="System boundary instructions")
    temperature: float = Field(0.2, ge=0.0, le=1.0, description="Sampling temperature")
    max_tokens: int = Field(2048, ge=64, le=8192, description="Maximum completion tokens")
    response_schema: Optional[Type[BaseModel]] = Field(None, description="Pydantic model for structured output")


class TextGenerationResponse(BaseModel):
    """Normalized response from text generation."""
    content: str = Field(..., description="Generated text content")
    provider: str = Field(..., description="Provider that generated this response")
    model: str = Field(..., description="Model identifier used")
    tokens_used: Optional[int] = Field(None, description="Reported token usage if available")
    structured_data: Optional[Dict[str, Any]] = Field(None, description="Validated parsed data if schema requested")


class ImageAnalysisRequest(BaseModel):
    """Input request for vision models."""
    image_bytes: bytes = Field(..., description="Raw image binary data")
    mime_type: str = Field("image/jpeg", description="MIME type: image/jpeg, image/png, image/webp")
    prompt: Optional[str] = Field(None, description="Specific extraction or analysis question")
    system_prompt: Optional[str] = Field(None, description="Vision system instructions")
    response_schema: Optional[Type[BaseModel]] = Field(None, description="Pydantic model for structured extraction")


class ImageAnalysisResponse(BaseModel):
    """Normalized response from image analysis."""
    content: str = Field(..., description="Markdown or text explanation of the image")
    provider: str = Field(..., description="Provider that analyzed this image")
    model: str = Field(..., description="Vision model identifier used")
    tokens_used: Optional[int] = Field(None, description="Reported token usage if available")
    structured_data: Optional[Dict[str, Any]] = Field(None, description="Parsed structured context if schema requested")


# Core domain contracts from feature.md


class KeyConcept(BaseModel):
    """A key concept extracted from learning material."""
    name: str
    description: str


class VisualElement(BaseModel):
    """Diagram or illustration description."""
    type: str  # diagram, chart, flowchart, table
    description: str


class ExtractedContentSchema(BaseModel):
    """F-04 baseline contract for image extraction."""
    title: str = "Extracted Material"
    subject: str = "General"
    topic: str = "General"
    subtopics: List[str] = Field(default_factory=list)
    extracted_text: str = ""
    key_concepts: List[KeyConcept] = Field(default_factory=list)
    equations: List[str] = Field(default_factory=list)
    visual_elements: List[VisualElement] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    language: str = "en"


class TopicDetectionSchema(BaseModel):
    """F-05 baseline contract for topic & intent detection."""
    subject: str = "General"
    topic: str = "General"
    subtopic: Optional[str] = None
    difficulty: str = "intermediate"  # beginner, intermediate, advanced, unknown
    input_type: str = "text"  # text, image, document
    intent: str = "general_question"  # general_question, summarize, generate_quiz, math_solve, logic_solve, follow_up, unknown
    confidence: float = Field(0.9, ge=0.0, le=1.0)
    needs_clarification: bool = False
    clarification_question: Optional[str] = None


class SummarySection(BaseModel):
    """Structured section within a summary."""
    heading: str
    points: List[str]


class KeyTerm(BaseModel):
    """Definition item in a summary."""
    term: str
    definition: str


class SummarySchema(BaseModel):
    """F-06 baseline contract for structured summaries."""
    title: str
    topic: str
    style: str  # short, detailed, exam_notes
    overview: str
    sections: List[SummarySection] = Field(default_factory=list)
    key_terms: List[KeyTerm] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    formulas: List[str] = Field(default_factory=list)
    revision_points: List[str] = Field(default_factory=list)


class QuizOption(BaseModel):
    """Option in an MCQ question."""
    id: str  # "A", "B", "C", "D"
    text: str


class QuizQuestionSchema(BaseModel):
    """Single question in a generated quiz."""
    id: str
    question: str
    options: List[QuizOption]
    correct_option_id: str
    explanation: str


class QuizSchema(BaseModel):
    """F-07 baseline contract for quiz generation."""
    title: str
    topic: str
    difficulty: str  # beginner, intermediate, advanced
    question_type: str = "mcq"
    questions: List[QuizQuestionSchema]


class MathStep(BaseModel):
    """Individual step in a mathematical solution."""
    step: int
    explanation: str
    expression: str


class MathVerification(BaseModel):
    """Deterministic verification result."""
    performed: bool = True
    status: str = "passed"  # passed, failed, not_available, ambiguous
    method: str = "sympy"


class MathSolutionSchema(BaseModel):
    """F-08 baseline contract for math problem solving."""
    problem: str
    category: str
    status: str = "solved"
    steps: List[MathStep]
    final_answer: str
    verification: MathVerification


class LogicSolutionSchema(BaseModel):
    """F-09 baseline contract for logical reasoning solving."""
    problem: str
    category: str
    status: str = "solved"
    reasoning_steps: List[str]
    final_answer: str
    assumptions: List[str] = Field(default_factory=list)
    confidence: float = Field(0.95, ge=0.0, le=1.0)

