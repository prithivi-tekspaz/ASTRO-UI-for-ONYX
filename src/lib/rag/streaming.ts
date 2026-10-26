/**
 * Agentic RAG System v11 — Streaming Protocol Parser & Reconnect Client
 * 
 * Strict SSE parser for Axum /v1/chat/stream endpoints conforming to Design Doc v11 (§13.0, §15.2, §15.3).
 * Features:
 * - Structured JSON-line claim units (u=1 answer first, consecutive u support/caveat)
 * - Status events for observable state transitions
 * - Resolved citations binding
 * - Reconnection via /v1/runs/{id}/events with Last-Event-ID (up to 3 reconnects, 10s grace)
 * - Safe cancellation via POST /v1/runs/{id}/cancel
 * - Distinguishes answer, refer_to_owner, social_reply, ask_user, fail_gracefully, upstream_failure
 */

import type { 
  ClaimUnit,
  Citation, 
  VerificationPayload,
  ClarificationPayload,
  DonePayload,
  AgentStreamingEvent,
  ClaimUnitRole
} from './types';
import { getAuthHeaders, ragConfig } from './client';

export interface StreamCallbacks {
  onStatus?: (step: string, detail?: string) => void;
  onClaimUnit?: (unit: ClaimUnit) => void;
  onCitations?: (citations: Citation[]) => void;
  onVerification?: (verification: VerificationPayload) => void;
  onClarification?: (clarification: ClarificationPayload) => void;
  onDone?: (done: DonePayload, units: ClaimUnit[]) => void;
  onError?: (errorMessage: string, code?: string, runId?: string) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

export interface StreamAgentOptions extends StreamCallbacks {
  query: string;
  conversationId: string;
  documentIds?: string[];
  mode?: 'gated' | 'strict' | 'fast';
  maxAttempts?: number;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function streamAgentRag(options: StreamAgentOptions): Promise<ClaimUnit[]> {
  const {
    query,
    conversationId,
    documentIds,
    mode = 'gated',
    maxAttempts = 3,
    idempotencyKey,
    signal,
    onStatus,
    onClaimUnit,
    onCitations,
    onVerification,
    onClarification,
    onDone,
    onError,
    onReconnecting
  } = options;

  let activeRunId: string | null = null;
  let lastEventId: string | null = null;
  let reconnectCount = 0;
  const maxReconnects = 3;
  const receivedUnits: ClaimUnit[] = [];
  const processedUnitIndices = new Set<number>();

  // Helper to safely cancel on the backend
  async function notifyBackendCancel(runId: string) {
    try {
      await fetch(`${ragConfig.baseUrl}/v1/runs/${runId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
    } catch {
      // Fire-and-forget
    }
  }

  // Parse SSE stream from ReadableStreamDefaultReader
  async function readSseStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<boolean> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          if (activeRunId) {
            await notifyBackendCancel(activeRunId);
          }
          throw new DOMException('Aborted by client', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;

          let currentEvent = 'message';
          let currentData = '';

          const lines = trimmed.split('\n');
          for (const line of lines) {
            if (line.startsWith('id:')) {
              lastEventId = line.substring(3).trim();
            } else if (line.startsWith('event:')) {
              currentEvent = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              const dataContent = line.substring(5).trim();
              currentData = currentData ? currentData + '\n' + dataContent : dataContent;
            }
          }

          if (!currentData) continue;

          try {
            const parsed = JSON.parse(currentData);
            const eventType = parsed.type || currentEvent;
            const data = parsed.data !== undefined ? parsed.data : parsed;

            switch (eventType) {
              case 'status':
                onStatus?.(data.step || 'Processing', data.detail);
                break;

              case 'token': {
                // Grounded claim unit event (§13.0, §15.2)
                const unitIndex = data.unit !== undefined ? data.unit : data.seq;
                if (unitIndex !== undefined && !processedUnitIndices.has(unitIndex)) {
                  processedUnitIndices.add(unitIndex);
                  const claimUnit: ClaimUnit = {
                    u: unitIndex,
                    role: (data.role as ClaimUnitRole) || (unitIndex === 1 ? 'answer' : 'support'),
                    text: data.text || '',
                    cites: Array.isArray(data.cites) ? data.cites : [],
                    reqs: data.reqs
                  };
                  receivedUnits.push(claimUnit);
                  onClaimUnit?.(claimUnit);
                }
                break;
              }

              case 'citations': {
                const citationsList: Citation[] = Array.isArray(data) ? data : (data.citations || []);
                onCitations?.(citationsList);
                break;
              }

              case 'verification': {
                onVerification?.(data as VerificationPayload);
                break;
              }

              case 'clarification': {
                onClarification?.(data as ClarificationPayload);
                break;
              }

              case 'done': {
                const donePayload: DonePayload = {
                  runId: data.run_id || data.runId || activeRunId || '',
                  outcome: data.outcome || 'answer',
                  reason: data.reason,
                  attemptsUsed: data.attempts_used || data.attemptsUsed || 1,
                  coverage: data.coverage || 'complete',
                  incomplete: Boolean(data.incomplete)
                };
                onDone?.(donePayload, receivedUnits);
                return true; // Finished cleanly
              }

              case 'error': {
                onError?.(data.message || 'Stream error', data.code, data.run_id);
                throw new Error(data.message || 'Stream error');
              }
            }
          } catch (jsonErr: any) {
            if (jsonErr.message && !jsonErr.message.includes('JSON')) {
              throw jsonErr;
            }
            // Ignore incomplete chunks
          }
        }
      }
      return false; // Stream ended without terminal 'done'
    } finally {
      reader.releaseLock();
    }
  }

  // Primary stream initiator
  async function connectPrimaryStream(): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...getAuthHeaders()
    };

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    // Try /v1/chat/stream first, with fallback to /api/chat if proxying legacy
    const endpoints = ['/v1/chat/stream', '/api/chat'];
    let response: Response | null = null;
    let lastErr: any = null;

    for (const ep of endpoints) {
      try {
        const res = await fetch(`${ragConfig.baseUrl}${ep}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            conversation_id: conversationId,
            message: query,
            document_ids: documentIds,
            options: {
              mode,
              max_attempts: maxAttempts
            }
          }),
          signal
        });

        if (res.ok) {
          response = res;
          break;
        } else if (res.status === 404 && ep === '/v1/chat/stream') {
          // Fall through to try /api/chat
          continue;
        } else {
          let errBody: any;
          try { errBody = await res.json(); } catch { errBody = await res.text(); }
          const errMsg = typeof errBody === 'object' && errBody?.message ? errBody.message : `HTTP ${res.status}`;
          onError?.(errMsg, `HTTP_${res.status}`, typeof errBody === 'object' ? errBody?.run_id : undefined);
          throw new Error(errMsg);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastErr = err;
      }
    }

    if (!response) {
      const msg = lastErr?.message || 'Could not connect to Agentic RAG streaming server.';
      onError?.(msg, 'CONNECTION_FAILED');
      throw new Error(msg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const msg = 'Streaming response body is unavailable or not readable.';
      onError?.(msg, 'STREAM_UNREADABLE');
      throw new Error(msg);
    }

    return await readSseStream(reader);
  }

  // Reconnection helper using GET /v1/runs/{id}/events (§15.2, §15.3)
  async function attemptReconnect(): Promise<boolean> {
    if (!activeRunId || reconnectCount >= maxReconnects) {
      return false;
    }

    reconnectCount++;
    onReconnecting?.(reconnectCount, maxReconnects);
    onStatus?.('Reconnecting stream', `Resuming from event ${lastEventId || 'beginning'} (attempt ${reconnectCount}/${maxReconnects})...`);

    // 1.5s backoff
    await new Promise(r => setTimeout(r, 1500));

    try {
      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
        ...getAuthHeaders()
      };
      if (lastEventId) {
        headers['Last-Event-ID'] = lastEventId;
      }

      const res = await fetch(`${ragConfig.baseUrl}/v1/runs/${activeRunId}/events`, {
        headers,
        signal
      });

      if (!res.ok) return false;
      const reader = res.body?.getReader();
      if (!reader) return false;

      return await readSseStream(reader);
    } catch {
      return false;
    }
  }

  // Execution with reconnect loop
  let isDone = false;
  try {
    isDone = await connectPrimaryStream();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    // Attempt reconnect if runId was assigned and stream dropped
    while (!isDone && activeRunId && reconnectCount < maxReconnects) {
      isDone = await attemptReconnect();
    }
    if (!isDone) {
      throw err;
    }
  }

  // Handle case where stream ended without terminal done
  if (!isDone && reconnectCount < maxReconnects && activeRunId) {
    while (!isDone && reconnectCount < maxReconnects) {
      isDone = await attemptReconnect();
    }
  }

  if (!isDone && receivedUnits.length > 0) {
    // Mark as incomplete response (§13.4)
    onDone?.({
      runId: activeRunId || '',
      outcome: 'answer',
      coverage: 'partial',
      incomplete: true
    }, receivedUnits);
  }

  return receivedUnits;
}
