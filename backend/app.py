import logging
import os
import tempfile
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated, NoReturn

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from database import (
    add_message,
    create_transcript,
    delete_transcript,
    get_all_transcripts,
    get_db,
    get_messages_for_transcript,
    get_transcript_by_id,
    init_db,
    search_transcripts,
    update_transcript,
)
from transcription import TranscriptionService

load_dotenv()

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Request/Response models
class CleanRequest(BaseModel):
    text: str
    system_prompt: str | None = None


class ChatRequest(BaseModel):
    message: str
    context: str | None = None


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


class ErrorResponse(BaseModel):
    success: bool = False
    error: dict


service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    global service
    logger.info("Starting AI Transcript App...")

    # Initialize database
    init_db()
    logger.info("Database initialized")

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
    logger.info("Services ready!")
    yield


app = FastAPI(title="AI Transcript App", lifespan=lifespan)

# Register rate limiter with app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS for localhost development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
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
async def create_new_transcript(data: TranscriptCreate, db: Session = Depends(get_db)):
    """Create a new transcript."""
    transcript = create_transcript(
        db,
        title=data.title,
        raw_text=data.rawText,
        cleaned_text=data.cleanedText,
    )
    return transcript.to_dict()


@app.put("/api/transcripts/{transcript_id}")
async def update_existing_transcript(
    transcript_id: str, data: TranscriptUpdate, db: Session = Depends(get_db)
):
    """Update an existing transcript."""
    transcript = update_transcript(
        db,
        transcript_id,
        title=data.title,
        raw_text=data.rawText,
        cleaned_text=data.cleanedText,
    )
    if not transcript:
        api_error("TRANSCRIPT_NOT_FOUND", f"Transcript {transcript_id} not found", 404)
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

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_AUDIO_TYPES = {
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


@app.post("/api/transcribe")
@limiter.limit("5/minute")
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
@limiter.limit("20/minute")
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
@limiter.limit("30/minute")
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


@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat(request: Request, data: ChatRequest, db: Session = Depends(get_db)):
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    try:
        response = service.chat(
            message=data.message,
            context=data.context,
            stream=False,
        )
        reply = response.choices[0].message.content
        return {"reply": reply}

    except Exception as e:
        logger.error(f"Chat error: {e}")
        api_error("CHAT_FAILED", "Chat request failed", 500, str(e))


@app.post("/api/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, data: ChatRequest):
    """Stream chat responses using Server-Sent Events."""
    if not service:
        api_error("SERVICE_NOT_READY", "Service not ready", 503)

    async def generate() -> AsyncGenerator[dict, None]:
        try:
            response = service.chat(
                message=data.message,
                context=data.context,
                stream=True,
            )

            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield {"event": "message", "data": content}

            yield {"event": "done", "data": ""}

        except Exception as e:
            logger.error(f"Stream chat error: {e}")
            yield {"event": "error", "data": str(e)}

    return EventSourceResponse(generate())


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
