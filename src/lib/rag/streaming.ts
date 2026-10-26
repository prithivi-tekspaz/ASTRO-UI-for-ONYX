/**
 * Rust Agentic RAG Streaming Protocol Parser
 * 
 * Accurately parses Server-Sent Events (SSE) from the Axum Agentic RAG backend.
 * Handles fragmented chunks, stage transitions, tool events, evidence evaluation,
 * grounded citation context, token delivery, and errors without fabricating states.
 */

import type { 
  AgentStage, 
  StageStatus,
  Citation, 
  SufficiencyStatus, 
  ToolInvocation, 
  EvidenceEvaluation,
  AgentStreamingEvent
} from './types';

export interface StreamCallbacks {
  onStageChange?: (stage: AgentStage, status: StageStatus, detail?: string, attempt?: number) => void;
  onToolEvent?: (tool: ToolInvocation) => void;
  onEvidenceEvaluation?: (evaluation: EvidenceEvaluation) => void;
  onContextReady?: (citations: Citation[], sufficiency: SufficiencyStatus) => void;
  onToken?: (token: string) => void;
  onDone?: (fullAnswer: string, durationMs?: number, totalAttempts?: number) => void;
  onError?: (errorMessage: string, code?: string) => void;
}

export interface StreamAgentOptions extends StreamCallbacks {
  query: string;
  conversationId: string;
  activeDocId?: string | null;
  retrievalStrategy?: string;
  signal?: AbortSignal;
}

export async function streamAgentRag(options: StreamAgentOptions): Promise<string> {
  const {
    query,
    conversationId,
    activeDocId,
    retrievalStrategy,
    signal,
    onStageChange,
    onToolEvent,
    onEvidenceEvaluation,
    onContextReady,
    onToken,
    onDone,
    onError
  } = options;

  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        query,
        conversation_id: conversationId,
        session_id: conversationId,
        active_doc_id: activeDocId,
        strategy: retrievalStrategy || 'hybrid'
      }),
      signal
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw err;
    }
    const msg = 'Could not establish connection to the Agentic RAG backend server.';
    onError?.(msg, 'CONNECTION_ERROR');
    throw new Error(msg);
  }

  if (!response.ok) {
    let errDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errDetail = errJson.error || errJson.message || errDetail;
    } catch {
      // fallback
    }
    onError?.(errDetail, `HTTP_${response.status}`);
    throw new Error(errDetail);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const msg = 'Backend streaming response body is unavailable or non-readable.';
    onError?.(msg, 'STREAM_UNAVAILABLE');
    throw new Error(msg);
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
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;

            try {
              const event: AgentStreamingEvent = JSON.parse(jsonStr);

              switch (event.type) {
                case 'stage_change':
                  onStageChange?.(
                    event.data.stage, 
                    event.data.status || 'in_progress', 
                    event.data.detail, 
                    event.data.attempt
                  );
                  break;

                case 'tool_event':
                  onToolEvent?.(event.data);
                  break;

                case 'evidence_evaluation':
                  onEvidenceEvaluation?.(event.data);
                  break;

                case 'context_ready':
                  onContextReady?.(
                    event.data.citations || [], 
                    event.data.sufficiency || 'sufficient'
                  );
                  break;

                case 'token':
                  if (event.data.token) {
                    fullAnswer += event.data.token;
                    onToken?.(event.data.token);
                  }
                  break;

                case 'done':
                  onDone?.(
                    fullAnswer, 
                    event.data.executionTimeMs, 
                    event.data.totalAttempts
                  );
                  return fullAnswer;

                case 'error':
                  onError?.(event.data.message, event.data.code);
                  throw new Error(event.data.message);
              }
            } catch (jsonErr: any) {
              if (jsonErr.message && !jsonErr.message.includes('JSON')) {
                throw jsonErr;
              }
              // Skip malformed/fragmented json event
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
