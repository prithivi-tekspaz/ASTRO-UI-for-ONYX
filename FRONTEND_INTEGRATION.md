# Frontend Integration & Architecture Guide
**Project:** Astro UI for Rust-Powered Agentic RAG Workspace  
**Status:** Integrated & Verified  
**Runtime:** Native Axum + Tokio backend (port `8080`), Astro frontend (port `4321`)  

---

## 1. Overview & Core UX Principle

The transformed frontend converts the existing Astro dark technical UI into an evidence-driven, tool-using **Agentic RAG Knowledge Workspace**. 

**Core UX Principle:**  
*The answer is the primary experience. Agent execution is transparent supporting information.*  
The workspace presents concise observable stages during execution (query planning, retrieval tool invocation, evidence evaluation, strategy refinement, context construction, and citation verification) and provides an expandable evidence trace when the user chooses to inspect it. It **never fabricates execution steps** or shows private chain-of-thought.

---

## 2. Directory Structure & Key Components

```
frontend/
├── src/
│   ├── components/
│   │   ├── app/
│   │   │   ├── AppHeader.astro       # Top navigation, brand, session title, theme toggle
│   │   │   └── AppSidebar.astro      # Collapsible sidebar with routes & persistent session list
│   │   ├── chat/
│   │   │   ├── AgentTimeline.astro   # Real-time observable orchestrator execution trace
│   │   │   ├── ChatComposer.astro    # Multiline composer, drag/drop attachment & draft preservation
│   │   │   ├── ChatEmptyState.astro  # "Ask. Investigate. Verify." with 4 evidence prompt cards
│   │   │   └── EvidencePanel.astro   # Sufficiency status banners & verifiable citation cards
│   │   └── effects/
│   │       └── AmbientBackground.astro # Non-interactive 3D geometric network wireframe
│   ├── layouts/
│   │   └── AppLayout.astro           # Root HTML layout with anti-flash theme init & responsive drawer
│   ├── lib/
│   │   ├── onyx/
│   │   │   └── markdown.ts           # Safe markdown renderer with sanitized code blocks & tables
│   │   └── rag/
│   │       ├── api.ts                # Typed conversation, search & ingestion client
│   │       ├── client.ts             # Axum HTTP transport, timeout management & health checks
│   │       ├── streaming.ts          # Server-Sent Events (SSE) streaming protocol parser
│   │       └── types.ts              # Canonical TypeScript contracts matching the Rust backend
│   ├── pages/
│   │   ├── index.astro               # Main Agentic RAG chat workspace & live execution stream
│   │   ├── search.astro              # Multi-strategy search (Hybrid, Dense Semantic, BM25 Keyword)
│   │   ├── knowledge.astro           # Document ingestion catalog & vector indexing states
│   │   ├── agents.astro              # Agent Activity & orchestrator diagnostics
│   │   └── settings.astro            # Backend health probes, strategy configs & appearance settings
│   └── styles/
│       ├── chat.css                  # Chat message bubbles, timeline stages & citation cards
│       ├── components.css            # Buttons, search input, status badges & layout grids
│       ├── layout.css                # App shell, responsive breakpoints & collapsible sidebar
│       ├── motion.css                # Micro-animations, pulses & transitions
│       └── tokens.css                # Curated HSL/Hex palette, dark/light theme & agentic stage colors
```

---

## 3. Real-Time Streaming & Timeline Lifecycle

The SSE protocol handler in `src/lib/rag/streaming.ts` consumes events from `POST /api/chat`:

1. **`stage_change`**: Transitions through:
   - `planning`: Query analysis and retrieval intent determination.
   - `tool_selection`: Choosing retrieval tool(s).
   - `retrieving`: Searching candidate passages.
   - `evaluating`: Assessing evidence sufficiency.
   - `refining`: Query rewriting / strategy switching upon insufficient evidence.
   - `building_context`: Grounding prompt context from selected passages.
   - `generating`: Synthesizing response tokens.
   - `validating`: Deterministic citation verification against passage boundaries.
   - `completed`: Generation successfully completed.
2. **`tool_event`**: Live record of tools executed (e.g. vector search, BM25 index) and their execution status.
3. **`evidence_evaluation`**: Reports candidate count, retained count, and safe retry reasons.
4. **`context_ready`**: Delivers validated citations and sufficiency rating (`sufficient`, `partial`, `insufficient`).
5. **`token`**: Markdown text tokens appended incrementally to the message bubble.
6. **`done`**: Final payload with execution duration and total attempt count.
7. **`error`**: Human-readable error message without swallowing errors or exposing private stack traces.

---

## 4. Evidence Sufficiency & Citations

- **Sufficiency Banners:**
  - `insufficient`: Displays clear alert: *"Incomplete Evidence: Not enough verified evidence was found in the knowledge base to answer this query fully."*
  - `partial`: Displays advisory regarding partial grounding.
  - `sufficient`: Shows verified grounding banner.
- **Citation Cards:**
  - Displays source title, file name, section/page reference (`[Page 4]`), and verified badges.
  - Interactive expand/collapse drawer to inspect supporting text excerpts.

---

## 5. Development & Running

- **Development Server:**
  ```bash
  npm run dev
  ```
  Runs on `http://localhost:4321`. API requests to `/api/*` are reverse-proxied to the Axum backend on `http://127.0.0.1:8080`.
- **Production Build:**
  ```bash
  npm run build
  ```
  Outputs optimized static HTML/CSS/JS to `dist/`.
