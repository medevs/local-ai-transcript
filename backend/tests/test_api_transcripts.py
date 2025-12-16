"""
API integration tests for transcript endpoints.
"""

import pytest
from fastapi.testclient import TestClient


class TestStatusEndpoints:
    """Tests for status and system endpoints."""

    def test_get_status(self, client: TestClient):
        """GET /api/status should return service status."""
        response = client.get("/api/status")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "whisper_model" in data
        assert "llm_model" in data

    def test_get_system_prompt(self, client: TestClient):
        """GET /api/system-prompt should return default prompt."""
        response = client.get("/api/system-prompt")

        assert response.status_code == 200
        data = response.json()
        assert "default_prompt" in data
        assert isinstance(data["default_prompt"], str)


class TestTranscriptListEndpoint:
    """Tests for GET /api/transcripts endpoint."""

    def test_list_transcripts_empty(self, client: TestClient):
        """Return empty list when no transcripts exist."""
        response = client.get("/api/transcripts")

        assert response.status_code == 200
        data = response.json()
        assert "transcripts" in data
        assert data["transcripts"] == []

    def test_list_transcripts_with_data(self, client: TestClient, sample_transcript):
        """Return list of transcripts when they exist."""
        response = client.get("/api/transcripts")

        assert response.status_code == 200
        data = response.json()
        assert len(data["transcripts"]) == 1
        assert data["transcripts"][0]["title"] == "Sample Transcript"

    def test_list_transcripts_with_limit(self, client: TestClient, db_session):
        """Respect limit query parameter."""
        from database import create_transcript

        # Create multiple transcripts
        for i in range(10):
            create_transcript(db_session, title=f"Transcript {i}")

        response = client.get("/api/transcripts?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["transcripts"]) == 5


class TestTranscriptGetEndpoint:
    """Tests for GET /api/transcripts/{id} endpoint."""

    def test_get_transcript_exists(self, client: TestClient, sample_transcript):
        """Return transcript when it exists."""
        response = client.get(f"/api/transcripts/{sample_transcript.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_transcript.id
        assert data["title"] == "Sample Transcript"
        assert "rawText" in data
        assert "cleanedText" in data
        assert "createdAt" in data

    def test_get_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.get("/api/transcripts/nonexistent-id-12345")

        assert response.status_code == 404
        data = response.json()
        assert data["detail"]["code"] == "TRANSCRIPT_NOT_FOUND"


class TestTranscriptCreateEndpoint:
    """Tests for POST /api/transcripts endpoint."""

    def test_create_transcript_minimal(self, client: TestClient):
        """Create transcript with only title."""
        response = client.post(
            "/api/transcripts",
            json={"title": "New Transcript"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Transcript"
        assert data["id"] is not None
        assert data["rawText"] is None

    def test_create_transcript_full(self, client: TestClient):
        """Create transcript with all fields."""
        response = client.post(
            "/api/transcripts",
            json={
                "title": "Full Transcript",
                "rawText": "Raw text content",
                "cleanedText": "Cleaned text content",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Full Transcript"
        assert data["rawText"] == "Raw text content"
        assert data["cleanedText"] == "Cleaned text content"


class TestTranscriptUpdateEndpoint:
    """Tests for PUT /api/transcripts/{id} endpoint."""

    def test_update_transcript_title(self, client: TestClient, sample_transcript):
        """Update only the title."""
        response = client.put(
            f"/api/transcripts/{sample_transcript.id}",
            json={"title": "Updated Title"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        # Other fields unchanged
        assert data["rawText"] == "Raw text content here."

    def test_update_transcript_all_fields(self, client: TestClient, sample_transcript):
        """Update all fields."""
        response = client.put(
            f"/api/transcripts/{sample_transcript.id}",
            json={
                "title": "New Title",
                "rawText": "New raw text",
                "cleanedText": "New cleaned text",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Title"
        assert data["rawText"] == "New raw text"
        assert data["cleanedText"] == "New cleaned text"

    def test_update_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.put(
            "/api/transcripts/nonexistent-id",
            json={"title": "Nope"},
        )

        assert response.status_code == 404


class TestTranscriptDeleteEndpoint:
    """Tests for DELETE /api/transcripts/{id} endpoint."""

    def test_delete_transcript_success(self, client: TestClient, sample_transcript):
        """Successfully delete a transcript."""
        response = client.delete(f"/api/transcripts/{sample_transcript.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify it's gone
        get_response = client.get(f"/api/transcripts/{sample_transcript.id}")
        assert get_response.status_code == 404

    def test_delete_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.delete("/api/transcripts/nonexistent-id")

        assert response.status_code == 404


class TestMessageEndpoints:
    """Tests for chat message endpoints."""

    def test_get_messages_empty(self, client: TestClient, sample_transcript):
        """Return empty list when no messages exist."""
        response = client.get(f"/api/transcripts/{sample_transcript.id}/messages")

        assert response.status_code == 200
        data = response.json()
        assert data["messages"] == []

    def test_get_messages_with_data(
        self, client: TestClient, sample_transcript_with_messages
    ):
        """Return messages when they exist."""
        response = client.get(
            f"/api/transcripts/{sample_transcript_with_messages.id}/messages"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["role"] == "assistant"

    def test_get_messages_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.get("/api/transcripts/fake-id/messages")

        assert response.status_code == 404

    def test_add_message_user(self, client: TestClient, sample_transcript):
        """Add a user message."""
        response = client.post(
            f"/api/transcripts/{sample_transcript.id}/messages",
            json={"role": "user", "content": "Hello!"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "user"
        assert data["content"] == "Hello!"
        assert data["transcriptId"] == sample_transcript.id

    def test_add_message_assistant(self, client: TestClient, sample_transcript):
        """Add an assistant message."""
        response = client.post(
            f"/api/transcripts/{sample_transcript.id}/messages",
            json={"role": "assistant", "content": "Hi there!"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "assistant"

    def test_add_message_invalid_role(self, client: TestClient, sample_transcript):
        """Reject invalid role."""
        response = client.post(
            f"/api/transcripts/{sample_transcript.id}/messages",
            json={"role": "invalid", "content": "Test"},
        )

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "INVALID_ROLE"

    def test_add_message_transcript_not_found(self, client: TestClient):
        """Return 404 for non-existent transcript."""
        response = client.post(
            "/api/transcripts/fake-id/messages",
            json={"role": "user", "content": "Test"},
        )

        assert response.status_code == 404
