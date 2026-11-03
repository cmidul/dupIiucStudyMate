"""Quiz repository managing quizzes, questions, and attempts with ownership checks."""

import json
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.quiz import Quiz, QuizAttempt, QuizQuestion


class QuizRepository:
    """Repository handling quizzes and attempts with strict user ownership enforcement."""

    async def create_quiz(
        self,
        db: AsyncSession,
        user_id: str,
        title: str,
        topic: str,
        difficulty: str,
        question_type: str,
        questions_data: List[Dict[str, Any]],
        source_content_id: Optional[str] = None,
    ) -> Quiz:
        """Create and persist a quiz along with its question bank."""
        quiz = Quiz(
            user_id=user_id,
            title=title,
            topic=topic,
            difficulty=difficulty,
            question_type=question_type,
            source_content_id=source_content_id,
        )
        db.add(quiz)
        await db.flush()  # assign quiz.id

        for idx, q in enumerate(questions_data):
            qq = QuizQuestion(
                quiz_id=quiz.id,
                question_order=idx + 1,
                question_text=q["question"],
                options_json=json.dumps(q["options"]),
                correct_option_id=q["correct_option_id"],
                explanation=q["explanation"],
            )
            db.add(qq)

        await db.commit()
        await db.refresh(quiz)
        return quiz

    async def get_quiz(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
        include_questions: bool = True,
    ) -> Optional[Quiz]:
        """Get quiz strictly belonging to user."""
        stmt = select(Quiz).where(
            Quiz.id == quiz_id,
            Quiz.user_id == user_id,
        )
        if include_questions:
            stmt = stmt.options(selectinload(Quiz.questions))

        result = await db.execute(stmt)
        return result.scalars().first()

    async def list_quizzes(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Quiz]:
        """List user's quizzes ordered newest first."""
        stmt = (
            select(Quiz)
            .where(Quiz.user_id == user_id)
            .options(selectinload(Quiz.questions))
            .order_by(desc(Quiz.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_quiz(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
    ) -> bool:
        """Delete quiz strictly belonging to user."""
        quiz = await self.get_quiz(db, quiz_id, user_id, include_questions=False)
        if not quiz:
            return False
        await db.delete(quiz)
        await db.commit()
        return True

    async def create_attempt(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
        score: int,
        total_questions: int,
        percentage: float,
        review_data: List[Dict[str, Any]],
    ) -> QuizAttempt:
        """Record and persist a scored quiz attempt."""
        attempt = QuizAttempt(
            quiz_id=quiz_id,
            user_id=user_id,
            score=score,
            total_questions=total_questions,
            percentage=percentage,
            review_json=json.dumps(review_data),
        )
        db.add(attempt)
        await db.commit()
        await db.refresh(attempt)
        return attempt

    async def list_attempts(
        self,
        db: AsyncSession,
        quiz_id: str,
        user_id: str,
    ) -> List[QuizAttempt]:
        """List user's attempts for a specific quiz."""
        stmt = (
            select(QuizAttempt)
            .where(
                QuizAttempt.quiz_id == quiz_id,
                QuizAttempt.user_id == user_id,
            )
            .order_by(desc(QuizAttempt.created_at))
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


quiz_repo = QuizRepository()

