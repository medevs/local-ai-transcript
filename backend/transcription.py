#!/usr/bin/env python3
"""
Uses OpenAI API format, compatible with Ollama, OpenAI, LM Studio, and other providers.
Configuration is loaded from .env file.

Supports optional fallback provider for reliability.
"""

import logging
from pathlib import Path
from typing import Optional

from faster_whisper import WhisperModel
from openai import OpenAI

logger = logging.getLogger(__name__)

# Edit system_prompt.txt to change how the LLM cleans transcriptions
PROMPT_FILE = Path(__file__).parent / "system_prompt.txt"
SYSTEM_PROMPT = PROMPT_FILE.read_text().strip()


class LLMProvider:
    """Wrapper for an OpenAI-compatible LLM provider."""

    def __init__(self, base_url: str, api_key: str, model: str, name: str = "LLM"):
        self.name = name
        self.base_url = base_url
        self.model = model
        self.client = OpenAI(base_url=base_url, api_key=api_key)
        logger.info(f"{name} initialized with model {model} at {base_url}")

    def chat(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 200,
        stream: bool = False,
    ):
        """Send a chat completion request."""
        return self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )


class TranscriptionService:
    """
    Speech-to-text and LLM cleaning service.

    Uses OpenAI-compatible API, works with any provider (Ollama, OpenAI, LM Studio, etc.)
    Supports optional fallback provider for reliability.
    """

    def __init__(
        self,
        whisper_model: str,
        llm_base_url: str,
        llm_api_key: str,
        llm_model: str,
        fallback_base_url: Optional[str] = None,
        fallback_api_key: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        # Initialize Whisper
        logger.info(f"Loading Whisper model '{whisper_model}'...")
        self.whisper = WhisperModel(
            whisper_model,
            device="auto",  # Auto-detect: Metal (Mac), CUDA (NVIDIA), or CPU
            compute_type="int8",
        )
        logger.info(f"Whisper model '{whisper_model}' loaded!")

        # Initialize primary LLM provider
        self.primary_provider = LLMProvider(
            llm_base_url, llm_api_key, llm_model, "Primary LLM"
        )

        # Initialize fallback provider if configured
        self.fallback_provider: Optional[LLMProvider] = None
        if fallback_base_url and fallback_api_key and fallback_model:
            self.fallback_provider = LLMProvider(
                fallback_base_url, fallback_api_key, fallback_model, "Fallback LLM"
            )

        # For backwards compatibility
        self.llm_client = self.primary_provider.client
        self.llm_model = llm_model

    def _get_available_provider(self) -> Optional[LLMProvider]:
        """Get the first available LLM provider."""
        if self.primary_provider.available:
            return self.primary_provider
        if self.fallback_provider and self.fallback_provider.available:
            logger.info("Using fallback LLM provider")
            return self.fallback_provider
        return None

    def transcribe(self, audio_file: str) -> str:
        """Transcribe audio file to text using Whisper."""
        logger.info("Transcribing audio...")

        segments, info = self.whisper.transcribe(
            audio_file, beam_size=5, language="en", condition_on_previous_text=False
        )

        text = " ".join([segment.text for segment in segments]).strip()
        logger.info(f"Transcription complete: {len(text)} characters")
        return text

    def get_default_system_prompt(self) -> str:
        """Get the default system prompt for cleaning."""
        return SYSTEM_PROMPT

    def clean_with_llm(
        self, text: str, system_prompt: Optional[str] = None
    ) -> str:
        """Clean transcribed text using LLM."""
        if not text:
            return ""

        prompt_to_use = system_prompt if system_prompt else SYSTEM_PROMPT
        logger.info("Cleaning text with LLM...")

        # Try primary, then fallback
        providers = [self.primary_provider]
        if self.fallback_provider:
            providers.append(self.fallback_provider)

        last_error = None
        for provider in providers:
            try:
                response = provider.chat(
                    messages=[
                        {"role": "system", "content": prompt_to_use},
                        {"role": "user", "content": text},
                    ],
                    temperature=0.3,
                    max_tokens=2000,  # Allow longer cleaned outputs
                )
                cleaned = response.choices[0].message.content.strip()
                logger.info(
                    f"LLM cleaning complete via {provider.name}: {len(cleaned)} chars"
                )
                return cleaned

            except Exception as e:
                last_error = e
                logger.warning(f"{provider.name} failed: {e}")
                continue

        # All providers failed
        if last_error:
            logger.error(f"All LLM providers failed. Last error: {last_error}")
        return text  # Fallback to raw text

    def generate_title(self, text: str) -> str:
        """Generate a short 2-3 word title for transcript text using LLM."""
        if not text:
            return "Untitled"

        # Take first 500 chars to keep it fast
        snippet = text[:500]

        title_prompt = (
            "Generate a short title (2-3 words maximum) that captures the main topic "
            "of this transcript. Return ONLY the title, nothing else. No quotes, no punctuation at the end.\n\n"
            f"Transcript:\n{snippet}"
        )

        # Try primary, then fallback
        providers = [self.primary_provider]
        if self.fallback_provider:
            providers.append(self.fallback_provider)

        for provider in providers:
            try:
                response = provider.chat(
                    messages=[{"role": "user", "content": title_prompt}],
                    temperature=0.7,
                    max_tokens=20,
                )
                title = response.choices[0].message.content.strip()
                # Clean up: remove quotes, limit length
                title = title.strip('"\'').strip()
                # Limit to ~5 words max
                words = title.split()[:5]
                title = " ".join(words)
                logger.info(f"Generated title via {provider.name}: {title}")
                return title if title else "Untitled"

            except Exception as e:
                logger.warning(f"Title generation failed via {provider.name}: {e}")
                continue

        # Fallback: first 3 words of text
        words = text.strip().split()[:3]
        return " ".join(words) if words else "Untitled"

    def chat(
        self,
        message: str,
        context: Optional[str] = None,
        stream: bool = False,
    ):
        """
        Send a chat message with optional transcript context.

        Args:
            message: User's message
            context: Optional transcript context
            stream: If True, return a streaming response

        Returns:
            Chat response (streaming or non-streaming)
        """
        system_prompt = (
            "You are a helpful assistant. Use the provided context to answer "
            "the user's question.\nIf the context is empty or irrelevant, "
            f"answer generally.\n\nContext:\n{context or ''}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ]

        # Try primary, then fallback
        providers = [self.primary_provider]
        if self.fallback_provider:
            providers.append(self.fallback_provider)

        for provider in providers:
            try:
                return provider.chat(
                    messages=messages,
                    temperature=0.2,
                    max_tokens=1500,
                    stream=stream,
                )
            except Exception as e:
                logger.warning(f"{provider.name} chat failed: {e}")
                continue

        raise RuntimeError("No LLM providers available")

    def transcribe_file(self, audio_file_path: str, use_llm: bool = True) -> dict:
        """Transcribe file and optionally clean with LLM."""
        raw_text = self.transcribe(audio_file_path)

        result = {"raw_text": raw_text}

        if use_llm and raw_text:
            cleaned_text = self.clean_with_llm(raw_text)
            result["cleaned_text"] = cleaned_text
        else:
            result["cleaned_text"] = raw_text

        return result
