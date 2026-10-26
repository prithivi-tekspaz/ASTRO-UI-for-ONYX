# Implementation Status Report: Agentic RAG System v11 Frontend Alignment
**Project:** Astro UI for Rust-Powered Agentic RAG System (Axum + Tokio)  
**Authoritative Specification:** Agentic RAG System Complete Design Document v11  
**Target Environment:** Internal IT Team, English-only documents (PDF, DOCX, PPTX)  
**Status:** All 8 Implementation Phases Completed  
**Date:** 2026-10-26  

---

## 1. Summary of Completed Deliverables

### A. Architectural & Core Transports (`src/lib/rag/`)
- [types.ts](file:///d:/frontend_backup/src/lib/rag/types.ts): Canonical TypeScript interfaces for v11:
  - Structured claim units: `u` (sequence), `role` (`answer`, `support`, `caveat`), `text`, `cites` (numeric references), and `reqs` (plan requirement mapping).
  - Terminal outcomes: `answer`, `refer_to_owner` (with reason: `general_question`, `out_of_scope`, `live_data`), `social_reply`, `ask_user`, `fail_gracefully`, `aborted`, `upstream_failure`, `internal_error`.
  - Full SSE events: `status`, `token`, `citations`, `verification`, `clarification`, `done`, `error`.
  - Document models: `nomic-embed-text-v1.5` (768-d), `Nemotron 3 Super` (120B/12B active).
- [client.ts](file:///d:/frontend_backup/src/lib/rag/client.ts): Native HTTP transport client with OIDC Bearer token injection (`getAuthHeaders`), configurable timeout (`35s`), structured `RagApiError` classification with `run_id`, and health probe resolution (`GET /health`, `GET /ready`).
- [streaming.ts](file:///d:/frontend_backup/src/lib/rag/streaming.ts): Resilient SSE streaming client:
  - Emits checked claim units with ordering invariants ($u=1$ answer first, consecutive $u$ support/caveat).
  - Handles reconnection replay from `GET /v1/runs/{id}/events` via `Last-Event-ID` (max 3 reconnects with 10s grace).
  - Graceful cancellation trigger to `POST /v1/runs/{id}/cancel` while preserving approved partial units.
- [api.ts](file:///d:/frontend_backup/src/lib/rag/api.ts): Typed client operations for v11 routes:
  - Conversations: `/v1/conversations`, `/v1/conversations/:id`
  - Ingestion: `/v1/documents`, `/v1/documents/:id` (strictly validating PDF, DOCX, PPTX in release 1)
  - Search: `/v1/search`
  - Citations: `/v1/citations/:id`

### B. Workspace Layout & Reusable Components (`src/components/`, `src/pages/`)
- [index.astro](file:///d:/frontend_backup/src/pages/index.astro):
  - Primary document chat view rendering structured claim units with numerical citation badges `[n]`.
  - Banners for `refer_to_owner` (referring general, out-of-scope, or live questions to the Business Owner), `fail_gracefully` (insufficient verified evidence), and `upstream_failure`.
  - Clarification dialog (`ask_user`) for interactive user-disambiguation.
  - Collapsible v11 execution timeline with actual timestamps and observable status transitions.
- [ChatEmptyState.astro](file:///d:/frontend_backup/src/components/chat/ChatEmptyState.astro):
  - Heading: **"Ask your documents. Examine the evidence."**
  - Supporting text: *"Get answers from approved internal documents, inspect the supporting sources, and see when more information is needed."*
  - 4 document-focused prompt cards matching v11 scope.
- [ChatComposer.astro](file:///d:/frontend_backup/src/components/chat/ChatComposer.astro):
  - Release 1 format restrictions (`.pdf`, `.docx`, `.pptx`).
  - Draft preservation across aborted or failed runs.
  - Transparent disclaimer: *"Answers are checked against approved internal documents with traceable citations. Unsupported claims are withheld by Grounding Gate."*
- [knowledge.astro](file:///d:/frontend_backup/src/pages/knowledge.astro):
  - Release 1 document catalog with client-side and server-side format enforcement.
  - Document states: `queued`, `processing`, `ready`, `failed`.
  - Deletion confirmation warning about vector and chunk removal.
- [search.astro](file:///d:/frontend_backup/src/pages/search.astro):
  - Document-only candidate retrieval calling `/v1/search`.
  - Transparent candidate cards displaying raw retrieval scores and document excerpts without simulated guarantees.
- [agents.astro](file:///d:/frontend_backup/src/pages/agents.astro):
  - Converted into **Run Activity** detailing the 6-stage pipeline: `ROUTE & PlanValidator`, `Hybrid Search (768-d nomic)`, `Evaluator Agent (Rules A–F)`, `Bounded Retry Loop`, `JSON-Line Generator (Nemotron 3 Super)`, `Grounding Gate (P0, P1, C1–C5)`.
- [settings.astro](file:///d:/frontend_backup/src/pages/settings.astro):
  - Live probe testing against `/health` and `/ready`.
  - Model spec reporting: `nomic-embed-text-v1.5` (768-d) & `Nemotron 3 Super` (120B/12B).
  - Storage & isolation diagnostics: `PostgreSQL + pgvector HNSW (Live-ACL RLS)`.
- [astro.config.mjs](file:///d:/frontend_backup/astro.config.mjs):
  - Proxies `/v1/*`, `/api/*`, `/health`, and `/ready` to backend at `http://127.0.0.1:8080`.

---

## 2. API Route & Protocol Mapping

| Method | Documented v11 Route | Frontend Implementation File | Handling & Fallback Behavior |
|---|---|---|---|
| `GET` | `/health`, `/ready` | `src/lib/rag/client.ts` | Probes service readiness; displays clear disconnected state if backend is offline |
| `POST` | `/v1/chat/stream` | `src/lib/rag/streaming.ts` | Streams claim units and status; falls back to `/api/chat` if legacy route is mounted |
| `GET` | `/v1/runs/:id/events` | `src/lib/rag/streaming.ts` | Replays events from PostgreSQL after `Last-Event-ID` on disconnect (max 3 tries) |
| `POST` | `/v1/runs/:id/cancel` | `src/lib/rag/streaming.ts` | Sends cancellation signal to root `CancellationToken` on stop button click |
| `POST` | `/v1/search` | `src/lib/rag/api.ts` | Executes candidate retrieval over PostgreSQL vector + FTS |
| `POST` | `/v1/documents` | `src/lib/rag/api.ts` | Uploads PDF, DOCX, PPTX; client rejects unsupported formats before sending |
| `GET` | `/v1/documents` | `src/lib/rag/api.ts` | Retrieves document catalog and version indexing states |
| `DELETE` | `/v1/documents/:id` | `src/lib/rag/api.ts` | Soft-deletes document and cascades removal of chunks and vectors |
| `GET` | `/v1/citations/:id` | `src/lib/rag/api.ts` | Resolves stable anchor to passage text, page, and highlight offsets |
| `GET` | `/v1/conversations` | `src/lib/rag/api.ts` | Lists past sessions; updates sidebar conversation list |
| `GET` | `/v1/conversations/:id` | `src/lib/rag/api.ts` | Loads persisted claim units, outcome status, and citations |
| `DELETE` | `/v1/conversations/:id` | `src/lib/rag/api.ts` | Deletes conversation session |

---

## 3. Scope & Truthfulness Verification

1. **Document-Only Answering Enforced**:
   - Web search, SQL tools, CRM, and MCP protocols are strictly omitted from Release 1 UI in accordance with §0.1 D3.
   - Out-of-scope, general knowledge, or live data questions explicitly render the `refer_to_owner` outcome with clear explanation and no model-knowledge hallucination.
2. **Citation Provenance Integrity**:
   - Citations are rendered exclusively from resolved structured `cites` and `citations` metadata.
   - In-text bracketed markers from raw model prose are never fabricated into citations.
3. **Claim Unit Invariants**:
   - Streaming parser validates and renders sequential claim units: $u=1$ role `answer` first, consecutive $u$ with role `support` or `caveat`.
   - Banners prominently declare **"Checked against sources"** rather than claiming an answer has been proven true.
