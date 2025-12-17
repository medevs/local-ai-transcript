"""
Unit tests for transcription.py - Whisper and LLM service.

These tests use mocks to avoid requiring actual Whisper models or LLM connections.
"""

import sys
from unittest.mock import MagicMock, patch

import pytest

# =============================================================================
# Module-level mocking setup
# =============================================================================

# Mock the heavy dependencies before importing transcription
mock_faster_whisper = MagicMock()
mock_openai = MagicMock()

# Create mock classes
mock_whisper_model = MagicMock()
mock_openai_client = MagicMock()

mock_faster_whisper.WhisperModel = mock_whisper_model
mock_openai.OpenAI = mock_openai_client


@pytest.fixture(autouse=True)
def mock_heavy_imports():
    """Mock heavy imports for all tests."""
    with patch.dict(
        sys.modules,
        {
            "faster_whisper": mock_faster_whisper,
            "openai": mock_openai,
        },
    ):
        # Force reimport of transcription module with mocks
        if "transcription" in sys.modules:
            del sys.modules["transcription"]

        yield


@pytest.fixture
def mock_whisper_instance():
    """Create a mock WhisperModel instance."""
    mock = MagicMock()
    mock.transcribe.return_value = (
        [MagicMock(text="Transcribed text.")],
        MagicMock(language="en"),
    )
    return mock


@pytest.fixture
def mock_openai_instance():
    """Create a mock OpenAI client instance."""
    mock = MagicMock()
    mock.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    return mock


# =============================================================================
# LLMProvider Tests
# =============================================================================


class TestLLMProvider:
    """Tests for LLMProvider class."""

    def test_init_creates_client(self, mock_openai_instance):
        """LLMProvider should initialize OpenAI client with correct params."""
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import LLMProvider

        provider = LLMProvider(
            base_url="http://localhost:11434/v1",
            api_key="test-key",
            model="llama2",
            name="Test Provider",
        )

        mock_openai.OpenAI.assert_called_with(
            base_url="http://localhost:11434/v1", api_key="test-key"
        )
        assert provider.name == "Test Provider"
        assert provider.model == "llama2"
        assert provider.base_url == "http://localhost:11434/v1"

    def test_chat_calls_completions_create(self, mock_openai_instance):
        """chat() should call client.chat.completions.create with correct params."""
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import LLMProvider

        provider = LLMProvider(
            base_url="http://localhost:11434/v1",
            api_key="test-key",
            model="llama2",
        )

        messages = [{"role": "user", "content": "Hello"}]
        provider.chat(messages, temperature=0.5, max_tokens=100, stream=True)

        mock_openai_instance.chat.completions.create.assert_called_once_with(
            model="llama2",
            messages=messages,
            temperature=0.5,
            max_tokens=100,
            stream=True,
        )


# =============================================================================
# TranscriptionService Tests
# =============================================================================


class TestTranscriptionServiceInit:
    """Tests for TranscriptionService initialization."""

    def test_init_with_primary_only(self, mock_whisper_instance, mock_openai_instance):
        """Initialize with only primary provider (no fallback)."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        mock_faster_whisper.WhisperModel.assert_called_with(
            "base.en", device="auto", compute_type="int8"
        )
        assert service.fallback_provider is None

    def test_init_with_fallback(self, mock_whisper_instance, mock_openai_instance):
        """Initialize with both primary and fallback providers."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
            fallback_base_url="https://api.openai.com/v1",
            fallback_api_key="sk-xxx",
            fallback_model="gpt-4o-mini",
        )

        assert service.fallback_provider is not None


class TestTranscriptionServiceTranscribe:
    """Tests for transcribe() method."""

    def test_transcribe_returns_text(self, mock_whisper_instance, mock_openai_instance):
        """transcribe() should return concatenated segment text."""
        mock_segments = [
            MagicMock(text=" Hello, this is "),
            MagicMock(text="a test transcription. "),
            MagicMock(text=" Thank you. "),
        ]
        mock_whisper_instance.transcribe.return_value = (mock_segments, MagicMock())
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.transcribe("/path/to/audio.wav")

        # The result joins segments with spaces - exact spacing depends on segment text
        assert "Hello, this is" in result
        assert "a test transcription" in result
        assert "Thank you" in result
        mock_whisper_instance.transcribe.assert_called_once_with(
            "/path/to/audio.wav",
            beam_size=5,
            language="en",
            condition_on_previous_text=False,
        )

    def test_transcribe_empty_segments(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """transcribe() should handle empty segments."""
        mock_whisper_instance.transcribe.return_value = ([], MagicMock())
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.transcribe("/path/to/audio.wav")
        assert result == ""


class TestTranscriptionServiceClean:
    """Tests for clean_with_llm() method."""

    def test_clean_empty_text_returns_empty(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """clean_with_llm() should return empty string for empty input."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.clean_with_llm("")
        assert result == ""

    def test_clean_uses_primary_provider(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """clean_with_llm() should use primary provider."""
        mock_openai_instance.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Cleaned text"))]
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.clean_with_llm("um like you know test")
        assert result == "Cleaned text"

    def test_clean_returns_raw_on_failure(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """clean_with_llm() should return raw text if provider fails."""
        mock_openai_instance.chat.completions.create.side_effect = Exception(
            "LLM failed"
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        raw_text = "um like you know test"
        result = service.clean_with_llm(raw_text)

        # Should return raw text as fallback
        assert result == raw_text


class TestTranscriptionServiceGenerateTitle:
    """Tests for generate_title() method."""

    def test_generate_title_empty_text(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """generate_title() should return 'Untitled' for empty text."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.generate_title("")
        assert result == "Untitled"

    def test_generate_title_success(self, mock_whisper_instance, mock_openai_instance):
        """generate_title() should return LLM-generated title."""
        mock_openai_instance.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content='"Meeting Notes"'))]
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.generate_title("This is a meeting about project planning...")

        # Quotes should be stripped
        assert result == "Meeting Notes"

    def test_generate_title_limits_words(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """generate_title() should limit title to 5 words max."""
        mock_openai_instance.chat.completions.create.return_value = MagicMock(
            choices=[
                MagicMock(message=MagicMock(content="This Is A Very Long Title Indeed"))
            ]
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.generate_title("Some long transcript text...")

        # Should be limited to 5 words
        assert len(result.split()) <= 5
        assert result == "This Is A Very Long"

    def test_generate_title_fallback_on_failure(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """generate_title() should use first 3 words if LLM fails."""
        mock_openai_instance.chat.completions.create.side_effect = Exception(
            "LLM failed"
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.generate_title("Hello world this is a test")

        # Should return first 3 words as fallback
        assert result == "Hello world this"


class TestTranscriptionServiceChat:
    """Tests for chat() method."""

    def test_chat_basic(self, mock_whisper_instance, mock_openai_instance):
        """chat() should send message and return response."""
        mock_response = MagicMock()
        mock_openai_instance.chat.completions.create.return_value = mock_response
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.chat("Hello!")

        assert result == mock_response
        mock_openai_instance.chat.completions.create.assert_called_once()

    def test_chat_with_context(self, mock_whisper_instance, mock_openai_instance):
        """chat() should include context in system prompt."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        service.chat("What is this about?", context="Meeting about project X")

        call_args = mock_openai_instance.chat.completions.create.call_args
        messages = call_args[1]["messages"]
        assert "Meeting about project X" in messages[0]["content"]

    def test_chat_streaming(self, mock_whisper_instance, mock_openai_instance):
        """chat() should pass stream parameter correctly."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        service.chat("Hello!", stream=True)

        call_args = mock_openai_instance.chat.completions.create.call_args
        assert call_args[1]["stream"] is True

    def test_chat_raises_on_failure(self, mock_whisper_instance, mock_openai_instance):
        """chat() should raise RuntimeError if provider fails."""
        mock_openai_instance.chat.completions.create.side_effect = Exception("Failed")
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        with pytest.raises(RuntimeError, match="No LLM providers available"):
            service.chat("Hello!")


class TestTranscriptionServiceTranscribeFile:
    """Tests for transcribe_file() method."""

    def test_transcribe_file_with_llm(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """transcribe_file() should transcribe and clean with LLM."""
        mock_segments = [MagicMock(text="Raw transcribed text.")]
        mock_whisper_instance.transcribe.return_value = (mock_segments, MagicMock())
        mock_openai_instance.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content="Cleaned text."))]
        )
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.transcribe_file("/path/to/audio.wav", use_llm=True)

        assert result["raw_text"] == "Raw transcribed text."
        assert result["cleaned_text"] == "Cleaned text."

    def test_transcribe_file_without_llm(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """transcribe_file() should skip LLM when use_llm=False."""
        mock_segments = [MagicMock(text="Raw transcribed text.")]
        mock_whisper_instance.transcribe.return_value = (mock_segments, MagicMock())
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        # Reset the mock call count before calling transcribe_file
        mock_openai_instance.chat.completions.create.reset_mock()

        result = service.transcribe_file("/path/to/audio.wav", use_llm=False)

        assert result["raw_text"] == "Raw transcribed text."
        assert result["cleaned_text"] == "Raw transcribed text."  # Same as raw
        mock_openai_instance.chat.completions.create.assert_not_called()


class TestSystemPrompt:
    """Tests for system prompt loading."""

    def test_get_default_system_prompt(
        self, mock_whisper_instance, mock_openai_instance
    ):
        """get_default_system_prompt() should return the loaded prompt."""
        mock_faster_whisper.WhisperModel.return_value = mock_whisper_instance
        mock_openai.OpenAI.return_value = mock_openai_instance

        from transcription import SYSTEM_PROMPT, TranscriptionService

        service = TranscriptionService(
            whisper_model="base.en",
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="ollama",
            llm_model="llama2",
        )

        result = service.get_default_system_prompt()
        assert result == SYSTEM_PROMPT
        assert isinstance(result, str)
        assert len(result) > 0
