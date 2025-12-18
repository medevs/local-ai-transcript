"""
Centralized configuration for the AI Transcript App.

All hardcoded values are now configurable via environment variables.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _parse_int(value: str | None, default: int) -> int:
    """Parse an integer from environment variable."""
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _parse_list(value: str | None, default: list[str]) -> list[str]:
    """Parse a comma-separated list from environment variable."""
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


# =============================================================================
# Server Configuration
# =============================================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# CORS origins (comma-separated)
CORS_ORIGINS = _parse_list(
    os.getenv("CORS_ORIGINS"),
    ["http://localhost:3000", "http://localhost:5173"],
)

# =============================================================================
# LLM Configuration
# =============================================================================

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL = os.getenv("LLM_MODEL", "llama2")

# Fallback LLM (optional)
LLM_FALLBACK_BASE_URL = os.getenv("LLM_FALLBACK_BASE_URL")
LLM_FALLBACK_API_KEY = os.getenv("LLM_FALLBACK_API_KEY")
LLM_FALLBACK_MODEL = os.getenv("LLM_FALLBACK_MODEL")

# Whisper model
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base.en")

# =============================================================================
# Embedding / RAG Configuration
# =============================================================================

EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

# Chunking settings
CHUNK_SIZE = _parse_int(os.getenv("CHUNK_SIZE"), 500)
CHUNK_OVERLAP = _parse_int(os.getenv("CHUNK_OVERLAP"), 100)
EMBEDDING_DIM = _parse_int(os.getenv("EMBEDDING_DIM"), 768)
TOP_K_CHUNKS = _parse_int(os.getenv("TOP_K_CHUNKS"), 5)

# =============================================================================
# File Upload Configuration
# =============================================================================

MAX_UPLOAD_SIZE_MB = _parse_int(os.getenv("MAX_UPLOAD_SIZE_MB"), 100)
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert to bytes

# Allowed audio MIME types (comma-separated to override)
DEFAULT_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mp3",
    "audio/mpeg",
    "audio/ogg",
    "audio/flac",
    "audio/m4a",
    "audio/mp4",
    "audio/x-m4a",
}
_custom_types = os.getenv("ALLOWED_AUDIO_TYPES")
ALLOWED_AUDIO_TYPES = set(_parse_list(_custom_types, [])) if _custom_types else DEFAULT_AUDIO_TYPES

# =============================================================================
# Database Configuration
# =============================================================================

DATABASE_PATH = os.getenv("DATABASE_PATH", "data/transcripts.db")

# =============================================================================
# Rate Limiting (requests per time period)
# =============================================================================

RATE_LIMIT_TRANSCRIBE = os.getenv("RATE_LIMIT_TRANSCRIBE", "5/minute")
RATE_LIMIT_CLEAN = os.getenv("RATE_LIMIT_CLEAN", "20/minute")
RATE_LIMIT_CHAT = os.getenv("RATE_LIMIT_CHAT", "30/minute")

# =============================================================================
# Chat Configuration
# =============================================================================

MAX_CHAT_HISTORY = _parse_int(os.getenv("MAX_CHAT_HISTORY"), 10)
