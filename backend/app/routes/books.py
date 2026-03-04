import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import io

from app.database import get_db
from app.models import User, Book, ReadingProgress
from app.middleware.auth import get_current_user
from app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter()


class BookResponse(BaseModel):
    id: str
    title: str
    file_name: str
    file_size: int
    total_pages: Optional[int] = None
    thumbnail_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookListResponse(BaseModel):
    books: List[BookResponse]
    total: int


class SignedUrlResponse(BaseModel):
    signed_url: str
    expires_at: datetime


@router.get("", response_model=BookListResponse)
async def list_books(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all books for the current user.
    """
    # Get books with count
    result = await db.execute(
        select(Book)
        .where(Book.user_id == user.id)
        .order_by(Book.updated_at.desc())
    )
    books = result.scalars().all()

    # Get total count
    count_result = await db.execute(
        select(func.count(Book.id)).where(Book.user_id == user.id)
    )
    total = count_result.scalar()

    # Build response with thumbnail URLs
    book_responses = []
    for book in books:
        thumbnail_url = None
        if book.thumbnail_path:
            thumbnail_url = f"/books/{book.id}/thumbnail"

        book_responses.append(BookResponse(
            id=str(book.id),
            title=book.title,
            file_name=book.file_name,
            file_size=book.file_size,
            total_pages=book.total_pages,
            thumbnail_url=thumbnail_url,
            created_at=book.created_at,
            updated_at=book.updated_at,
        ))

    return BookListResponse(books=book_responses, total=total)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(
    book_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific book by ID.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid, Book.user_id == user.id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    thumbnail_url = None
    if book.thumbnail_path:
        thumbnail_url = f"/books/{book.id}/thumbnail"

    return BookResponse(
        id=str(book.id),
        title=book.title,
        file_name=book.file_name,
        file_size=book.file_size,
        total_pages=book.total_pages,
        thumbnail_url=thumbnail_url,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.post("", response_model=BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    title: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a new book (PDF).
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file size (max 100MB)
    max_size = 100 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 100MB limit",
        )

    # Save file to storage
    try:
        file_content = io.BytesIO(content)
        relative_path, _ = await storage_service.save_file(
            user_id=str(user.id),
            file_content=file_content,
            file_extension=".pdf",
        )
    except Exception as e:
        logger.error(f"Failed to save file to storage: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {type(e).__name__}: {e}",
        )

    # Create book record
    try:
        book_title = title or file.filename.rsplit(".", 1)[0]
        book = Book(
            user_id=user.id,
            title=book_title,
            file_name=file.filename,
            file_path=relative_path,
            file_size=file_size,
            total_pages=0,
        )
        db.add(book)

        # Create initial reading progress
        progress = ReadingProgress(
            user_id=user.id,
            book_id=book.id,
        )
        db.add(progress)

        await db.commit()
        await db.refresh(book)
    except Exception as e:
        logger.error(f"Failed to save book to database: {type(e).__name__}: {e}")
        # Clean up the stored file
        try:
            await storage_service.delete_file(relative_path)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save book record: {type(e).__name__}: {e}",
        )

    return BookResponse(
        id=str(book.id),
        title=book.title,
        file_name=book.file_name,
        file_size=book.file_size,
        total_pages=book.total_pages,
        thumbnail_url=None,
        created_at=book.created_at,
        updated_at=book.updated_at,
    )


@router.delete("/{book_id}")
async def delete_book(
    book_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a book and its associated files.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid, Book.user_id == user.id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Delete files from storage
    if book.file_path:
        await storage_service.delete_file(book.file_path)
    if book.thumbnail_path:
        await storage_service.delete_file(book.thumbnail_path)

    # Delete from database (cascade will handle reading_progress)
    await db.delete(book)
    await db.commit()

    return {"message": "Book deleted successfully"}


@router.get("/{book_id}/signed-url", response_model=SignedUrlResponse)
async def get_signed_url(
    book_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a signed URL for accessing the book PDF.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid, Book.user_id == user.id)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    signed_url, expires_at = storage_service.generate_signed_url(str(book.id))

    return SignedUrlResponse(
        signed_url=signed_url,
        expires_at=expires_at,
    )


@router.get("/{book_id}/thumbnail")
async def get_thumbnail(
    book_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the thumbnail image for a book.
    No authentication required - thumbnails are public preview images.
    """
    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid)
    )
    book = result.scalar_one_or_none()

    if not book or not book.thumbnail_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail not found",
        )

    # Read and return thumbnail
    content = await storage_service.read_file(book.thumbnail_path)

    return Response(
        content=content,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400",  # 1 day cache
        },
    )


@router.get("/{book_id}/data")
async def get_book_data(
    book_id: str,
    expires: int,
    sig: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Serve book file as base64-encoded JSON.
    This bypasses browser extensions like IDM that intercept file downloads.
    """
    import base64

    # Verify signed URL
    if not storage_service.verify_signed_url(book_id, expires, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired signed URL",
        )

    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Read file and encode as base64
    content = await storage_service.read_file(book.file_path)
    encoded_content = base64.b64encode(content).decode('utf-8')

    return {
        "data": encoded_content,
        "mime_type": "application/pdf",
        "file_name": book.file_name,
    }


@router.get("/{book_id}/file")
async def get_file(
    book_id: str,
    expires: int,
    sig: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Serve book file using signed URL.
    This endpoint is accessed via signed URLs and doesn't require session auth.
    """
    # Verify signed URL
    if not storage_service.verify_signed_url(book_id, expires, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired signed URL",
        )

    try:
        book_uuid = uuid.UUID(book_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid book ID",
        )

    result = await db.execute(
        select(Book).where(Book.id == book_uuid)
    )
    book = result.scalar_one_or_none()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Read and return file
    content = await storage_service.read_file(book.file_path)

    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{book.file_name}"',
            "Cache-Control": "private, max-age=3600",  # 1 hour cache
        },
    )
