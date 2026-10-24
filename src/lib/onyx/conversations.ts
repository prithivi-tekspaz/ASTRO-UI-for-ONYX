/**
 * Onyx Conversations API & Adapter
 * 
 * Maps backend conversation data into canonical Onyx frontend models.
 */

import { onyxFetch } from './client';
import type { Conversation, ChatMessage, Citation } from './types';

interface RawBackendConversation {
  id: string;
  title?: string;
  created_at?: string;
  active_doc_id?: string;
}

interface RawBackendMessage {
  id?: string;
  role: string;
  content: string;
  created_at?: string;
  sources_json?: string | Citation[];
}

export async function listConversations(): Promise<Conversation[]> {
  try {
    const rawList = await onyxFetch<RawBackendConversation[]>('/api/conversations');
    return (rawList || []).map(raw => ({
      id: raw.id,
      title: raw.title || raw.id,
      createdAt: raw.created_at || new Date().toISOString(),
      activeDocId: raw.active_doc_id || null
    }));
  } catch (err) {
    console.warn('[Onyx API] listConversations failed:', err);
    return [];
  }
}

export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: ChatMessage[] } | null> {
  try {
    const rawData = await onyxFetch<{ id: string; title?: string; messages?: RawBackendMessage[] }>(`/api/conversations/${conversationId}`);
    if (!rawData) return null;

    const messages: ChatMessage[] = (rawData.messages || []).map((m, idx) => {
      let parsedSources: Citation[] = [];
      if (m.sources_json) {
        try {
          parsedSources = typeof m.sources_json === 'string' ? JSON.parse(m.sources_json) : m.sources_json;
        } catch {
          parsedSources = [];
        }
      }

      return {
        id: m.id || `msg_${idx}`,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        createdAt: m.created_at || new Date().toISOString(),
        sources: parsedSources
      };
    });

    return {
      conversation: {
        id: rawData.id,
        title: rawData.title || rawData.id,
        createdAt: new Date().toISOString()
      },
      messages
    };
  } catch (err) {
    console.error(`[Onyx API] Failed to fetch conversation ${conversationId}:`, err);
    return null;
  }
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const res = await onyxFetch<{ success: boolean }>('/api/conversations/delete', {
    method: 'POST',
    body: JSON.stringify({ conversation_id: conversationId })
  });
  return res.success ?? true;
}
