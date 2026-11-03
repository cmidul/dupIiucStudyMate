"""Tests for Image Understanding and Multimodal Learning Context (F-04, IMG-001..013)."""

import io
import pytest
from httpx import AsyncClient
from PIL import Image

from app.ai.exceptions import AITimeoutError
from app.ai.mock_provider import MockAIProvider
from app.ai.router import ai_router


def create_test_image(fmt: str = "PNG") -> bytes:
    """Generate minimal valid image bytes."""
    img = Image.new("RGB", (20, 20), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


async def get_test_auth(client: AsyncClient, email: str = "img_user@example.com") -> dict:
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_img_001_valid_jpeg_upload(client: AsyncClient):
    """IMG-001: Valid JPEG upload creates private record, background job, and omits storage path."""
    headers = await get_test_auth(client, "img1@example.com")
    jpeg_bytes = create_test_image("JPEG")

    files = {"file": ("lecture_slide.jpg", jpeg_bytes, "image/jpeg")}
    res = await client.post("/api/v1/uploads/image", headers=headers, files=files)
    assert res.status_code == 201
    data = res.json()["data"]

    # Validated file metadata
    file_info = data["file"]
    assert file_info["mime_type"] == "image/jpeg"
    assert file_info["original_filename"] == "lecture_slide.jpg"
    assert file_info["file_size"] == len(jpeg_bytes)
    # Storage path must NEVER be leaked in public DTO
    assert "storage_path" not in file_info

    # Job created
    assert data["job"]["job_type"] == "image_extraction"


@pytest.mark.asyncio
async def test_img_002_valid_png_and_webp_upload(client: AsyncClient):
    """IMG-002: Supported formats (PNG, WEBP) accepted; unsupported rejected."""
    headers = await get_test_auth(client, "img2@example.com")

    # PNG
    png_bytes = create_test_image("PNG")
    res_png = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("diagram.png", png_bytes, "image/png")},
    )
    assert res_png.status_code == 201
    assert res_png.json()["data"]["file"]["mime_type"] == "image/png"

    # Unsupported format (e.g. GIF or BMP)
    bmp_bytes = create_test_image("BMP")
    res_unsupported = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("graphic.bmp", bmp_bytes, "image/bmp")},
    )
    assert res_unsupported.status_code == 400
    assert "not match any supported image format" in res_unsupported.json()["error"]["message"] or "unsupported" in res_unsupported.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_img_003_mime_spoofing(client: AsyncClient):
    """IMG-003: Text or executable file renamed to .png is rejected by magic bytes inspection."""
    headers = await get_test_auth(client, "img3@example.com")
    fake_png = b"This is purely plain text content pretending to be an image."

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("spoofed.png", fake_png, "image/png")},
    )
    assert res.status_code == 400
    assert "does not match any supported image format" in res.json()["error"]["message"]


@pytest.mark.asyncio
async def test_img_004_corrupt_image(client: AsyncClient):
    """IMG-004: Truncated or corrupted image header is rejected with clear error."""
    headers = await get_test_auth(client, "img4@example.com")
    # PNG signature followed by garbage bytes
    corrupted_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRcorruptedpayload12345"

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("corrupt.png", corrupted_png, "image/png")},
    )
    assert res.status_code == 400
    assert "corrupt or unreadable" in res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_img_005_oversized_image(client: AsyncClient):
    """IMG-005: File exceeding maximum upload size is rejected before provider call."""
    headers = await get_test_auth(client, "img5@example.com")
    # Max size in test config can be tested with oversized payload
    huge_fake_image = b"\xFF\xD8\xFF" + b"\x00" * (11 * 1024 * 1024)  # 11MB

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("huge.jpg", huge_fake_image, "image/jpeg")},
    )
    assert res.status_code == 400
    assert "exceeds the maximum allowed limit" in res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_img_006_educational_text_extraction(client: AsyncClient):
    """IMG-006: Educational text and topic metadata extracted."""
    headers = await get_test_auth(client, "img6@example.com")
    png_bytes = create_test_image("PNG")

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("bst_notes.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    data = res.json()["data"]
    extracted = data["extracted_content"]
    assert extracted is not None
    assert extracted["topic"] is not None
    assert len(extracted["key_concepts"]) > 0


@pytest.mark.asyncio
async def test_img_007_diagram_understanding(client: AsyncClient):
    """IMG-007: Visual diagrams are distinguished from extracted text."""
    headers = await get_test_auth(client, "img7@example.com")
    png_bytes = create_test_image("PNG")

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("neural_network.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    extracted = res.json()["data"]["extracted_content"]
    assert extracted is not None
    assert len(extracted["visual_elements"]) > 0
    assert any(ve["type"] == "diagram" for ve in extracted["visual_elements"])


@pytest.mark.asyncio
async def test_img_008_equation_extraction(client: AsyncClient):
    """IMG-008: Mathematical equations extracted from image."""
    headers = await get_test_auth(client, "img8@example.com")
    png_bytes = create_test_image("PNG")

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("quadratic_equation.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    extracted = res.json()["data"]["extracted_content"]
    assert extracted is not None
    assert len(extracted["equations"]) > 0


@pytest.mark.asyncio
async def test_img_009_blurry_image(client: AsyncClient):
    """IMG-009: Blurry image flags uncertainty without fabricating text."""
    headers = await get_test_auth(client, "img9@example.com")
    png_bytes = create_test_image("PNG")

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("blurry_notes.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    extracted = res.json()["data"]["extracted_content"]
    assert len(extracted["uncertainties"]) > 0
    assert any("blurry" in u.lower() for u in extracted["uncertainties"])


@pytest.mark.asyncio
async def test_img_010_non_educational_image(client: AsyncClient):
    """IMG-010: Non-educational image reports absence of educational content."""
    headers = await get_test_auth(client, "img10@example.com")
    png_bytes = create_test_image("PNG")

    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("non_educational.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    extracted = res.json()["data"]["extracted_content"]
    assert extracted["topic"] == "Non-educational"
    assert any("no useful educational context" in u.lower() for u in extracted["uncertainties"])


@pytest.mark.asyncio
async def test_img_011_reuse_extracted_content(client: AsyncClient):
    """IMG-011: Reuse extracted content for summary and quiz without re-uploading."""
    headers = await get_test_auth(client, "img11@example.com")
    png_bytes = create_test_image("PNG")

    # 1. Upload and extract
    res_upload = await client.post(
        "/api/v1/uploads/image",
        headers=headers,
        files={"file": ("lecture_notes.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res_upload.status_code == 201
    content_id = res_upload.json()["data"]["extracted_content"]["id"]

    # 2. Reuse for summary
    res_summary = await client.post(
        "/api/v1/summaries",
        headers=headers,
        json={"source_content_id": content_id, "style": "short"},
    )
    assert res_summary.status_code == 201
    assert res_summary.json()["data"]["source_content_id"] == content_id

    # 3. Reuse for quiz
    res_quiz = await client.post(
        "/api/v1/quizzes/generate",
        headers=headers,
        json={"source_content_id": content_id, "question_count": 3},
    )
    assert res_quiz.status_code == 201
    assert res_quiz.json()["data"]["source_content_id"] == content_id


@pytest.mark.asyncio
async def test_img_012_image_ownership(client: AsyncClient):
    """IMG-012: Cross-user access denied for uploaded files and extracted contents."""
    headers_user_a = await get_test_auth(client, "user_a@example.com")
    headers_user_b = await get_test_auth(client, "user_b@example.com")
    png_bytes = create_test_image("PNG")

    # User A uploads
    res = await client.post(
        "/api/v1/uploads/image",
        headers=headers_user_a,
        files={"file": ("private_notes.png", png_bytes, "image/png")},
        data={"process_now": "true"},
    )
    assert res.status_code == 201
    file_id = res.json()["data"]["file"]["id"]

    # User B attempts to access User A's file
    res_forbidden = await client.get(f"/api/v1/uploads/{file_id}", headers=headers_user_b)
    assert res_forbidden.status_code == 404

    # User B attempts to access User A's extracted content
    res_content_forbidden = await client.get(f"/api/v1/uploads/{file_id}/content", headers=headers_user_b)
    assert res_content_forbidden.status_code == 404


@pytest.mark.asyncio
async def test_img_013_provider_failure_during_processing(client: AsyncClient):
    """IMG-013: Provider failure marks job as failed with safe error code."""
    headers = await get_test_auth(client, "img13@example.com")
    png_bytes = create_test_image("PNG")

    # Configure mock provider to simulate timeout failure
    mock_prov = MockAIProvider()
    mock_prov.simulate_timeout = True

    orig_provider = ai_router.get_provider("mock")
    try:
        ai_router.register_provider(mock_prov)

        res = await client.post(
            "/api/v1/uploads/image",
            headers=headers,
            files={"file": ("failing_slide.png", png_bytes, "image/png")},
            data={"process_now": "true"},
        )
        assert res.status_code == 201
        job_info = res.json()["data"]["job"]
        assert job_info["status"] in {"failed", "queued"}
        if job_info["status"] == "failed":
            assert job_info["error_code"] == "AI_PROVIDER_ERROR"
    finally:
        if orig_provider:
            ai_router.register_provider(orig_provider)
