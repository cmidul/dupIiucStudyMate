"""Tests for AI Provider Abstraction and Routing.

Directly verifies test cases AI-001 through AI-007 from test.md.
"""

import pytest
from app.ai.base import BaseAIProvider
from app.ai.exceptions import (
    AICapabilityError,
    AIProviderError,
    AIRateLimitError,
    AIStructuredOutputError,
    AITimeoutError,
)
from app.ai.mock_provider import MockAIProvider
from app.ai.providers.groq import GroqProvider
from app.ai.router import AIRouter
from app.ai.schemas import (
    AICapability,
    ExtractedContentSchema,
    ImageAnalysisRequest,
    QuizSchema,
    SummarySchema,
    TextGenerationRequest,
    TextGenerationResponse,
    TopicDetectionSchema,
)


@pytest.mark.asyncio
async def test_ai_001_text_provider_contract():
    """AI-001: Text provider contract.

    Verify provider adapter normalizes text response to the internal schema.
    """
    provider = MockAIProvider()
    req = TextGenerationRequest(prompt="Explain binary search in simple terms.")
    res = await provider.generate_text(req)

    assert res.content != ""
    assert res.provider == "mock"
    assert res.model == "mock-text-v1"
    assert res.tokens_used is not None
    assert isinstance(res.content, str)


@pytest.mark.asyncio
async def test_ai_002_vision_provider_contract():
    """AI-002: Vision provider contract.

    Verify image extraction data normalizes to internal ExtractedContentSchema.
    """
    provider = MockAIProvider()
    req = ImageAnalysisRequest(
        image_bytes=b"fake-png-binary-data",
        mime_type="image/png",
        response_schema=ExtractedContentSchema,
    )
    res = await provider.analyze_image(req)

    assert res.content != ""
    assert res.provider == "mock"
    assert res.structured_data is not None
    assert "title" in res.structured_data
    assert "key_concepts" in res.structured_data
    assert "equations" in res.structured_data
    assert "uncertainties" in res.structured_data


@pytest.mark.asyncio
async def test_ai_003_capability_routing():
    """AI-003: Capability routing.

    Verify text requests route to text-capable providers, image requests route only to
    vision-capable providers, and text-only models (like Groq) are never used for vision.
    """
    router = AIRouter()

    # Groq does not support vision
    groq = GroqProvider(api_key="mock_groq_key")
    assert not groq.has_capability(AICapability.VISION)
    assert groq.has_capability(AICapability.TEXT)

    # Calling analyze_image on Groq raises AICapabilityError
    with pytest.raises(AICapabilityError) as exc_info:
        await groq.analyze_image(
            ImageAnalysisRequest(image_bytes=b"fake-bytes", mime_type="image/jpeg")
        )
    assert exc_info.value.code == "CAPABILITY_UNSUPPORTED"

    # Router resolves a vision-capable provider even when preferred is text-only
    resolved_vision = router.resolve_provider(AICapability.VISION, preferred_name="groq")
    assert resolved_vision.has_capability(AICapability.VISION)
    assert resolved_vision.name != "groq"


@pytest.mark.asyncio
async def test_ai_004_provider_replacement():
    """AI-004: Provider replacement.

    Verify swap of provider configuration without changing feature-service code.
    """
    router = AIRouter()

    # Create two different providers with the same contract
    provider_1 = MockAIProvider(custom_response="Response from Provider 1")
    provider_1.name = "provider_1"

    provider_2 = MockAIProvider(custom_response="Response from Provider 2")
    provider_2.name = "provider_2"

    router.register_provider(provider_1)
    router.register_provider(provider_2)

    req = TextGenerationRequest(prompt="Test swap")

    res1 = await router.generate_text(req, preferred_provider="provider_1")
    assert res1.content == "Response from Provider 1"
    assert res1.provider == "provider_1"

    res2 = await router.generate_text(req, preferred_provider="provider_2")
    assert res2.content == "Response from Provider 2"
    assert res2.provider == "provider_2"


@pytest.mark.asyncio
async def test_ai_005_rate_limit_and_timeout_normalization():
    """AI-005: Rate limit and timeout normalization.

    Verify provider rate limits and timeouts normalize to standard application error codes.
    """
    # 1. Rate limit
    rate_limited_provider = MockAIProvider(simulate_rate_limit=True)
    with pytest.raises(AIRateLimitError) as rl_exc:
        await rate_limited_provider.generate_text(TextGenerationRequest(prompt="Test rate limit"))
    assert rl_exc.value.code == "PROVIDER_RATE_LIMITED"
    assert rl_exc.value.status_code == 429

    # 2. Timeout
    timeout_provider = MockAIProvider(simulate_timeout=True)
    with pytest.raises(AITimeoutError) as to_exc:
        await timeout_provider.generate_text(TextGenerationRequest(prompt="Test timeout"))
    assert to_exc.value.code == "PROVIDER_UNAVAILABLE"
    assert to_exc.value.status_code == 504


@pytest.mark.asyncio
async def test_ai_006_invalid_structured_output_and_repair():
    """AI-006: Invalid structured output.

    Verify schema validator catches malformed JSON output and triggers at most 1 repair attempt.
    """
    # 1. When provider keeps failing, repair fails and raises AIStructuredOutputError
    broken_provider = MockAIProvider(simulate_malformed_json=True)
    router = AIRouter()
    router.register_provider(broken_provider)

    req = TextGenerationRequest(
        prompt="Generate topic schema",
        response_schema=TopicDetectionSchema,
    )

    with pytest.raises(AIStructuredOutputError) as exc_info:
        await router.generate_text(req, preferred_provider="mock")
    assert exc_info.value.code == "INVALID_AI_OUTPUT"

    # 2. When first call fails but repair call succeeds
    class FlakyThenFixedProvider(BaseAIProvider):
        name = "flaky"
        default_text_model = "flaky-v1"
        default_vision_model = "none"
        supported_capabilities = {AICapability.TEXT}

        def __init__(self):
            self.call_count = 0

        async def generate_text(self, request: TextGenerationRequest):
            self.call_count += 1
            if self.call_count == 1:
                # First attempt fails schema parse
                return TextGenerationResponse(
                    content="not valid json",
                    provider=self.name,
                    model=self.default_text_model,
                )
            # Second attempt (repair) succeeds
            valid_json = TopicDetectionSchema(
                subject="Mathematics",
                topic="Calculus",
                difficulty="intermediate",
                intent="general_question",
            ).model_dump_json()
            return TextGenerationResponse(
                content=valid_json,
                provider=self.name,
                model=self.default_text_model,
                structured_data=self.parse_and_validate_json(valid_json, request.response_schema),
            )

        async def analyze_image(self, request):
            raise NotImplementedError

    flaky_provider = FlakyThenFixedProvider()
    flaky_router = AIRouter()
    flaky_router.register_provider(flaky_provider)

    repaired_res = await flaky_router.generate_text(req, preferred_provider="flaky")
    assert flaky_provider.call_count == 2  # exactly 1 retry (controlled repair)
    assert repaired_res.structured_data is not None
    assert repaired_res.structured_data["subject"] == "Mathematics"


@pytest.mark.asyncio
async def test_ai_007_secret_handling():
    """AI-007: Secret handling.

    Verify credentials are never exposed in representation or error messages.
    """
    fake_secret = "AIzaSySecretFakeApiKey12345"
    provider = GroqProvider(api_key=fake_secret)

    # Calling __repr__ or checking exception does not leak secret
    assert fake_secret not in str(provider)

    # Triggering capability error does not expose keys
    try:
        await provider.analyze_image(ImageAnalysisRequest(image_bytes=b"bytes"))
    except Exception as exc:
        assert fake_secret not in str(exc)
        if hasattr(exc, "details") and exc.details:
            assert fake_secret not in str(exc.details)
