# AI Transcript App – Codebase Guide

This guide reflects the current, implemented architecture of the Local AI Transcript App and provides a concise reference to structure, modules, configuration, and build/deployment processes.

## Directory Hierarchy

```
local-ai-transcript-app/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── components.json
│   ├── eslint.config.js
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── Dockerfile                 # Multi-stage build (Node → Nginx)
│   ├── nginx.conf                 # Production server config
│   ├── public/
│   │   └── logo.svg
│   └── src/
│       ├── App.tsx
│       ├── App.css
│       ├── index.css
│       ├── main.tsx
│       ├── lib/
│       │   ├── api-client.ts      # Typed API wrapper with Zod validation
│       │   ├── history.ts         # Transcript CRUD and events
│       │   └── utils.ts           # Utility functions (cn, etc.)
│       ├── hooks/
│       │   ├── use-audio-recorder.ts      # Web Audio API recording
│       │   ├── use-keyboard-shortcuts.ts  # Shortcut registration system
│       │   └── use-mobile.ts              # Mobile detection
│       └── components/
│           ├── site-header.tsx
│           ├── app-sidebar.tsx            # Navigation, settings, theme
│           ├── nav-documents.tsx          # Transcript list with delete
│           ├── transcript-panel.tsx       # Main transcription UI
│           ├── chatbot-panel.tsx          # Chat interface
│           ├── error-boundary.tsx         # Error catching component
│           ├── keyboard-shortcuts-dialog.tsx
│           ├── transcript/
│           │   ├── voice-recorder.tsx     # Recording UI with waveform
│           │   ├── input-methods.tsx      # Upload/paste tabs
│           │   ├── transcript-results.tsx # Display results
│           │   ├── export-dialog.tsx      # Export format selection
│           │   └── settings-section.tsx   # AI settings panel
│           └── ui/
│               ├── avatar.tsx
│               ├── badge.tsx
│               ├── button.tsx
│               ├── card.tsx
│               ├── checkbox.tsx
│               ├── dropdown-menu.tsx
│               ├── expandable-chat.tsx    # Floating chat component
│               ├── input.tsx
│               ├── label.tsx
│               ├── select.tsx
│               ├── separator.tsx
│               ├── sheet.tsx
│               ├── sidebar.tsx
│               ├── skeleton.tsx
│               ├── table.tsx
│               ├── toggle-group.tsx
│               ├── toggle.tsx
│               └── tooltip.tsx
├── backend/
│   ├── app.py                     # FastAPI routes (19 endpoints)
│   ├── transcription.py           # Whisper + LLM service
│   ├── database.py                # SQLAlchemy models and CRUD
│   ├── system_prompt.txt          # Default LLM cleaning prompt
│   ├── pyproject.toml             # Dependencies and tool config
│   ├── uv.lock                    # Dependency lock file
│   ├── Dockerfile                 # Python 3.12 image
│   ├── .env.example               # Configuration template
│   ├── pytest.ini                 # Test configuration
│   ├── transcripts.db             # SQLite database (generated)
│   └── tests/                     # Backend test suite (81 tests)
│       ├── conftest.py            # Fixtures: test DB, mocked services
│       ├── test_database.py       # Database CRUD tests (26)
│       ├── test_transcription.py  # TranscriptionService tests (20)
│       ├── test_api_transcripts.py # Transcript API tests (21)
│       └── test_api_ai.py         # AI endpoint tests (14)
├── .devcontainer/
│   ├── Dockerfile
│   ├── devcontainer.json
│   ├── docker-compose.yml
│   └── post-create.sh
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI pipeline
├── .claude/
│   └── settings.local.json        # Claude Code permissions
├── docker-compose.yml             # Production orchestration
├── CLAUDE.md                      # Claude Code instructions (doc update rules)
├── README.md                      # User documentation
├── CODEBASE_GUIDE.md              # This file
└── GAP_ANALYSIS_REPORT.md         # Product & engineering gap analysis
```

## Module Organization

### Frontend

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout with sidebar, header, content grid, and floating chat |
| `src/main.tsx` | Vite entry point, renders App |
| `src/components/transcript-panel.tsx` | Recording, upload, paste, LLM cleaning, title generation |
| `src/components/chatbot-panel.tsx` | Streaming chat with transcript context |
| `src/components/app-sidebar.tsx` | Navigation, transcript history, theme toggle, settings dialog |
| `src/components/nav-documents.tsx` | Transcript list with delete confirmation |
| `src/components/site-header.tsx` | App title and GitHub link |
| `src/components/error-boundary.tsx` | Error catching and recovery UI |
| `src/components/keyboard-shortcuts-dialog.tsx` | Keyboard shortcut help modal |
| `src/lib/api-client.ts` | Typed API wrapper with Zod schema validation |
| `src/lib/history.ts` | Transcript CRUD via API, event dispatching |
| `src/lib/utils.ts` | Utility functions (className merge) |
| `src/hooks/use-audio-recorder.ts` | Web Audio API for recording, waveform, volume |
| `src/hooks/use-keyboard-shortcuts.ts` | Global keyboard shortcut system |
| `src/components/ui/*` | Radix UI-based primitives |

### Backend

| File | Purpose |
|------|---------|
| `app.py` | FastAPI application with 19 API endpoints |
| `transcription.py` | `TranscriptionService` class (Whisper STT + LLM client) |
| `database.py` | SQLAlchemy models (`Transcript`, `ChatMessage`, `Setting`) and CRUD |
| `system_prompt.txt` | Default prompt for LLM text cleaning |
| `pyproject.toml` | Python dependencies, Ruff/Black configuration |
| `.env.example` | Environment variable template |

### API Endpoints (19 total)

**Status & System:**
- `GET /api/status` – Service health check
- `GET /api/system-prompt` – Get default cleaning prompt

**Transcripts:**
- `GET /api/transcripts` – List all transcripts
- `POST /api/transcripts` – Create transcript
- `GET /api/transcripts/:id` – Get single transcript
- `PUT /api/transcripts/:id` – Update transcript
- `DELETE /api/transcripts/:id` – Delete transcript

**Chat Messages:**
- `GET /api/transcripts/:id/messages` – Get chat history
- `POST /api/transcripts/:id/messages` – Add message

**Export:**
- `GET /api/transcripts/:id/export` – Export (md/txt/pdf)

**AI Processing:**
- `POST /api/transcribe` – Transcribe audio file
- `POST /api/clean` – Clean text with LLM
- `POST /api/generate-title` – Generate AI title
- `POST /api/chat` – Non-streaming chat
- `POST /api/chat/stream` – Streaming chat (SSE)

## Database Schema

```sql
-- Transcripts table
CREATE TABLE transcripts (
    id VARCHAR PRIMARY KEY,         -- UUID
    title VARCHAR NOT NULL,
    raw_text TEXT,
    cleaned_text TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

-- Chat messages table
CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY,
    transcript_id VARCHAR REFERENCES transcripts(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL,          -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at DATETIME
);

-- Settings table (key-value store)
CREATE TABLE settings (
    key VARCHAR PRIMARY KEY,
    value TEXT
);
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `frontend/vite.config.ts` | Vite plugins, path alias `@` → `src`, dev proxy `/api` → `:8000` |
| `frontend/nginx.conf` | Production: API proxy, SPA routing, gzip, caching |
| `frontend/Dockerfile` | Multi-stage build: Node builder → Nginx production |
| `backend/pyproject.toml` | Python dependencies, Ruff lint rules, Black config |
| `backend/Dockerfile` | Python 3.12 + FFmpeg + uv package manager |
| `backend/.env.example` | LLM and Whisper configuration template |
| `docker-compose.yml` | Production orchestration (frontend + backend) |
| `.github/workflows/ci.yml` | CI pipeline: lint, format, type-check, build |

## Build and Deployment

### Development

**Backend:**
```bash
cd backend
cp .env.example .env          # Configure LLM settings
uv sync                       # Install dependencies
uv run uvicorn app:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
pnpm install                  # or npm install
pnpm run dev                  # or npm run dev
# Open http://localhost:5173
```

### Production (Docker)

```bash
# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your LLM provider settings

# Build and start
docker compose up -d --build

# Access at http://localhost:3000
```

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR to main:

**Frontend:**
1. Install dependencies (`npm ci`)
2. Lint (`npm run lint`)
3. Type check (`npx tsc --noEmit`)
4. Build (`npm run build`)

**Backend:**
1. Install dependencies (`uv sync --dev`)
2. Lint (`uv run ruff check .`)
3. Format check (`uv run black --check .`)
4. Type check (`uv run pyright`) – optional, warn only
5. Run tests (`uv run pytest --tb=short -v`) – 81 tests

## Technology Stack

### Frontend
- React 19.2.0
- TypeScript 5.9.3
- Vite 7.2.4
- Tailwind CSS 4.1.18
- Radix UI (headless components)
- Framer Motion (animations)
- Zod (schema validation)
- pnpm (package manager)

### Backend
- Python 3.12
- FastAPI 0.115.0
- SQLAlchemy 2.0 (ORM)
- faster-whisper 1.2.0 (speech-to-text)
- OpenAI SDK 1.0.0 (LLM client)
- ReportLab 4.0 (PDF generation)
- slowapi 0.1.9 (rate limiting)
- uvicorn (ASGI server)

### Infrastructure
- Docker + Docker Compose
- Nginx (reverse proxy, static serving)
- SQLite (database)
- GitHub Actions (CI)

## Notes

- The app is **OpenAI API-compatible** – works with Ollama, LM Studio, OpenAI, Groq, Together AI
- Adjust proxy settings in `vite.config.ts` if backend port changes
- Default Whisper model is `base.en` – change via `WHISPER_MODEL` env var
- Transcript history persists in SQLite at `backend/transcripts.db`
- Docker volumes persist database and Whisper model cache between restarts
