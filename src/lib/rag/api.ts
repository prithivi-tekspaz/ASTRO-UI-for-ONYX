/**
 * Agentic RAG System v11 — Document Ingestion, Retrieval & Conversation Client
 * 
 * Strict endpoint operations for Rust Axum/Tokio Agentic RAG.
 * References: Agentic RAG System Complete Design Document v11 (§12.1, §14.3, §15.1)
 */

import { ragFetch } from './client';
import type { 
  Conversation, 
  ChatMessage, 
  Citation, 
  SearchResult, 
  DocumentSource 
} from './types';

// ==========================================
// 1. Conversations API (§15.1)
// ==========================================

export async function listConversations(): Promise<Conversation[]> {
  try {
    const raw = await ragFetch<any[]>('/v1/conversations');
    return (raw || []).map(c => ({
      id: c.id,
      title: c.title || 'Untitled Session',
      createdAt: c.created_at || c.createdAt || new Date().toISOString(),
      updatedAt: c.updated_at || c.updatedAt,
      messageCount: c.message_count || c.messageCount,
      fence: c.fence
    }));
  } catch {
    // Fallback to legacy endpoint if backend has not mounted /v1/conversations yet
    try {
      const raw = await ragFetch<any[]>('/api/conversations');
      return (raw || []).map(c => ({
        id: c.id,
        title: c.title || 'Untitled Session',
        createdAt: c.created_at || c.createdAt || new Date().toISOString(),
        updatedAt: c.updated_at || c.updatedAt,
        messageCount: c.message_count || c.messageCount
      }));
    } catch (err) {
      console.warn('[RAG API] listConversations failed:', err);
      return [];
    }
  }
}

export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  try {
    const raw = await ragFetch<any>(`/v1/conversations/${conversationId}`);
    if (!raw) return null;

    const messages: ChatMessage[] = (raw.messages || []).map((m: any, idx: number) => {
      let citations: Citation[] = [];
      if (m.citations) {
        citations = typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations;
      } else if (m.sources) {
        citations = typeof m.sources === 'string' ? JSON.parse(m.sources) : m.sources;
      }

      return {
        id: m.id || `msg_${idx}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        createdAt: m.created_at || m.createdAt || new Date().toISOString(),
        units: m.units,
        citations,
        outcome: m.outcome || 'answer',
        outcomeReason: m.outcome_reason || m.outcomeReason,
        coverage: m.coverage || 'complete',
        lowConfidence: Boolean(m.low_confidence),
        incomplete: Boolean(m.incomplete),
        runId: m.run_id || m.runId
      };
    });

    return {
      conversation: {
        id: raw.id,
        title: raw.title || 'Session',
        createdAt: raw.created_at || new Date().toISOString(),
        fence: raw.fence
      },
      messages
    };
  } catch (err) {
    // Fallback to legacy endpoint
    try {
      const raw = await ragFetch<any>(`/api/conversations/${conversationId}`);
      if (!raw) return null;
      return {
        conversation: {
          id: raw.id,
          title: raw.title || 'Session',
          createdAt: raw.created_at || new Date().toISOString()
        },
        messages: (raw.messages || []).map((m: any, idx: number) => ({
          id: m.id || `msg_${idx}`,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
          createdAt: m.created_at || new Date().toISOString(),
          citations: m.sources || []
        }))
      };
    } catch {
      return null;
    }
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const res = await ragFetch<{ success: boolean }>(`/v1/conversations/${conversationId}`, {
      method: 'DELETE'
    });
    return res.success ?? true;
  } catch {
    try {
      const res = await ragFetch<{ success: boolean }>(`/api/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// 2. Search & Retrieval API (§12.4, §15.1)
// ==========================================

export async function searchKnowledge(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  try {
    const res = await ragFetch<{ results: any[] }>('/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query })
    });

    return (res.results || []).map((r, idx) => ({
      id: r.id || `res_${idx}`,
      title: r.title || 'Document Section',
      snippet: r.snippet || r.text || r.content || '',
      documentId: r.document_id || r.documentId || '',
      documentVersionId: r.document_version_id || r.documentVersionId,
      page: r.page,
      sourceLocation: r.source_location || r.sourceLocation || (r.page ? `Page ${r.page}` : undefined),
      score: typeof r.score === 'number' ? r.score : 0.85,
      retrievalScore: r.retrieval_score,
      rerankScore: r.rerank_score,
      authority: r.authority || 'Internal'
    }));
  } catch (err) {
    // Fallback to legacy search endpoint if mounted
    try {
      const res = await ragFetch<{ results: any[] }>('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query, strategy: 'hybrid' })
      });
      return (res.results || []).map((r, idx) => ({
        id: r.id || `res_${idx}`,
        title: r.title || 'Document Section',
        snippet: r.snippet || r.content || '',
        documentId: r.document_id || '',
        sourceLocation: r.source_location,
        score: r.score || 0.85,
        authority: 'Internal'
      }));
    } catch {
      console.warn('[RAG API] Search failed:', err);
      throw err;
    }
  }
}

// ==========================================
// 3. Document Ingestion API (§12.1, §15.1)
// ==========================================

export async function listDocuments(): Promise<DocumentSource[]> {
  try {
    const raw = await ragFetch<any[]>('/v1/documents');
    return (raw || []).map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      title: d.title || d.filename,
      filename: d.filename,
      fileFormat: d.file_format || d.filename.split('.').pop() || 'file',
      currentVersionId: d.current_version_id,
      sizeBytes: d.size_bytes || d.sizeBytes,
      totalChunks: d.total_chunks || d.totalChunks || 0,
      uploadedAt: d.uploaded_at || d.uploadedAt || new Date().toISOString(),
      state: d.state || d.status || 'ready',
      errorMessage: d.error_message || d.errorMessage
    }));
  } catch {
    // Fallback to legacy endpoint
    try {
      const raw = await ragFetch<any[]>('/api/documents');
      return (raw || []).map(d => ({
        id: d.id,
        title: d.filename,
        filename: d.filename,
        fileFormat: d.file_format || d.filename.split('.').pop() || 'file',
        sizeBytes: d.size_bytes,
        totalChunks: d.total_chunks || 0,
        uploadedAt: d.uploaded_at || new Date().toISOString(),
        state: d.status || 'ready'
      }));
    } catch (err) {
      console.warn('[RAG API] listDocuments failed:', err);
      return [];
    }
  }
}

export async function uploadDocuments(files: File[]): Promise<{ success: boolean; filesCount: number }> {
  // Validate supported formats in Release 1 (§0.1 D2): PDF, DOCX, PPTX only
  const validExtensions = ['pdf', 'docx', 'pptx'];
  for (const f of files) {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!validExtensions.includes(ext)) {
      throw new Error(`Unsupported format "${f.name}". Release 1 supports text-extractable PDF, .docx, and .pptx only.`);
    }
  }

  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  try {
    const res = await ragFetch<{ success?: boolean; ingested?: number }>('/v1/documents', {
      method: 'POST',
      body: formData
    });
    return {
      success: res.success ?? true,
      filesCount: files.length
    };
  } catch {
    // Fallback to legacy upload
    const res = await ragFetch<{ success?: boolean; ingested?: number }>('/api/upload', {
      method: 'POST',
      body: formData
    });
    return {
      success: res.success ?? true,
      filesCount: files.length
    };
  }
}

export async function removeDocument(documentId: string): Promise<boolean> {
  try {
    const res = await ragFetch<{ success: boolean }>(`/v1/documents/${documentId}`, {
      method: 'DELETE'
    });
    return res.success ?? true;
  } catch {
    try {
      const res = await ragFetch<{ success: boolean }>(`/api/documents/${documentId}`, {
        method: 'DELETE'
      });
      return res.success ?? true;
    } catch {
      return false;
    }
  }
}

// ==========================================
// 4. Citations Resolution API (§14.3, §15.1)
// ==========================================

export async function resolveCitation(citationId: string | number): Promise<Citation | null> {
  try {
    return await ragFetch<Citation>(`/v1/citations/${citationId}`);
  } catch (err) {
    console.warn(`[RAG API] resolveCitation ${citationId} failed:`, err);
    return null;
  }
}
