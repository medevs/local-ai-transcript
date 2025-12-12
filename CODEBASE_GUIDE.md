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
# AI Transcript App - Comprehensive Codebase Guide

A complete tutorial and technical reference for understanding and learning from this AI-powered voice transcription application with **agentic capabilities**.

> **Branch:** This guide documents the `checkpoint-agentic-openrouter` branch which includes the full agentic system with tool calling.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack Deep Dive](#tech-stack-deep-dive)
3. [Architecture & Design Patterns](#architecture--design-patterns)
4. [Directory Structure](#directory-structure)
5. [Agentic System Tutorial](#agentic-system-tutorial)
6. [Tool Framework](#tool-framework)
7. [Frontend Tutorial](#frontend-tutorial)
8. [Backend Tutorial](#backend-tutorial)
9. [Data Flow & API Reference](#data-flow--api-reference)
10. [Development Environment](#development-environment)
11. [Configuration Guide](#configuration-guide)
12. [Code Quality Standards](#code-quality-standards)
13. [Learning Resources](#learning-resources)

---

## Project Overview

### What is This Project?

**AI Transcript App** is a full-stack, AI-powered voice transcription application that combines:
- Browser-based voice recording
- Local AI speech-to-text using Whisper
- **Agentic AI system** that autonomously analyzes transcripts and executes tools
- Automatic generation of incident reports, decision records, and calendar reminders

### Primary Use Case

Transform meeting recordings into **actionable outputs**:
- **Incident Reports** - Structured documentation for production issues
- **Decision Records (ADRs)** - Architecture Decision Records for technical decisions
- **Calendar Reminders** - `.ics` files with action items and deadlines

### What Makes This "Agentic"?

Unlike simple transcription apps, this project features an **AI agent** that:
1. Analyzes the transcript content
2. Autonomously decides which tools to use
3. Executes tools with extracted parameters
4. Generates a summary of actions taken

This is a practical implementation of the **ReAct (Reasoning + Acting)** pattern using OpenAI function calling.

### Why This Stack?

This project serves as a portfolio piece demonstrating:
- Modern React patterns with TypeScript
- Python FastAPI backend development
- **Agentic AI with tool calling**
- AI/ML integration (Whisper, LLMs)
- Docker containerization
- Full-stack application architecture

---

## Tech Stack Deep Dive

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.0 | UI library for building component-based interfaces |
| **TypeScript** | 5.9.3 | Static typing for JavaScript |
| **Vite** | 7.1.12 | Fast build tool and development server |
| **Lucide React** | 0.552.0 | Modern icon library |
| **CSS Modules** | Built-in | Scoped component styling |

#### Why These Choices?

**React 19** - The latest React version with improved performance, concurrent features, and the new compiler. Industry standard for modern web apps.

**TypeScript** - Catches errors at compile time, improves IDE support, and makes refactoring safer. Essential for production applications.

**Vite** - Extremely fast development server with hot module replacement (HMR). Much faster than Create React App or Webpack for development.

**CSS Modules** - Automatically scopes CSS to components, preventing style conflicts without the overhead of CSS-in-JS libraries.

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.115.0 | Modern Python web framework for APIs |
| **Uvicorn** | 0.32.0 | ASGI server to run FastAPI |
| **faster-whisper** | 1.2.0 | Optimized Whisper implementation for speech-to-text |
| **OpenAI SDK** | 1.0.0 | Client for OpenAI-compatible LLM APIs |
| **Python** | 3.12+ | Programming language |
| **uv** | Latest | Fast Python package manager |

#### Why These Choices?

**FastAPI** - Automatic API documentation, type validation with Pydantic, async support, and excellent performance. The modern standard for Python APIs.

**faster-whisper** - CTranslate2-based implementation that's 4x faster than OpenAI's Whisper with lower memory usage. Supports CPU, CUDA, and Metal acceleration.

**uv** - Written in Rust, 10-100x faster than pip. Modern dependency management with lock files.

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization for consistent environments |
| **Docker Compose** | Multi-container orchestration |
| **Dev Containers** | VS Code development environment |
| **Ollama** | Local LLM server |

---

## Architecture & Design Patterns

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    React Application                       │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │  │
│  │  │ Recording  │ │   Upload   │ │    Text Input      │   │  │
│  │  │ Component  │ │ Component  │ │    Component       │   │  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────────┬──────────┘   │  │
│  │        │              │                   │              │  │
│  │        └──────────────┴───────────────────┘              │  │
│  │                       │                                   │  │
│  │              ┌────────▼────────┐                         │  │
│  │              │   API Client    │                         │  │
│  │              │  (fetch calls)  │                         │  │
│  │              └────────┬────────┘                         │  │
│  └───────────────────────┼──────────────────────────────────┘  │
│                          │ Vite Proxy (/api/*)                  │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Server                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │  │
│  │  │ /api/status  │ │/api/transcribe│ │   /api/process   │   │  │
│  │  └──────────────┘ └──────┬───────┘ └────────┬─────────┘   │  │
│  │                          │                   │             │  │
│  │              ┌───────────▼───────────────────▼──────────┐  │  │
│  │              │       TranscriptionService               │  │  │
│  │              │  ┌─────────────┐  ┌─────────────────┐   │  │  │
│  │              │  │   Whisper   │  │   LLM Client    │   │  │  │
│  │              │  │   Model     │  │   (OpenAI SDK)  │   │  │  │
│  │              │  └─────────────┘  └────────┬────────┘   │  │  │
│  │              └────────────────────────────┼────────────┘  │  │
│  │                                           │               │  │
│  │              ┌────────────────────────────▼────────────┐  │  │
│  │              │              AI AGENT                   │  │  │
│  │              │  ┌─────────────────────────────────┐   │  │  │
│  │              │  │        Tool Registry            │   │  │  │
│  │              │  │  ┌─────────┐ ┌─────────────┐   │   │  │  │
│  │              │  │  │Calendar │ │  Incident   │   │   │  │  │
│  │              │  │  │  Tool   │ │   Tool      │   │   │  │  │
│  │              │  │  └─────────┘ └─────────────┘   │   │  │  │
│  │              │  │  ┌─────────────────────────┐   │   │  │  │
│  │              │  │  │   Decision Record Tool  │   │   │  │  │
│  │              │  │  └─────────────────────────┘   │   │  │  │
│  │              │  └─────────────────────────────────┘   │  │  │
│  │              └────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Ollama / OpenAI   │
                         │   (LLM Provider)    │
                         │   Port 11434        │
                         └─────────────────────┘
```

### Design Patterns Used

#### 1. Singleton Pattern (Backend)

The `TranscriptionService` is instantiated once at application startup and reused for all requests:

```python
# app.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the transcription service on startup."""
    global transcription_service
    transcription_service = TranscriptionService()
    yield
```

**Why?** Loading the Whisper model is expensive (takes several seconds). Loading once and reusing is much more efficient.

#### 2. Component Composition (Frontend)

React components are composed together to build the UI:

```
App
├── Header
├── RecordButton
├── UploadZone
├── TextInputZone
├── SettingsPanel
│   └── TextBox
├── TranscriptionResults
│   ├── TextBox (raw)
│   └── TextBox (cleaned)
└── Footer
```

**Why?** Promotes reusability, testability, and separation of concerns.

#### 3. Proxy Pattern (Development)

Vite proxies API requests to the backend:

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
}
```

**Why?** Avoids CORS issues during development while keeping frontend and backend on different ports.

#### 4. Strategy Pattern (LLM Integration)

The OpenAI SDK client can connect to any OpenAI-compatible API:

```python
self.llm_client = OpenAI(
    base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
    api_key=os.getenv("LLM_API_KEY", "ollama"),
)
```

**Why?** Swap between Ollama, OpenAI, LM Studio, or any other provider by changing environment variables.

#### 5. Agent Pattern (Agentic AI)

The Agent class implements a reasoning-and-acting loop:

```python
class Agent:
    def process_transcript(self, transcript: str) -> dict:
        # 1. Reasoning: LLM decides which tools to use
        tool_calls = self._select_tools(transcript)

        # 2. Acting: Execute the selected tools
        results = self._execute_tools(tool_calls)

        # 3. Reflection: Summarize actions taken
        summary = self._generate_summary(transcript, tool_calls, results)

        return {"tool_calls": tool_calls, "results": results, "summary": summary}
```

**Why?** Enables autonomous decision-making. The LLM analyzes context and chooses appropriate actions without hardcoded rules.

#### 6. Registry Pattern (Tool Management)

Tools are registered in a central registry for discovery and execution:

```python
tool_registry = ToolRegistry()
tool_registry.register(CalendarTool())
tool_registry.register(IncidentTool())
tool_registry.register(DecisionRecordTool())

# Agent uses registry to find and execute tools
agent = Agent(llm_client, model, tool_registry)
```

**Why?** Decouples tool implementation from the agent. New tools can be added without modifying the agent code.

---

## Directory Structure

```
local-ai-transcript-app/
│
├── frontend/                      # React TypeScript Application
│   ├── src/
│   │   ├── components/           # UI Components
│   │   │   ├── Box.tsx          # Reusable container component
│   │   │   ├── Box.module.css
│   │   │   ├── ErrorMessage.tsx # Error notification component
│   │   │   ├── ErrorMessage.module.css
│   │   │   ├── Footer.tsx       # Page footer
│   │   │   ├── Footer.module.css
│   │   │   ├── Header.tsx       # Page header
│   │   │   ├── Header.module.css
│   │   │   ├── RecordButton.tsx # Microphone recording
│   │   │   ├── RecordButton.module.css
│   │   │   ├── SettingsPanel.tsx # LLM settings
│   │   │   ├── SettingsPanel.module.css
│   │   │   ├── Spinner.tsx      # Loading indicator
│   │   │   ├── Spinner.module.css
│   │   │   ├── TextBox.tsx      # Text display/input
│   │   │   ├── TextBox.module.css
│   │   │   ├── TextInputZone.tsx # Manual text input
│   │   │   ├── TextInputZone.module.css
│   │   │   ├── TranscriptionResults.tsx # Results display
│   │   │   ├── TranscriptionResults.module.css
│   │   │   ├── UploadZone.tsx   # File upload
│   │   │   └── UploadZone.module.css
│   │   │
│   │   ├── styles/
│   │   │   └── variables.css    # CSS custom properties (design system)
│   │   │
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript interfaces
│   │   │
│   │   ├── App.tsx              # Main application component
│   │   ├── App.css              # Global app styles
│   │   ├── index.css            # Global CSS reset
│   │   └── main.tsx             # React entry point
│   │
│   ├── public/                   # Static assets
│   ├── index.html               # HTML template
│   ├── package.json             # Dependencies & scripts
│   ├── tsconfig.json            # TypeScript config
│   ├── vite.config.ts           # Vite build config
│   ├── eslint.config.js         # Linting rules
│   └── .prettierrc              # Formatting rules
│
├── backend/                      # FastAPI Python Application
│   ├── app.py                   # FastAPI server & routes
│   ├── agent.py                 # AI Agent implementation
│   ├── transcription.py         # Whisper transcription service
│   ├── system_prompt.txt        # LLM instructions
│   ├── tools/                   # Agentic tool implementations
│   │   ├── __init__.py          # Exports ToolRegistry
│   │   ├── base.py              # Abstract Tool base class
│   │   ├── registry.py          # Tool registry for management
│   │   ├── calendar_tool.py     # Creates .ics calendar files
│   │   ├── incident_tool.py     # Generates incident reports
│   │   └── decision_record_tool.py  # Creates ADR documents
│   ├── incident_reports/        # Generated incident reports (output)
│   ├── decision_records/        # Generated ADRs (output)
│   ├── pyproject.toml           # Python project config
│   ├── uv.lock                  # Dependency lock file
│   └── .env.example             # Environment template
│
├── .devcontainer/               # Development Container
│   ├── devcontainer.json        # VS Code config
│   ├── docker-compose.yml       # Container orchestration
│   ├── Dockerfile               # Build instructions
│   └── post-create.sh           # Setup script
│
├── .vscode/                     # VS Code settings
│   └── settings.json
│
├── README.md                    # Project documentation
└── CODEBASE_GUIDE.md           # This file
```

---

## Agentic System Tutorial

This section explains the AI agent architecture - the core differentiator of this project.

### What is an AI Agent?

An AI agent is a system that can:
1. **Perceive** - Understand input (in our case, transcripts)
2. **Reason** - Decide what actions to take
3. **Act** - Execute tools to accomplish goals
4. **Reflect** - Summarize what was done

### The Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           AGENT WORKFLOW                             │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   PHASE 1    │    │   PHASE 2    │    │      PHASE 3         │  │
│  │    Tool      │───▶│    Tool      │───▶│     Summary          │  │
│  │  Selection   │    │  Execution   │    │    Generation        │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                   │                      │                │
│         ▼                   ▼                      ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │ LLM analyzes │    │ Execute each │    │ LLM generates user-  │  │
│  │ transcript & │    │ selected tool│    │ friendly summary of  │  │
│  │ picks tools  │    │ with params  │    │ actions taken        │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Implementation

**agent.py** - The core agent class:

```python
class Agent:
    """AI agent that analyzes transcripts and executes tools."""

    def __init__(self, llm_client: OpenAI, model: str, tool_registry: ToolRegistry):
        self.llm_client = llm_client
        self.model = model
        self.tool_registry = tool_registry

    def process_transcript(self, transcript: str) -> dict[str, Any]:
        """Process transcript: LLM selects tools, execute them, generate summary."""
        # Phase 1: Ask LLM to select appropriate tools
        tool_calls = self._select_tools(transcript)

        # Phase 2: Execute the selected tools
        results = self._execute_tools(tool_calls)

        # Phase 3: Generate user-friendly summary
        summary = self._generate_summary(transcript, tool_calls, results)

        return {
            "tool_calls": tool_calls,
            "results": results,
            "summary": summary,
            "success": True,
        }
```

### Phase 1: Tool Selection with Function Calling

The agent uses **OpenAI function calling** to let the LLM decide which tools to use:

```python
def _select_tools(self, transcript: str) -> list[dict[str, Any]]:
    """Ask LLM to analyze transcript and select tools to call."""

    system_prompt = f"""You are a meeting assistant that processes transcripts.
    Today is {current_date}. Analyze the transcript and call appropriate tools."""

    # Get tools in OpenAI function format
    tools_formatted = self.tool_registry.to_openai_format()

    response = self.llm_client.chat.completions.create(
        model=self.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Process this transcript:\n\n{transcript}"},
        ],
        tools=tools_formatted,      # Available tools
        tool_choice="auto",         # LLM decides which to use
        temperature=0.3,            # Low temperature for consistency
    )

    # Extract tool calls from response
    message = response.choices[0].message
    if message.tool_calls:
        return [
            {"name": tc.function.name, "input": json.loads(tc.function.arguments)}
            for tc in message.tool_calls
        ]
    return []
```

**Key Concepts:**
- `tools` parameter provides available functions to the LLM
- `tool_choice="auto"` lets LLM decide (vs forcing a specific tool)
- LLM returns structured JSON with tool name and arguments
- Multiple tools can be called for a single transcript

### Phase 2: Tool Execution

```python
def _execute_tools(self, tool_calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Execute the tools selected by the LLM."""
    results = []
    for tool_call in tool_calls:
        result = self.tool_registry.execute(
            name=tool_call["name"],
            tool_input=tool_call["input"]
        )
        results.append(result)
    return results
```

### Phase 3: Summary Generation

```python
def _generate_summary(self, transcript, tool_calls, results) -> str:
    """Generate a user-friendly summary of what the agent did."""

    system_prompt = """Write a Markdown-formatted summary explaining:
    - What you found in the transcript
    - What actions you took
    - Next steps for the user"""

    response = self.llm_client.chat.completions.create(
        model=self.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"I executed: {json.dumps(tool_calls)}"},
        ],
        temperature=0.7,  # Higher for more natural language
    )

    return response.choices[0].message.content
```

### Example: Processing an Incident Call

**Input Transcript:**
```
"We had a production outage at 10:15 AM. The payment API was down for
15 minutes. Sarah identified the root cause - expired API credentials.
Mike rotated the credentials and services recovered. We need to set up
credential rotation automation by next Friday."
```

**Agent Processing:**

1. **Tool Selection:** LLM analyzes and decides:
   - `generate_incident_report` (this is an incident)
   - `create_calendar_reminder` (there's a follow-up action)

2. **Tool Execution:**
   - Incident tool extracts: severity, timeline, root cause, impact
   - Calendar tool extracts: action item, owner, deadline

3. **Summary Generated:**
   ```markdown
   I processed your incident call and took the following actions:

   - **Created Incident Report** for "Payment API Outage"
     - Severity: HIGH
     - Root cause: Expired API credentials
     - Downtime: 15 minutes

   - **Created Calendar Reminder** for credential rotation automation
     - Due: Next Friday
     - Owner: Team

   **Next Steps:** Review the incident report and add it to your post-mortem.
   ```

---

## Tool Framework

The tool framework provides a clean abstraction for building agentic capabilities.

### Tool Base Class

**tools/base.py:**

```python
from abc import ABC, abstractmethod
from typing import Dict, Any

class Tool(ABC):
    """Base class for all tools."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for the tool."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description shown to the LLM for tool selection."""
        pass

    @property
    @abstractmethod
    def input_schema(self) -> Dict[str, Any]:
        """JSON Schema defining expected input parameters."""
        pass

    @abstractmethod
    def execute(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool with given input."""
        pass

    def to_openai_format(self) -> Dict[str, Any]:
        """Convert tool to OpenAI function calling format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema,
            }
        }
```

### Tool Registry

**tools/registry.py:**

```python
class ToolRegistry:
    """Registry for managing tools."""

    def __init__(self):
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        """Register a tool by name."""
        self._tools[tool.name] = tool

    def execute(self, name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given input."""
        tool = self._tools[name]
        return tool.execute(tool_input)

    def to_openai_format(self) -> List[Dict[str, Any]]:
        """Get all tools in OpenAI function calling format."""
        return [tool.to_openai_format() for tool in self._tools.values()]
```

### Available Tools

#### 1. Calendar Tool (`create_calendar_reminder`)

**Purpose:** Creates `.ics` calendar files with meeting action items.

**When Used:**
- Meetings with action items and deadlines
- Follow-up tasks from any type of meeting
- Blockers that need attention

**Input Schema:**
```python
{
    "meeting_title": str,           # Title of the meeting
    "meeting_type": enum,           # standup, planning, review, etc.
    "meeting_summary": str,         # 2-3 sentence summary
    "key_points": list[str],        # Important discussion points
    "action_items": list[{          # Tasks to complete
        "task": str,
        "owner": str,
        "priority": "high"|"medium"|"low",
        "due_date": str
    }],
    "blockers": list[{...}],        # Impediments mentioned
    "urgent_issues": list[{...}],   # Critical items
    "reminder_date": str            # YYYY-MM-DD for calendar event
}
```

**Output:** `.ics` file content (RFC 5545 iCalendar format)

#### 2. Incident Tool (`generate_incident_report`)

**Purpose:** Creates structured incident reports for production issues.

**When Used:**
- Production outages or system failures
- Emergency response calls
- Post-mortem discussions
- Critical issues affecting users

**Input Schema:**
```python
{
    "incident_title": str,          # Clear title (e.g., "Payment API Outage")
    "severity": "critical"|"high"|"medium"|"low",
    "start_time": str,              # When incident started
    "detection_time": str,          # When detected
    "resolution_time": str,         # When resolved (or "ongoing")
    "root_cause": str,              # What caused the incident
    "business_impact": {
        "description": str,
        "downtime_duration": str,
        "affected_users": str,
        "failed_transactions": str,
        "revenue_impact": str
    },
    "timeline": list[{              # Chronological events
        "time": str,
        "event": str,
        "actor": str
    }],
    "resolution_steps": list[str],  # Steps taken to resolve
    "stakeholders_notified": list[str],
    "follow_up_actions": list[{...}]
}
```

**Output:** Markdown incident report saved to `backend/incident_reports/`

#### 3. Decision Record Tool (`create_decision_record`)

**Purpose:** Creates Architecture Decision Records (ADRs) for technical decisions.

**When Used:**
- Architectural decisions (tech stack, framework choices)
- Strategic product decisions
- Process changes
- Technical trade-off discussions

**Input Schema:**
```python
{
    "decision_title": str,          # Clear title (e.g., "Use REST over GraphQL")
    "decision_date": str,           # YYYY-MM-DD
    "status": "proposed"|"accepted"|"rejected"|"deprecated"|"superseded",
    "context": str,                 # Background - why was this needed?
    "options_considered": list[{    # Alternatives discussed
        "option": str,
        "pros": list[str],
        "cons": list[str]
    }],
    "decision": str,                # What was decided
    "rationale": str,               # Why this choice was made
    "consequences": {
        "positive": list[str],
        "negative": list[str],
        "risks": list[str]
    },
    "decision_makers": list[str]
}
```

**Output:** Markdown ADR saved to `backend/decision_records/`

### Creating a New Tool

To add a new tool, follow this pattern:

```python
# tools/my_new_tool.py
from typing import Dict, Any
from .base import Tool

class MyNewTool(Tool):
    """Description of what this tool does."""

    @property
    def name(self) -> str:
        return "my_tool_name"  # Used in function calling

    @property
    def description(self) -> str:
        return """Detailed description for the LLM.
        Explain when to use this tool and what it extracts."""

    @property
    def input_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "required_field": {
                    "type": "string",
                    "description": "What this field contains"
                },
                "optional_field": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of items"
                }
            },
            "required": ["required_field"]
        }

    def execute(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the tool logic."""
        # Process the input
        result = process_data(tool_input)

        return {
            "status": "success",
            "type": "my_tool_type",
            "data": result
        }
```

Then register it in `app.py`:

```python
from tools import ToolRegistry
from tools.my_new_tool import MyNewTool

tool_registry = ToolRegistry()
tool_registry.register(MyNewTool())
```

---

## Frontend Tutorial

### Setting Up React with TypeScript and Vite

#### 1. Project Initialization

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

This creates a React project with:
- TypeScript configuration
- Vite as the build tool
- ESLint pre-configured

#### 2. Understanding the Entry Point

**main.tsx** - The application entry point:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Key concepts:
- `StrictMode` - Enables additional development checks
- `createRoot` - React 18+ concurrent rendering API
- Non-null assertion (`!`) tells TypeScript the element exists

### Building Components

#### Component Structure Pattern

Each component in this project follows a consistent pattern:

```
ComponentName/
├── ComponentName.tsx        # Component logic
└── ComponentName.module.css # Scoped styles
```

#### Example: Building the RecordButton Component

**RecordButton.tsx:**

```tsx
import { Mic, Square } from 'lucide-react';
import styles from './RecordButton.module.css';

interface RecordButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export function RecordButton({
  isRecording,
  onStartRecording,
  onStopRecording,
  disabled = false,
}: RecordButtonProps) {
  return (
    <button
      className={`${styles.recordButton} ${isRecording ? styles.recording : ''}`}
      onClick={isRecording ? onStopRecording : onStartRecording}
      disabled={disabled}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? <Square size={24} /> : <Mic size={24} />}
      <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
    </button>
  );
}
```

**Key Concepts Demonstrated:**

1. **TypeScript Interface** - Defines props contract
2. **Default Props** - `disabled = false`
3. **Conditional Styling** - Template literals for dynamic classes
4. **Conditional Rendering** - Different icons based on state
5. **Accessibility** - `aria-label` for screen readers
6. **CSS Modules** - `styles.recordButton` scoped class

### State Management with React Hooks

This project uses React's built-in hooks for state management:

#### useState - Component State

```tsx
const [isRecording, setIsRecording] = useState(false);
const [rawTranscript, setRawTranscript] = useState('');
const [cleanedTranscript, setCleanedTranscript] = useState('');
const [error, setError] = useState<string | null>(null);
```

#### useRef - Mutable References

```tsx
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioChunksRef = useRef<Blob[]>([]);
```

**Why useRef?**
- Persists across renders without causing re-renders
- Perfect for MediaRecorder which shouldn't trigger UI updates

#### useCallback - Memoized Functions

```tsx
const handleStartRecording = useCallback(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // ... recording logic
  } catch (err) {
    setError('Microphone access denied');
  }
}, [useLLM, systemPrompt]);
```

**Why useCallback?**
- Prevents unnecessary re-renders when passing to child components
- Dependencies array ensures fresh function when dependencies change

#### useEffect - Side Effects

```tsx
useEffect(() => {
  // Fetch system prompt on mount
  fetch('/api/system-prompt')
    .then(res => res.json())
    .then(data => setSystemPrompt(data.system_prompt));
}, []);
```

### CSS Modules & Design System

#### Design System Variables (variables.css)

```css
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-secondary: #8b5cf6;
  --color-success: #10b981;
  --color-error: #ef4444;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;

  /* Effects */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --transition-fast: 150ms ease;
}
```

**Why CSS Variables?**
- Single source of truth for design tokens
- Easy theming (could add dark mode)
- Consistent spacing and colors throughout

#### Using CSS Modules

```tsx
// Import styles
import styles from './Button.module.css';

// Use in JSX
<button className={styles.primary}>Click me</button>
```

Generated output:
```html
<button class="Button_primary_x7d2k">Click me</button>
```

The hash ensures styles never conflict between components.

### TypeScript Types

**types/index.ts:**

```typescript
// API Response Types
export interface TranscriptionResponse {
  raw_transcript: string;
  cleaned_transcript: string;
}

export interface CleanResponse {
  cleaned_text: string;
}

export interface SystemPromptResponse {
  system_prompt: string;
}

// Component Props Types
export interface TextBoxProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  placeholder?: string;
}

// Utility Types
export type AudioFileType = 'audio/mp3' | 'audio/wav' | 'audio/webm' | 'audio/ogg' | 'audio/m4a';
```

**Benefits:**
- Compile-time error checking
- Autocomplete in IDE
- Self-documenting code
- Refactoring safety

---

## Backend Tutorial

### FastAPI Fundamentals

#### 1. Application Setup

**app.py:**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, cleanup on shutdown."""
    global transcription_service
    transcription_service = TranscriptionService()
    yield
    # Cleanup code would go here

# Create FastAPI app
app = FastAPI(title="AI Transcript API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Key Concepts:**
- `lifespan` - Modern way to handle startup/shutdown (replaces `@app.on_event`)
- `CORSMiddleware` - Allows frontend to make requests from different origin
- Type hints everywhere - FastAPI uses them for validation and docs

#### 2. Defining Endpoints

```python
@app.get("/api/status")
async def get_status():
    """Check if the transcription service is ready."""
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    return {"status": "ready"}

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile,
    use_llm: bool = True,
    system_prompt: str | None = None,
):
    """Transcribe audio file to text."""
    # Implementation...
```

**FastAPI Features Used:**
- Path operations (`@app.get`, `@app.post`)
- Automatic request validation
- File uploads with `UploadFile`
- Query parameters with defaults
- Automatic OpenAPI documentation

### Building the Transcription Service

**transcription.py:**

```python
import os
from faster_whisper import WhisperModel
from openai import OpenAI

class TranscriptionService:
    def __init__(self):
        # Detect best compute device
        self.device = self._detect_device()

        # Load Whisper model
        model_name = os.getenv("WHISPER_MODEL", "base.en")
        self.whisper_model = WhisperModel(
            model_name,
            device=self.device,
            compute_type="int8",
        )

        # Initialize LLM client
        self.llm_client = OpenAI(
            base_url=os.getenv("LLM_BASE_URL", "http://localhost:11434/v1"),
            api_key=os.getenv("LLM_API_KEY", "ollama"),
        )
        self.llm_model = os.getenv("LLM_MODEL", "gemma3:4b")

    def _detect_device(self) -> str:
        """Auto-detect the best compute device."""
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
            if torch.backends.mps.is_available():
                return "mps"  # Apple Silicon
        except ImportError:
            pass
        return "cpu"

    def transcribe(self, audio_path: str) -> str:
        """Convert audio to text using Whisper."""
        segments, _ = self.whisper_model.transcribe(
            audio_path,
            language="en",
        )
        return " ".join(segment.text for segment in segments)

    def clean_with_llm(self, text: str, system_prompt: str) -> str:
        """Clean transcript using LLM."""
        response = self.llm_client.chat.completions.create(
            model=self.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        return response.choices[0].message.content
```

### Understanding faster-whisper

**What is Whisper?**
OpenAI's Whisper is a speech-to-text model trained on 680,000 hours of multilingual data.

**Why faster-whisper?**
- Uses CTranslate2 for optimized inference
- 4x faster than original Whisper
- Lower memory usage with int8 quantization
- Supports CPU, CUDA (NVIDIA), and Metal (Apple)

**Model Sizes:**
| Model | Parameters | English-only | Multilingual |
|-------|------------|--------------|--------------|
| tiny | 39M | tiny.en | tiny |
| base | 74M | base.en | base |
| small | 244M | small.en | small |
| medium | 769M | medium.en | medium |
| large | 1550M | N/A | large-v3 |

### LLM Integration Pattern

The project uses the OpenAI SDK as a universal client:

```python
# Works with OpenAI
client = OpenAI(api_key="sk-...")

# Works with Ollama
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # Ollama ignores this
)

# Works with LM Studio
client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
)
```

**Why This Pattern?**
- Single codebase supports multiple providers
- Easy to switch between local and cloud
- Consistent API regardless of backend

---

## Data Flow & API Reference

### Complete Request Flow

#### Audio Recording Flow

```
1. User clicks "Record" button
   └── Browser requests microphone permission

2. MediaRecorder captures audio chunks
   └── Stored in audioChunksRef array

3. User clicks "Stop"
   └── Chunks combined into Blob
   └── Blob converted to File

4. File sent via fetch POST to /api/transcribe
   └── Vite proxy forwards to localhost:8000

5. FastAPI receives UploadFile
   └── Saved to temp file
   └── Path passed to TranscriptionService

6. Whisper processes audio
   └── Returns raw transcript

7. If use_llm=true:
   └── Raw transcript sent to LLM
   └── LLM returns cleaned version

8. Response sent to frontend
   └── {raw_transcript, cleaned_transcript}

9. React updates state
   └── UI re-renders with results
```

### API Reference

#### GET /api/status

Check if the service is ready.

**Response:**
```json
{
  "status": "ready"
}
```

#### GET /api/system-prompt

Get the default LLM system prompt.

**Response:**
```json
{
  "system_prompt": "You are a helpful assistant that cleans up transcripts..."
}
```

#### POST /api/transcribe

Transcribe an audio file.

**Request:**
- `file` (form-data): Audio file (MP3, WAV, WebM, M4A, OGG)
- `use_llm` (query, optional): Enable LLM cleaning (default: true)
- `system_prompt` (query, optional): Custom system prompt

**Response:**
```json
{
  "raw_transcript": "um so like I was thinking that we should uh...",
  "cleaned_transcript": "I was thinking that we should..."
}
```

#### POST /api/clean

Clean text with LLM (without transcription).

**Request:**
```json
{
  "text": "um so like I was thinking...",
  "system_prompt": "Optional custom prompt"
}
```

**Response:**
```json
{
  "cleaned_text": "I was thinking..."
}
```

---

## Development Environment

### Option 1: Dev Container (Recommended)

The project includes a complete Dev Container configuration:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install VS Code [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
3. Open project in VS Code
4. Click "Reopen in Container" when prompted

**What Gets Set Up:**
- Python 3.12 with uv
- Node.js 24
- Ollama with gemma3:4b model
- Whisper base.en model
- All dependencies installed

### Option 2: Manual Setup

#### Backend Setup

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Navigate to backend
cd backend

# Create .env from example
cp .env.example .env

# Install dependencies
uv sync

# Start Ollama (in separate terminal)
ollama serve
ollama pull gemma3:4b

# Run the server
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 3000 | http://localhost:3000 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| Ollama | 11434 | http://localhost:11434 |
| API Docs | 8000 | http://localhost:8000/docs |

---

## Configuration Guide

### Environment Variables

**backend/.env:**

```bash
# LLM Configuration
LLM_BASE_URL=http://localhost:11434/v1  # Ollama default
LLM_API_KEY=ollama                       # Ignored by Ollama
LLM_MODEL=gemma3:4b                      # Model to use

# Whisper Configuration
WHISPER_MODEL=base.en                    # Model size
```

### LLM Provider Examples

#### Ollama (Local)
```bash
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=gemma3:4b
```

#### OpenAI (Cloud)
```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini
```

#### LM Studio (Local)
```bash
LLM_BASE_URL=http://localhost:1234/v1
LLM_API_KEY=lm-studio
LLM_MODEL=local-model
```

### Customizing the System Prompt

Edit `backend/system_prompt.txt`:

```text
You are a transcript cleaning assistant. Your job is to:

1. Remove filler words (um, uh, like, you know, basically, etc.)
2. Fix grammar and punctuation
3. Remove redundant phrases and false starts
4. Preserve all important information, names, numbers, and action items
5. Maintain the speaker's intended meaning

Return ONLY the cleaned transcript with no additional commentary.
```

---

## Code Quality Standards

### Frontend (ESLint + Prettier)

**eslint.config.js** enforces:
- TypeScript best practices
- React hooks rules
- Import ordering
- No unused variables

**Run linting:**
```bash
npm run lint
```

**.prettierrc** enforces:
- Single quotes
- No semicolons (optional)
- 2-space indentation
- 80 character line width

**Run formatting:**
```bash
npm run format
```

### Backend (Ruff + Black)

**pyproject.toml** configures:
- Ruff for fast linting (13 rule categories)
- Black for formatting (88 char lines)
- isort for import sorting

**Run linting:**
```bash
uv run ruff check .
```

**Run formatting:**
```bash
uv run black .
```

---

## Learning Resources

### React & TypeScript

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Vite Guide](https://vite.dev/guide/)

### FastAPI & Python

- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Python Type Hints](https://docs.python.org/3/library/typing.html)
- [uv Documentation](https://docs.astral.sh/uv/)

### AI/ML & Speech Recognition

- [Whisper Paper](https://arxiv.org/abs/2212.04356)
- [faster-whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [Ollama Documentation](https://ollama.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

### Agentic AI & Function Calling

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [ReAct: Reasoning and Acting in LLMs](https://arxiv.org/abs/2210.03629) - The foundational paper
- [Building AI Agents](https://www.anthropic.com/research/building-effective-agents) - Anthropic's guide
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/) - Alternative framework

### Docker & Dev Containers

- [Docker Getting Started](https://docs.docker.com/get-started/)
- [Dev Containers Specification](https://containers.dev/)

### Video Tutorials

- [Project Structure & API Tutorial](https://youtu.be/WUo5tKg2lnE)
- [Agentic Demo Full Video](https://youtu.be/uR_lvAZFBw0)

---

## Next Steps for Learning

1. **Extend the Agent**
   - Add new tools (e.g., Slack notification, Jira ticket creation)
   - Implement tool chaining (output of one tool feeds into another)
   - Add memory/context persistence across sessions

2. **Enhance the Frontend**
   - Add dark mode using CSS variables
   - Display agent actions in real-time
   - Add file download for generated reports

3. **Improve AI Capabilities**
   - Try different Whisper model sizes
   - Experiment with different LLM models (GPT-4, Claude, Llama)
   - Add speaker diarization
   - Implement streaming responses

4. **Production Readiness**
   - Add user authentication
   - Implement rate limiting
   - Set up monitoring and logging
   - Deploy with Docker/Kubernetes

5. **Advanced Agentic Features**
   - Multi-agent collaboration
   - Human-in-the-loop approval for critical actions
   - Feedback loop for improving tool selection

---

*This guide documents the `checkpoint-agentic-openrouter` branch of the AI Transcript App. For the latest updates, check the project README.*
