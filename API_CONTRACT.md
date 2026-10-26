# Rust Backend API Contract Reference (v11)
**Authoritative Specification:** Agentic RAG System Complete Design Document v11  
**Backend Framework:** Axum + Tokio (Modular Monolith with API & Ingestion Worker binaries)  
**Protocol:** REST + Server-Sent Events (`text/event-stream`)  
**Base URL:** `http://127.0.0.1:8080` (Proxied in development via `/v1/*`, `/api/*`, `/health`, `/ready`)  

---

## 1. Health & Service Readiness Probes (§15.1, §28.2)

### `GET /health` and `GET /ready`
Readiness probes wait for embedding (`nomic-embed-text-v1.5`) and NLI models to load.

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "version": "v11.0.0",
  "models": {
    "embedding": "nomic-embed-text-v1.5 (768-d)",
    "generator": "Nemotron 3 Super (120B/12B active)",
    "evaluator": "Nemotron 3 Super"
  },
  "supportedFormats": ["pdf", "docx", "pptx"],
  "uptimeSeconds": 3600
}
```

---

## 2. Agentic Chat & Streaming (§13.0, §15.2, §15.3)

### `POST /v1/chat/stream`
Submits a query to the Agentic RAG state machine and streams individually screened claim units and execution trace events.

#### Request Headers
- `Authorization: Bearer <oidc_jwt_token>` (Authoritative OIDC principal set)
- `Idempotency-Key: <unique_key>` (Deduplication within 24h)
- `Content-Type: application/json`
- `Accept: text/event-stream`

#### Request Body (`application/json`)
```json
{
  "conversation_id": "conv_8f910a",
  "message": "What is the refund window for digital goods according to our internal policy?",
  "document_ids": null,
  "options": {
    "mode": "gated",
    "max_attempts": 3
  }
}
```

#### Stream Response (`text/event-stream`)

##### A. `status` Event
Observable state transitions (`ROUTE`, `PLAN`, `SELECT_TOOLS`, `EVALUATE`, `BUILD_CONTEXT`, `GROUNDING_GATE`).
```
id: 1
event: status
data: {"step":"Searching approved documents","detail":"Executing hybrid search (nomic 768-d + FTS) over internal policy documents"}

```

##### B. `token` Event (Claim Units)
Individually screened JSON-line claim units (§13.0). Units satisfy: $u=1$ role `answer` first, consecutive $u$ with role `support` or `caveat`.
```
id: 2
event: token
data: {"seq":1,"unit":1,"role":"answer","origin":"model","text":"Refunds for standard items are accepted within 30 days of delivery.","cites":[1],"reqs":["r1"]}

```
```
id: 3
event: token
data: {"seq":2,"unit":2,"role":"support","origin":"model","text":"Digital goods are non-refundable once downloaded unless defective.","cites":[3],"reqs":["r2"]}

```
```
id: 4
event: token
data: {"seq":3,"unit":3,"role":"caveat","origin":"model","text":"The 2024 policy notes that promotional items must be returned within 14 days.","cites":[2],"reqs":["r1"]}

```

##### C. `citations` Event
Binds numeric $[n]$ references in units to stable, resolvable source anchors.
```
id: 5
event: citations
data: [
  {
    "id": 1,
    "document_id": "doc_9918a",
    "document_version_id": "ver_01",
    "title": "Customer Refund Policy 2026",
    "filename": "refund_policy_2026.pdf",
    "page": 4,
    "char_start": 1204,
    "char_end": 1420,
    "source_location": "Page 4, Section 2.1",
    "content": "Refunds are accepted within 30 days of delivery...",
    "verified": true
  }
]

```

##### D. `verification` Event
Grounding Gate screening summary.
```
id: 6
event: verification
data: {
  "mode": "gated",
  "withheld_count": 0,
  "withheld": [],
  "flagged": [],
  "low_confidence": false
}

```

##### E. `clarification` Event (`ask_user`)
Emitted when question is ambiguous or requires user-supplied parameters.
```
id: 7
event: clarification
data: {
  "question": "Did your order occur before or after the July 2026 policy revision?",
  "options": ["Before July 2026", "After July 2026"]
}

```

##### F. `done` Event
Finalizes the run lifecycle.
```
id: 8
event: done
data: {
  "run_id": "run_9821ef",
  "outcome": "answer",
  "attempts_used": 1,
  "coverage": "complete",
  "incomplete": false
}
```

##### G. Outcomes: `refer_to_owner` and `fail_gracefully`
When a query is out-of-scope or live data:
```
id: 9
event: done
data: {
  "run_id": "run_9821ef",
  "outcome": "refer_to_owner",
  "reason": "out_of_scope",
  "attempts_used": 1,
  "coverage": "complete"
}
```

---

## 3. Reconnection Replay (§15.2, §15.3)

### `GET /v1/runs/{id}/events`
Replays verified events from PostgreSQL `run_events` log after `Last-Event-ID` upon client disconnect or proxy timeout (max 3 reconnects within 10s grace).

#### Request Headers
- `Last-Event-ID: 4`
- `Authorization: Bearer <oidc_jwt_token>`

---

## 4. Cancellation (§15.1)

### `POST /v1/runs/{id}/cancel`
Signals immediate cancellation to the active run's root `CancellationToken`. Tool calls and LLM generation abort cooperatively; approved partial units are preserved.

---

## 5. Citations Resolution (§14.3, §15.1)

### `GET /v1/citations/{id}`
Re-checks live caller ACL against PostgreSQL RLS and returns immutable version text, page, and character highlight spans.

---

## 6. Document Ingestion (§12.1, §15.1)

### `POST /v1/documents`
Uploads permitted documents (`.pdf`, `.docx`, `.pptx`). Ingestion stages are asynchronous and idempotent; publish transaction sets `version.state = ready` atomically.

### `GET /v1/documents`
Lists documents and ingestion states (`queued`, `processing`, `ready`, `failed`, `superseded`, `deleted`).

### `DELETE /v1/documents/{id}`
Sets soft-deletion tombstone immediately and purges chunks/vectors within 60 seconds.

---

## 7. Document Retrieval Only (§12.4, §15.1)

### `POST /v1/search`
Retrieval without answer generation.
```json
{
  "query": "digital goods refund exception"
}
```
Returns candidate passages with retrieval scores, rerank scores, and document anchors.
