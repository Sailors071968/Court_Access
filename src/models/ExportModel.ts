// ============================================
// Court Access — Court Packet Export Model (Phase 6)
// Structured Court Packet Export Engine (CAPS-Ready)
//
// All export-related domain types.
// Deterministic. Tenant-scoped. Dual-hashed.
//
// Constitutional boundaries:
//   - No narrative
//   - No recommendations
//   - No interpretation
//   - No scoring
//   - No ranking
//   - No probability
//   - No intent inference
//   - No strategy recommendations
//   - Structural export only
// ============================================

import type { StructuredIssueIndexResult } from './ChargeElementModel';
import type { DeviationRecord } from './PolicyModel';
import type { OfficerStructuralIndexEntity } from './OfficerIndexModel';
import type { DocumentEntity } from './DocumentModel';

// ---------------------------------------------------------------------------
// Document Reference (export-safe subset)
// ---------------------------------------------------------------------------

/**
 * A document reference for export.
 * Contains only fields relevant to court packet export.
 * No extracted text. No storage paths. No internal processing state.
 */
export interface ExportDocumentReference {
  id: string;
  tenantId: string;
  caseId: string;
  name: string;
  type: string;
  filedDate: string;
  pages: number;
  contentHash: string;
  sha3Hash: string;
}

// ---------------------------------------------------------------------------
// Court Packet Export — Canonical JSON Structure
// ---------------------------------------------------------------------------

/**
 * The canonical court packet export artifact.
 * Key order is FIXED and DOCUMENTED (see engine for canonical serialization).
 *
 * This is the deterministic, court-ready export containing:
 *   - Structured Issue Index (CALCRIM elements)
 *   - Policy Deviation Records (binary PASS/FAIL)
 *   - Officer Structural Indexes (aggregation only, if requested)
 *   - Document references
 *   - Scope hash, immutable core hash, anchor epoch
 *   - Non-interpretive declaration
 *
 * No narrative. No recommendations. No interpretation.
 */
export interface CourtPacketExport {
  version: string;                                    // Export format version (e.g. "1.0")
  tenantId: string;
  caseId: string;
  structuredIssueIndex: StructuredIssueIndexResult[];
  policyDeviationRecords: DeviationRecord[];
  officerStructuralIndexes: OfficerStructuralIndexEntity[];
  documentReferences: ExportDocumentReference[];
  scopeHash: string;                                  // SHA-256 of canonical JSON
  immutableCoreHash: string;                          // SHA3-256 of canonical JSON
  anchorEpoch: number;                                // Fixed anchor year (e.g. 2026)
  nonInterpretiveDeclaration: true;                   // Always true — structural assertion
}

// ---------------------------------------------------------------------------
// CAPS Binding
// ---------------------------------------------------------------------------

/**
 * Cryptographic Audit Proof Structure (CAPS).
 * Binds the export artifact to dual-hash proofs.
 *
 * This is the integrity envelope around the export.
 * Both hashes must match for the export to be considered authentic.
 *
 * Updated in Phase 8 to include immutableCoreHash and merkleRoot.
 */
export interface CAPSBinding {
  sha256: string;                                     // SHA-256 of canonical export JSON
  sha3_256: string;                                   // SHA3-256 of canonical export JSON
  scopeHash: string;                                  // Same as export.scopeHash
  immutableCoreHash: string;                          // System-wide immutable core hash reference
  merkleRoot: string;                                 // Daily anchor Merkle root (from TATL)
  nonInterpretiveDeclaration: true;                   // Always true
  anchorEpoch: number;                                // Same as export.anchorEpoch
}

// ---------------------------------------------------------------------------
// CAPS-Bound Export Result
// ---------------------------------------------------------------------------

/**
 * The full CAPS-bound export result.
 * Contains both the canonical export artifact and its CAPS binding.
 */
export interface CAPSBoundExport {
  export: CourtPacketExport;
  caps: CAPSBinding;
}

// ---------------------------------------------------------------------------
// Export Input
// ---------------------------------------------------------------------------

/**
 * Input for building a court packet export.
 * The caller provides all structural data; the engine computes hashes.
 */
export interface CourtPacketExportInput {
  tenantId: string;
  caseId: string;
  structuredIssueIndex: StructuredIssueIndexResult[];
  policyDeviationRecords: DeviationRecord[];
  officerStructuralIndexes: OfficerStructuralIndexEntity[];
  documents: DocumentEntity[];
  anchorEpoch: number;
  merkleRoot: string;                                   // Daily anchor Merkle root (from TATL, Phase 7)
}

// ---------------------------------------------------------------------------
// Export Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a court packet export's integrity.
 */
export interface ExportVerificationResult {
  verified: boolean;                                  // True ONLY if BOTH hashes match
  computedSha256: string;
  computedSha3: string;
}
