"""Secure private file storage and image validation manager (F-04)."""

import io
from pathlib import Path
from typing import Optional, Set, Tuple
import uuid
from PIL import Image

from app.core.config import settings


class FileValidationError(Exception):
    """Raised when an uploaded file fails security or format validation."""
    pass


class SecureFileStorage:
    """Manages secure file validation, disk persistence, and private storage isolation."""

    SUPPORTED_MIME_TYPES: Set[str] = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    MAGIC_BYTES = {
        "image/jpeg": [b"\xFF\xD8\xFF"],
        "image/png": [b"\x89PNG\r\n\x1a\n"],
        "image/webp": [b"RIFF"],
    }

    def __init__(self, base_storage_dir: Optional[str] = None):
        self.base_dir = Path(base_storage_dir or settings.STORAGE_LOCAL_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(
        self,
        file_bytes: bytes,
        client_mime: Optional[str] = None,
        max_size: Optional[int] = None,
    ) -> Tuple[str, str]:
        """Validate file size, magic bytes, and image integrity.
        
        Returns:
            Tuple of (detected_mime_type, file_extension)
            
        Raises:
            FileValidationError on empty, oversized, corrupt, or spoofed files.
        """
        # 1. Size check
        if not file_bytes or len(file_bytes) == 0:
            raise FileValidationError("Uploaded file is empty (0 bytes).")

        limit = max_size or settings.MAX_UPLOAD_SIZE_BYTES
        if len(file_bytes) > limit:
            raise FileValidationError(
                f"File size ({len(file_bytes)} bytes) exceeds the maximum allowed limit of {limit} bytes."
            )

        # 2. Magic bytes validation (detect real MIME type)
        detected_mime = None
        for mime, signatures in self.MAGIC_BYTES.items():
            for sig in signatures:
                if file_bytes.startswith(sig):
                    if mime == "image/webp":
                        # WEBP signature: bytes 0-3 "RIFF", bytes 8-11 "WEBP"
                        if len(file_bytes) > 12 and file_bytes[8:12] == b"WEBP":
                            detected_mime = mime
                            break
                    else:
                        detected_mime = mime
                        break
            if detected_mime:
                break

        if not detected_mime:
            raise FileValidationError("File content does not match any supported image format (JPEG, PNG, WEBP).")

        if detected_mime not in self.SUPPORTED_MIME_TYPES:
            raise FileValidationError(f"Unsupported image MIME type: '{detected_mime}'.")

        # 3. MIME spoofing check: if client sent an incompatible MIME type
        if client_mime and client_mime.lower().strip() not in self.SUPPORTED_MIME_TYPES:
            raise FileValidationError(f"Client declared unsupported MIME type '{client_mime}'.")

        # 4. Image integrity & corruption check using Pillow
        try:
            with Image.open(io.BytesIO(file_bytes)) as img:
                img.verify()
        except Exception as e:
            raise FileValidationError(f"Corrupt or unreadable image file: {e}")

        # Extension mapping
        ext_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }
        return detected_mime, ext_map[detected_mime]

    def _safe_resolve(self, relative_path: str) -> Path:
        """Resolve a relative storage path safely, preventing directory traversal attacks (SEC-004)."""
        if not relative_path or "\0" in relative_path:
            raise FileValidationError("Invalid or null-byte corrupted file path.")

        # Check for directory traversal sequences
        clean_path = relative_path.replace("\\", "/")
        parts = [p for p in clean_path.split("/") if p and p != "."]
        if ".." in parts:
            raise FileValidationError("Path traversal pattern ('..') detected.")

        target = (self.base_dir / relative_path).resolve()
        base = self.base_dir.resolve()

        try:
            target.relative_to(base)
        except ValueError:
            raise FileValidationError("Path traversal attempt: target is outside storage root.")

        return target

    def save_file(self, user_id: str, file_bytes: bytes, ext: str) -> str:
        """Save file bytes to an unguessable private location.
        
        Returns:
            Relative storage path string (never expose absolute server paths).
        """
        if not user_id or ".." in user_id or "/" in user_id or "\\" in user_id or "\0" in user_id:
            raise FileValidationError("Invalid user identifier for storage partition.")

        user_folder = self.base_dir / user_id
        user_folder.mkdir(parents=True, exist_ok=True)

        unique_filename = f"{uuid.uuid4().hex}{ext}"
        target_path = user_folder / unique_filename

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        # Return relative storage path
        return str(Path(user_id) / unique_filename)

    def read_file(self, relative_path: str) -> bytes:
        """Read file bytes from private storage."""
        full_path = self._safe_resolve(relative_path)
        if not full_path.exists() or not full_path.is_file():
            raise FileValidationError("Requested file does not exist in storage.")
        with open(full_path, "rb") as f:
            return f.read()

    def delete_file(self, relative_path: str) -> bool:
        """Remove file from storage safely."""
        try:
            full_path = self._safe_resolve(relative_path)
            if full_path.exists() and full_path.is_file():
                full_path.unlink()
                return True
        except FileValidationError:
            return False
        return False


# Shared storage instance
file_storage = SecureFileStorage()

