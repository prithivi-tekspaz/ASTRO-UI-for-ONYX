/**
 * Onyx API Client & Configuration
 * 
 * Central HTTP client and environment configuration for upstream Onyx backend.
 */

export interface OnyxConfig {
  baseUrl: string;
  isMockEnabled: boolean;
}

export const onyxConfig: OnyxConfig = {
  // Uses proxy /api during dev (as defined in astro.config.mjs), configurable via env
  baseUrl: typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8080',
  isMockEnabled: false // explicitly false: only fall back when endpoints are unconfirmed
};

export class OnyxApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'OnyxApiError';
    this.status = status;
    this.data = data;
  }
}

export async function onyxFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${onyxConfig.baseUrl}${endpoint}`;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errData: unknown;
    try {
      errData = await response.json();
    } catch {
      errData = await response.text();
    }
    const message = (errData as { error?: string })?.error || `HTTP ${response.status} from ${endpoint}`;
    throw new OnyxApiError(message, response.status, errData);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}
