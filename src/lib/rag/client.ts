/**
 * Agentic RAG System v11 — HTTP Client & Endpoint Transport
 * 
 * Strict transport handling for Rust Axum/Tokio Agentic RAG endpoints.
 * References: Agentic RAG System Complete Design Document v11 (§15, §16.2)
 */

import type { BackendHealthResponse } from './types';

export interface RagClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export const ragConfig: RagClientConfig = {
  // Uses Vite/Astro proxy in development or direct host in production
  baseUrl: typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8080',
  timeoutMs: 35000
};

export class RagApiError extends Error {
  status: number;
  data: unknown;
  code?: string;
  runId?: string;

  constructor(message: string, status: number, data?: unknown, code?: string, runId?: string) {
    super(message);
    this.name = 'RagApiError';
    this.status = status;
    this.data = data;
    this.code = code;
    this.runId = runId;
  }
}

/**
 * Retrieves authentication header from sessionStorage/localStorage if configured.
 * In release 1 OIDC environment, this attaches the Bearer token.
 */
export function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('rag_access_token') || sessionStorage.getItem('rag_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function ragFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ragConfig.baseUrl}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Attach default content-type if not multipart
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach OIDC Bearer token if available
  const auth = getAuthHeaders();
  for (const [k, v] of Object.entries(auth)) {
    if (!headers.has(k)) {
      headers.set(k, v);
    }
  }

  // Set timeout controller
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ragConfig.timeoutMs);
  
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(id);

    if (!response.ok) {
      let errData: any;
      try {
        errData = await response.json();
      } catch {
        errData = await response.text();
      }

      const message = typeof errData === 'object' && errData?.message
        ? errData.message
        : (typeof errData === 'object' && errData?.error ? errData.error : `Backend responded with HTTP ${response.status} from ${endpoint}`);
      
      const code = typeof errData === 'object' ? errData?.code : undefined;
      const runId = typeof errData === 'object' ? errData?.run_id : undefined;
      throw new RagApiError(message, response.status, errData, code, runId);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new RagApiError('Request timed out or was cancelled by client', 408);
    }
    if (err instanceof RagApiError) {
      throw err;
    }
    throw new RagApiError(err.message || 'Network connection to backend failed', 0, err);
  }
}

/** 
 * Check Rust backend health and service readiness probes (§15.1, §28.2)
 * Probes GET /health and GET /ready
 */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  try {
    // Try v1 health probe first
    return await ragFetch<BackendHealthResponse>('/health');
  } catch {
    // Fallback to legacy probe route if necessary
    try {
      return await ragFetch<BackendHealthResponse>('/api/health');
    } catch {
      return {
        status: 'unhealthy',
        version: 'Unknown',
        models: {
          embedding: 'nomic-embed-text-v1.5 (768-d)',
          generator: 'Nemotron 3 Super (120B/12B)',
          evaluator: 'Nemotron 3 Super'
        },
        supportedFormats: ['pdf', 'docx', 'pptx']
      };
    }
  }
}
