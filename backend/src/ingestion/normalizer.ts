// ============================================
// Court Access — Document Normalizer
// Transforms raw parsed records into canonical NormalizedDocument format.
// Deterministic: same input always produces same output.
// ============================================

import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import type { RawDocument, NormalizedDocument, CorpusType } from './types.ts';
import type { ParsedRecord } from './corpusParser.ts';

// ---------------------------------------------------------------------------
// Corpus Type Mapping
// ---------------------------------------------------------------------------

const CORPUS_TYPE_MAP: Record<string, CorpusType> = {
  policy: 'policy',
  policy_document: 'policy',
  chp_policy: 'policy',
  statute: 'statute',
  penal_code: 'statute',
  evidence_code: 'statute',
  federal_statute: 'statute',
  case_law: 'case_law',
  case: 'case_law',
  transcript: 'transcript',
  court_transcript: 'transcript',
  evidence: 'evidence',
  evidence_file: 'evidence',
  discovery: 'evidence',
  investigative_report: 'investigative_report',
  investigation: 'investigative_report',
};

/**
 * Resolve a raw document type string to a canonical CorpusType.
 */
function resolveDocumentType(raw: string | undefined, corpusName: string): CorpusType {
  if (raw) {
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized in CORPUS_TYPE_MAP) {
      return CORPUS_TYPE_MAP[normalized];
    }
  }
  // Fall back to corpus name
  const corpusNormalized = corpusName.toLowerCase().replace(/[\s-]+/g, '_');
  return CORPUS_TYPE_MAP[corpusNormalized] ?? 'policy';
}

// ---------------------------------------------------------------------------
// Content Hash
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of document content for deduplication.
 * Deterministic: identical content always produces identical hash.
 */
function computeContentHash(content: string, tenantId: string): string {
  return createHash('sha256')
    .update(`${tenantId}:${content}`)
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a raw document into canonical form.
 */
export function normalizeDocument(
  raw: RawDocument,
  corpusName: string,
  sourceFile: string,
  tenantId: string,
): NormalizedDocument {
  const content = raw.content ?? raw.body ?? raw.text ?? '';
  const title = raw.title ?? 'Untitled';
  const jurisdiction = raw.jurisdiction ?? 'unknown';
  const documentType = resolveDocumentType(
    raw.type ?? raw.documentType,
    corpusName,
  );
  const source = raw.source ?? sourceFile;
  const version = raw.version ?? '1.0';
  const now = new Date();
  const contentHash = computeContentHash(content, tenantId);

  // Deterministic ID: SHA-256 of content hash + corpus + source
  const id = raw.id ?? createHash('sha256')
    .update(`${contentHash}:${corpusName}:${sourceFile}`)
    .digest('hex');

  return {
    id,
    tenantId,
    title,
    content,
    jurisdiction,
    documentType,
    source,
    version,
    corpusName,
    sourceFile,
    contentHash,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a Transform stream that normalizes raw parsed records
 * into NormalizedDocument objects.
 */
export function createNormalizerTransform(
  corpusName: string,
  sourceFile: string,
  tenantId: string,
): Transform {
  return new Transform({
    objectMode: true,
    transform(record: ParsedRecord, _encoding, callback) {
      try {
        const normalized = normalizeDocument(
          record.doc,
          corpusName,
          sourceFile,
          tenantId,
        );
        this.push(normalized);
        callback();
      } catch (_err) {
        // Skip documents that fail normalization
        callback();
      }
    },
  });
}
