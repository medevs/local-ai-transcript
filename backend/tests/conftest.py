"""
Pytest fixtures for backend tests.

Provides test database, API client, and mock services.
"""

import os
import sys
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db

# =============================================================================
# Database Fixtures
# =============================================================================


@pytest.fixture(scope="function")
def test_engine():
    """Create an in-memory SQLite database engine for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a database session for testing."""
    testing_session_local = sessionmaker(
        autocommit=False, autoflush=False, bind=test_engine
    )
    session = testing_session_local()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# =============================================================================
# Mock Service Fixtures
# =============================================================================


@pytest.fixture(scope="function")
def mock_transcription_service():
    """Create a mock TranscriptionService that doesn't require Whisper/LLM."""
    mock_service = MagicMock()
    mock_service.transcribe.return_value = "This is transcribed text."
    mock_service.clean_with_llm.return_value = "This is cleaned text."
    mock_service.generate_title.return_value = "Test Title"
    mock_service.get_default_system_prompt.return_value = "You are a helpful assistant."
    mock_service.chat.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="Test response"))]
    )
    return mock_service


@pytest.fixture(scope="function")
def mock_whisper_model():
    """Mock WhisperModel to avoid loading actual model."""
    mock = MagicMock()
    mock.transcribe.return_value = (
        [MagicMock(text="Transcribed text segment.")],
        MagicMock(language="en"),
    )
    return mock


# =============================================================================
# FastAPI App Fixtures
# =============================================================================


@pytest.fixture(scope="function")
def app(db_session: Session, mock_transcription_service):
    """Create a FastAPI app instance with test database and mocked services."""
    # Mock the heavy imports before importing app
    mock_whisper = MagicMock()
    mock_openai = MagicMock()

    with patch.dict(
        "sys.modules",
        {
            "faster_whisper": mock_whisper,
            "openai": mock_openai,
        },
    ):
        # Force reimport to get fresh module with mocks
        if "transcription" in sys.modules:
            del sys.modules["transcription"]
        if "app" in sys.modules:
            del sys.modules["app"]

        import app as app_module

        # Override database dependency
        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app_module.app.dependency_overrides[get_db] = override_get_db

        # Patch the service at module level - this will be used by the lifespan
        # We also need to patch TranscriptionService to prevent it from loading
        with patch.object(app_module, "service", mock_transcription_service):
            with patch.object(
                app_module,
                "TranscriptionService",
                return_value=mock_transcription_service,
            ):
                yield app_module.app

        # Cleanup
        app_module.app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(app) -> Generator:
    """Create a test client for making HTTP requests."""
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client


# =============================================================================
# Test Data Fixtures
# =============================================================================


@pytest.fixture
def sample_transcript_data():
    """Sample data for creating a transcript."""
    return {
        "title": "Test Meeting Notes",
        "rawText": "This is the raw transcript text with um and uh.",
        "cleanedText": "This is the cleaned transcript text.",
    }


@pytest.fixture
def sample_transcript(db_session: Session):
    """Create a sample transcript in the database."""
    from database import create_transcript

    transcript = create_transcript(
        db_session,
        title="Sample Transcript",
        raw_text="Raw text content here.",
        cleaned_text="Cleaned text content here.",
    )
    return transcript


@pytest.fixture
def sample_transcript_with_messages(db_session: Session, sample_transcript):
    """Create a transcript with chat messages."""
    from database import add_message

    add_message(db_session, sample_transcript.id, "user", "What is this about?")
    add_message(db_session, sample_transcript.id, "assistant", "This is about testing.")
    return sample_transcript


# =============================================================================
# File Fixtures
# =============================================================================


@pytest.fixture
def sample_audio_bytes():
    """Create minimal valid WebM audio bytes for testing file upload."""
    # Minimal WebM header (not a real audio file, but passes MIME check)
    return b"\x1a\x45\xdf\xa3" + b"\x00" * 100


@pytest.fixture
def temp_audio_file(tmp_path, sample_audio_bytes):
    """Create a temporary audio file for testing."""
    audio_path = tmp_path / "test_audio.webm"
    audio_path.write_bytes(sample_audio_bytes)
    return audio_path
