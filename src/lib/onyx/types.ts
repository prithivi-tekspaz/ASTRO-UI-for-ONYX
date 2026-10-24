/**
 * Onyx Knowledge Workspace — Canonical Frontend Type Definitions
 * 
 * Strict typing for conversations, messages, citations, documents,
 * connectors, agents, and streaming chunks.
 */

export type Role = 'user' | 'assistant' | 'system';

export interface Citation {
  id?: string;
  sourceId?: string;
  filename: string;
  sourceLocation?: string; // e.g. "Page 4", "Slide 12", "Row 34"
  content: string;
  score?: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  sources?: Citation[];
  isStreaming?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  activeDocId?: string | null;
  messageCount?: number;
}

export type IndexingStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface DocumentSource {
  id: string;
  filename: string;
  fileFormat: string;
  sizeBytes?: number;
  totalChunks?: number;
  uploadedAt: string;
  status: IndexingStatus;
  errorMessage?: string;
}

export interface Connector {
  id: string;
  name: string;
  type: 'google_drive' | 'confluence' | 'github' | 'web' | 'file';
  status: 'active' | 'syncing' | 'paused' | 'error';
  lastSyncAt: string;
  documentCount: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  isDefault?: boolean;
  avatar?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  documentId: string;
  sourceLocation?: string;
  score: number;
}

export type StreamingEvent = 
  | { type: 'context'; data: Citation[] }
  | { type: 'token'; token: string }
  | { type: 'tool_start'; toolName: string; input?: unknown }
  | { type: 'tool_end'; toolName: string; result?: unknown }
  | { type: 'done'; fullAnswer?: string }
  | { type: 'error'; message: string };
