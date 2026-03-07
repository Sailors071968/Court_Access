// ============================================
// Court Access — Evidence Search Service (Phase 24)
// Full-text search across all evidence types.
// In-memory mock for frontend scaffolding.
// ============================================

import type { EvidenceRecord, EvidenceType } from '../models/EvidenceModel';
import type { ProcessingResult } from './evidenceUploadService';

// ---------------------------------------------------------------------------
// Search Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  evidenceId: string;
  fileName: string;
  fileType: EvidenceType;
  matchType: 'content' | 'transcript' | 'ocr' | 'summary' | 'entity' | 'filename';
  matchText: string;           // The text snippet containing the match
  matchHighlight: string;      // Match text with <mark> tags around matches
  relevanceScore: number;      // 0-1
  uploadTimestamp: string;
}

export interface SearchFilters {
  evidenceType: EvidenceType | 'all';
  dateFrom: string | null;
  dateTo: string | null;
  personMentioned: string | null;
}

// ---------------------------------------------------------------------------
// Search Index (in-memory)
// ---------------------------------------------------------------------------

const searchIndex: Map<string, { record: EvidenceRecord; result: ProcessingResult }> = new Map();

export function indexEvidence(record: EvidenceRecord, result: ProcessingResult): void {
  searchIndex.set(record.evidenceId, { record, result });
}

export function removeFromIndex(evidenceId: string): void {
  searchIndex.delete(evidenceId);
}

// ---------------------------------------------------------------------------
// Search Function
// ---------------------------------------------------------------------------

export function searchEvidence(
  query: string,
  filters: SearchFilters
): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  for (const [, { record, result }] of searchIndex) {
    // Apply type filter
    if (filters.evidenceType !== 'all' && record.fileType !== filters.evidenceType) continue;

    // Apply date filters
    if (filters.dateFrom && record.uploadTimestamp < filters.dateFrom) continue;
    if (filters.dateTo && record.uploadTimestamp > filters.dateTo) continue;

    // Apply person filter
    if (filters.personMentioned) {
      const personLower = filters.personMentioned.toLowerCase();
      const hasEntity = result.entities.some((e) => e.name.toLowerCase().includes(personLower));
      if (!hasEntity) continue;
    }

    // Search across all text fields
    const searchableFields: { text: string; type: SearchResult['matchType'] }[] = [
      { text: record.fileName, type: 'filename' },
      { text: result.extractedText, type: 'content' },
      { text: result.summary, type: 'summary' },
      { text: result.transcript ?? '', type: 'transcript' },
      { text: result.ocrText ?? '', type: 'ocr' },
      ...result.entities.map((e) => ({ text: e.name, type: 'entity' as const })),
    ];

    for (const field of searchableFields) {
      if (!field.text) continue;
      const textLower = field.text.toLowerCase();
      const matchIndex = textLower.indexOf(queryLower);

      if (matchIndex !== -1) {
        // Extract snippet around match
        const start = Math.max(0, matchIndex - 60);
        const end = Math.min(field.text.length, matchIndex + query.length + 60);
        const snippet = (start > 0 ? '...' : '') + field.text.slice(start, end) + (end < field.text.length ? '...' : '');

        // Create highlighted version (escape HTML first to prevent XSS)
        const highlight = escapeHtml(snippet).replace(
          new RegExp(`(${escapeRegex(query)})`, 'gi'),
          '<mark>$1</mark>'
        );

        results.push({
          evidenceId: record.evidenceId,
          fileName: record.fileName,
          fileType: record.fileType,
          matchType: field.type,
          matchText: snippet,
          matchHighlight: highlight,
          relevanceScore: field.type === 'filename' ? 1.0 : field.type === 'content' ? 0.9 : 0.7,
          uploadTimestamp: record.uploadTimestamp,
        });

        break; // One result per evidence item
      }
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// Get all indexed entities (for person filter autocomplete)
// ---------------------------------------------------------------------------

export function getIndexedEntities(): { name: string; type: string; count: number }[] {
  const entityMap = new Map<string, { name: string; type: string; count: number }>();

  for (const [, { result }] of searchIndex) {
    for (const entity of result.entities) {
      const key = `${entity.name}-${entity.type}`;
      const existing = entityMap.get(key);
      if (existing) {
        existing.count += entity.count;
      } else {
        entityMap.set(key, { ...entity });
      }
    }
  }

  return Array.from(entityMap.values()).sort((a, b) => b.count - a.count);
}
