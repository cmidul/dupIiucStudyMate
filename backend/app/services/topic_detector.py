"""Topic and intent detection service (F-05).

Classifies user learning requests and identifies ambiguous inputs.
"""

import logging
from typing import List, Optional

from app.ai.router import ai_router
from app.ai.schemas import TextGenerationRequest, TopicDetectionSchema
from app.models.message import Message

logger = logging.getLogger("learning_assistant.topic_detector")

AMBIGUOUS_PHRASES = {
    "explain this",
    "explain this.",
    "what is this",
    "what is this?",
    "solve this",
    "solve this.",
    "summarize this",
    "summarize this.",
}


class TopicDetector:
    """Service detecting subject, topic, and intent from user inputs."""

    async def detect_topic_and_intent(
        self,
        message: str,
        recent_messages: Optional[List[Message]] = None,
    ) -> TopicDetectionSchema:
        """Classify message intent and educational topic with ambiguity detection."""
        cleaned = message.strip().lower()

        # Check for ambiguous standalone questions without preceding context (CHAT-003)
        has_prior_context = bool(recent_messages and len(recent_messages) > 0)
        if cleaned in AMBIGUOUS_PHRASES and not has_prior_context:
            return TopicDetectionSchema(
                subject="General",
                topic="Unknown",
                subtopic=None,
                difficulty="unknown",
                input_type="text",
                intent="unknown",
                confidence=0.1,
                needs_clarification=True,
                clarification_question="What specific concept, problem, or topic would you like me to explain?",
            )

        context_summary = ""
        if recent_messages:
            history_lines = [f"{m.role}: {m.content[:150]}" for m in recent_messages[-3:]]
            context_summary = f"\nRecent conversation context:\n" + "\n".join(history_lines)

        prompt = (
            f"Classify the following educational user request into subject, topic, subtopic, "
            f"difficulty, and intent.{context_summary}\n\n"
            f"User message: {message}\n"
            f"Output strictly matching the required JSON schema."
        )

        system_prompt = (
            "You are an educational intent and topic classifier. Categorize the user request accurately. "
            "Allowed difficulty: beginner, intermediate, advanced, unknown. "
            "Allowed intents: general_question, summarize, generate_quiz, math_solve, logic_solve, follow_up, unknown. "
            "If uncertain, use unknown and lower confidence."
        )

        req = TextGenerationRequest(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.1,
            response_schema=TopicDetectionSchema,
        )

        try:
            res = await ai_router.generate_text(req)
            if res.structured_data:
                parsed = TopicDetectionSchema.model_validate(res.structured_data)
                self._normalize_schema(parsed)
                return parsed
        except Exception as exc:
            logger.warning(f"AI topic detection failed: {exc}. Using heuristic fallback.")

        # Heuristic fallback if provider is unavailable or fails
        return self._heuristic_fallback(message)

    def _normalize_schema(self, schema: TopicDetectionSchema) -> None:
        """Ensure enums and confidence bounds are strictly enforced (TOPIC-001)."""
        allowed_diff = {"beginner", "intermediate", "advanced", "unknown"}
        if schema.difficulty.lower() not in allowed_diff:
            schema.difficulty = "unknown"
        else:
            schema.difficulty = schema.difficulty.lower()

        allowed_intents = {
            "general_question",
            "summarize",
            "generate_quiz",
            "math_solve",
            "logic_solve",
            "follow_up",
            "unknown",
        }
        if schema.intent.lower() not in allowed_intents:
            schema.intent = "unknown"
        else:
            schema.intent = schema.intent.lower()

        schema.confidence = max(0.0, min(1.0, float(schema.confidence)))

        # Handle low confidence (TOPIC-002)
        if schema.confidence < 0.4 and not schema.needs_clarification:
            schema.needs_clarification = True
            schema.clarification_question = f"Could you provide more details about what you want to learn?"

    def _heuristic_fallback(self, message: str) -> TopicDetectionSchema:
        """Heuristic classification when AI provider is offline."""
        lowered = message.lower()
        if any(w in lowered for w in ["summary", "summarize", "recap"]):
            intent = "summarize"
        elif any(w in lowered for w in ["quiz", "test me", "mcq"]):
            intent = "generate_quiz"
        elif any(w in lowered for w in ["solve", "equation", "calculate", "x^2"]):
            intent = "math_solve"
        elif any(w in lowered for w in ["if all", "syllogism", "logic"]):
            intent = "logic_solve"
        else:
            intent = "general_question"

        return TopicDetectionSchema(
            subject="General",
            topic="General Learning",
            difficulty="intermediate",
            input_type="text",
            intent=intent,
            confidence=0.6,
        )


topic_detector = TopicDetector()

