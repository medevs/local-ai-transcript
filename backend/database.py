"""
SQLite database layer using SQLAlchemy for transcript persistence.
Includes FTS5 full-text search support.
"""

import logging
import struct
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

import config

logger = logging.getLogger(__name__)

# Database file location (configurable via DATABASE_PATH env var)
DB_PATH = Path(config.DATABASE_PATH)
# Ensure parent directory exists
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_id() -> str:
    """Generate a unique ID for new records."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Get current UTC timestamp."""
    return datetime.now(UTC)


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

    # Relationship to chunks (for RAG)
    chunks = relationship(
        "TranscriptChunk", back_populates="transcript", cascade="all, delete-orphan"
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


class TranscriptChunk(Base):
    """Stores text chunks for RAG vector search."""

    __tablename__ = "transcript_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transcript_id = Column(String, ForeignKey("transcripts.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    start_char = Column(Integer, nullable=False)
    end_char = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    transcript = relationship("Transcript", back_populates="chunks")

    __table_args__ = (UniqueConstraint("transcript_id", "chunk_index"),)

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "transcriptId": self.transcript_id,
            "chunkIndex": self.chunk_index,
            "content": self.content,
            "startChar": self.start_char,
            "endChar": self.end_char,
        }


def _init_fts5(conn) -> None:
    """Initialize FTS5 virtual table and triggers for full-text search."""
    conn.execute(
        text(
            """
        CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
            id UNINDEXED, title, raw_text, cleaned_text,
            content='transcripts', content_rowid='rowid'
        )
    """
        )
    )
    conn.execute(
        text(
            """
        CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
            INSERT INTO transcripts_fts(rowid, id, title, raw_text, cleaned_text)
            VALUES (NEW.rowid, NEW.id, NEW.title, NEW.raw_text, NEW.cleaned_text);
        END
    """
        )
    )
    conn.execute(
        text(
            """
        CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
            INSERT INTO transcripts_fts(transcripts_fts, rowid, id, title, raw_text, cleaned_text)
            VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.raw_text, OLD.cleaned_text);
        END
    """
        )
    )
    conn.execute(
        text(
            """
        CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
            INSERT INTO transcripts_fts(transcripts_fts, rowid, id, title, raw_text, cleaned_text)
            VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.raw_text, OLD.cleaned_text);
            INSERT INTO transcripts_fts(rowid, id, title, raw_text, cleaned_text)
            VALUES (NEW.rowid, NEW.id, NEW.title, NEW.raw_text, NEW.cleaned_text);
        END
    """
        )
    )
    conn.commit()


def init_db():
    """Initialize database tables and FTS5 search."""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        _init_fts5(conn)
        logger.info("FTS5 full-text search initialized")


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
        db.query(Transcript).order_by(Transcript.created_at.desc()).limit(limit).all()
    )


def search_transcripts(db: Session, query: str, limit: int = 50) -> list[Transcript]:
    """Search transcripts using FTS5 full-text search."""
    if not query or not query.strip():
        return get_all_transcripts(db, limit=limit)

    search_term = query.strip().replace('"', '""')
    search_term = f'"{search_term}"*'

    try:
        result = db.execute(
            text(
                """
                SELECT id FROM transcripts_fts
                WHERE transcripts_fts MATCH :query
                ORDER BY rank
                LIMIT :limit
            """
            ),
            {"query": search_term, "limit": limit},
        )
        ids = [row[0] for row in result.fetchall()]
        if not ids:
            return []
        transcripts = db.query(Transcript).filter(Transcript.id.in_(ids)).all()
        id_order = {id_: idx for idx, id_ in enumerate(ids)}
        transcripts.sort(key=lambda t: id_order.get(t.id, 999))
        return transcripts
    except Exception as e:
        logger.warning(f"FTS search failed, falling back to LIKE: {e}")
        like_pattern = f"%{query.strip()}%"
        return (
            db.query(Transcript)
            .filter(
                (Transcript.title.ilike(like_pattern))
                | (Transcript.raw_text.ilike(like_pattern))
                | (Transcript.cleaned_text.ilike(like_pattern))
            )
            .order_by(Transcript.created_at.desc())
            .limit(limit)
            .all()
        )


def get_transcript_by_id(db: Session, transcript_id: str) -> Transcript | None:
    """Get a single transcript by ID."""
    return db.query(Transcript).filter(Transcript.id == transcript_id).first()


def create_transcript(
    db: Session,
    title: str,
    raw_text: str | None = None,
    cleaned_text: str | None = None,
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
    title: str | None = None,
    raw_text: str | None = None,
    cleaned_text: str | None = None,
) -> Transcript | None:
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


def get_messages_for_transcript(db: Session, transcript_id: str) -> list[ChatMessage]:
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


def get_setting(db: Session, key: str) -> str | None:
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


# =============================================================================
# Vector Store Functions (sqlite-vec for RAG)
# =============================================================================

# Embedding dimension for nomic-embed-text
EMBEDDING_DIM = 768

# Global flag to track if vector store is available
_vector_store_available: bool | None = None


def init_vector_store(conn) -> bool:
    """
    Initialize sqlite-vec extension and virtual table.

    Args:
        conn: Raw SQLite connection (dbapi_connection)

    Returns:
        True if successful, False otherwise
    """
    global _vector_store_available

    try:
        import sqlite_vec

        sqlite_vec.load(conn)
        conn.execute(
            f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0(
                chunk_id INTEGER PRIMARY KEY,
                embedding float[{EMBEDDING_DIM}]
            )
        """
        )
        conn.commit()
        _vector_store_available = True
        logger.info("sqlite-vec vector store initialized")
        return True
    except ImportError:
        logger.warning("sqlite-vec not installed, vector search disabled")
        _vector_store_available = False
        return False
    except Exception as e:
        logger.warning(f"Failed to initialize vector store: {e}")
        _vector_store_available = False
        return False


def is_vector_store_available() -> bool:
    """Check if vector store is available."""
    return _vector_store_available is True


def get_chunks_for_transcript(db: Session, transcript_id: str) -> list[TranscriptChunk]:
    """Get all chunks for a transcript ordered by chunk_index."""
    return (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.transcript_id == transcript_id)
        .order_by(TranscriptChunk.chunk_index.asc())
        .all()
    )


def delete_chunks_for_transcript(db: Session, transcript_id: str) -> int:
    """
    Delete all chunks and embeddings for a transcript.

    Returns:
        Number of chunks deleted
    """
    chunks = get_chunks_for_transcript(db, transcript_id)
    count = len(chunks)

    if count > 0 and is_vector_store_available():
        # Delete embeddings first
        chunk_ids = [c.id for c in chunks]
        for chunk_id in chunk_ids:
            try:
                db.execute(
                    text("DELETE FROM chunk_embeddings WHERE chunk_id = :id"),
                    {"id": chunk_id},
                )
            except Exception as e:
                logger.warning(f"Failed to delete embedding for chunk {chunk_id}: {e}")

    # Delete chunks
    db.query(TranscriptChunk).filter(
        TranscriptChunk.transcript_id == transcript_id
    ).delete()
    db.commit()

    return count


def save_chunks_with_embeddings(
    db: Session,
    transcript_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> list[TranscriptChunk]:
    """
    Save chunks and their embeddings for a transcript.

    Args:
        db: Database session
        transcript_id: ID of the transcript
        chunks: List of chunk dicts with content, start_char, end_char, chunk_index
        embeddings: List of embedding vectors (same length as chunks)

    Returns:
        List of created TranscriptChunk objects
    """
    # Delete existing chunks for this transcript
    delete_chunks_for_transcript(db, transcript_id)

    saved_chunks = []
    for chunk_data, embedding in zip(chunks, embeddings, strict=True):
        # Save chunk
        chunk = TranscriptChunk(
            transcript_id=transcript_id,
            chunk_index=chunk_data["chunk_index"],
            content=chunk_data["content"],
            start_char=chunk_data["start_char"],
            end_char=chunk_data["end_char"],
        )
        db.add(chunk)
        db.flush()  # Get the chunk.id

        # Save embedding if vector store available
        if is_vector_store_available():
            embedding_bytes = struct.pack(f"{len(embedding)}f", *embedding)
            try:
                db.execute(
                    text(
                        """
                        INSERT OR REPLACE INTO chunk_embeddings(chunk_id, embedding)
                        VALUES (:chunk_id, :embedding)
                    """
                    ),
                    {"chunk_id": chunk.id, "embedding": embedding_bytes},
                )
            except Exception as e:
                logger.warning(f"Failed to save embedding for chunk {chunk.id}: {e}")

        saved_chunks.append(chunk)

    db.commit()
    return saved_chunks


def search_similar_chunks(
    db: Session,
    transcript_id: str,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[TranscriptChunk]:
    """
    Find the most similar chunks to query embedding within a transcript.

    Uses cosine distance for similarity search.

    Args:
        db: Database session
        transcript_id: ID of the transcript to search
        query_embedding: Query embedding vector
        top_k: Number of chunks to retrieve

    Returns:
        List of most similar TranscriptChunk objects
    """
    if not is_vector_store_available():
        logger.warning("Vector store not available, returning empty results")
        return []

    embedding_bytes = struct.pack(f"{len(query_embedding)}f", *query_embedding)

    try:
        # Query sqlite-vec for similar chunks, filtered by transcript_id
        result = db.execute(
            text(
                """
                SELECT tc.id, vec_distance_cosine(ce.embedding, :query) as distance
                FROM chunk_embeddings ce
                JOIN transcript_chunks tc ON tc.id = ce.chunk_id
                WHERE tc.transcript_id = :transcript_id
                ORDER BY distance ASC
                LIMIT :top_k
            """
            ),
            {
                "query": embedding_bytes,
                "transcript_id": transcript_id,
                "top_k": top_k,
            },
        )

        rows = result.fetchall()
        if not rows:
            return []

        chunk_ids = [row[0] for row in rows]

        # Fetch full chunk objects maintaining order
        chunks = (
            db.query(TranscriptChunk).filter(TranscriptChunk.id.in_(chunk_ids)).all()
        )

        # Maintain similarity order
        id_order = {chunk_id: idx for idx, chunk_id in enumerate(chunk_ids)}
        chunks.sort(key=lambda c: id_order.get(c.id, 999))

        return chunks

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []


