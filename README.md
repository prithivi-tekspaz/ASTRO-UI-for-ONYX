# Rust Knowledge Agent — Astro UI Workspace

A high-performance enterprise **Agentic RAG Workspace** built with **Astro**, engineered specifically for native **Rust-based Agentic RAG backends** (Axum + Tokio + RIG). 

Features observable query planning, real-time tool execution traces, evidence sufficiency verification, traceable citations, multi-strategy knowledge search, and a non-intrusive 3D wireframe ambient canvas.

---

## 1. Key Capabilities

- **Observable Agent Execution Timeline**: Real-time lifecycle visualization powered by Server-Sent Events (SSE). Tracks query planning, retrieval tool invocation, evidence evaluation, search refinement/rewriting, grounded context assembly, and citation validation.
- **Evidence-Driven Grounding & Citations**: Interactive citations with document names, section/page references (`[Page 4, Section 2.1]`), and verification badges. Displays transparent sufficiency banners when evidence is incomplete or partial.
- **Dedicated Multi-Strategy Search**: Retrieve candidate passages across **Hybrid (Dense + Sparse)**, **Semantic (Dense Vector)**, and **Keyword (BM25)** retrieval strategies with live confidence scores.
- **Granular Document Ingestion**: Ingestion pipeline visualizing document indexing states (`uploaded`, `processing`, `extracting`, `chunking`, `indexing`, `ready`, `failed`).
- **Agent Orchestrator Diagnostics**: Dedicated Agent Activity view detailing orchestrator pipeline stages, active session traces, and deterministic grounding checks.
- **Resilient Chat Composer**: Multiline composer with Enter-to-send, Shift+Enter for newlines, generation cancellation, draft preservation on network failures, and file drag-and-drop.
- **Premium Technical Aesthetics**: Curated dark workspace palette with cyan and purple accents, high contrast typography, collapsible sidebar, and non-blocking 3D geometric network filaments.

---

## 2. Architecture & File Layout

```text
src/
├── layouts/
│   └── AppLayout.astro             # Workspace shell (Header, Sidebar, 3D Background, Anti-flash theme)
├── pages/
│   ├── index.astro                 # Agentic RAG Chat Workspace & Live Execution Timeline
│   ├── search.astro                # Dedicated Knowledge Retrieval (Hybrid, Semantic, BM25)
│   ├── knowledge.astro             # Knowledge Catalog & Document Ingestion Pipeline
│   ├── agents.astro                # Agent Activity & Pipeline Execution Diagnostics
│   └── settings.astro              # Upstream Backend Health Probes, Diagnostics & Themes
├── components/
│   ├── app/
│   │   ├── AppHeader.astro         # Top brand header, session title & theme switcher
│   │   └── AppSidebar.astro        # Collapsible navigation & persistent conversation history
│   ├── chat/
│   │   ├── AgentTimeline.astro     # Real-time observable agent execution timeline
│   │   ├── EvidencePanel.astro     # Evidence sufficiency alert & verified citations drawer
│   │   ├── ChatComposer.astro      # Multiline input, draft preservation & attachment handling
│   │   └── ChatEmptyState.astro    # "Ask. Investigate. Verify." with 4 evidence prompt cards
│   └── effects/
│       └── AmbientBackground.astro # 3D wireframe geometric solids & network filaments
├── lib/
│   ├── rag/
│   │   ├── types.ts                # Canonical TypeScript types matching Axum/Tokio contracts
│   │   ├── client.ts               # HTTP client with timeouts, health checks & error handling
│   │   ├── streaming.ts            # Server-Sent Events (SSE) streaming protocol parser
│   │   └── api.ts                  # Typed conversations, search & document ingestion APIs
│   └── onyx/
│       └── markdown.ts             # Safe Markdown parser, code blocks & table rendering
└── styles/
    ├── tokens.css                  # Color tokens, agentic stage badges & dark/light variables
    ├── layout.css                  # App shell, responsive breakpoints & collapsible sidebar
    ├── chat.css                    # Message bubbles, timeline stages & citation cards
    ├── components.css              # Cards, badges, buttons & search bar
    └── motion.css                  # Micro-animations, ambient glow & reduced motion
```

---

## 3. Running Locally (No Docker Required)

### Prerequisites
- **Node.js**: `v20+` or `v22+`
- **npm** or your preferred package manager
- **Rust Backend**: Running locally on port `8080` (Axum/Tokio)

### Install Dependencies
```bash
npm install
```

### Start the Development Server
Run directly:
```bash
npm run dev
```
Or start in the background:
```bash
npx astro dev --background
```
The application will be available at **`http://localhost:4321`**.

### Production Build
```bash
npm run build
```
Generates optimized static HTML/CSS/JS in `dist/`.

---

## 4. Backend Integration & Upstream Proxy

All `/api/*` endpoints are automatically reverse-proxied via `astro.config.mjs` to the native Rust backend:
```javascript
vite: {
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
}
```

### Core API Endpoints
- `GET /api/health` — Backend health, vector store readiness, and configured model provider.
- `POST /api/chat` — Server-Sent Events (`text/event-stream`) for agentic execution, evidence evaluation, citations, and streaming tokens.
- `POST /api/search` — Direct retrieval endpoint with strategy selection (`hybrid`, `semantic`, `keyword`).
- `GET /api/documents` & `POST /api/upload` — Document catalog and multipart file ingestion.
- `GET /api/conversations` & `GET /api/conversations/:id` — Conversation history persistence.

---

## 5. Documentation References

- [FRONTEND_INTEGRATION.md](file:///d:/frontend_backup/FRONTEND_INTEGRATION.md): Detailed component architecture and SSE streaming lifecycle.
- [API_CONTRACT.md](file:///d:/frontend_backup/API_CONTRACT.md): Comprehensive Axum/Tokio request/response schemas and SSE event payloads.
- [IMPLEMENTATION_STATUS.md](file:///d:/frontend_backup/IMPLEMENTATION_STATUS.md): Deliverable status matrix and verification notes.
