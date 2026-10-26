/**
 * Rust Agentic RAG HTTP Client & Endpoint Transport
 * 
 * Configures communication with the Axum/Tokio Rust backend.
 * Provides typed fetch handling, health checks, and strict error classification.
 */

import type { BackendHealthResponse } from './types';

export interface RagClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export const ragConfig: RagClientConfig = {
  // Uses Vite proxy '/api' in development or direct host in production
  baseUrl: typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8080',
  timeoutMs: 30000
};

export class RagApiError extends Error {
  status: number;
  data: unknown;
  code?: string;

  constructor(message: string, status: number, data?: unknown, code?: string) {
    super(message);
    this.name = 'RagApiError';
    this.status = status;
    this.data = data;
    this.code = code;
  }
}

export async function ragFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ragConfig.baseUrl}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Set timeout controller
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ragConfig.timeoutMs);
  
  // Combine signals if caller passed one
  let signal = controller.signal;
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal
    });

    clearTimeout(id);

    if (!response.ok) {
      let errData: any;
      try {
        errData = await response.json();
      } catch {
        errData = await response.text();
      }

      const message = typeof errData === 'object' && errData?.error 
        ? errData.error 
        : `Backend responded with HTTP ${response.status} from ${endpoint}`;
      
      const code = typeof errData === 'object' ? errData?.code : undefined;
      throw new RagApiError(message, response.status, errData, code);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new RagApiError('Request timed out or was cancelled', 408);
    }
    if (err instanceof RagApiError) {
      throw err;
    }
    throw new RagApiError(err.message || 'Network connection to backend failed', 0, err);
  }
}

/** Check Rust backend health and service capabilities */
export async function checkBackendHealth(): Promise<BackendHealthResponse> {
  try {
    return await ragFetch<BackendHealthResponse>('/api/health');
  } catch (err) {
    return {
      status: 'unhealthy',
      version: 'Unknown',
      modelProvider: 'Unavailable',
      vectorBackend: 'Disconnected'
    };
  }
}
