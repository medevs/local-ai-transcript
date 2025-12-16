"""
Unit tests for database.py - CRUD operations and models.
"""

import pytest
from sqlalchemy.orm import Session

from database import (
    Transcript,
    ChatMessage,
    Setting,
    create_transcript,
    get_transcript_by_id,
    get_all_transcripts,
    update_transcript,
    delete_transcript,
    add_message,
    get_messages_for_transcript,
    get_setting,
    set_setting,
    generate_id,
    utc_now,
)


# =============================================================================
# Helper Function Tests
# =============================================================================


class TestHelperFunctions:
    """Tests for utility functions."""

    def test_generate_id_returns_string(self):
        """generate_id should return a non-empty string."""
        id_value = generate_id()
        assert isinstance(id_value, str)
        assert len(id_value) > 0

    def test_generate_id_unique(self):
        """generate_id should return unique values."""
        ids = [generate_id() for _ in range(100)]
        assert len(set(ids)) == 100  # All unique

    def test_utc_now_returns_datetime(self):
        """utc_now should return a datetime object."""
        from datetime import datetime

        now = utc_now()
        assert isinstance(now, datetime)


# =============================================================================
# Transcript CRUD Tests
# =============================================================================


class TestTranscriptCRUD:
    """Tests for Transcript model CRUD operations."""

    def test_create_transcript_minimal(self, db_session: Session):
        """Create transcript with only required fields."""
        transcript = create_transcript(db_session, title="Test Title")

        assert transcript is not None
        assert transcript.id is not None
        assert transcript.title == "Test Title"
        assert transcript.raw_text is None
        assert transcript.cleaned_text is None
        assert transcript.created_at is not None

    def test_create_transcript_full(self, db_session: Session):
        """Create transcript with all fields."""
        transcript = create_transcript(
            db_session,
            title="Full Transcript",
            raw_text="Raw text here",
            cleaned_text="Cleaned text here",
        )

        assert transcript.title == "Full Transcript"
        assert transcript.raw_text == "Raw text here"
        assert transcript.cleaned_text == "Cleaned text here"

    def test_get_transcript_by_id_exists(self, db_session: Session):
        """Retrieve an existing transcript by ID."""
        created = create_transcript(db_session, title="Find Me")
        found = get_transcript_by_id(db_session, created.id)

        assert found is not None
        assert found.id == created.id
        assert found.title == "Find Me"

    def test_get_transcript_by_id_not_found(self, db_session: Session):
        """Return None for non-existent transcript ID."""
        found = get_transcript_by_id(db_session, "nonexistent-id-12345")
        assert found is None

    def test_get_all_transcripts_empty(self, db_session: Session):
        """Return empty list when no transcripts exist."""
        transcripts = get_all_transcripts(db_session)
        assert transcripts == []

    def test_get_all_transcripts_ordered_by_date(self, db_session: Session):
        """Transcripts should be ordered by created_at descending."""
        t1 = create_transcript(db_session, title="First")
        t2 = create_transcript(db_session, title="Second")
        t3 = create_transcript(db_session, title="Third")

        transcripts = get_all_transcripts(db_session)

        assert len(transcripts) == 3
        # Most recent first (Third was created last)
        assert transcripts[0].title == "Third"
        assert transcripts[2].title == "First"

    def test_get_all_transcripts_with_limit(self, db_session: Session):
        """Limit parameter should restrict number of results."""
        for i in range(10):
            create_transcript(db_session, title=f"Transcript {i}")

        transcripts = get_all_transcripts(db_session, limit=5)
        assert len(transcripts) == 5

    def test_update_transcript_title(self, db_session: Session):
        """Update only the title field."""
        transcript = create_transcript(
            db_session, title="Original", raw_text="Keep this"
        )

        updated = update_transcript(db_session, transcript.id, title="Updated Title")

        assert updated is not None
        assert updated.title == "Updated Title"
        assert updated.raw_text == "Keep this"  # Unchanged

    def test_update_transcript_all_fields(self, db_session: Session):
        """Update all fields at once."""
        transcript = create_transcript(
            db_session, title="Original", raw_text="Old raw", cleaned_text="Old clean"
        )

        updated = update_transcript(
            db_session,
            transcript.id,
            title="New Title",
            raw_text="New raw",
            cleaned_text="New clean",
        )

        assert updated.title == "New Title"
        assert updated.raw_text == "New raw"
        assert updated.cleaned_text == "New clean"
        assert updated.updated_at is not None

    def test_update_transcript_not_found(self, db_session: Session):
        """Return None when updating non-existent transcript."""
        result = update_transcript(db_session, "fake-id", title="Nope")
        assert result is None

    def test_delete_transcript_success(self, db_session: Session):
        """Successfully delete an existing transcript."""
        transcript = create_transcript(db_session, title="Delete Me")
        transcript_id = transcript.id

        result = delete_transcript(db_session, transcript_id)

        assert result is True
        assert get_transcript_by_id(db_session, transcript_id) is None

    def test_delete_transcript_not_found(self, db_session: Session):
        """Return False when deleting non-existent transcript."""
        result = delete_transcript(db_session, "nonexistent-id")
        assert result is False

    def test_delete_transcript_cascades_to_messages(self, db_session: Session):
        """Deleting transcript should also delete associated messages."""
        transcript = create_transcript(db_session, title="With Messages")
        add_message(db_session, transcript.id, "user", "Hello")
        add_message(db_session, transcript.id, "assistant", "Hi there")

        # Verify messages exist
        messages = get_messages_for_transcript(db_session, transcript.id)
        assert len(messages) == 2

        # Delete transcript
        delete_transcript(db_session, transcript.id)

        # Messages should be gone (cascade delete)
        messages = get_messages_for_transcript(db_session, transcript.id)
        assert len(messages) == 0

    def test_transcript_to_dict(self, db_session: Session):
        """to_dict() should return proper dictionary representation."""
        transcript = create_transcript(
            db_session, title="Dict Test", raw_text="Raw", cleaned_text="Clean"
        )

        data = transcript.to_dict()

        assert isinstance(data, dict)
        assert data["id"] == transcript.id
        assert data["title"] == "Dict Test"
        assert data["rawText"] == "Raw"
        assert data["cleanedText"] == "Clean"
        assert "createdAt" in data
        assert "updatedAt" in data


# =============================================================================
# Chat Message Tests
# =============================================================================


class TestChatMessageCRUD:
    """Tests for ChatMessage model CRUD operations."""

    def test_add_message_user(self, db_session: Session, sample_transcript):
        """Add a user message to a transcript."""
        message = add_message(
            db_session, sample_transcript.id, "user", "What is this?"
        )

        assert message is not None
        assert message.transcript_id == sample_transcript.id
        assert message.role == "user"
        assert message.content == "What is this?"
        assert message.created_at is not None

    def test_add_message_assistant(self, db_session: Session, sample_transcript):
        """Add an assistant message to a transcript."""
        message = add_message(
            db_session, sample_transcript.id, "assistant", "This is a test."
        )

        assert message.role == "assistant"
        assert message.content == "This is a test."

    def test_get_messages_for_transcript_empty(self, db_session: Session, sample_transcript):
        """Return empty list when transcript has no messages."""
        messages = get_messages_for_transcript(db_session, sample_transcript.id)
        assert messages == []

    def test_get_messages_for_transcript_ordered(self, db_session: Session, sample_transcript):
        """Messages should be ordered by created_at ascending."""
        add_message(db_session, sample_transcript.id, "user", "First")
        add_message(db_session, sample_transcript.id, "assistant", "Second")
        add_message(db_session, sample_transcript.id, "user", "Third")

        messages = get_messages_for_transcript(db_session, sample_transcript.id)

        assert len(messages) == 3
        assert messages[0].content == "First"
        assert messages[1].content == "Second"
        assert messages[2].content == "Third"

    def test_message_to_dict(self, db_session: Session, sample_transcript):
        """to_dict() should return proper dictionary representation."""
        message = add_message(db_session, sample_transcript.id, "user", "Test")

        data = message.to_dict()

        assert isinstance(data, dict)
        assert data["id"] == message.id
        assert data["transcriptId"] == sample_transcript.id
        assert data["role"] == "user"
        assert data["content"] == "Test"
        assert "createdAt" in data


# =============================================================================
# Settings Tests
# =============================================================================


class TestSettingsCRUD:
    """Tests for Setting model CRUD operations."""

    def test_set_setting_new(self, db_session: Session):
        """Create a new setting."""
        set_setting(db_session, "test_key", "test_value")

        value = get_setting(db_session, "test_key")
        assert value == "test_value"

    def test_set_setting_update(self, db_session: Session):
        """Update an existing setting."""
        set_setting(db_session, "update_key", "original")
        set_setting(db_session, "update_key", "updated")

        value = get_setting(db_session, "update_key")
        assert value == "updated"

    def test_get_setting_not_found(self, db_session: Session):
        """Return None for non-existent setting."""
        value = get_setting(db_session, "nonexistent_key")
        assert value is None

    def test_setting_model_attributes(self, db_session: Session):
        """Setting model should have key and value attributes."""
        set_setting(db_session, "dict_key", "dict_value")

        setting = db_session.query(Setting).filter(Setting.key == "dict_key").first()

        assert setting.key == "dict_key"
        assert setting.value == "dict_value"
