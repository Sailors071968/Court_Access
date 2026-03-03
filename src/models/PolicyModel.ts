// ============================================
// Court Access — Policy Canon Model (Phase 3)
// Law Enforcement Policy Canon Ingestion Layer
//
// All policy-related domain types.
// Deterministic. Tenant-scoped. Dual-hashed.
//
// Constitutional boundaries:
//   - No compliance scoring
//   - No agency ranking
//   - No probability assignment
//   - No risk levels
//   - No misconduct likelihood
//   - No intent inference
//   - No strategy recommendations
//   - Binary deviation detection only (Phase 35)
// ============================================

// ---------------------------------------------------------------------------
// Policy Manual Entity
// ---------------------------------------------------------------------------

/**
 * A law enforcement agency's policy manual.
 * Represents the top-level container for an agency's policies.
 * Dual-hashed for integrity. Tenant-scoped.
 *
 * Binary state rule (Phase 4 + Phase 35):
 *   - contentHash and sha3Hash are REQUIRED (non-null).
 *   - A PolicyManualEntity only exists after full ingestion.
 */
export interface PolicyManualEntity {
  id: string;                    // Deterministic — derived from contentHash
  tenantId: string;
  agencyId: string;              // Reference to AgencyEntity
  title: string;                 // e.g. "LAPD Use of Force Policy Manual"
  version: string;               // e.g. "2024-01" — manual version identifier
  effectiveDate: string;         // ISO 8601 — when this version became effective
  supersededDate: string | null; // ISO 8601 — when this version was replaced (null if current)
  sourceFileName: string;        // Original uploaded file name
  fileSize: number;              // Raw bytes
  fileType: string;              // e.g. "pdf", "txt", "docx"
  contentHash: string;           // SHA-256 of entire source file — REQUIRED, immutable
  sha3Hash: string;              // SHA3-256 of entire source file — REQUIRED, immutable
  totalSections: number;         // Count of PolicySectionEntity children
  totalChunks: number;           // Count of PolicyChunkEntity descendants
  ingestedAt: string;            // ISO 8601 — deterministic timestamp
  integrityVerified: boolean;    // True once dual-hash verified post-upload
}

// ---------------------------------------------------------------------------
// Policy Section Entity
// ---------------------------------------------------------------------------

/**
 * A named section within a policy manual.
 * Represents a logical division (chapter, article, section header).
 * Dual-hashed independently.
 *
 * Sections are ordered by `sectionNumber` for deterministic traversal.
 */
export interface PolicySectionEntity {
  id: string;                    // Deterministic — derived from contentHash
  tenantId: string;
  manualId: string;              // Reference to parent PolicyManualEntity
  agencyId: string;              // Denormalized for query efficiency
  sectionNumber: number;         // Deterministic ordering within manual (1-indexed)
  title: string;                 // Section heading text
  rawText: string;               // Full raw text of this section
  contentHash: string;           // SHA-256 of rawText bytes — REQUIRED, immutable
  sha3Hash: string;              // SHA3-256 of rawText bytes — REQUIRED, immutable
  chunkCount: number;            // Count of PolicyChunkEntity children
  integrityVerified: boolean;    // True once dual-hash verified
}

// ---------------------------------------------------------------------------
// Policy Chunk Entity
// ---------------------------------------------------------------------------

/**
 * A canonical text chunk within a policy section.
 * The atomic unit for deterministic text comparison.
 * Dual-hashed independently.
 *
 * Chunks are produced by splitting section text into comparison-ready segments.
 * Each chunk is normalized (whitespace, line endings) before hashing.
 *
 * Chunks are ordered by `chunkIndex` for deterministic traversal.
 */
export interface PolicyChunkEntity {
  id: string;                    // Deterministic — derived from contentHash
  tenantId: string;
  manualId: string;              // Reference to PolicyManualEntity
  sectionId: string;             // Reference to parent PolicySectionEntity
  agencyId: string;              // Denormalized for query efficiency
  chunkIndex: number;            // Deterministic ordering within section (0-indexed)
  normalizedText: string;        // Whitespace-normalized, line-ending-canonicalized text
  contentHash: string;           // SHA-256 of normalizedText bytes — REQUIRED, immutable
  sha3Hash: string;              // SHA3-256 of normalizedText bytes — REQUIRED, immutable
  integrityVerified: boolean;    // True once dual-hash verified
}

// ---------------------------------------------------------------------------
// Deviation Record
// ---------------------------------------------------------------------------

/**
 * A binary deviation detection record.
 * Produced by comparing a report text segment against a policy chunk.
 *
 * Phase 35 output format — strictly binary:
 *   - deviationDetected: true | false
 *   - No adjectives. No narrative. No interpretation.
 *   - No scoring. No ranking. No probability.
 *
 * The comparisonHash is a dual-hash of the concatenated normalized texts,
 * ensuring the comparison itself is deterministically reproducible.
 */
export interface DeviationRecord {
  id: string;                    // Deterministic — derived from comparisonHash
  tenantId: string;
  caseId: string;                // Reference to CaseEntity
  documentId: string;            // Reference to source DocumentEntity (the report)
  policyChunkId: string;         // Reference to PolicyChunkEntity being compared against
  policyReference: string;       // Human-readable policy reference (e.g. "Section 4.2, Chunk 3")
  reportReference: string;       // Human-readable report reference (e.g. "Document 'Arrest Report', Paragraph 7")
  deviationDetected: boolean;    // Binary: true = textual deviation detected, false = texts align
  comparisonHash: string;        // SHA-256 of (normalizedPolicyText + normalizedReportText)
  comparisonSha3Hash: string;    // SHA3-256 of same concatenation
  normalizedPolicyText: string;  // The exact normalized policy text used in comparison
  normalizedReportText: string;  // The exact normalized report text used in comparison
  comparedAt: string;            // ISO 8601 — deterministic timestamp of comparison
  integrityVerified: boolean;    // True once comparison hashes verified
}

// ---------------------------------------------------------------------------
// Policy Ingestion Input
// ---------------------------------------------------------------------------

/**
 * Input for policy manual ingestion.
 * Caller provides file and metadata; ingestion service computes hashes,
 * parses sections, chunks text, and produces fully-hashed entities.
 */
export interface PolicyIngestionInput {
  file: File;
  tenantId: string;
  agencyId: string;
  title: string;
  version: string;
  effectiveDate: string;
}

// ---------------------------------------------------------------------------
// Policy Ingestion Result
// ---------------------------------------------------------------------------

/**
 * Result of policy manual ingestion.
 * Contains the full entity hierarchy produced by ingestion.
 */
export interface PolicyIngestionResult {
  success: boolean;
  manual: PolicyManualEntity | null;
  sections: PolicySectionEntity[];
  chunks: PolicyChunkEntity[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Deviation Comparison Input
// ---------------------------------------------------------------------------

/**
 * Input for a deviation comparison.
 * Compares a specific report text segment against a specific policy chunk.
 */
export interface DeviationComparisonInput {
  tenantId: string;
  caseId: string;
  documentId: string;
  reportText: string;            // Raw report text segment to compare
  reportReference: string;       // Human-readable reference for the report segment
  policyChunk: PolicyChunkEntity; // The policy chunk to compare against
}

// ---------------------------------------------------------------------------
// Deviation Comparison Result
// ---------------------------------------------------------------------------

/**
 * Result of a deviation comparison.
 */
export interface DeviationComparisonResult {
  success: boolean;
  record: DeviationRecord | null;
  error: string | null;
}
