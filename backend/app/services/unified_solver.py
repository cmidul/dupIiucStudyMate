"""Unified 'Solve Questions' Service.

Integrates mathematical problem solving, logical reasoning, summarization,
and educational question-answering into a single intelligent entry point.
Automatically classifies user input without requiring manual mode selection.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import ai_router
from app.ai.schemas import TextGenerationRequest
from app.core.quota import quota_manager
from app.core.responses import AppException
from app.models.conversation import Conversation
from app.models.upload import ExtractedContent
from app.repositories.chat_repo import chat_repo
from app.repositories.upload_repo import upload_repo
from app.schemas.chat import ChatMessageRequest
from app.schemas.solver import LogicSolveRequest, MathSolveRequest
from app.schemas.summary import SummaryGenerateRequest
from app.schemas.unified_solver import (
    EducationalConcept,
    EducationalSolution,
    EducationalStep,
    TaskType,
    UnifiedFollowUpRequest,
    UnifiedFollowUpResponse,
    UnifiedSolveRequest,
    UnifiedSolveResponse,
)
from app.services.chat_service import chat_service
from app.services.logic_solver import logic_solver_service
from app.services.math_solver import SafeMathParser, SafeMathSecurityError, math_solver_service
from app.services.summarizer import summarizer_service
from app.services.topic_detector import topic_detector

logger = logging.getLogger("learning_assistant.unified_solver")

MATH_SECURITY_PARSER = SafeMathParser()

AMBIGUOUS_PATTERNS = [
    re.compile(r"(?<![\w(])(\d+)\s*/\s*(\d+)\s*([a-zA-Z])(?![a-zA-Z])"),
]

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


class UnifiedSolverService:
    """Service providing automatic classification and solving for all educational inputs."""

    def classify_input(
        self,
        text: str,
        ext_content: Optional[ExtractedContent] = None,
    ) -> Tuple[TaskType, float, bool, Optional[str]]:
        """Classify user text or extracted content into the appropriate task type.
        
        Returns:
            Tuple of (TaskType, confidence, clarification_needed, clarification_question)
        """
        clean = text.strip()
        lowered = clean.lower()

        # 1. Security Check for malicious code execution (SEC-005)
        injection_patterns = [
            r"__",
            r"\b__import__\b",
            r"\beval\s*\(",
            r"\bexec\s*\(",
            r"\bsubprocess\b",
            r"\bglobals\s*\(",
            r"\blocals\s*\(",
            r"\bgetattr\s*\(",
            r"\bcompile\s*\(",
        ]
        for pattern in injection_patterns:
            if re.search(pattern, clean, re.IGNORECASE):
                raise AppException(
                    code="UNSAFE_EXPRESSION",
                    message=f"Input contains disallowed code execution token matching '{pattern}'.",
                    status_code=400,
                )

        # 2. Check for Ambiguous Expressions e.g. 1/2x without grouping
        for pattern in AMBIGUOUS_PATTERNS:
            match = pattern.search(clean)
            if match:
                num, den, var = match.groups()
                q = (
                    f"The expression '{match.group(0)}' is ambiguous. "
                    f"Did you mean '({num}/{den})*{var}' or '{num}/({den}*{var})'? "
                    f"Please clarify using parentheses."
                )
                return TaskType.MATHEMATICS, 0.4, True, q

        # Check for vague prompts without context
        if lowered in AMBIGUOUS_PHRASES and not ext_content:
            return (
                TaskType.GENERAL_EDUCATIONAL,
                0.2,
                True,
                "Could you please specify the exact question, problem, or passage you would like me to solve or explain?",
            )

        # 3. Check for Mathematical Problem
        # Indicators: Equation with equality, calculus terms, arithmetic operations with numbers, or image equations
        has_equation = bool(re.search(r"[a-zA-Z0-9_\(\)]+\s*=\s*[a-zA-Z0-9_\(\)]+", clean))
        has_calc_terms = any(term in lowered for term in [
            "diff(", "integrate(", "derivative of", "integral of", "evaluate",
            "x^2", "x**2", "sqrt(", "sin(", "cos(", "tan(", "log(", "ln("
        ])
        is_arithmetic = bool(re.search(r"^\s*\(?\s*\d+[\s\d\+\-\*\/\^\(\)\.]+\s*\)?\s*$", clean))
        parsed_eqs = []
        if ext_content and ext_content.equations:
            try:
                raw_eq = ext_content.equations
                parsed_eqs = json.loads(raw_eq) if isinstance(raw_eq, str) else raw_eq
            except Exception:
                parsed_eqs = []
        has_extracted_eq = bool(parsed_eqs and len(parsed_eqs) > 0)
        starts_with_math_solve = lowered.startswith("solve ") and any(c in clean for c in ["x", "y", "z", "+", "-", "*", "/", "="])

        if has_equation or has_calc_terms or is_arithmetic or has_extracted_eq or starts_with_math_solve:
            return TaskType.MATHEMATICS, 0.95, False, None

        # 4. Check for Logical Reasoning
        # Indicators: Truth tables, propositional logic keywords, syllogisms, sequences
        has_logic_keywords = any(kw in lowered for kw in [
            "truth table", "tautology", "contradiction", "valid argument",
            "syllogism", "barbara", "deductive reasoning", "premise 1", "premises:"
        ])
        has_prop_operators = any(op in clean for op in [" AND ", " OR ", " NOT ", " IMPLIES ", " <-> ", " -> "])
        has_syllogism_pattern = ("all " in lowered and " are " in lowered) or ("if all " in lowered)
        has_sequence_pattern = any(p in lowered for p in ["next number in", "sequence", "find the pattern"]) and any(c.isdigit() for c in clean)

        if has_logic_keywords or has_prop_operators or has_syllogism_pattern or has_sequence_pattern:
            return TaskType.LOGICAL_REASONING, 0.92, False, None

        # 5. Check for Summarization
        # Indicators: Explicit summarize keywords, or a substantial educational passage without a question mark
        has_summary_keyword = any(kw in lowered for kw in [
            "summarize", "summary of", "give me a summary", "create notes", "recap", "overview of"
        ])
        is_long_passage = (len(clean) >= 220) and not clean.endswith("?") and not any(lowered.startswith(w) for w in ["what", "how", "why", "who", "when", "where", "can you", "is it"])

        if has_summary_keyword or is_long_passage:
            return TaskType.SUMMARIZATION, 0.90, False, None

        # 6. Default to General Educational Question
        return TaskType.GENERAL_EDUCATIONAL, 0.85, False, None

    async def solve_question(
        self,
        db: AsyncSession,
        user_id: str,
        data: UnifiedSolveRequest,
    ) -> UnifiedSolveResponse:
        """Process unified question, detect task type, execute corresponding solver, and persist history."""
        # 1. Resolve source text and extracted content
        source_text = (data.input_text or "").strip()
        ext_content: Optional[ExtractedContent] = None

        if data.source_content_id:
            ext_content = await upload_repo.get_extracted_content(db, data.source_content_id, user_id)
            if not ext_content:
                raise AppException(
                    code="NOT_FOUND",
                    message="Referenced extracted image content not found or access denied.",
                    status_code=404,
                )
            if not source_text:
                # Use extracted equations if present and no text provided, or extracted text
                parsed_eqs = []
                if ext_content.equations:
                    try:
                        raw_eq = ext_content.equations
                        parsed_eqs = json.loads(raw_eq) if isinstance(raw_eq, str) else raw_eq
                    except Exception:
                        parsed_eqs = []
                if parsed_eqs and len(parsed_eqs) > 0:
                    source_text = parsed_eqs[0]
                else:
                    source_text = ext_content.extracted_text

        if not source_text:
            raise AppException(
                code="INVALID_INPUT",
                message="Please provide a question, problem, passage, or valid image source.",
                status_code=422,
            )

        # 2. Conversation handling: load existing or create a new one
        conversation: Optional[Conversation] = None
        if data.conversation_id:
            conversation = await chat_repo.get_conversation(db, data.conversation_id, user_id, include_messages=False)
            if not conversation:
                raise AppException(code="NOT_FOUND", message="Conversation not found or access denied.", status_code=404)
        else:
            title_preview = source_text[:40].replace("\n", " ").strip()
            conversation = await chat_repo.create_conversation(db, user_id, title=f"Solve: {title_preview}")

        # 3. Classify input into task type
        task_type, confidence, needs_clarification, clarification_q = self.classify_input(source_text, ext_content)

        # If ambiguous, return early with clarification
        if needs_clarification:
            return UnifiedSolveResponse(
                task_type=task_type,
                task_label="Clarification Needed",
                title="Input Needs Clarification",
                summary_or_answer=clarification_q or "Please provide more details.",
                confidence=confidence,
                conversation_id=conversation.id,
                source_content_id=data.source_content_id,
                clarification_needed=True,
                clarification_question=clarification_q,
            )

        # Save user query to conversation history
        await chat_repo.add_message(
            db=db,
            conversation_id=conversation.id,
            role="user",
            content=source_text,
        )

        # 4. Dispatch according to detected task type
        if task_type == TaskType.MATHEMATICS:
            quota_manager.check_quota(user_id=user_id, category="solver")
            clean_math_problem = source_text
            if clean_math_problem.lower().startswith("solve "):
                clean_math_problem = clean_math_problem[6:].strip()

            math_req = MathSolveRequest(
                problem=clean_math_problem,
                domain=data.domain or "real",
                source_content_id=data.source_content_id,
                conversation_id=conversation.id,
            )
            math_res = await math_solver_service.solve(math_req)
            quota_manager.record_usage(user_id=user_id, category="solver")

            # Persist assistant solution in conversation
            steps_summary = "\n".join([f"Step {s.step}: {s.explanation} ({s.expression})" for s in math_res.steps])
            asst_text = f"**Final Answer:** {math_res.final_answer}\n\n**Steps:**\n{steps_summary}"
            await chat_repo.add_message(
                db=db,
                conversation_id=conversation.id,
                role="assistant",
                content=asst_text,
            )

            return UnifiedSolveResponse(
                task_type=TaskType.MATHEMATICS,
                task_label="Mathematics",
                title=f"Math Solution ({math_res.category.replace('_', ' ').title()})",
                summary_or_answer=math_res.final_answer,
                confidence=confidence,
                conversation_id=conversation.id,
                source_content_id=data.source_content_id,
                math_solution=math_res,
            )

        elif task_type == TaskType.LOGICAL_REASONING:
            quota_manager.check_quota(user_id=user_id, category="solver")
            logic_req = LogicSolveRequest(
                problem=source_text,
                conversation_id=conversation.id,
            )
            logic_res = await logic_solver_service.solve(logic_req)
            quota_manager.record_usage(user_id=user_id, category="solver")

            steps_summary = "\n".join([f"• {s}" for s in logic_res.reasoning_steps])
            asst_text = f"**Conclusion:** {logic_res.final_answer}\n\n**Reasoning:**\n{steps_summary}"
            await chat_repo.add_message(
                db=db,
                conversation_id=conversation.id,
                role="assistant",
                content=asst_text,
            )

            return UnifiedSolveResponse(
                task_type=TaskType.LOGICAL_REASONING,
                task_label="Logical Reasoning",
                title=f"Logic Solution ({logic_res.category.replace('_', ' ').title()})",
                summary_or_answer=logic_res.final_answer,
                confidence=confidence,
                conversation_id=conversation.id,
                source_content_id=data.source_content_id,
                logic_solution=logic_res,
            )

        elif task_type == TaskType.SUMMARIZATION:
            # Reuses summarizer service
            summary_req = SummaryGenerateRequest(
                source_text=source_text,
                source_content_id=data.source_content_id,
                conversation_id=conversation.id,
                style=data.preferred_style or "exam_notes",
            )
            summary_res = await summarizer_service.generate_summary(db=db, user_id=user_id, data=summary_req)

            asst_text = f"**Summary: {summary_res.title}**\n\n{summary_res.overview}"
            await chat_repo.add_message(
                db=db,
                conversation_id=conversation.id,
                role="assistant",
                content=asst_text,
            )

            return UnifiedSolveResponse(
                task_type=TaskType.SUMMARIZATION,
                task_label="Study Summary",
                title=summary_res.title,
                summary_or_answer=summary_res.overview,
                confidence=confidence,
                conversation_id=conversation.id,
                source_content_id=data.source_content_id,
                summary_solution=summary_res,
            )

        else:
            # TaskType.GENERAL_EDUCATIONAL
            quota_manager.check_quota(user_id=user_id, category="ai_chat")
            edu_solution = await self._generate_educational_explanation(source_text)
            quota_manager.record_usage(user_id=user_id, category="ai_chat")

            asst_text = f"**Answer:** {edu_solution.conclusion}\n\n" + "\n".join(
                [f"**Step {s.step}: {s.title}** - {s.explanation}" for s in edu_solution.steps]
            )
            await chat_repo.add_message(
                db=db,
                conversation_id=conversation.id,
                role="assistant",
                content=asst_text,
            )

            return UnifiedSolveResponse(
                task_type=TaskType.GENERAL_EDUCATIONAL,
                task_label="Educational Explanation",
                title=f"Explanation: {edu_solution.topic}",
                summary_or_answer=edu_solution.conclusion,
                confidence=confidence,
                conversation_id=conversation.id,
                source_content_id=data.source_content_id,
                educational_solution=edu_solution,
            )

    async def _generate_educational_explanation(self, question: str) -> EducationalSolution:
        """Generate a structured, pedagogical step-by-step educational explanation."""
        prompt = (
            f"Provide an understandable, pedagogical step-by-step explanation for the following educational question:\n\n"
            f"Question: {question}\n\n"
            f"Break it down into progressive learning steps, define core concepts, and provide a clear conclusion."
        )
        system_prompt = (
            "You are an expert tutor. Provide accurate, clear educational explanations suitable for students. "
            "Prioritize step-by-step clarity and essential concept retention."
        )

        req = TextGenerationRequest(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.2,
        )

        try:
            res = await ai_router.generate_text(req)
            content = res.content
        except Exception as exc:
            logger.warning(f"AI text generation error: {exc}. Using fallback explanation.")
            content = f"Educational explanation for: {question}"

        # Build structured educational solution
        steps = [
            EducationalStep(
                step=1,
                title="Concept Overview",
                explanation=content[:250].strip() if len(content) > 50 else content,
            ),
            EducationalStep(
                step=2,
                title="Key Mechanism & Analysis",
                explanation=content[250:600].strip() if len(content) > 300 else "Core concepts and underlying mechanics.",
            ),
        ]

        concepts = [
            EducationalConcept(
                concept="Core Subject Knowledge",
                explanation="Foundational definitions and relationships relevant to the topic.",
            )
        ]

        return EducationalSolution(
            subject="General",
            topic="Educational Concept",
            steps=steps,
            key_concepts=concepts,
            conclusion=content[:180].strip() if len(content) > 180 else content,
            takeaways=["Understand fundamental mechanisms", "Apply concepts to practical problems"],
        )

    async def ask_follow_up(
        self,
        db: AsyncSession,
        user_id: str,
        data: UnifiedFollowUpRequest,
    ) -> UnifiedFollowUpResponse:
        """Allow users to ask follow-up questions within the solved question thread."""
        chat_req = ChatMessageRequest(
            conversation_id=data.conversation_id,
            message=data.message,
            source_content_id=data.source_content_id,
        )
        chat_res = await chat_service.send_message(db=db, user_id=user_id, data=chat_req)

        return UnifiedFollowUpResponse(
            conversation_id=chat_res.conversation_id,
            user_message=chat_res.user_message.content,
            assistant_message=chat_res.assistant_message.content,
            topic_metadata=chat_res.topic_metadata.model_dump() if chat_res.topic_metadata else None,
        )


unified_solver_service = UnifiedSolverService()

