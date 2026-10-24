/**
 * Onyx Streaming Response Handler
 * 
 * Safely parses Server-Sent Events (SSE) from the backend streaming pipeline.
 */

import type { StreamingEvent, Citation } from './types';

export interface StreamChatOptions {
  query: string;
  sessionId: string;
  activeDocId?: string | null;
  onContext?: (citations: Citation[]) => void;
  onToken?: (token: string) => void;
  onDone?: (fullAnswer: string) => void;
  onError?: (errorMsg: string) => void;
  signal?: AbortSignal;
}

export async function streamChatCompletion(options: StreamChatOptions): Promise<string> {
  const { query, sessionId, activeDocId, onContext, onToken, onDone, onError, signal } = options;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      session_id: sessionId,
      conversation_id: sessionId,
      active_doc_id: activeDocId
    }),
    signal
  });

  if (!response.ok) {
    let errText = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errText = errJson.error || errText;
    } catch {
      // fallback to status
    }
    throw new Error(errText);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response body is unavailable.');
  }

  const decoder = new TextDecoder();
  let fullAnswer = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const lines = trimmed.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: StreamingEvent = JSON.parse(line.substring(6));

              if (eventData.type === 'context') {
                onContext?.(eventData.data || []);
              } else if (eventData.type === 'token') {
                fullAnswer += eventData.token;
                onToken?.(eventData.token);
              } else if (eventData.type === 'done') {
                onDone?.(fullAnswer);
                return fullAnswer;
              } else if (eventData.type === 'error') {
                onError?.(eventData.message);
                throw new Error(eventData.message);
              }
            } catch (err) {
              // Ignore non-json lines
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  onDone?.(fullAnswer);
  return fullAnswer;
}
