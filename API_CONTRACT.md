# Rust Backend API Contract Reference
**Target API Framework:** Axum + Tokio (Native Rust)  
**Agent Framework:** RIG / Native Orchestrator  
**Protocol:** REST + Server-Sent Events (`text/event-stream`)  
**Base URL:** `http://127.0.0.1:8080` (Proxied via `/api/*` in Vite dev server)  

---

## 1. Health & Diagnostics

### `GET /api/health`
Checks server health, vector store readiness, and configured model provider.

#### Request
No request parameters or body.

#### Response (`200 OK`)
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "modelProvider": "Gemini / RIG Native",
  "embeddingModel": "text-embedding-004",
  "vectorBackend": "InMemory / Qdrant / LanceDB",
  "retrievalStrategies": ["hybrid", "semantic", "keyword"],
  "uptimeSeconds": 1420
}
```

---

## 2. Agentic Chat & Streaming

### `POST /api/chat`
Submits a user query and returns a real-time Server-Sent Event (SSE) stream.

#### Request Body (`application/json`)
```json
{
  "query": "What is the self-verification mechanism in DeepSeek-R1?",
  "conversation_id": "sess_x8f9a2",
  "session_id": "sess_x8f9a2",
  "active_doc_id": null,
  "strategy": "hybrid"
}
```

#### Stream Response (`text/event-stream`)

##### A. Stage Change Event
```
data: {"type":"stage_change","data":{"stage":"planning","detail":"Formulating retrieval strategy for multi-step reasoning query","attempt":1,"status":"in_progress"}}

```

##### B. Tool Event
```
data: {"type":"tool_event","data":{"toolName":"vector_search","status":"started","summary":"Searching vector store for dense matches"}}

```

##### C. Evidence Evaluation Event
```
data: {"type":"evidence_evaluation","data":{"isSufficient":true,"candidateCount":12,"retainedCount":4,"strategy":"hybrid","notes":"Retained top 4 passages with score > 0.75"}}

```

##### D. Grounded Citations & Sufficiency Event
```
data: {"type":"context_ready","data":{"sufficiency":"sufficient","citations":[{"id":"c1","title":"DeepSeek-R1 Tech Report","filename":"deepseek_r1.pdf","sourceLocation":"Page 3, Section 2.1","content":"DeepSeek-R1 uses rule-based verification rewards...","verified":true,"score":0.92}]}}

```

##### E. Token Stream
```
data: {"type":"token","data":{"token":"DeepSeek-R1 employs "}}

```

##### F. Completion Event
```
data: {"type":"done","data":{"answer":"...","executionTimeMs":1420,"totalAttempts":1}}

```

##### G. Error Event
```
data: {"type":"error","data":{"message":"Evidence store connection refused","code":"VECTOR_DB_UNAVAILABLE"}}

```

---

## 3. Dedicated Knowledge Search

### `POST /api/search`
Retrieves candidate passages without running full conversational answer generation.

#### Request Body
```json
{
  "query": "DeepSeek-R1 mathematical verification",
  "strategy": "hybrid"
}
```

#### Response (`200 OK`)
```json
{
  "results": [
    {
      "id": "res_1",
      "title": "DeepSeek-R1 Technical Report",
      "snippet": "Rule-based reward verification enables multi-step mathematical reasoning...",
      "document_id": "doc_9281a",
      "source_location": "Page 4, Section 3.2",
      "score": 0.94,
      "strategy": "hybrid",
      "is_evaluated_evidence": false
    }
  ]
}
```

---

## 4. Document Ingestion & Catalog

### `GET /api/documents`
Lists ingested documents and their vector chunk status.

#### Response (`200 OK`)
```json
[
  {
    "id": "doc_9281a",
    "filename": "deepseek_r1.pdf",
    "file_format": "pdf",
    "size_bytes": 1048576,
    "total_chunks": 48,
    "uploaded_at": "2026-10-26T10:00:00Z",
    "status": "ready"
  }
]
```

### `POST /api/upload`
Multipart upload for new documents.

#### Request Form-Data
- `files`: File[] (PDF, TXT, MD, JSON, CSV)

#### Response (`200 OK`)
```json
{
  "success": true,
  "ingested": 1
}
```

### `DELETE /api/documents/:id` (or `POST /api/documents/remove`)
Removes an ingested document and its vector embeddings.

#### Response (`200 OK`)
```json
{
  "success": true
}
```

---

## 5. Conversation History

### `GET /api/conversations`
Lists past conversation sessions.

### `GET /api/conversations/:id`
Retrieves messages, citations, and execution traces for a specific conversation.

### `DELETE /api/conversations/:id` (or `POST /api/conversations/delete`)
Deletes a conversation history session.
