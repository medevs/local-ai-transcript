"""
SQLite database layer using SQLAlchemy for transcript persistence.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

# Database file location (in backend directory)
DB_PATH = Path(__file__).parent / "transcripts.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_id() -> str:
    """Generate a unique ID for new records."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


class Transcript(Base):
    """Transcript model for storing transcription results."""

    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=generate_id)
    title = Column(String, nullable=False, default="Untitled")
    raw_text = Column(Text, nullable=True)
    cleaned_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Relationship to chat messages
    messages = relationship(
        "ChatMessage", back_populates="transcript", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "title": self.title,
            "rawText": self.raw_text,
            "cleanedText": self.cleaned_text,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class ChatMessage(Base):
    """Chat message model for storing conversation history per transcript."""

    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(String, ForeignKey("transcripts.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    transcript = relationship("Transcript", back_populates="messages")

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "transcriptId": self.transcript_id,
            "role": self.role,
            "content": self.content,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Setting(Base):
    """Key-value settings storage."""

    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session (dependency for FastAPI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Repository functions for cleaner data access


def get_all_transcripts(db: Session, limit: int = 100) -> list[Transcript]:
    """Get all transcripts ordered by creation date (newest first)."""
    return (
        db.query(Transcript)
        .order_by(Transcript.created_at.desc())
        .limit(limit)
        .all()
    )


def get_transcript_by_id(db: Session, transcript_id: str) -> Optional[Transcript]:
    """Get a single transcript by ID."""
    return db.query(Transcript).filter(Transcript.id == transcript_id).first()


def create_transcript(
    db: Session,
    title: str,
    raw_text: Optional[str] = None,
    cleaned_text: Optional[str] = None,
) -> Transcript:
    """Create a new transcript."""
    transcript = Transcript(
        id=generate_id(),
        title=title,
        raw_text=raw_text,
        cleaned_text=cleaned_text,
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)
    return transcript


def update_transcript(
    db: Session,
    transcript_id: str,
    title: Optional[str] = None,
    raw_text: Optional[str] = None,
    cleaned_text: Optional[str] = None,
) -> Optional[Transcript]:
    """Update an existing transcript."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        return None

    if title is not None:
        transcript.title = title
    if raw_text is not None:
        transcript.raw_text = raw_text
    if cleaned_text is not None:
        transcript.cleaned_text = cleaned_text

    transcript.updated_at = utc_now()
    db.commit()
    db.refresh(transcript)
    return transcript


def delete_transcript(db: Session, transcript_id: str) -> bool:
    """Delete a transcript and its messages."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        return False

    db.delete(transcript)
    db.commit()
    return True


def get_messages_for_transcript(
    db: Session, transcript_id: str
) -> list[ChatMessage]:
    """Get all chat messages for a transcript."""
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.transcript_id == transcript_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


def add_message(
    db: Session, transcript_id: str, role: str, content: str
) -> ChatMessage:
    """Add a chat message to a transcript."""
    message = ChatMessage(
        transcript_id=transcript_id,
        role=role,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def get_setting(db: Session, key: str) -> Optional[str]:
    """Get a setting value by key."""
    setting = db.query(Setting).filter(Setting.key == key).first()
    return setting.value if setting else None


def set_setting(db: Session, key: str, value: str) -> Setting:
    """Set a setting value."""
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Setting(key=key, value=value)
        db.add(setting)
    db.commit()
    return setting
