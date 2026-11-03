"""Deterministic Mock AI Provider for testing and offline development.

Allows controlled simulation of success, rate limits, timeouts, and malformed outputs.
"""

import json
from typing import Any, Dict, Optional, Set
from pydantic import BaseModel

from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AIAuthenticationError,
    AIRateLimitError,
    AITimeoutError,
)
from app.ai.schemas import (
    AICapability,
    ExtractedContentSchema,
    ImageAnalysisRequest,
    ImageAnalysisResponse,
    KeyConcept,
    KeyTerm,
    LogicSolutionSchema,
    MathSolutionSchema,
    MathStep,
    MathVerification,
    QuizOption,
    QuizQuestionSchema,
    QuizSchema,
    SummarySchema,
    SummarySection,
    TextGenerationRequest,
    TextGenerationResponse,
    TopicDetectionSchema,
    VisualElement,
)


class MockAIProvider(BaseAIProvider):
    """In-memory deterministic provider adapter."""

    name = "mock"
    default_text_model = "mock-text-v1"
    default_vision_model = "mock-vision-v1"
    supported_capabilities: Set[AICapability] = {
        AICapability.TEXT,
        AICapability.VISION,
        AICapability.REASONING,
    }

    def __init__(
        self,
        simulate_rate_limit: bool = False,
        simulate_timeout: bool = False,
        simulate_auth_error: bool = False,
        simulate_malformed_json: bool = False,
        custom_response: Optional[str] = None,
    ):
        self.simulate_rate_limit = simulate_rate_limit
        self.simulate_timeout = simulate_timeout
        self.simulate_auth_error = simulate_auth_error
        self.simulate_malformed_json = simulate_malformed_json
        self.custom_response = custom_response

    def _check_simulated_errors(self) -> None:
        if self.simulate_auth_error:
            raise AIAuthenticationError(provider_name=self.name)
        if self.simulate_rate_limit:
            raise AIRateLimitError()
        if self.simulate_timeout:
            raise AITimeoutError()

    async def generate_text(self, request: TextGenerationRequest) -> TextGenerationResponse:
        self._check_simulated_errors()

        if self.custom_response:
            content = self.custom_response
        elif self.simulate_malformed_json:
            content = '{"invalid_json": true, missing_brace'
        elif request.response_schema:
            content = self._generate_default_schema_response(request.response_schema, request.prompt)
        else:
            content = f"Mock AI answer for prompt: {request.prompt[:100]}"

        structured_data = None
        if request.response_schema:
            structured_data = self.parse_and_validate_json(content, request.response_schema)

        return TextGenerationResponse(
            content=content,
            provider=self.name,
            model=self.default_text_model,
            tokens_used=42,
            structured_data=structured_data,
        )

    async def analyze_image(self, request: ImageAnalysisRequest) -> ImageAnalysisResponse:
        self._check_simulated_errors()

        if self.custom_response:
            content = self.custom_response
        elif self.simulate_malformed_json:
            content = '{"broken": [true,'
        elif request.response_schema:
            content = self._generate_default_schema_response(request.response_schema, request.prompt or "analyze")
        else:
            content = "Mock image analysis: Diagram showing Neural Network with input, hidden, and output layers."

        structured_data = None
        if request.response_schema:
            structured_data = self.parse_and_validate_json(content, request.response_schema)

        return ImageAnalysisResponse(
            content=content,
            provider=self.name,
            model=self.default_vision_model,
            tokens_used=88,
            structured_data=structured_data,
        )

    def _generate_default_schema_response(self, schema: Any, prompt: str) -> str:
        """Produce predictable JSON string corresponding to target schema."""
        prompt_lower = (prompt or "").lower()

        if schema is TopicDetectionSchema:
            obj = TopicDetectionSchema(
                subject="Computer Science",
                topic="Data Structures",
                subtopic="Binary Search Tree",
                difficulty="beginner",
                input_type="text",
                intent="general_question",
                confidence=0.96,
            )
            return obj.model_dump_json()

        if schema is SummarySchema:
            obj = SummarySchema(
                title="Binary Search Tree Notes",
                topic="Data Structures",
                style="exam_notes",
                overview="A binary search tree is an ordered node-based binary tree data structure.",
                sections=[
                    SummarySection(
                        heading="Core Properties",
                        points=[
                            "Left subtree holds smaller values.",
                            "Right subtree holds larger values.",
                        ],
                    )
                ],
                key_terms=[
                    KeyTerm(term="BST", definition="Binary Search Tree"),
                    KeyTerm(term="Root", definition="Topmost node in a tree hierarchy"),
                ],
                revision_points=["Remember ordering invariants."],
            )
            return obj.model_dump_json()

        if schema is QuizSchema:
            obj = QuizSchema(
                title="Binary Search Tree Quick Quiz",
                topic="Data Structures",
                difficulty="beginner",
                question_type="mcq",
                questions=[
                    QuizQuestionSchema(
                        id="q1",
                        question="Which property defines a Binary Search Tree?",
                        options=[
                            QuizOption(id="A", text="Left is smaller, right is larger"),
                            QuizOption(id="B", text="All nodes have exactly 3 children"),
                            QuizOption(id="C", text="Values are arranged randomly"),
                            QuizOption(id="D", text="Only leaf nodes store integers"),
                        ],
                        correct_option_id="A",
                        explanation="In a BST, values in left subtree are smaller and right subtree are larger.",
                    ),
                    QuizQuestionSchema(
                        id="q2",
                        question="What is the average time complexity of searching in a balanced BST?",
                        options=[
                            QuizOption(id="A", text="O(1)"),
                            QuizOption(id="B", text="O(log n)"),
                            QuizOption(id="C", text="O(n^2)"),
                            QuizOption(id="D", text="O(n!)"),
                        ],
                        correct_option_id="B",
                        explanation="Balanced BST operations divide search space in half at each step: O(log n).",
                    ),
                ],
            )
            return obj.model_dump_json()

        if schema is MathSolutionSchema:
            obj = MathSolutionSchema(
                problem="x^2 - 5x + 6 = 0",
                category="quadratic_equation",
                status="solved",
                steps=[
                    MathStep(step=1, explanation="Factor the quadratic expression", expression="(x - 2)(x - 3) = 0"),
                    MathStep(step=2, explanation="Solve each factor", expression="x = 2 or x = 3"),
                ],
                final_answer="x = 2 or x = 3",
                verification=MathVerification(performed=True, status="passed", method="sympy"),
            )
            return obj.model_dump_json()

        if schema is LogicSolutionSchema:
            obj = LogicSolutionSchema(
                problem="All A are B. All B are C. Are all A also C?",
                category="deductive_reasoning",
                status="solved",
                reasoning_steps=[
                    "Every element in set A is contained within set B.",
                    "Every element in set B is contained within set C.",
                    "By transitive property of set inclusion, every element in set A is in set C.",
                ],
                final_answer="Yes.",
                assumptions=[],
                confidence=0.99,
            )
            return obj.model_dump_json()

        if schema is ExtractedContentSchema:
            obj = ExtractedContentSchema(
                title="Lecture Notes on Neural Networks",
                subject="Computer Science",
                topic="Artificial Intelligence",
                subtopics=["Neural Networks", "Activation Functions"],
                extracted_text="A neural network is composed of layers of artificial neurons.",
                key_concepts=[
                    KeyConcept(name="Neuron", description="A computational node with weighted inputs and bias."),
                ],
                equations=["y = f(W*x + b)"],
                visual_elements=[
                    VisualElement(type="diagram", description="Layer architecture with 3 inputs, 4 hidden nodes, 1 output."),
                ],
                uncertainties=[],
                language="en",
            )
            return obj.model_dump_json()

        # Fallback to an empty instance of the requested BaseModel
        try:
            return schema().model_dump_json()
        except Exception:
            return "{}"
