#!/usr/bin/env python3
"""
Uses OpenAI API format, compatible with Ollama, OpenAI, LM Studio, and other providers.
Configuration is loaded from .env file.

Supports optional fallback provider for reliability.
"""

import logging
import re
from pathlib import Path

from faster_whisper import WhisperModel
from openai import OpenAI

import config

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
        fallback_base_url: str | None = None,
        fallback_api_key: str | None = None,
        fallback_model: str | None = None,
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
        self.fallback_provider: LLMProvider | None = None
        if fallback_base_url and fallback_api_key and fallback_model:
            self.fallback_provider = LLMProvider(
                fallback_base_url, fallback_api_key, fallback_model, "Fallback LLM"
            )

    def transcribe(self, audio_file: str) -> str:
        """Transcribe audio file to text using Whisper."""
        logger.info("Transcribing audio...")

        segments, info = self.whisper.transcribe(
            audio_file, beam_size=5, language="en", condition_on_previous_text=False
        )

        text = " ".join([segment.text for segment in segments]).strip()

        # Fix common Whisper spacing issues
        text = self._fix_whisper_spacing(text)

        logger.info(f"Transcription complete: {len(text)} characters")
        return text

    def _fix_whisper_spacing(self, text: str) -> str:
        """Fix spacing issues from Whisper tokenizer."""
        # Remove spaces before punctuation
        text = re.sub(r"\s+([.,;:!?'\"])", r"\1", text)
        # Fix spaces after opening quotes/brackets
        text = re.sub(r"(['\"\(])\s+", r"\1", text)
        # Fix hyphenated words (full -stack -> full-stack)
        text = re.sub(r"(\w)\s+-\s*(\w)", r"\1-\2", text)
        # Fix spaces before file extensions or dots in names
        text = re.sub(r"(\w)\s+\.(\w)", r"\1.\2", text)
        return text

    def get_default_system_prompt(self) -> str:
        """Get the default system prompt for cleaning."""
        return SYSTEM_PROMPT

    def clean_with_llm(self, text: str, system_prompt: str | None = None) -> str:
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
                title = title.strip("\"'").strip()
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
        context: str | None = None,
        chat_history: list[dict] | None = None,
        relevant_chunks: list[str] | None = None,
        stream: bool = False,
    ):
        """
        Send a chat message with RAG-enhanced context and chat history.

        Args:
            message: User's message
            context: Full transcript context (fallback if no RAG chunks)
            chat_history: Previous messages [{"role": "user/assistant", "content": "..."}]
            relevant_chunks: Pre-retrieved relevant chunks from RAG
            stream: If True, return a streaming response

        Returns:
            Chat response (streaming or non-streaming)
        """
        # Build context from relevant chunks if available, else use full context
        if relevant_chunks:
            chunk_context = "\n\n---\n\n".join(relevant_chunks)
            context_section = (
                f"Relevant excerpts from the transcript:\n\n{chunk_context}"
            )
        elif context:
            context_section = f"Full transcript:\n\n{context}"
        else:
            context_section = "No transcript context available."

        system_prompt = f"""You're chatting with someone about their transcript. Be casual and brief - like talking to a friend.

Rules:
- Only answer from the transcript below. If it's not there, say "I don't see that mentioned"
- Keep it SHORT - 1-2 sentences is usually enough
- Sound natural, not robotic
- No bullet points unless they ask for a list
- Answer directly - don't restate the question

{context_section}"""

        messages = [{"role": "system", "content": system_prompt}]

        # Add chat history (limit configurable via MAX_CHAT_HISTORY env var)
        if chat_history:
            for msg in chat_history[-config.MAX_CHAT_HISTORY :]:
                messages.append(
                    {
                        "role": msg["role"],
                        "content": msg["content"],
                    }
                )

        # Add current user message
        messages.append({"role": "user", "content": message})

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
