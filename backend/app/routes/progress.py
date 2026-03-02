from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.database import get_db
from app.models import User, Book, ReadingProgress
from app.middleware.auth import get_current_user

router = APIRouter()


class ProgressResponse(BaseModel):
    id: str
    book_id: str
    current_page: int
    scroll_position: int
    zoom_level: int
    last_read_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProgressListResponse(BaseModel):
    progress: List[ProgressResponse]


class ProgressUpdate(BaseModel):
    current_page: Optional[int] = None
    scroll_position: Optional[int] = None
    zoom_level: Optional[int] = None


@router.get("", response_model=ProgressListResponse)
async def list_progress(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reading progress for all books.
    """
    result = await db.execute(
        select(ReadingProgress)
        .where(ReadingProgress.user_id == user.id)
        .order_by(ReadingProgress.last_read_at.desc())
    )
    progress_list = result.scalars().all()

    return ProgressListResponse(
        progress=[
            ProgressResponse(
                id=str(p.id),
                book_id=str(p.book_id),
                current_page=p.current_page,
                scroll_position=p.scroll_position,
                zoom_level=p.zoom_level,
                last_read_at=p.last_read_at,
                updated_at=p.updated_at,
            )
            for p in progress_list
        ]
    )


@router.get("/{book_id}", response_model=ProgressResponse)
async def get_progress(
    book_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reading progress for a specific book.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.book_id == book_uuid,
        )
    )
    progress = result.scalar_one_or_none()

    if not progress:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Progress not found",
        )

    return ProgressResponse(
        id=str(progress.id),
        book_id=str(progress.book_id),
        current_page=progress.current_page,
        scroll_position=progress.scroll_position,
        zoom_level=progress.zoom_level,
        last_read_at=progress.last_read_at,
        updated_at=progress.updated_at,
    )


@router.put("/{book_id}", response_model=ProgressResponse)
async def update_progress(
    book_id: str,
    update_data: ProgressUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update reading progress for a specific book.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    # Verify book exists and belongs to user
    book_result = await db.execute(
        select(Book).where(Book.id == book_uuid, Book.user_id == user.id)
    )
    book = book_result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Get or create progress
    result = await db.execute(
        select(ReadingProgress).where(
            ReadingProgress.user_id == user.id,
            ReadingProgress.book_id == book_uuid,
        )
    )
    progress = result.scalar_one_or_none()

    if not progress:
        progress = ReadingProgress(
            user_id=user.id,
            book_id=book_uuid,
        )
        db.add(progress)

    # Update fields
    if update_data.current_page is not None:
        progress.current_page = update_data.current_page
    if update_data.scroll_position is not None:
        progress.scroll_position = update_data.scroll_position
    if update_data.zoom_level is not None:
        progress.zoom_level = update_data.zoom_level

    progress.last_read_at = datetime.utcnow()

    await db.commit()
    await db.refresh(progress)

    return ProgressResponse(
        id=str(progress.id),
        book_id=str(progress.book_id),
        current_page=progress.current_page,
        scroll_position=progress.scroll_position,
        zoom_level=progress.zoom_level,
        last_read_at=progress.last_read_at,
        updated_at=progress.updated_at,
    )
