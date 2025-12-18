import asyncio
import logging
import os
import tempfile
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated, NoReturn

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

import config
from database import (
    SessionLocal,
    add_message,
    create_transcript,
    delete_transcript,
    engine,
    get_all_transcripts,
    get_chunks_for_transcript,
    get_db,
    get_messages_for_transcript,
    get_transcript_by_id,
    init_db,
    init_vector_store,
    is_vector_store_available,
    save_chunks_with_embeddings,
    search_similar_chunks,
    search_transcripts,
    update_transcript,
)
from embeddings import EmbeddingService
from transcription import TranscriptionService

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Request/Response models
class CleanRequest(BaseModel):
    text: str
    system_prompt: str | None = None


class ChatRequest(BaseModel):
    message: str
    transcript_id: str | None = None
    context: str | None = None  # Fallback context if RAG unavailable
    include_history: bool = True
    history_limit: int = 10


class TranscriptCreate(BaseModel):
    title: str
    rawText: str | None = None
    cleanedText: str | None = None


class GenerateTitleRequest(BaseModel):
    text: str


class TranscriptUpdate(BaseModel):
    title: str | None = None
    rawText: str | None = None
    cleanedText: str | None = None


class MessageCreate(BaseModel):
    role: str
    content: str


service: TranscriptionService | None = None
embedding_service: EmbeddingService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global service, embedding_service
    logger.info("Starting AI Transcript App...")

    # Initialize database
    init_db()
    logger.info("Database initialized")

    # Initialize vector store (sqlite-vec)
    try:
        with engine.connect() as conn:
            raw_conn = conn.connection.dbapi_connection
            if init_vector_store(raw_conn):
                logger.info("Vector store initialized")
            else:
                logger.warning("Vector store not available - RAG disabled")
    except Exception as e:
        logger.warning(f"Could not initialize vector store: {e}")

    # Initialize transcription service
    service = TranscriptionService(
        whisper_model=os.getenv("WHISPER_MODEL", "base.en"),
        llm_base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
        llm_api_key=os.getenv("LLM_API_KEY", "ollama"),
        llm_model=os.getenv("LLM_MODEL", "llama2"),
        # Optional fallback provider
        fallback_base_url=os.getenv("LLM_FALLBACK_BASE_URL"),
        fallback_api_key=os.getenv("LLM_FALLBACK_API_KEY"),
        fallback_model=os.getenv("LLM_FALLBACK_MODEL"),
    )

    # Initialize embedding service
    embedding_base_url = os.getenv(
        "EMBEDDING_BASE_URL",
        os.getenv("LLM_BASE_URL", "http://localhost:11434/v1").replace("/v1", ""),
    )
    embedding_model = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

    embedding_service = EmbeddingService(
        base_url=embedding_base_url,
        model=embedding_model,
    )
    logger.info(
        f"Embedding service configured: {embedding_model} at {embedding_base_url}"
    )

    logger.info("Services ready!")
    yield


app = FastAPI(title="AI Transcript App", lifespan=lifespan)

# Register rate limiter with app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware (origins configurable via CORS_ORIGINS env var)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Error helper
def api_error(
    code: str, message: str, status_code: int = 400, details: str | None = None
) -> NoReturn:
    """Create a structured error response."""
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    raise HTTPException(status_code=status_code, detail=error)


# ============================================================================
# Status & System Endpoints
# ============================================================================


@app.get("/api/status")
async def get_status():
    return {
        "status": "ready" if service else "initializing",
        "whisper_model": os.getenv("WHISPER_MODEL", "base.en"),
        "llm_model": os.getenv("LLM_MODEL"),
        "llm_base_url": os.getenv("LLM_BASE_URL"),
    }


@app.get("/api/system-prompt")
async def get_system_prompt():
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    return {"default_prompt": service.get_default_system_prompt()}


# ============================================================================
# Transcript CRUD Endpoints
# ============================================================================


@app.get("/api/transcripts")
async def list_transcripts(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    """Get all transcripts ordered by creation date."""
    transcripts = get_all_transcripts(db, limit=limit)
    return {"transcripts": [t.to_dict() for t in transcripts]}


@app.get("/api/transcripts/search")
async def search_transcripts_endpoint(
    q: str = Query(default="", description="Search query"),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Search transcripts by title and content using full-text search."""
    transcripts = search_transcripts(db, q, limit=limit)
    return {"transcripts": [t.to_dict() for t in transcripts], "query": q}


@app.get("/api/transcripts/{transcript_id}")
async def get_transcript(transcript_id: str, db: Session = Depends(get_db)):
    """Get a single transcript by ID."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)
    return transcript.to_dict()


@app.post("/api/transcripts", status_code=201)
async def create_new_transcript(
    data: TranscriptCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new transcript and queue it for RAG indexing."""
    transcript = create_transcript(
        db,
        title=data.title,
        raw_text=data.rawText,
        cleaned_text=data.cleanedText,
    )

    # Queue background indexing for RAG
    text = data.cleanedText or data.rawText
    if text and embedding_service:
        background_tasks.add_task(_index_transcript, transcript.id, text)

    return transcript.to_dict()


@app.put("/api/transcripts/{transcript_id}")
async def update_existing_transcript(
    transcript_id: str,
    data: TranscriptUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Update an existing transcript and reindex if text changed."""
    transcript = update_transcript(
        db,
        transcript_id,
        title=data.title,
        raw_text=data.rawText,
        cleaned_text=data.cleanedText,
    )
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    # Reindex if text was updated
    if (data.rawText or data.cleanedText) and embedding_service:
        text = transcript.cleaned_text or transcript.raw_text
        if text:
            background_tasks.add_task(_index_transcript, transcript_id, text)

    return transcript.to_dict()


@app.delete("/api/transcripts/{transcript_id}")
async def delete_existing_transcript(transcript_id: str, db: Session = Depends(get_db)):
    """Delete a transcript and its chat messages."""
    success = delete_transcript(db, transcript_id)
    if not success:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)
    return {"success": True}


# ============================================================================
# Chat Message Endpoints
# ============================================================================


@app.get("/api/transcripts/{transcript_id}/messages")
async def get_transcript_messages(transcript_id: str, db: Session = Depends(get_db)):
    """Get chat messages for a transcript."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    messages = get_messages_for_transcript(db, transcript_id)
    return {"messages": [m.to_dict() for m in messages]}


@app.post("/api/transcripts/{transcript_id}/messages", status_code=201)
async def add_transcript_message(
    transcript_id: str, data: MessageCreate, db: Session = Depends(get_db)
):
    """Add a chat message to a transcript."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    if data.role not in ("user", "assistant"):
        api_error("INVALID_ROLE", "Role must be 'user' or 'assistant'")

    message = add_message(db, transcript_id, data.role, data.content)
    return message.to_dict()


# ============================================================================
# Transcription & LLM Endpoints
# ============================================================================

# Upload limits (configurable via env vars)
MAX_UPLOAD_SIZE = config.MAX_UPLOAD_SIZE
ALLOWED_AUDIO_TYPES = config.ALLOWED_AUDIO_TYPES


@app.post("/api/transcribe")
@limiter.limit(config.RATE_LIMIT_TRANSCRIBE)
async def transcribe_audio(request: Request, audio: Annotated[UploadFile, File()]):
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready, still initializing", 503)

    # Validate content type
    content_type = audio.content_type or ""
    if content_type and not content_type.startswith("audio/"):
        api_error(
            "INVALID_FILE_TYPE",
            f"Invalid file type: {content_type}. Only audio files are allowed.",
        )

    suffix = os.path.splitext(audio.filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()

        # Validate file size
        if len(content) > MAX_UPLOAD_SIZE:
            api_error(
                "FILE_TOO_LARGE",
                f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB.",
            )

        tmp.write(content)
        tmp_path = tmp.name

    try:
        raw_text = service.transcribe(tmp_path)
        return {"success": True, "text": raw_text}

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        api_error(
            "TRANSCRIPTION_FAILED",
            "Transcription failed",
            500,
            str(e),
        )

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/clean")
@limiter.limit(config.RATE_LIMIT_CLEAN)
async def clean_text(request: Request, data: CleanRequest):
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    if not data.text:
        return {"success": True, "text": ""}

    try:
        cleaned_text = service.clean_with_llm(
            data.text, system_prompt=data.system_prompt
        )
        return {"success": True, "text": cleaned_text}

    except Exception as e:
        logger.error(f"LLM cleaning error: {e}")
        api_error("CLEANING_FAILED", "Text cleaning failed", 500, str(e))


@app.post("/api/generate-title")
@limiter.limit(config.RATE_LIMIT_CHAT)
async def generate_title(request: Request, data: GenerateTitleRequest):
    """Generate a short 2-3 word title for transcript text using LLM."""
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    if not data.text:
        return {"success": True, "title": "Untitled"}

    try:
        title = service.generate_title(data.text)
        return {"success": True, "title": title}

    except Exception as e:
        logger.error(f"Title generation error: {e}")
        # Fallback to first few words if LLM fails
        words = data.text.strip().split()[:3]
        fallback = " ".join(words) if words else "Untitled"
        return {"success": True, "title": fallback}


async def _get_rag_context(
    db: Session,
    transcript_id: str,
    message: str,
    include_history: bool,
    history_limit: int,
) -> tuple[list[str] | None, list[dict] | None]:
    """
    Get RAG context (relevant chunks and chat history) for a chat request.

    Returns:
        Tuple of (relevant_chunks, chat_history)
    """
    relevant_chunks = None
    chat_history = None

    # Get chat history
    if include_history:
        messages = get_messages_for_transcript(db, transcript_id)
        chat_history = [
            {"role": m.role, "content": m.content} for m in messages[-history_limit:]
        ]

    # Get relevant chunks via RAG
    if embedding_service and is_vector_store_available():
        try:
            if await embedding_service.is_available():
                query_embedding = await embedding_service.embed_text(message)
                chunks = search_similar_chunks(
                    db, transcript_id, query_embedding, top_k=5
                )
                if chunks:
                    relevant_chunks = [c.content for c in chunks]
                    logger.info(
                        f"RAG: Found {len(chunks)} relevant chunks for transcript {transcript_id}"
                    )
        except Exception as e:
            logger.warning(f"RAG lookup failed, using fallback: {e}")

    return relevant_chunks, chat_history


@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat(request: Request, data: ChatRequest, db: Session = Depends(get_db)):
    """Chat with RAG-enhanced context from transcript."""
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    relevant_chunks = None
    chat_history = None

    # If transcript_id provided, use RAG
    if data.transcript_id:
        transcript = get_transcript_by_id(db, data.transcript_id)
        if transcript:
            relevant_chunks, chat_history = await _get_rag_context(
                db,
                data.transcript_id,
                data.message,
                data.include_history,
                data.history_limit,
            )

            # Fallback to full context if no RAG chunks found
            if not relevant_chunks and not data.context:
                data.context = transcript.cleaned_text or transcript.raw_text

    try:
        response = service.chat(
            message=data.message,
            context=data.context,
            chat_history=chat_history,
            relevant_chunks=relevant_chunks,
            stream=False,
        )
        reply = response.choices[0].message.content
        return {"reply": reply, "used_rag": relevant_chunks is not None}

    except Exception as e:
        logger.error(f"Chat error: {e}")
        api_error("CHAT_FAILED", "Chat request failed", 500, str(e))


@app.post("/api/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(
    request: Request, data: ChatRequest, db: Session = Depends(get_db)
):
    """Stream chat responses with RAG support using Server-Sent Events."""
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    relevant_chunks = None
    chat_history = None

    # If transcript_id provided, use RAG
    if data.transcript_id:
        transcript = get_transcript_by_id(db, data.transcript_id)
        if transcript:
            relevant_chunks, chat_history = await _get_rag_context(
                db,
                data.transcript_id,
                data.message,
                data.include_history,
                data.history_limit,
            )

            # Fallback to full context if no RAG chunks found
            if not relevant_chunks and not data.context:
                data.context = transcript.cleaned_text or transcript.raw_text

    async def generate() -> AsyncGenerator[dict, None]:
        try:
            response = service.chat(
                message=data.message,
                context=data.context,
                chat_history=chat_history,
                relevant_chunks=relevant_chunks,
                stream=True,
            )

            # Use a queue to pass chunks from sync iterator to async generator
            queue: asyncio.Queue[str | None] = asyncio.Queue()
            loop = asyncio.get_running_loop()  # Get loop BEFORE starting thread

            def read_chunks() -> None:
                """Read chunks from sync iterator and put them in queue."""
                try:
                    for chunk in response:
                        if chunk.choices and chunk.choices[0].delta.content:
                            content = chunk.choices[0].delta.content
                            loop.call_soon_threadsafe(queue.put_nowait, content)
                finally:
                    # Signal completion
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            # Run sync iteration in thread pool
            loop.run_in_executor(None, read_chunks)

            # Yield chunks as they arrive
            while True:
                content = await queue.get()
                if content is None:
                    break
                yield {"event": "message", "data": content}

            yield {"event": "done", "data": ""}

        except Exception as e:
            logger.error(f"Stream chat error: {e}")
            yield {"event": "error", "data": str(e)}

    return EventSourceResponse(
        generate(),
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )


# ============================================================================
# RAG / Embedding Endpoints
# ============================================================================


async def _index_transcript(transcript_id: str, text: str) -> dict:
    """
    Index a transcript's text for RAG.

    Returns dict with status info.
    """
    if not text:
        return {"success": False, "error": "No text to index"}

    if not embedding_service:
        return {"success": False, "error": "Embedding service not configured"}

    if not is_vector_store_available():
        return {"success": False, "error": "Vector store not available"}

    try:
        if not await embedding_service.is_available():
            return {"success": False, "error": "Embedding service unavailable"}

        # Chunk and embed
        chunks = embedding_service.chunk_text(text)
        embeddings = await embedding_service.embed_batch([c["content"] for c in chunks])

        # Save to database
        db = SessionLocal()
        try:
            save_chunks_with_embeddings(db, transcript_id, chunks, embeddings)
        finally:
            db.close()

        logger.info(f"Indexed transcript {transcript_id} with {len(chunks)} chunks")
        return {"success": True, "chunks_created": len(chunks)}

    except Exception as e:
        logger.error(f"Indexing failed for {transcript_id}: {e}")
        return {"success": False, "error": str(e)}


@app.post("/api/transcripts/{transcript_id}/reindex")
@limiter.limit("10/minute")
async def reindex_transcript(
    request: Request,
    transcript_id: str,
    db: Session = Depends(get_db),
):
    """Recompute embeddings for a transcript."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    # Use cleaned text if available, else raw text
    text = transcript.cleaned_text or transcript.raw_text
    if not text:
        api_error("NO_TEXT", "Transcript has no text to index", 400)

    result = await _index_transcript(transcript_id, text)

    if not result["success"]:
        api_error("REINDEX_FAILED", result.get("error", "Unknown error"), 500)

    return {
        "success": True,
        "transcript_id": transcript_id,
        "chunks_created": result["chunks_created"],
    }


@app.get("/api/transcripts/{transcript_id}/chunks")
async def get_transcript_chunks_endpoint(
    transcript_id: str,
    db: Session = Depends(get_db),
):
    """Get chunks for a transcript (for debugging/inspection)."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    chunks = get_chunks_for_transcript(db, transcript_id)
    return {
        "transcript_id": transcript_id,
        "chunk_count": len(chunks),
        "chunks": [
            {
                "id": c.id,
                "chunkIndex": c.chunk_index,
                "content": (
                    c.content[:200] + "..." if len(c.content) > 200 else c.content
                ),
                "startChar": c.start_char,
                "endChar": c.end_char,
            }
            for c in chunks
        ],
    }


@app.get("/api/embeddings/status")
async def get_embeddings_status():
    """Check embedding service status."""
    if not embedding_service:
        return {
            "enabled": False,
            "available": False,
            "reason": "Embedding service not configured",
        }

    available = await embedding_service.is_available()
    vector_store = is_vector_store_available()

    return {
        "enabled": True,
        "available": available and vector_store,
        "embedding_service": {
            "available": available,
            "model": embedding_service.model,
            "base_url": embedding_service.base_url,
        },
        "vector_store": {
            "available": vector_store,
        },
    }


# ============================================================================
# Export Endpoints
# ============================================================================


@app.get("/api/transcripts/{transcript_id}/export")
@limiter.limit("30/minute")
async def export_transcript(
    request: Request,
    transcript_id: str,
    format: str = Query(default="md", regex="^(md|txt|pdf)$"),
    db: Session = Depends(get_db),
):
    """Export a transcript in various formats."""
    transcript = get_transcript_by_id(db, transcript_id)
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)

    messages = get_messages_for_transcript(db, transcript_id)

    if format == "md":
        content = generate_markdown(transcript, messages)
        return StreamingResponse(
            iter([content]),
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="{transcript.title}.md"'
            },
        )

    if format == "txt":
        content = generate_plaintext(transcript, messages)
        return StreamingResponse(
            iter([content]),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{transcript.title}.txt"'
            },
        )

    if format == "pdf":
        pdf_bytes = generate_pdf(transcript, messages)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{transcript.title}.pdf"'
            },
        )

    # Should never reach here due to regex validation, but satisfy type checker
    api_error("INVALID_FORMAT", f"Unsupported format: {format}", 400)


def generate_markdown(transcript, messages) -> str:
    """Generate Markdown export."""
    lines = [
        f"# {transcript.title}",
        "",
        f"**Created:** {transcript.created_at.strftime('%Y-%m-%d %H:%M:%S') if transcript.created_at else 'N/A'}",
        "",
    ]

    if transcript.raw_text:
        lines.extend(["## Original Transcript", "", transcript.raw_text, ""])

    if transcript.cleaned_text:
        lines.extend(["## Cleaned Transcript", "", transcript.cleaned_text, ""])

    if messages:
        lines.extend(["## Chat History", ""])
        for msg in messages:
            role = "**You:**" if msg.role == "user" else "**Assistant:**"
            lines.extend([role, "", msg.content, ""])

    return "\n".join(lines)


def generate_plaintext(transcript, messages) -> str:
    """Generate plain text export."""
    lines = [
        transcript.title,
        "=" * len(transcript.title),
        "",
        f"Created: {transcript.created_at.strftime('%Y-%m-%d %H:%M:%S') if transcript.created_at else 'N/A'}",
        "",
    ]

    if transcript.raw_text:
        lines.extend(["ORIGINAL TRANSCRIPT", "-" * 20, transcript.raw_text, ""])

    if transcript.cleaned_text:
        lines.extend(["CLEANED TRANSCRIPT", "-" * 18, transcript.cleaned_text, ""])

    if messages:
        lines.extend(["CHAT HISTORY", "-" * 12, ""])
        for msg in messages:
            role = "You:" if msg.role == "user" else "Assistant:"
            lines.extend([role, msg.content, ""])

    return "\n".join(lines)


def generate_pdf(transcript, messages) -> bytes:
    """Generate PDF export using ReportLab."""
    from io import BytesIO

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5 * inch)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        spaceBefore=12,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontSize=10,
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.gray,
    )

    story = []

    # Title
    story.append(Paragraph(transcript.title, title_style))
    created = (
        transcript.created_at.strftime("%Y-%m-%d %H:%M:%S")
        if transcript.created_at
        else "N/A"
    )
    story.append(Paragraph(f"Created: {created}", meta_style))
    story.append(Spacer(1, 12))

    # Original transcript
    if transcript.raw_text:
        story.append(Paragraph("Original Transcript", heading_style))
        story.append(Paragraph(transcript.raw_text, body_style))

    # Cleaned transcript
    if transcript.cleaned_text:
        story.append(Paragraph("Cleaned Transcript", heading_style))
        story.append(Paragraph(transcript.cleaned_text, body_style))

    # Chat history
    if messages:
        story.append(Paragraph("Chat History", heading_style))
        for msg in messages:
            role = "You:" if msg.role == "user" else "Assistant:"
            story.append(Paragraph(f"<b>{role}</b>", body_style))
            story.append(Paragraph(msg.content, body_style))
            story.append(Spacer(1, 6))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
