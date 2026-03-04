import os
import aiofiles
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, BinaryIO
import uuid
import hashlib
import hmac

from app.config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self):
        self.storage_path = Path(settings.storage_path)
        self.books_path = self.storage_path / "books"
        self._ensure_directories()

    def _ensure_directories(self):
        self.books_path.mkdir(parents=True, exist_ok=True)

    def _get_user_dir(self, user_id: str) -> Path:
        user_dir = self.books_path / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    async def save_file(
        self,
        user_id: str,
        file_content: BinaryIO,
        file_extension: str = ".pdf"
    ) -> tuple[str, int]:
        """
        Save a file to storage.
        Returns (file_path, file_size)
        """
        user_dir = self._get_user_dir(user_id)
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        file_name = f"{timestamp}{file_extension}"
        file_path = user_dir / file_name

        # Write file
        content = file_content.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        file_size = len(content)
        return str(file_path.relative_to(self.storage_path)), file_size

    async def save_thumbnail(
        self,
        user_id: str,
        thumbnail_content: BinaryIO,
        original_timestamp: int
    ) -> str:
        """
        Save a thumbnail image.
        Returns thumbnail_path
        """
        user_dir = self._get_user_dir(user_id)
        file_name = f"{original_timestamp}_thumb.jpg"
        file_path = user_dir / file_name

        content = thumbnail_content.read()
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        return str(file_path.relative_to(self.storage_path))

    async def read_file(self, relative_path: str) -> bytes:
        """
        Read a file from storage.
        """
        file_path = self.storage_path / relative_path
        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()

    async def delete_file(self, relative_path: str) -> bool:
        """
        Delete a file from storage.
        """
        file_path = self.storage_path / relative_path
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    async def delete_user_files(self, user_id: str) -> int:
        """
        Delete all files for a user.
        Returns count of deleted files.
        """
        user_dir = self._get_user_dir(user_id)
        count = 0
        if user_dir.exists():
            for file in user_dir.iterdir():
                file.unlink()
                count += 1
            user_dir.rmdir()
        return count

    def generate_signed_url(
        self,
        book_id: str,
        expires_in_hours: int = 1
    ) -> tuple[str, datetime]:
        """
        Generate a signed URL for file access.
        Returns (signed_url_path, expiration)
        """
        expiration = datetime.utcnow() + timedelta(hours=expires_in_hours)
        expiration_timestamp = int(expiration.timestamp())

        # Create signature
        message = f"{book_id}:{expiration_timestamp}"
        signature = hmac.new(
            settings.session_secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()[:32]

        signed_url = f"/books/{book_id}/data?expires={expiration_timestamp}&sig={signature}"
        return signed_url, expiration

    def verify_signed_url(
        self,
        book_id: str,
        expires_timestamp: int,
        signature: str
    ) -> bool:
        """
        Verify a signed URL is valid and not expired.
        """
        # Check expiration
        if datetime.utcnow().timestamp() > expires_timestamp:
            return False

        # Verify signature
        message = f"{book_id}:{expires_timestamp}"
        expected_signature = hmac.new(
            settings.session_secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()[:32]

        return hmac.compare_digest(signature, expected_signature)

    def get_file_path(self, relative_path: str) -> Path:
        """
        Get the absolute path for a relative storage path.
        """
        return self.storage_path / relative_path


# Singleton instance
storage_service = StorageService()
