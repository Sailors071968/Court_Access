// ============================================
// Court Access — Officer Structural Index Model (Phase 5)
// Officer Cross-Case Structural Index Engine
//
// All officer-related structural aggregation types.
// Deterministic. Tenant-scoped. Dual-hashed.
//
// Constitutional boundaries (Phase 6 — Officer Cross-Case Index):
//   - No officer ranking
//   - No percentile assignment
//   - No probability assignment
//   - No anomaly detection
//   - No score production
//   - No risk labels
//   - No intent inference
//   - No strategy recommendations
//   - No cross-officer comparison
//   - Aggregation only. No evaluation.
// ============================================

// ---------------------------------------------------------------------------
// Officer Structural Index Entity
// ---------------------------------------------------------------------------

/**
 * Structural aggregation data for a single officer across cases.
 *
 * This entity aggregates:
 *   - Document count (unique documents referencing this officer)
 *   - Phrase frequency (exact substring match counts, deterministic phrase list)
 *   - First/last seen timestamps (derived from document dates)
 *
 * This entity does NOT:
 *   - Rank officers
 *   - Compare officers to each other
 *   - Produce relative metrics
 *   - Detect anomalies or patterns
 *   - Assign risk labels or scores
 *
 * Binary state rule (Phase 4 + Phase 35):
 *   - contentHash and sha3Hash are REQUIRED (non-null).
 *   - An OfficerStructuralIndexEntity only exists after full construction.
 *
 * Immutability contract:
 *   - contentHash (SHA-256) is REQUIRED and IMMUTABLE once set.
 *   - sha3Hash (SHA3-256) is REQUIRED and IMMUTABLE once set.
 *
 * ID derivation:
 *   - Derived from tenantId + officerIdentifier ONLY.
 *   - Not from documentCount, phraseFrequency, or timestamps.
 */
export interface OfficerStructuralIndexEntity {
  id: string;                    // Deterministic — derived from tenantId + officerIdentifier
  tenantId: string;

  officerIdentifier: string;     // Canonical badge ID or normalized name

  documentCount: number;         // Count of unique documents referencing officer
  phraseFrequency: {             // Exact substring match counts (deterministic phrase list)
    [phrase: string]: number;
  };

  firstSeen: string;             // ISO 8601 — earliest document date referencing officer
  lastSeen: string;              // ISO 8601 — latest document date referencing officer

  contentHash: string;           // SHA-256 — REQUIRED, immutable
  sha3Hash: string;              // SHA3-256 — REQUIRED, immutable
}

// ---------------------------------------------------------------------------
// Officer Index Construction Input
// ---------------------------------------------------------------------------

/**
 * A single document reference for officer index construction.
 * Represents one document that references a specific officer.
 */
export interface OfficerDocumentReference {
  documentId: string;            // Unique document identifier
  documentDate: string;          // ISO 8601 — date associated with this document
  documentText: string;          // Full text of document (for phrase matching)
}

/**
 * Input for constructing an officer structural index.
 * The caller provides officer identity, document references, and phrase list.
 * The engine computes aggregations, hashes, and returns the entity.
 */
export interface OfficerIndexInput {
  tenantId: string;
  officerIdentifier: string;     // Raw identifier — will be normalized by engine
  documentReferences: OfficerDocumentReference[];
  phraseList: string[];          // Deterministic phrase list — exact substrings to count
}

// ---------------------------------------------------------------------------
// Officer Index Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying an officer structural index entity's integrity.
 */
export interface OfficerIndexVerificationResult {
  verified: boolean;             // True ONLY if BOTH hashes match
  computedSha256: string;
  computedSha3: string;
}
