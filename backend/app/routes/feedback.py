from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import User, Feedback
from app.middleware.auth import get_current_user_optional

router = APIRouter()


class FeedbackCreate(BaseModel):
    category: str
    subject: str
    description: str
    email: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    category: str
    subject: str
    description: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    feedback_data: FeedbackCreate,
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit feedback. Works for both authenticated and anonymous users.
    """
    # Validate category
    valid_categories = ["bug", "feature", "general", "other"]
    if feedback_data.category.lower() not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}",
        )

    # Create feedback
    feedback = Feedback(
        user_id=user.id if user else None,
        email=feedback_data.email or (user.email if user else None),
        category=feedback_data.category.lower(),
        subject=feedback_data.subject,
        description=feedback_data.description,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(
        id=str(feedback.id),
        category=feedback.category,
        subject=feedback.subject,
        description=feedback.description,
        status=feedback.status,
        created_at=feedback.created_at,
    )


@router.get("", response_model=list[FeedbackResponse])
async def list_feedback(
    user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    List feedback submitted by the current user.
    """
    if not user:
        return []

    result = await db.execute(
        select(Feedback)
        .where(Feedback.user_id == user.id)
        .order_by(Feedback.created_at.desc())
    )
    feedback_list = result.scalars().all()

    return [
        FeedbackResponse(
            id=str(f.id),
            category=f.category,
            subject=f.subject,
            description=f.description,
            status=f.status,
            created_at=f.created_at,
        )
        for f in feedback_list
    ]
