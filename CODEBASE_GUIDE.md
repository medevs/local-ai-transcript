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
│   ├── public/
│   │   └── logo.svg
│   └── src/
│       ├── App.tsx
│       ├── App.css
│       ├── index.css
│       ├── main.tsx
│       ├── lib/
│       │   ├── history.ts
│       │   └── utils.ts
│       ├── hooks/
│       │   └── use-mobile.ts
│       └── components/
│           ├── site-header.tsx
│           ├── app-sidebar.tsx
│           ├── nav-documents.tsx
│           ├── transcript-panel.tsx
│           ├── chatbot-panel.tsx
│           └── ui/
│               ├── button.tsx
│               ├── card.tsx
│               ├── checkbox.tsx
│               ├── dropdown-menu.tsx
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
│   ├── app.py
│   ├── transcription.py
│   ├── system_prompt.txt
│   ├── pyproject.toml
│   ├── uv.lock
│   └── .env.example
├── .devcontainer/
│   ├── Dockerfile
│   ├── devcontainer.json
│   ├── docker-compose.yml
│   └── post-create.sh
├── README.md
└── CODEBASE_GUIDE.md
```

## Module Organization

- Frontend
  - `src/App.tsx` – Layout container for header, sidebar, and content grid
  - `src/components/transcript-panel.tsx` – Recording, upload, paste text, LLM cleaning
  - `src/components/chatbot-panel.tsx` – Contextual chat over latest transcript
  - `src/components/app-sidebar.tsx` – Transcript history, new transcript trigger, theme toggle
  - `src/components/site-header.tsx` – App title and GitHub link
  - `src/lib/history.ts` – Local storage CRUD and update events
  - `src/components/ui/*` – UI primitives used across the app

- Backend
  - `backend/app.py` – FastAPI routes: `/api/status`, `/api/system-prompt`, `/api/transcribe`, `/api/clean`, `/api/chat`
  - `backend/transcription.py` – `TranscriptionService` (Whisper + OpenAI-compatible LLM client)
  - `backend/system_prompt.txt` – Default prompt used by cleaning
  - `backend/pyproject.toml` – Dependencies and tooling configuration
  - `backend/.env.example` – Provider and model configuration template

## Key Configuration Files

- `frontend/vite.config.ts` – Vite plugins, alias `@` → `src`, dev proxy for `/api` → `http://localhost:8000`
- `backend/pyproject.toml` – Python dependencies and Black/Ruff tool config
- `backend/.env.example` – Example variables for LLM and Whisper
- `frontend/package.json` – Scripts: `dev`, `build`, `lint`, `preview`
- `.devcontainer/*` – Containerized development setup for app + Ollama

## Build and Deployment

- Development
  - Backend: `uv sync && uv run uvicorn app:app --reload --port 8000`
  - Frontend: `pnpm install && pnpm run dev` (or `npm install && npm run dev`)
  - Access: `http://localhost:5173` (frontend dev server, proxied to backend `8000`)

- Production (reference)
  - Frontend: `npm run build` → outputs `frontend/dist/`
  - Serve static assets via any web server; backend with `uvicorn app:app` behind a reverse proxy
  - Configure environment via `backend/.env` (copy from `.env.example`)

## Notes

- The app is OpenAI API-compatible (Ollama, LM Studio, OpenAI, etc.)
- Adjust proxy settings in `vite.config.ts` if backend port or origin changes
