// ============================================
// Court Access — Analysis Snapshot Model (Phase 12)
// Immutable Analysis Export Layer
//
// Defines types for generating structured export packages
// that include all intelligence layer outputs.
//
// This is documentation intelligence infrastructure:
//   - Versioned, reproducible analysis snapshots
//   - Includes issue index, CALCRIM mapping, policy comparison,
//     media alignment — all hashed
//   - No narrative summary
//   - Structured tables only
//   - Embedded snapshot hash + model version
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction / strategy
//   - No credibility analysis / intent inference
//   - No "likely" / "appears to" / "suggests"
//   - No "weak" / "strong" / "contradiction" / "violation"
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Analysis Snapshot Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a complete analysis snapshot for a case.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> snapshotId
 *   Pass 2: full canonical -> dual-hash
 *
 * Each sub-hash represents the hash of the corresponding
 * intelligence layer output for this case at this version.
 *
 * Reproducible: given same inputs + modelVersion, produces same snapshot.
 * Append-only. No update. No delete.
 */
export interface AnalysisSnapshotEntity {
  snapshotId: string;                        // SHA-256 of canonical pre-ID form
  caseId: string;
  modelVersion: string;                      // Version of analysis model
  issueIndexHash: string;                    // Hash of structured issue index output
  calcrimMappingHash: string;                // Hash of CALCRIM mapping output
  policyComparisonHash: string;              // Hash of policy comparison output
  mediaAlignmentHash: string;                // Hash of media alignment output
  generatedTimestamp: string;                // ISO 8601, caller-provided
  sha256: string;                            // Dual-hash: SHA-256 of canonical JSON
  sha3_256: string;                          // Dual-hash: SHA3-256 of canonical JSON
}

// ---------------------------------------------------------------------------
// Analysis Snapshot Input
// ---------------------------------------------------------------------------

/**
 * Input for creating an analysis snapshot entity.
 *
 * The caller provides all fields except:
 *   - snapshotId (derived from canonical form)
 *   - sha256 / sha3_256 (computed from canonical form)
 */
export interface AnalysisSnapshotInput {
  caseId: string;
  modelVersion: string;
  issueIndexHash: string;
  calcrimMappingHash: string;
  policyComparisonHash: string;
  mediaAlignmentHash: string;
  generatedTimestamp: string;
}

// ---------------------------------------------------------------------------
// Export Section Type
// ---------------------------------------------------------------------------

/**
 * Section types for the structured export document.
 * Fixed section order enforced by the export engine.
 */
export type ExportSectionType =
  | 'ISSUE_INDEX'
  | 'CALCRIM_MAPPING'
  | 'POLICY_COMPARISON'
  | 'MEDIA_ALIGNMENT'
  | 'SNAPSHOT_METADATA';

// ---------------------------------------------------------------------------
// Export Section
// ---------------------------------------------------------------------------

/**
 * A section of the structured export document.
 *
 * No narrative summary. Structured tables only.
 * Fixed section order.
 */
export interface ExportSection {
  sectionType: ExportSectionType;
  sectionOrder: number;                      // 1-indexed, deterministic
  contentHash: string;                       // Hash of section content
  rowCount: number;                          // Number of structured rows
}

// ---------------------------------------------------------------------------
// Export Document Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a generated export document.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> exportId
 *   Pass 2: full canonical -> dual-hash
 *
 * Fixed section order. Embedded snapshot hash. Embedded model version.
 * No narrative summary. Structured tables only.
 */
export interface ExportDocumentEntity {
  exportId: string;                          // SHA-256 of canonical pre-ID form
  snapshotId: string;                        // Reference to AnalysisSnapshotEntity
  caseId: string;
  modelVersion: string;
  sections: ExportSection[];
  generatedTimestamp: string;
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Export Document Input
// ---------------------------------------------------------------------------

/**
 * Input for creating an export document entity.
 */
export interface ExportDocumentInput {
  snapshotId: string;
  caseId: string;
  modelVersion: string;
  sections: ExportSection[];
  generatedTimestamp: string;
}
