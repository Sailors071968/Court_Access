// ============================================
// Court Access — Model Version Registry Model (Phase 18)
// Deterministic Model Version Control Layer
//
// Ensures reproducibility of AI outputs across model upgrades.
// Tracks model version, temperature, prompt schema hash.
//
// Architectural boundary:
//   - Does NOT import any engine
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing
//   - Two-pass hash derivation
// ============================================

// ---------------------------------------------------------------------------
// Model Version Registry Entity — immutable
// ---------------------------------------------------------------------------

/**
 * Immutable record of a model version configuration.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> registryId
 *   Pass 2: full canonical -> dual-hash
 */
export interface ModelVersionRegistryEntity {
  registryId: string;              // SHA-256 of canonical pre-ID form
  modelVersion: string;
  temperature: number;
  promptSchemaHash: string;
  createdTimestamp: string;        // ISO 8601, caller-provided
  sha256: string;
  sha3_256: string;
}

// ---------------------------------------------------------------------------
// Model Version Registry Input
// ---------------------------------------------------------------------------

export interface ModelVersionRegistryInput {
  modelVersion: string;
  temperature: number;
  promptSchemaHash: string;
  createdTimestamp: string;
}

// ---------------------------------------------------------------------------
// Model Version Validation Result
// ---------------------------------------------------------------------------

export interface ModelVersionValidationResult {
  temperatureStatus: 'PASS' | 'FAIL';
  versionExistsStatus: 'PASS' | 'FAIL';
  promptSchemaStatus: 'PASS' | 'FAIL';
  overallStatus: 'PASS' | 'FAIL';
}

// ---------------------------------------------------------------------------
// Drift Detection Result
// ---------------------------------------------------------------------------

export interface DriftDetectionResult {
  snapshotHashMatch: 'PASS' | 'FAIL';
  originalHash: string;
  recomputedHash: string;
}
