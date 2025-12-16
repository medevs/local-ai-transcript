# Local AI Transcript App

An AI-powered voice transcription application with a React frontend and FastAPI backend. Records audio in the browser, transcribes with Whisper, optionally cleans text with an LLM, and lets you chat about the latest transcript.

## Features

- Browser recording and file upload
- Local Whisper speech-to-text
- Optional LLM cleaning (OpenAI API-compatible providers)
- Streaming chat with transcript context
- Export to Markdown, TXT, or PDF
- Persistent transcript history (SQLite)
- Keyboard shortcuts (press `?` to see all)
- Dark/light theme

---

## Quick Start with Docker

The easiest way to run the app is with Docker Compose:

```bash
# Clone the repository
git clone <repo-url>
cd local-ai-transcript-app

# Copy environment template and configure
cp backend/.env.example backend/.env
# Edit backend/.env with your LLM configuration

# Start services (frontend + backend)
docker compose up -d

# Wait for services to start (Whisper model downloads on first run)
# This can take a few minutes depending on your internet speed

# Open the app
open http://localhost:3000
```

### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React app served via Nginx |
| Backend | 8000 | FastAPI with Whisper |

> **Note:** Ollama is not included by default. To use local LLM, either run Ollama separately (`ollama serve`) or uncomment the Ollama service in `docker-compose.yml`.

### Configuration

Create a `.env` file in the `backend/` directory to customize:

```bash
# LLM Model (default: llama2)
LLM_MODEL=llama2

# Whisper Model (default: base.en)
# Options: tiny, tiny.en, base, base.en, small, small.en, medium, large-v3
WHISPER_MODEL=base.en

# Optional: Fallback to OpenAI if Ollama fails
LLM_FALLBACK_BASE_URL=https://api.openai.com/v1
LLM_FALLBACK_API_KEY=sk-your-key
LLM_FALLBACK_MODEL=gpt-3.5-turbo
```

### Docker Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Remove all data (reset)
docker compose down -v
```

---

## Manual Setup (Development)

### Prerequisites

- Python 3.12+
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- An LLM server (Ollama, LM Studio, or OpenAI API key)

### Backend Setup

```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your LLM configuration
# For Ollama: LLM_BASE_URL=http://localhost:11434/v1

# Install dependencies
uv sync

# Start the server
uv run uvicorn app:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:5173
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  React 19 + Vite + TypeScript + Tailwind                   │
│  └── Nginx (production) or Vite dev server                 │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP
┌───────────────────────┴─────────────────────────────────────┐
│                         Backend                             │
│  FastAPI + SQLAlchemy + SQLite                             │
│  ├── Whisper (speech-to-text)                              │
│  └── OpenAI-compatible LLM client                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────┐
│                         Ollama                              │
│  Local LLM server (llama2, mistral, etc.)                  │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Service health check |
| GET | `/api/system-prompt` | Get default LLM cleaning prompt |
| GET | `/api/transcripts` | List all transcripts |
| POST | `/api/transcripts` | Create transcript |
| GET | `/api/transcripts/:id` | Get transcript |
| PUT | `/api/transcripts/:id` | Update transcript |
| DELETE | `/api/transcripts/:id` | Delete transcript |
| GET | `/api/transcripts/:id/messages` | Get chat messages for transcript |
| POST | `/api/transcripts/:id/messages` | Add chat message to transcript |
| GET | `/api/transcripts/:id/export?format=md\|txt\|pdf` | Export transcript |
| POST | `/api/transcribe` | Transcribe audio file |
| POST | `/api/clean` | Clean text with LLM |
| POST | `/api/generate-title` | Generate AI title |
| POST | `/api/chat` | Chat (non-streaming) |
| POST | `/api/chat/stream` | Chat (SSE streaming) |

### Rate Limits

The following endpoints have rate limiting to prevent abuse:

| Endpoint | Limit | Reason |
|----------|-------|--------|
| `/api/transcribe` | 5/minute | CPU-intensive Whisper processing |
| `/api/clean` | 20/minute | LLM API call |
| `/api/generate-title` | 30/minute | LLM API call (fast) |
| `/api/chat` | 20/minute | LLM API call |
| `/api/chat/stream` | 20/minute | LLM streaming |
| `/api/transcripts/{id}/export` | 30/minute | PDF generation |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Hold to record, release to stop |
| `Ctrl/⌘ + N` | New transcript |
| `Ctrl/⌘ + Enter` | Submit text input |
| `?` | Show all shortcuts |
| `Escape` | Close dialogs |

## LLM Providers

The app works with any OpenAI API-compatible provider:

- **Ollama** (default, local): `http://localhost:11434/v1`
- **OpenAI**: `https://api.openai.com/v1`
- **LM Studio**: `http://localhost:1234/v1`
- **Groq**: `https://api.groq.com/openai/v1`
- **Together AI**: `https://api.together.xyz/v1`

Configure via environment variables in `.env` or docker-compose.

---

## Troubleshooting

### Microphone not working
- Allow microphone access in browser settings
- Use HTTPS in production (required for `getUserMedia`)

### Transcription slow
- Use a smaller Whisper model (`tiny.en` or `base.en`)
- Ensure GPU acceleration is available

### LLM not responding
- Check that Ollama is running: `curl http://localhost:11434/api/tags`
- Pull a model: `ollama pull llama2`
- Check logs: `docker compose logs ollama`

### Docker build fails
- Ensure Docker has enough memory (at least 4GB)
- Try rebuilding: `docker compose build --no-cache`
