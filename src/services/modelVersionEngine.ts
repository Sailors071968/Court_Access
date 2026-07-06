// ============================================
// Court Access — Model Version Engine (Phase 18)
// Deterministic Model Version Control Layer
//
// Ensures reproducibility of AI outputs across model upgrades.
// Validates temperature, model version, prompt schema hash.
// Detects drift by comparing snapshot hashes.
//
// Every function is:
//   - Pure (same inputs -> same outputs)
//   - Deterministic (no randomness, no Date.now)
//   - No side effects
//
// Architectural boundary:
//   - Only imports policyIngestionService for hashing
//   - Type-only imports from models
//   - No circular dependencies
//   - No store access
//   - No SES calls
//
// Constitutional boundaries:
//   - No probability / scoring / randomness
//   - No Date.now / localeCompare
//   - No legal advice / outcome prediction
//   - Deterministic processing only
// ============================================

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

import type {
  ModelVersionRegistryEntity,
  ModelVersionRegistryInput,
  ModelVersionValidationResult,
  DriftDetectionResult,
} from '../models/ModelVersionRegistryModel';

// ---------------------------------------------------------------------------
// Canonicalize Registry Pre-ID Form
// ---------------------------------------------------------------------------

function canonicalizeRegistryPreId(input: ModelVersionRegistryInput): string {
  return (
    '{' +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"temperature":${input.temperature},` +
    `"promptSchemaHash":${JSON.stringify(input.promptSchemaHash)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Canonicalize Registry Full Form
// ---------------------------------------------------------------------------

function canonicalizeRegistryFull(
  registryId: string,
  input: ModelVersionRegistryInput
): string {
  return (
    '{' +
    `"registryId":${JSON.stringify(registryId)},` +
    `"modelVersion":${JSON.stringify(input.modelVersion)},` +
    `"temperature":${input.temperature},` +
    `"promptSchemaHash":${JSON.stringify(input.promptSchemaHash)},` +
    `"createdTimestamp":${JSON.stringify(input.createdTimestamp)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// Build Model Version Registry Entity — two-pass hash derivation
// ---------------------------------------------------------------------------

/**
 * Build a complete model version registry entity.
 *
 * Two-pass hash derivation:
 *   Pass 1: pre-ID canonical -> registryId
 *   Pass 2: full canonical -> dual-hash
 *
 * Deterministic — same input always produces same output.
 */
export async function buildModelVersionRegistryEntity(
  input: ModelVersionRegistryInput
): Promise<ModelVersionRegistryEntity> {
  const preIdCanonical = canonicalizeRegistryPreId(input);
  const registryId = await computeTextSHA256(preIdCanonical);
  const fullCanonical = canonicalizeRegistryFull(registryId, input);
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = await computeTextSHA3_256(fullCanonical);

  return {
    registryId,
    modelVersion: input.modelVersion,
    temperature: input.temperature,
    promptSchemaHash: input.promptSchemaHash,
    createdTimestamp: input.createdTimestamp,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Verify Model Version Registry Entity — replay verification
// ---------------------------------------------------------------------------

/**
 * Verify a model version registry entity by recomputing all hashes.
 *
 * Binary PASS/FAIL per field.
 * Deterministic — same input always produces same result.
 */
export async function verifyModelVersionRegistryEntity(
  entity: ModelVersionRegistryEntity
): Promise<{
  registryIdMatch: 'PASS' | 'FAIL';
  sha256Match: 'PASS' | 'FAIL';
  sha3_256Match: 'PASS' | 'FAIL';
  overallResult: 'PASS' | 'FAIL';
}> {
  const input: ModelVersionRegistryInput = {
    modelVersion: entity.modelVersion,
    temperature: entity.temperature,
    promptSchemaHash: entity.promptSchemaHash,
    createdTimestamp: entity.createdTimestamp,
  };

  const preIdCanonical = canonicalizeRegistryPreId(input);
  const recomputedId = await computeTextSHA256(preIdCanonical);
  const registryIdMatch = recomputedId === entity.registryId ? 'PASS' : 'FAIL';

  const fullCanonical = canonicalizeRegistryFull(entity.registryId, input);
  const recomputedSha256 = await computeTextSHA256(fullCanonical);
  const recomputedSha3 = await computeTextSHA3_256(fullCanonical);
  const sha256Match = recomputedSha256 === entity.sha256 ? 'PASS' : 'FAIL';
  const sha3_256Match = recomputedSha3 === entity.sha3_256 ? 'PASS' : 'FAIL';

  const overallResult =
    registryIdMatch === 'PASS' &&
    sha256Match === 'PASS' &&
    sha3_256Match === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return { registryIdMatch, sha256Match, sha3_256Match, overallResult };
}

// ---------------------------------------------------------------------------
// Validate Model Version — pre-processing enforcement
// ---------------------------------------------------------------------------

/**
 * Validate model version configuration before AI processing.
 *
 * Rules:
 *   - temperature must be <= 0.2
 *   - modelVersion must exist in registry
 *   - promptSchemaHash must match current schema
 *
 * Binary PASS/FAIL per check + overall.
 * Deterministic — same inputs always produce same result.
 */
export function validateModelVersion(
  modelVersion: string,
  temperature: number,
  promptSchemaHash: string,
  registryEntries: readonly ModelVersionRegistryEntity[],
  currentSchemaHash: string
): ModelVersionValidationResult {
  // Temperature check: must be <= 0.2
  const temperatureStatus = temperature <= 0.2 ? 'PASS' : 'FAIL';

  // Version existence check
  let versionExistsStatus: 'PASS' | 'FAIL' = 'FAIL';
  for (let i = 0; i < registryEntries.length; i++) {
    if (registryEntries[i].modelVersion === modelVersion) {
      versionExistsStatus = 'PASS';
      break;
    }
  }

  // Prompt schema hash check
  const promptSchemaStatus = promptSchemaHash === currentSchemaHash ? 'PASS' : 'FAIL';

  const overallStatus =
    temperatureStatus === 'PASS' &&
    versionExistsStatus === 'PASS' &&
    promptSchemaStatus === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    temperatureStatus,
    versionExistsStatus,
    promptSchemaStatus,
    overallStatus,
  };
}

// ---------------------------------------------------------------------------
// Drift Detection — binary PASS/FAIL
// ---------------------------------------------------------------------------

/**
 * Detect model drift by comparing snapshot hashes.
 *
 * Re-run same document with same modelVersion:
 * If snapshotHash differs -> FAIL.
 *
 * Binary PASS/FAIL.
 * Deterministic — same inputs always produce same result.
 */
export function detectModelDrift(
  originalSnapshotHash: string,
  recomputedSnapshotHash: string
): DriftDetectionResult {
  return {
    snapshotHashMatch: originalSnapshotHash === recomputedSnapshotHash ? 'PASS' : 'FAIL',
    originalHash: originalSnapshotHash,
    recomputedHash: recomputedSnapshotHash,
  };
}
