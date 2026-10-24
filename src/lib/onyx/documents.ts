/**
 * Onyx Documents API & Adapter
 * 
 * Manages document catalog fetching, uploads, removals, and indexing statuses.
 */

import { onyxFetch } from './client';
import type { DocumentSource } from './types';

interface RawBackendDoc {
  id: string;
  filename: string;
  file_format?: string;
  total_chunks?: number;
  uploaded_at?: string;
  size_bytes?: number;
}

export async function listDocuments(): Promise<DocumentSource[]> {
  try {
    const rawDocs = await onyxFetch<RawBackendDoc[]>('/api/documents');
    return (rawDocs || []).map(d => ({
      id: d.id,
      filename: d.filename,
      fileFormat: d.file_format || d.filename.split('.').pop() || 'file',
      totalChunks: d.total_chunks || 0,
      sizeBytes: d.size_bytes,
      uploadedAt: d.uploaded_at || new Date().toISOString(),
      status: 'completed'
    }));
  } catch (err) {
    console.warn('[Onyx API] Failed to fetch documents list:', err);
    return [];
  }
}

export async function uploadDocuments(files: File[]): Promise<{ success: boolean; filesCount: number }> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));

  const res = await onyxFetch<{ success?: boolean; ingested?: number }>('/api/upload', {
    method: 'POST',
    body: formData
  });

  return {
    success: res.success ?? true,
    filesCount: files.length
  };
}

export async function removeDocument(documentId: string): Promise<boolean> {
  const res = await onyxFetch<{ success: boolean }>('/api/documents/remove', {
    method: 'POST',
    body: JSON.stringify({ document_id: documentId })
  });
  return res.success ?? true;
}
