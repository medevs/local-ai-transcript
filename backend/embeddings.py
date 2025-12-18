"""
Embedding service for RAG functionality.

Uses Ollama's nomic-embed-text model for local embeddings.
"""

import logging

import httpx

import config

logger = logging.getLogger(__name__)

# Chunking configuration (from centralized config)
CHUNK_SIZE = config.CHUNK_SIZE
CHUNK_OVERLAP = config.CHUNK_OVERLAP
EMBEDDING_DIM = config.EMBEDDING_DIM
TOP_K_CHUNKS = config.TOP_K_CHUNKS


class EmbeddingService:
    """Handles text embedding via Ollama nomic-embed-text."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "nomic-embed-text",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._available: bool | None = None

    async def is_available(self) -> bool:
        """Check if embedding service is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    available = any(
                        m.get("name", "").startswith(self.model) for m in models
                    )
                    self._available = available
                    return available
                self._available = False
                return False
        except Exception as e:
            logger.warning(f"Embedding service unavailable: {e}")
            self._available = False
            return False

    async def embed_text(self, text: str) -> list[float]:
        """Get embedding for a single text string."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Get embeddings for multiple texts."""
        embeddings = []
        for text in texts:
            embedding = await self.embed_text(text)
            embeddings.append(embedding)
        return embeddings

    @staticmethod
    def chunk_text(
        text: str,
        chunk_size: int = CHUNK_SIZE,
        overlap: int = CHUNK_OVERLAP,
    ) -> list[dict]:
        """
        Split text into overlapping chunks.

        Returns list of dicts with keys:
        - content: chunk text
        - start_char: start position
        - end_char: end position
        - chunk_index: chunk order
        """
        if not text:
            return []

        text = text.strip()
        if len(text) <= chunk_size:
            return [
                {
                    "content": text,
                    "start_char": 0,
                    "end_char": len(text),
                    "chunk_index": 0,
                }
            ]

        chunks = []
        start = 0
        chunk_index = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))

            # Try to end at a sentence/word boundary
            if end < len(text):
                # Look for sentence end (.!?\n) in last 20% of chunk
                search_start = start + int(chunk_size * 0.8)
                found_boundary = False

                for i in range(end, search_start, -1):
                    if text[i - 1] in ".!?\n":
                        end = i
                        found_boundary = True
                        break

                if not found_boundary:
                    # Fall back to word boundary (space)
                    for i in range(end, search_start, -1):
                        if text[i - 1] == " ":
                            end = i
                            break

            chunk_content = text[start:end].strip()
            if chunk_content:  # Only add non-empty chunks
                chunks.append(
                    {
                        "content": chunk_content,
                        "start_char": start,
                        "end_char": end,
                        "chunk_index": chunk_index,
                    }
                )
                chunk_index += 1

            # Move start forward, with overlap
            if end >= len(text):
                break
            start = end - overlap

        return chunks
