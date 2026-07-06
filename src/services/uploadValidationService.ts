// ============================================
// Court Access — Upload Validation Service (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Binary PASS/FAIL upload validation.
// No heuristic scoring. No fuzzy logic.
// Deterministic rejection of violations.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - Binary PASS/FAIL only
//   - Deterministic validation rules
// ============================================

import type { DocumentType } from '../models/DocumentModel';
import type { SubscriptionTierId } from '../models/SubscriptionTierModel';
import { getSubscriptionTierById } from '../models/SubscriptionTierModel';

// ---------------------------------------------------------------------------
// Upload Validation Input
// ---------------------------------------------------------------------------

/**
 * Input for validating a file upload.
 * The caller provides all metadata; the service validates deterministically.
 */
export interface UploadValidationInput {
  fileSizeBytes: number;               // Integer — file size in bytes
  documentType: DocumentType;
  pageCount: number;                   // Integer — total pages in document
  transcriptLogicalPages: number;      // Integer — logical transcript pages (0 if not transcript)
  tierId: SubscriptionTierId;
}

// ---------------------------------------------------------------------------
// Upload Validation Rule Result
// ---------------------------------------------------------------------------

/**
 * Result for a single validation rule.
 * Binary only: PASS or FAIL. No scoring.
 */
export interface UploadValidationRuleResult {
  rule: string;
  result: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Upload Validation Result
// ---------------------------------------------------------------------------

/**
 * Complete upload validation result.
 * Overall: PASS only if ALL rules pass.
 * No partial pass. Binary only.
 */
export interface UploadValidationResult {
  rules: UploadValidationRuleResult[];
  overallResult: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum transcript pages per 1 PDF page.
 * A transcript document may contain up to 4 logical transcript pages
 * per single PDF page. This is the deterministic limit.
 */
const MAX_TRANSCRIPT_PAGES_PER_PDF_PAGE = 4;

/**
 * Bytes per megabyte — integer constant.
 */
const BYTES_PER_MB = 1048576;

// ---------------------------------------------------------------------------
// Upload Validation Engine
// ---------------------------------------------------------------------------

/**
 * Validate an upload against deterministic rules.
 *
 * Rules:
 *   1. fileSizeLimit: file size must not exceed tier's maxUploadMB
 *   2. singleDocument: one logical document per upload (pageCount > 0)
 *   3. transcriptPageRatio: if documentType === 'transcript',
 *      transcriptLogicalPages must be <= pageCount * MAX_TRANSCRIPT_PAGES_PER_PDF_PAGE
 *   4. transcriptDeclaration: if transcriptLogicalPages > 0,
 *      documentType must be 'transcript'
 *   5. tierExists: the provided tierId must exist in the registry
 *
 * Binary PASS/FAIL per rule.
 * Overall: PASS only if ALL rules pass.
 *
 * No heuristic scoring. No fuzzy logic.
 * Deterministic: same input always produces same output.
 */
export function validateUpload(
  input: UploadValidationInput
): UploadValidationResult {
  const rules: UploadValidationRuleResult[] = [];

  // Rule 1: Tier must exist
  const tier = getSubscriptionTierById(input.tierId);
  rules.push({
    rule: 'tierExists',
    result: tier !== null ? 'PASS' : 'FAIL',
  });

  // Rule 2: File size limit
  const maxBytes = tier !== null ? tier.maxUploadMB * BYTES_PER_MB : 0;
  rules.push({
    rule: 'fileSizeLimit',
    result:
      tier !== null &&
      Number.isInteger(input.fileSizeBytes) &&
      input.fileSizeBytes > 0 &&
      input.fileSizeBytes <= maxBytes
        ? 'PASS'
        : 'FAIL',
  });

  // Rule 3: Single document — one logical document per upload
  rules.push({
    rule: 'singleDocument',
    result:
      Number.isInteger(input.pageCount) && input.pageCount > 0
        ? 'PASS'
        : 'FAIL',
  });

  // Rule 4: Transcript page ratio
  // If documentType === 'transcript', transcriptLogicalPages must be
  // <= pageCount * MAX_TRANSCRIPT_PAGES_PER_PDF_PAGE
  if (input.documentType === 'transcript') {
    rules.push({
      rule: 'transcriptPageRatio',
      result:
        Number.isInteger(input.transcriptLogicalPages) &&
        input.transcriptLogicalPages > 0 &&
        input.transcriptLogicalPages <= input.pageCount * MAX_TRANSCRIPT_PAGES_PER_PDF_PAGE
          ? 'PASS'
          : 'FAIL',
    });
  }

  // Rule 5: Transcript declaration
  // If transcriptLogicalPages > 0, documentType must be 'transcript'
  if (input.transcriptLogicalPages > 0) {
    rules.push({
      rule: 'transcriptDeclaration',
      result: input.documentType === 'transcript' ? 'PASS' : 'FAIL',
    });
  }

  // Overall: PASS only if ALL rules pass
  const allPass = rules.every((r) => r.result === 'PASS');

  return {
    rules,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
