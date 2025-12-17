"""
API integration tests for AI/transcription endpoints.

These tests use mocked services to avoid requiring actual Whisper/LLM.
"""

from fastapi.testclient import TestClient


class TestCleanEndpoint:
    """Tests for POST /api/clean endpoint."""

    def test_clean_text_success(self, client: TestClient):
        """Successfully clean text with LLM."""
        response = client.post(
            "/api/clean",
            json={"text": "um like you know this is a test"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "text" in data
        # Mock returns "This is cleaned text."
        assert data["text"] == "This is cleaned text."

    def test_clean_text_empty(self, client: TestClient):
        """Return empty string for empty input."""
        response = client.post(
            "/api/clean",
            json={"text": ""},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["text"] == ""

    def test_clean_text_with_custom_prompt(self, client: TestClient):
        """Accept custom system prompt."""
        response = client.post(
            "/api/clean",
            json={
                "text": "test text",
                "system_prompt": "Custom prompt here",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestGenerateTitleEndpoint:
    """Tests for POST /api/generate-title endpoint."""

    def test_generate_title_success(self, client: TestClient):
        """Successfully generate title."""
        response = client.post(
            "/api/generate-title",
            json={"text": "This is a meeting about project planning and deadlines."},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "title" in data
        # Mock returns "Test Title"
        assert data["title"] == "Test Title"

    def test_generate_title_empty_text(self, client: TestClient):
        """Return 'Untitled' for empty text."""
        response = client.post(
            "/api/generate-title",
            json={"text": ""},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["title"] == "Untitled"


class TestChatEndpoint:
    """Tests for POST /api/chat endpoint."""

    def test_chat_success(self, client: TestClient):
        """Successfully send chat message."""
        response = client.post(
            "/api/chat",
            json={"message": "What is this about?"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        # Mock returns "Test response"
        assert data["reply"] == "Test response"

    def test_chat_with_context(self, client: TestClient):
        """Send chat message with context."""
        response = client.post(
            "/api/chat",
            json={
                "message": "Summarize this",
                "context": "This is the transcript context about meetings.",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "reply" in data


class TestExportEndpoint:
    """Tests for GET /api/transcripts/{id}/export endpoint."""

    def test_export_markdown(self, client: TestClient, sample_transcript):
        """Export transcript as Markdown."""
        response = client.get(
            f"/api/transcripts/{sample_transcript.id}/export?format=md"
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"
        content = response.text
        assert "# Sample Transcript" in content
        assert "Raw text content here." in content

    def test_export_plaintext(self, client: TestClient, sample_transcript):
        """Export transcript as plain text."""
        response = client.get(
            f"/api/transcripts/{sample_transcript.id}/export?format=txt"
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
        content = response.text
        assert "Sample Transcript" in content
        assert "ORIGINAL TRANSCRIPT" in content

    def test_export_pdf(self, client: TestClient, sample_transcript):
        """Export transcript as PDF."""
        response = client.get(
            f"/api/transcripts/{sample_transcript.id}/export?format=pdf"
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        # PDF should start with %PDF
        assert response.content[:4] == b"%PDF"

    def test_export_default_format(self, client: TestClient, sample_transcript):
        """Default format should be Markdown."""
        response = client.get(f"/api/transcripts/{sample_transcript.id}/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"

    def test_export_invalid_format(self, client: TestClient, sample_transcript):
        """Reject invalid export format."""
        response = client.get(
            f"/api/transcripts/{sample_transcript.id}/export?format=doc"
        )

        assert response.status_code == 422  # Validation error

    def test_export_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.get("/api/transcripts/fake-id/export?format=md")

        assert response.status_code == 404

    def test_export_with_messages(
        self, client: TestClient, sample_transcript_with_messages
    ):
        """Export should include chat history."""
        response = client.get(
            f"/api/transcripts/{sample_transcript_with_messages.id}/export?format=md"
        )

        assert response.status_code == 200
        content = response.text
        assert "Chat History" in content
        assert "What is this about?" in content
        assert "This is about testing." in content
