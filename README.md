# Local AI Transcript App

An AI-powered voice transcription application with a React frontend and FastAPI backend. Records audio in the browser, transcribes with Whisper, optionally cleans text with an LLM, and lets you chat about the latest transcript.

**Highlights**

- Browser recording and file upload
- Local Whisper speech-to-text
- Optional LLM cleaning (OpenAI API-compatible providers)
- Persistent transcript history and copy-to-clipboard
- Two-panel dashboard: Transcript (70%) + Chatbot (30%)

---

## Setup

### Dev Container (Recommended)

- Install Docker Desktop and VS Code with the Dev Containers extension
- Open the project in VS Code and choose “Reopen in Container”
- The container builds, installs dependencies, creates `backend/.env`, and starts an Ollama service

### Manual Setup

- Backend: Python 3.12+, install [uv](https://docs.astral.sh/uv/)
- Frontend: Node.js 20+, `npm` or `pnpm`
- Copy `backend/.env.example` to `backend/.env` and configure provider and model
- Start an LLM server (Ollama, LM Studio, or OpenAI-compatible)

Commands:

```bash
# Backend
cd backend
uv sync && uv run uvicorn app:app --reload --port 8000 --host 0.0.0.0 --timeout-keep-alive 600

# Frontend (pnpm)
cd frontend
pnpm install && pnpm run dev
# or with npm
npm install && npm run dev

# Open the app
http://localhost:5173
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                         Frontend                         │
│  React + Vite + TypeScript                               │
│  - App.tsx (layout)                                      │
│  - SiteHeader, AppSidebar                                │
│  - TranscriptPanel (record/upload/paste + LLM clean)     │
│  - ChatbotPanel (contextual chat on latest transcript)   │
│  - lib/history (localStorage transcript store)           │
│  - shadcn-style UI components (button, card, etc.)       │
│                                                          │
│  Vite dev server proxies `/api/*` to backend:8000        │
└───────────────▲──────────────────────────────────────────┘
                │
                │ HTTP (fetch)
                │
┌───────────────┴──────────────────────────────────────────┐
│                         Backend                          │
│  FastAPI                                                  │
│  - app.py (routes: status, system-prompt, transcribe,     │
│            clean, chat)                                   │
│  - transcription.py (Whisper + LLM cleaning service)      │
│  - .env (LLM/Whisper config)                              │
│  - pyproject.toml (deps, tooling)                         │
└──────────────────────────────────────────────────────────┘
```

Proxy config: `frontend/vite.config.ts` maps `/api` to `http://localhost:8000`.

---

## Backend API

Base URL: `http://localhost:8000`

- `GET /api/status`
  - Returns service readiness and configured models
- `GET /api/system-prompt`
  - Returns default system prompt text
- `POST /api/transcribe` (multipart form, `audio` file)
  - Returns `{ success: boolean, text?: string }`
- `POST /api/clean` (JSON)
  - Body: `{ text: string, system_prompt?: string }`
  - Returns `{ success: boolean, text?: string }`
- `POST /api/chat` (JSON)
  - Body: `{ message: string, context?: string }`
  - Returns `{ reply: string }`

Example:

```bash
curl -s http://localhost:8000/api/status

curl -s -X POST http://localhost:8000/api/clean \
  -H "Content-Type: application/json" \
  -d '{"text":"hello wrold","system_prompt":"fix typos"}'
```

---

## Frontend Components

- `src/App.tsx` – Main layout with header, sidebar, and two-panel grid
- `src/components/site-header.tsx` – App title and GitHub link
- `src/components/app-sidebar.tsx` – Transcript history, “New Transcript” button, theme toggle
- `src/components/transcript-panel.tsx` – Record/upload/paste, LLM cleaning, copy buttons
- `src/components/chatbot-panel.tsx` – Chat using latest transcript context
- `src/lib/history.ts` – Local storage for transcripts, update events
- `src/components/ui/*` – Reusable UI primitives

---

## Development Workflow

- Branching: feature branches; PRs to main
- Commit messages: clear, scoped changes
- Frontend:
  - Lint: `npm run lint`
  - Build: `npm run build` (includes TypeScript project build)
  - Preview: `npm run preview`
- Backend:
  - Format: `uv run black .`
  - Lint: `uv run ruff check .`
  - Run: `uv run uvicorn app:app --reload --port 8000`
- Environment:
  - Configure `backend/.env` from `backend/.env.example`
- Ports:
  - Frontend `5173`, Backend `8000` (proxied via Vite)

---

## Configuration Notes

- LLM providers: Ollama, LM Studio, OpenAI, or any OpenAI-compatible API
- Whisper model: set via `WHISPER_MODEL` in `.env`
- Vite proxy: adjust `vite.config.ts` if backend port changes

---

## Troubleshooting

- Microphone permissions: allow in browser settings
- Long processing: backend uses extended timeouts for large files
- LLM connectivity: ensure provider running; see `backend/.env`
