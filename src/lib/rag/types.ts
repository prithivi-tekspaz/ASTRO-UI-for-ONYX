/**
 * Rust-Powered Agentic RAG — Canonical Type Definitions
 * 
 * Strict typing for Axum/Tokio Agentic RAG endpoints, SSE streaming events,
 * execution stages, evidence evaluation, citations, and system diagnostics.
 */

export type Role = 'user' | 'assistant' | 'system';

/** Logical stages executed by the Rust Agentic RAG orchestrator */
export type AgentStage = 
  | 'planning'            // Planning query decomposition / intent
  | 'tool_selection'     // Selecting retrieval or search tools
  | 'retrieving'         // Executing candidate search
  | 'evaluating'         // Evaluating evidence sufficiency & relevance
  | 'refining'           // Search improvement / query rewriting (retry)
  | 'building_context'   // Assembling grounded context
  | 'generating'         // Generating synthesized answer
  | 'validating'         // Validating citations against grounded context
  | 'completed'          // Pipeline successfully finished
  | 'failed';            // Pipeline execution error

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'retrying';

export interface AgentStageEvent {
  stage: AgentStage;
  status: StageStatus;
  detail?: string;
  attempt?: number;
  timestamp?: string;
  elapsedMs?: number;
}

export interface ToolInvocation {
  toolName: string;
  status: 'started' | 'completed' | 'failed';
  inputSnippet?: string;
  resultSummary?: string;
  durationMs?: number;
}

export interface EvidenceEvaluation {
  isSufficient: boolean;
  candidateCount: number;
  retainedCount: number;
  strategy?: 'semantic' | 'keyword' | 'hybrid' | string;
  retryReason?: string;
  notes?: string;
}

export interface Citation {
  id: string;
  sourceId?: string;
  title: string;
  filename: string;
  sourceLocation?: string; // e.g. "Page 4", "Section 2.1", "Row 34"
  content: string;
  score?: number;
  url?: string;
  verified?: boolean;
}

export type SufficiencyStatus = 'sufficient' | 'partial' | 'insufficient';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  sources?: Citation[];
  sufficiency?: SufficiencyStatus;
  executionTrace?: ExecutionTraceSummary;
  isStreaming?: boolean;
  error?: string;
}

export interface ExecutionTraceSummary {
  totalAttempts: number;
  elapsedMs: number;
  stages: AgentStageEvent[];
  toolsUsed: ToolInvocation[];
  evaluations: EvidenceEvaluation[];
  retried: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  activeDocId?: string | null;
  messageCount?: number;
}

export type IngestionStatus = 
  | 'uploaded'
  | 'processing'
  | 'extracting'
  | 'chunking'
  | 'indexing'
  | 'ready'
  | 'failed';

export interface DocumentSource {
  id: string;
  filename: string;
  fileFormat: string;
  sizeBytes?: number;
  totalChunks?: number;
  uploadedAt: string;
  status: IngestionStatus;
  errorMessage?: string;
}

export type RetrievalStrategy = 'hybrid' | 'semantic' | 'keyword';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  documentId: string;
  sourceLocation?: string;
  score: number;
  strategy?: RetrievalStrategy;
  isEvaluatedEvidence?: boolean;
}

export interface BackendHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version?: string;
  modelProvider?: string;
  embeddingModel?: string;
  vectorBackend?: string;
  retrievalStrategies?: RetrievalStrategy[];
  uptimeSeconds?: number;
}

/** Server-Sent Events emitted by the Axum Agentic RAG backend */
export type AgentStreamingEvent = 
  | { type: 'stage_change'; data: { stage: AgentStage; detail?: string; attempt?: number; status?: StageStatus } }
  | { type: 'tool_event'; data: ToolInvocation }
  | { type: 'evidence_evaluation'; data: EvidenceEvaluation }
  | { type: 'context_ready'; data: { citations: Citation[]; sufficiency: SufficiencyStatus } }
  | { type: 'token'; data: { token: string } }
  | { type: 'done'; data: { answer?: string; executionTimeMs?: number; totalAttempts?: number } }
  | { type: 'error'; data: { message: string; code?: string } };
