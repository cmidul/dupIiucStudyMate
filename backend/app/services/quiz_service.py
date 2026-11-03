"""Quiz generation and authoritative backend scoring service (F-07)."""

import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import ai_router
from app.ai.schemas import QuizOption, QuizSchema, TextGenerationRequest
from app.core.responses import AppException
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.repositories.quiz_repo import quiz_repo
from app.schemas.quiz import (
    AnswerSubmission,
    QuestionReview,
    QuizAttemptResponse,
    QuizAttemptSubmitRequest,
    QuizDeliveryResponse,
    QuizGenerateRequest,
    QuizListItemResponse,
    QuizQuestionDelivery,
)

logger = logging.getLogger("learning_assistant.quiz_service")


class QuizService:
    """Service generating quizzes and evaluating attempts."""

    async def generate_quiz(
        self,
        db: AsyncSession,
        user_id: str,
        data: QuizGenerateRequest,
    ) -> QuizDeliveryResponse:
        """Generate, validate, and store a quiz, returning safe questions without answer keys."""
        if data.question_count < 1 or data.question_count > 20:
            raise AppException(
                code="INVALID_INPUT",
                message="Question count must be between 1 and 20.",
                status_code=422,
            )

        source_material = data.source_text or data.topic
        if data.source_content_id:
            from app.repositories.upload_repo import upload_repo
            ext_content = await upload_repo.get_extracted_content(db, data.source_content_id, user_id)
            if not ext_content:
                raise AppException(code="NOT_FOUND", message="Source extracted content not found or access denied.", status_code=404)
            source_material = ext_content.extracted_text

        if not source_material:
            source_material = "Computer Science fundamentals"
        prompt = (
            f"Generate a {data.difficulty} difficulty multiple-choice quiz with exactly {data.question_count} questions.\n"
            f"Topic/Material: {source_material}\n\n"
            f"Requirements:\n"
            f"- Each question must have exactly 4 clear options labeled A, B, C, D.\n"
            f"- Specify correct_option_id matching one of the options.\n"
            f"- Include a detailed pedagogical explanation.\n"
            f"Output strictly matching the required QuizSchema JSON."
        )

        req = TextGenerationRequest(
            prompt=prompt,
            system_prompt="You are an expert educational exam writer. Formulate rigorous, unambiguous MCQ questions.",
            temperature=0.2,
            response_schema=QuizSchema,
        )

        res = await ai_router.generate_text(req)
        if not res.structured_data:
            raise AppException(
                code="INVALID_AI_OUTPUT",
                message="AI provider failed to generate structured quiz data.",
                status_code=502,
            )

        quiz_schema = QuizSchema.model_validate(res.structured_data)
        self._validate_quiz_schema(quiz_schema)

        # Prepare question entities for database
        questions_data = []
        for q in quiz_schema.questions[: data.question_count]:
            questions_data.append({
                "question": q.question,
                "options": [opt.model_dump() for opt in q.options],
                "correct_option_id": q.correct_option_id,
                "explanation": q.explanation,
            })

        # Persist quiz and answer keys securely in database
        quiz = await quiz_repo.create_quiz(
            db=db,
            user_id=user_id,
            title=quiz_schema.title,
            topic=quiz_schema.topic or data.topic or "General",
            difficulty=data.difficulty,
            question_type=data.question_type,
            questions_data=questions_data,
            source_content_id=data.source_content_id,
        )

        # Re-fetch with questions
        saved_quiz = await quiz_repo.get_quiz(db, quiz.id, user_id, include_questions=True)
        return self._to_delivery_response(saved_quiz)

    def _validate_quiz_schema(self, quiz: QuizSchema) -> None:
        """Validate question structure, option count, and correct option presence (QUIZ-005)."""
        seen_ids = set()
        for q in quiz.questions:
            if q.id in seen_ids:
                raise AppException(code="INVALID_AI_OUTPUT", message="Duplicate question IDs in generated quiz.")
            seen_ids.add(q.id)

            if len(q.options) < 2:
                raise AppException(code="INVALID_AI_OUTPUT", message="Question has fewer than 2 options.")

            opt_ids = {opt.id for opt in q.options}
            if q.correct_option_id not in opt_ids:
                raise AppException(code="INVALID_AI_OUTPUT", message="correct_option_id not found in question options.")

    async def get_quiz_for_taking(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
    ) -> QuizDeliveryResponse:
        """Deliver quiz questions WITHOUT answer keys or explanations (QUIZ-006)."""
        quiz = await quiz_repo.get_quiz(db, quiz_id, user_id, include_questions=True)
        if not quiz:
            raise AppException(code="NOT_FOUND", message="Quiz not found or access denied.", status_code=404)
        return self._to_delivery_response(quiz)

    async def list_quizzes(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[QuizListItemResponse]:
        """List quizzes owned by user."""
        quizzes = await quiz_repo.list_quizzes(db, user_id, limit=limit, offset=offset)
        return [
            QuizListItemResponse(
                id=q.id,
                user_id=q.user_id,
                title=q.title,
                topic=q.topic,
                difficulty=q.difficulty,
                question_type=q.question_type,
                question_count=len(q.questions),
                created_at=q.created_at,
            )
            for q in quizzes
        ]

    async def delete_quiz(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
    ) -> None:
        """Delete quiz strictly belonging to user."""
        deleted = await quiz_repo.delete_quiz(db, quiz_id, user_id)
        if not deleted:
            raise AppException(code="NOT_FOUND", message="Quiz not found or access denied.", status_code=404)

    async def submit_attempt(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
        submission: QuizAttemptSubmitRequest,
    ) -> QuizAttemptResponse:
        """Score submitted answers authoritatively against database answer keys."""
        quiz = await quiz_repo.get_quiz(db, quiz_id, user_id, include_questions=True)
        if not quiz:
            raise AppException(code="NOT_FOUND", message="Quiz not found or access denied.", status_code=404)

        questions_by_id: Dict[str, QuizQuestion] = {q.id: q for q in quiz.questions}
        total_questions = len(quiz.questions)
        if total_questions == 0:
            raise AppException(code="INVALID_INPUT", message="Quiz has no questions.")

        submitted_answers: Dict[str, str] = {}
        for ans in submission.answers:
            if ans.question_id not in questions_by_id:
                raise AppException(
                    code="INVALID_INPUT",
                    message=f"Question ID '{ans.question_id}' does not belong to this quiz.",
                    status_code=422,
                )
            submitted_answers[ans.question_id] = ans.selected_option_id

        # Grade each question
        correct_count = 0
        reviews: List[Dict[str, Any]] = []

        for q in quiz.questions:
            options_list = json.loads(q.options_json)
            selected = submitted_answers.get(q.id)
            is_correct = selected == q.correct_option_id
            if is_correct:
                correct_count += 1

            reviews.append({
                "question_id": q.id,
                "question": q.question_text,
                "options": options_list,
                "selected_option_id": selected,
                "correct_option_id": q.correct_option_id,
                "is_correct": is_correct,
                "explanation": q.explanation,
            })

        percentage = round((correct_count / total_questions) * 100.0, 2)

        attempt = await quiz_repo.create_attempt(
            db=db,
            quiz_id=quiz.id,
            user_id=user_id,
            score=correct_count,
            total_questions=total_questions,
            percentage=percentage,
            review_data=reviews,
        )

        return QuizAttemptResponse(
            id=attempt.id,
            quiz_id=attempt.quiz_id,
            user_id=attempt.user_id,
            score=attempt.score,
            total_questions=attempt.total_questions,
            percentage=attempt.percentage,
            reviews=[QuestionReview.model_validate(r) for r in reviews],
            created_at=attempt.created_at,
        )

    def _to_delivery_response(self, quiz: Quiz) -> QuizDeliveryResponse:
        """Convert quiz entity to safe delivery DTO with answer keys removed."""
        delivery_questions: List[QuizQuestionDelivery] = []
        for q in quiz.questions:
            raw_options = json.loads(q.options_json)
            parsed_options = [QuizOption.model_validate(opt) for opt in raw_options]
            delivery_questions.append(
                QuizQuestionDelivery(
                    id=q.id,
                    question_order=q.question_order,
                    question=q.question_text,
                    options=parsed_options,
                )
            )

        return QuizDeliveryResponse(
            id=quiz.id,
            user_id=quiz.user_id,
            source_content_id=quiz.source_content_id,
            title=quiz.title,
            topic=quiz.topic,
            difficulty=quiz.difficulty,
            question_type=quiz.question_type,
            questions=delivery_questions,
            created_at=quiz.created_at,
        )


quiz_service = QuizService()

