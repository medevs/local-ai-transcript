# Claude Code Instructions

This file contains instructions for Claude Code when working on this project.

## Documentation Update Rule

**IMPORTANT**: After completing any task that modifies the codebase, always update the relevant documentation files:

### Files to Update

1. **`README.md`** - Update when:
   - Adding/removing/changing API endpoints
   - Changing Docker configuration or services
   - Adding new features users need to know about
   - Changing setup/installation instructions
   - Adding new keyboard shortcuts
   - Changing environment variables

2. **`CODEBASE_GUIDE.md`** - Update when:
   - Adding/removing/renaming files or directories
   - Adding new components, hooks, or modules
   - Changing the database schema
   - Modifying build or deployment processes
   - Adding new dependencies
   - Changing the technology stack

3. **`GAP_ANALYSIS_REPORT.md`** - Update when:
   - Fixing issues identified in the report (mark as resolved)
   - Implementing missing features (move from "Missing" to "Implemented")
   - Adding tests (update coverage metrics)
   - Addressing security concerns (update security section)
   - Completing technical debt items (mark as done)

### Update Checklist

After each task, ask yourself:
- [ ] Did I add/remove any files? → Update `CODEBASE_GUIDE.md` directory structure
- [ ] Did I add/change API endpoints? → Update both `README.md` and `CODEBASE_GUIDE.md`
- [ ] Did I add new features? → Update `README.md` features list
- [ ] Did I fix a gap/issue? → Update `GAP_ANALYSIS_REPORT.md`
- [ ] Did I change dependencies? → Update `CODEBASE_GUIDE.md` tech stack
- [ ] Did I modify Docker/deployment? → Update both `README.md` and `CODEBASE_GUIDE.md`

## Project Context

This is a local-first AI transcription application with:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy + SQLite
- **AI**: Whisper (speech-to-text) + OpenAI-compatible LLM (text cleaning, chat)

## Code Style

### Frontend
- Use TypeScript strict mode
- Use functional components with hooks
- Use Zod for API response validation
- Follow existing component patterns in `src/components/`

### Backend
- Use type hints throughout
- Use Pydantic models for request/response validation
- Follow existing patterns in `app.py`
- Run `ruff check` and `black` before committing

## Testing (Priority)

This project currently has **0% test coverage**. When adding new features:
- Consider adding tests (this is a high-priority gap)
- Backend: Use pytest + pytest-asyncio + httpx
- Frontend: Use Vitest + React Testing Library

## Git Commit Rules

- **Commit messages must be 15 words or less**
- Use conventional commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
- Keep messages concise and descriptive

## Security Notes

- Never commit `.env` files with real credentials
- The `backend/.env` should be in `.gitignore`
- Use `backend/.env.example` as the template
- Rate limiting and authentication are missing (documented gaps)
