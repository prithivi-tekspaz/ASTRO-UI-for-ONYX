/**
 * Rust Agentic RAG Conversations, Search & Document Ingestion Client
 */

import { ragFetch } from './client';
import type { 
  Conversation, 
  ChatMessage, 
  Citation, 
  SearchResult, 
  DocumentSource,
  RetrievalStrategy 
} from './types';

// ==========================================
// 1. Conversations API
// ==========================================

export async function listConversations(): Promise<Conversation[]> {
  try {
    const raw = await ragFetch<any[]>('/api/conversations');
    return (raw || []).map(c => ({
      id: c.id,
      title: c.title || 'Untitled Session',
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      updatedAt: c.updated_at || c.updatedAt,
      activeDocId: c.active_doc_id || c.activeDocId || null,
      messageCount: c.message_count || c.messageCount
    }));
  } catch (err) {
    console.warn('[RAG API] listConversations failed:', err);
    return [];
  }
}

export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  try {
    const raw = await ragFetch<any>(`/api/conversations/${conversationId}`);
    if (!raw) return null;

    const messages: ChatMessage[] = (raw.messages || []).map((m: any, idx: number) => {
      let sources: Citation[] = [];
      if (m.sources) {
        sources = typeof m.sources === 'string' ? JSON.parse(m.sources) : m.sources;
      }

      return {
        id: m.id || `msg_${idx}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        createdAt: m.created_at || m.createdAt || new Date().toISOString(),
        sources,
        sufficiency: m.sufficiency || (sources.length > 0 ? 'sufficient' : undefined),
        executionTrace: m.execution_trace || m.executionTrace
      };
    });

    return {
      conversation: {
        id: raw.id,
        title: raw.title || 'Session',
        createdAt: raw.created_at || new Date().toISOString()
      },
      messages
    };
  } catch (err) {
    console.error(`[RAG API] Failed to fetch conversation ${conversationId}:`, err);
    return null;
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const res = await ragFetch<{ success: boolean }>(`/api/conversations/${conversationId}`, {
      method: 'DELETE'
    });
    return res.success ?? true;
  } catch {
    // Also try fallback endpoint
    try {
      const res = await ragFetch<{ success: boolean }>('/api/conversations/delete', {
        method: 'POST',
        body: JSON.stringify({ conversation_id: conversationId })
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// 2. Search & Retrieval API
// ==========================================

export async function searchKnowledge(query: string, strategy: RetrievalStrategy = 'hybrid'): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  try {
    const res = await ragFetch<{ results: any[] }>('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        strategy
      })
    });

    return (res.results || []).map((r, idx) => ({
      id: r.id || `res_${idx}`,
      title: r.title || 'Document Section',
      snippet: r.snippet || r.content || '',
      documentId: r.document_id || r.documentId || '',
      sourceLocation: r.source_location || r.sourceLocation,
      score: typeof r.score === 'number' ? r.score : 0.85,
      strategy: r.strategy || strategy,
      isEvaluatedEvidence: r.is_evaluated_evidence ?? false
    }));
  } catch (err) {
    console.warn('[RAG API] Search failed:', err);
    throw err;
  }
}

// ==========================================
// 3. Document Ingestion API
// ==========================================

export async function listDocuments(): Promise<DocumentSource[]> {
  try {
    const raw = await ragFetch<any[]>('/api/documents');
    return (raw || []).map(d => ({
      id: d.id,
      filename: d.filename,
      fileFormat: d.file_format || d.fileFormat || d.filename.split('.').pop() || 'file',
      sizeBytes: d.size_bytes || d.sizeBytes,
      totalChunks: d.total_chunks || d.totalChunks || 0,
      uploadedAt: d.uploaded_at || d.uploadedAt || new Date().toISOString(),
      status: d.status || 'ready',
      errorMessage: d.error_message || d.errorMessage
    }));
  } catch (err) {
    console.warn('[RAG API] listDocuments failed:', err);
    return [];
  }
}

export async function uploadDocuments(files: File[]): Promise<{ success: boolean; filesCount: number }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const res = await ragFetch<{ success?: boolean; ingested?: number }>('/api/upload', {
    method: 'POST',
    body: formData
  });

  return {
    success: res.success ?? true,
    filesCount: files.length
  };
}

export async function removeDocument(documentId: string): Promise<boolean> {
  try {
    const res = await ragFetch<{ success: boolean }>(`/api/documents/${documentId}`, {
      method: 'DELETE'
    });
    return res.success ?? true;
  } catch {
    const res = await ragFetch<{ success: boolean }>('/api/documents/remove', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId })
    });
    return res.success ?? true;
  }
}
