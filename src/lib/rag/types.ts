/**
 * Agentic RAG System v11 — Canonical TypeScript Definitions
 * 
 * Strict typing for Rust Axum/Tokio Agentic RAG endpoints, SSE streaming events,
 * JSON Lines claim units, Grounding Gate, citations, and terminal outcomes.
 * References: Agentic RAG System Complete Design Document v11 (§0, §3.4, §5, §13, §14, §15)
 */

export type Role = 'user' | 'assistant' | 'system';

/**
 * Claim unit role in grounded mode (§13.0)
 * Invariants: u=1 must have role 'answer'; subsequent units have role 'support' or 'caveat'.
 */
export type ClaimUnitRole = 'answer' | 'support' | 'caveat';

/**
 * JSON Lines Claim Unit emitted by generator and verified by Grounding Gate (§13.0)
 */
export interface ClaimUnit {
  u: number;
  role: ClaimUnitRole;
  text: string;
  cites: number[]; // Array of 1 to 8 integers mapping to evidence IDs
  reqs?: string[]; // Requirement IDs mapped from validated plan (e.g. ["r1"])
}

/**
 * Terminal run outcome (§3.4)
 */
export type RunOutcome = 
  | 'answer'
  | 'refer_to_owner'
  | 'social_reply'
  | 'ask_user'
  | 'fail_gracefully'
  | 'aborted'
  | 'upstream_failure'
  | 'internal_error';

/**
 * Reasons for refer_to_owner outcome (§0.1 D3, §3.4)
 */
export type ReferralReason = 'general_question' | 'out_of_scope' | 'live_data';

/**
 * Reasons for fail_gracefully outcome (§3.4)
 */
export type GracefulFailureReason = 
  | 'insufficient_evidence'
  | 'sources_unavailable'
  | 'no_accessible_information'
  | 'budget_exhausted'
  | 'verification_failed'
  | 'evaluation_unavailable'
  | 'evidence_required';

/**
 * Coverage completeness (§4, §13.0, §15.2)
 */
export type CoverageStatus = 'complete' | 'partial';

/**
 * Grounding verification mode (§13.1, §13.5)
 */
export type VerificationMode = 'gated' | 'strict' | 'fast';

/**
 * Stable, resolvable citation anchor (§14.1)
 */
export interface SourceAnchor {
  documentId?: string;
  documentVersionId?: string;
  chunkId?: string;
  page?: number | null;
  charStart?: number;
  charEnd?: number;
  contentHash?: string;
  uri?: string;
}

/**
 * Resolved citation object returned via SSE or GET /v1/citations/{id} (§14, §15.2)
 */
export interface Citation {
  id: string | number; // Evidence index [n] or anchor ID
  documentId?: string;
  documentVersionId?: string;
  title: string;
  filename: string;
  page?: number | null;
  charStart?: number;
  charEnd?: number;
  sourceLocation?: string; // Formatted location e.g. "Page 4, Section 2.1"
  snippet?: string;
  content?: string;
  score?: number;
  authority?: 'SystemOfRecord' | 'Internal' | 'Web';
  verified?: boolean;
}

/**
 * Clarification prompt emitted on ask_user (§11.1, §15.2)
 */
export interface ClarificationPayload {
  question: string;
  options?: string[];
  reason?: string;
}

/**
 * Verification summary event payload (§13.2, §15.2)
 */
export interface VerificationPayload {
  mode: VerificationMode;
  withheldCount?: number;
  withheld?: Array<{ unit: number; failedCheck: string }>;
  flagged?: string[];
  lowConfidence?: boolean;
}

/**
 * Done event payload (§15.2)
 */
export interface DonePayload {
  runId: string;
  outcome: RunOutcome;
  reason?: string;
  attemptsUsed?: number;
  coverage?: CoverageStatus;
  incomplete?: boolean;
}

/**
 * Server-Sent Events emitted by Axum /v1/chat/stream (§15.2)
 */
export type AgentStreamingEvent = 
  | { type: 'status'; data: { step: string; detail?: string } }
  | { type: 'token'; data: { seq: number; unit?: number; role?: ClaimUnitRole; origin?: 'model' | 'system'; text: string; cites?: number[] } }
  | { type: 'citations'; data: Citation[] }
  | { type: 'verification'; data: VerificationPayload }
  | { type: 'clarification'; data: ClarificationPayload }
  | { type: 'done'; data: DonePayload }
  | { type: 'error'; data: { code: string; message: string; run_id?: string } };

/**
 * Chat message stored in UI state
 */
export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  units?: ClaimUnit[];
  citations?: Citation[];
  outcome?: RunOutcome;
  outcomeReason?: string;
  coverage?: CoverageStatus;
  lowConfidence?: boolean;
  withheldCount?: number;
  clarification?: ClarificationPayload;
  runId?: string;
  isStreaming?: boolean;
  incomplete?: boolean;
  error?: string;
}

/**
 * Conversation metadata (§15.1)
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messageCount?: number;
  fence?: number;
}

/**
 * Document source returned from GET /v1/documents (§12.1, §12.2)
 */
export type IngestionState = 'queued' | 'processing' | 'ready' | 'failed' | 'superseded' | 'deleted';

export interface DocumentSource {
  id: string;
  tenantId?: string;
  title: string;
  filename: string;
  fileFormat: string;
  currentVersionId?: string;
  sizeBytes?: number;
  totalChunks?: number;
  uploadedAt: string;
  state: IngestionState;
  errorMessage?: string;
}

/**
 * Search candidate passage from POST /v1/search (§12.4, §15.1)
 */
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  documentId: string;
  documentVersionId?: string;
  page?: number | null;
  sourceLocation?: string;
  score: number;
  retrievalScore?: number;
  rerankScore?: number | null;
  authority?: string;
}

/**
 * Health probe response from GET /health and GET /ready (§15.1, §28.2)
 */
export interface BackendHealthResponse {
  status: 'healthy' | 'ready' | 'degraded' | 'unhealthy';
  version?: string;
  models?: {
    embedding: string; // e.g. "nomic-embed-text-v1.5 (768-d)"
    generator: string; // e.g. "Nemotron 3 Super (120B/12B active)"
    evaluator: string;
  };
  supportedFormats?: string[]; // e.g. ["pdf", "docx", "pptx"]
  uptimeSeconds?: number;
}
