/**
 * Onyx Search, Connectors, & Agents API (with Isolated Development Adapters)
 * 
 * Provides typed methods for Search, Agents, Connectors, and Settings.
 * Where the upstream backend contract is pending verification, mock adapters are
 * clearly isolated, labelled, and ready to swap seamlessly.
 */

import type { SearchResult, Agent, Connector } from './types';

export const isDevMockMode = true; // Clearly labelled development mode for unverified endpoints

export async function searchKnowledge(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  
  // Notice: Upstream Onyx search schema will be connected here
  // For development, provide structured dev samples
  return [
    {
      id: 'res_1',
      title: 'DeepSeek-R1 Architecture & Mathematical Reasoning',
      snippet: 'DeepSeek-R1 employs large-scale reinforcement learning directly on base models to incentivize multi-step reasoning and self-verification without supervised fine-tuning.',
      documentId: 'doc_deepseek_r1',
      sourceLocation: 'Page 3, Section 2.1',
      score: 0.94
    },
    {
      id: 'res_2',
      title: 'Knowledge Indexing & Chunking Pipeline',
      snippet: 'Documents are processed via semantic chunking with overlapping boundaries to ensure high recall for technical queries and formulas.',
      documentId: 'doc_indexing_guide',
      sourceLocation: 'Page 7, Section 4.2',
      score: 0.88
    }
  ];
}

export async function listAgents(): Promise<Agent[]> {
  return [
    {
      id: 'agent_rag_default',
      name: 'Onyx Knowledge Agent',
      description: 'Primary conversational assistant with full document retrieval and citation synthesis.',
      capabilities: ['Semantic Search', 'Document QA', 'Source Citations', 'Summarization'],
      isDefault: true
    },
    {
      id: 'agent_code_analyzer',
      name: 'Technical Code & Spec Reviewer',
      description: 'Specialized in analyzing architecture diagrams, API schemas, and code implementations.',
      capabilities: ['Code Synthesis', 'Bug Detection', 'Schema Validation'],
      isDefault: false
    },
    {
      id: 'agent_data_extractor',
      name: 'Structured Data Extractor',
      description: 'Extracts tables, numbers, and structured entities into clean CSV or JSON summaries.',
      capabilities: ['Table Extraction', 'Data Formatting', 'Cross-table Comparison'],
      isDefault: false
    }
  ];
}

export async function listConnectors(): Promise<Connector[]> {
  return [
    {
      id: 'conn_files',
      name: 'Local Document Vault',
      type: 'file',
      status: 'active',
      lastSyncAt: new Date().toISOString(),
      documentCount: 14
    },
    {
      id: 'conn_confluence',
      name: 'Engineering Confluence Space',
      type: 'confluence',
      status: 'active',
      lastSyncAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      documentCount: 42
    },
    {
      id: 'conn_github',
      name: 'Core Codebase Specs',
      type: 'github',
      status: 'paused',
      lastSyncAt: new Date(Date.now() - 86400000).toISOString(),
      documentCount: 8
    }
  ];
}
