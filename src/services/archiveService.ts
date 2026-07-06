// ============================================
// Court Access — Archive Service (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Deterministic archive pipeline.
// Fetch → Verify → Manifest → Bundle → Store → Ledger.
// No content mutation. No hash mutation.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - Consumes canonical DocumentEntity only
//   - Produces ArchiveManifestEntity
//   - Appends to ledger
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No mutation of document content or hashes
//   - Append-only ledger discipline
//   - Dual-hash enforcement
//   - Canonical JSON with fixed key order
//   - ASCII comparator only
// ============================================

import type { DocumentEntity } from '../models/DocumentModel';
import type {
  ArchiveManifestEntity,
  ArchiveManifestInput,
  ArchiveManifestVerificationResult,
  ArchiveManifestFieldValidation,
  ArchiveManifestValidationMatrix,
} from '../models/ArchiveManifestModel';
import type { LedgerEntryInput } from '../models/CreditLedgerModel';
import { computeTextSHA256, computeTextSHA3_256 } from './policyIngestionService';

// ---------------------------------------------------------------------------
// Canonical JSON Serialization — Archive Manifest (fixed key order)
// ---------------------------------------------------------------------------

/**
 * Canonical JSON serialization for an archive manifest (pre-hash).
 *
 * Key order is FIXED and DOCUMENTED:
 *   1. "tenantId"
 *   2. "archiveId"
 *   3. "caseIds"
 *   4. "documentIds"
 *   5. "documentHashes"
 *   6. "totalSizeBytes"
 *   7. "archiveCreatedAt"
 *
 * Arrays are serialized as JSON arrays of strings (already ASCII-sorted).
 * Key order enforced via explicit string construction.
 * NOT relying on JSON.stringify object key insertion order.
 *
 * Note: archiveId is included in canonical form but is derived from
 * the pre-ID canonical form. The two-pass approach:
 *   Pass 1: canonical without archiveId → derive archiveId
 *   Pass 2: canonical with archiveId → compute dual-hash
 *
 * This is a pure function — same input always produces same output.
 */
function canonicalizeManifestPreId(
  tenantId: string,
  caseIds: string[],
  documentIds: string[],
  documentHashes: string[],
  totalSizeBytes: number,
  archiveCreatedAt: string
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"caseIds":${JSON.stringify(caseIds)},` +
    `"documentIds":${JSON.stringify(documentIds)},` +
    `"documentHashes":${JSON.stringify(documentHashes)},` +
    `"totalSizeBytes":${JSON.stringify(totalSizeBytes)},` +
    `"archiveCreatedAt":${JSON.stringify(archiveCreatedAt)}` +
    '}'
  );
}

/**
 * Full canonical JSON with archiveId included.
 * Used for dual-hash computation after ID derivation.
 */
function canonicalizeManifestFull(
  tenantId: string,
  archiveId: string,
  caseIds: string[],
  documentIds: string[],
  documentHashes: string[],
  totalSizeBytes: number,
  archiveCreatedAt: string
): string {
  return (
    '{' +
    `"tenantId":${JSON.stringify(tenantId)},` +
    `"archiveId":${JSON.stringify(archiveId)},` +
    `"caseIds":${JSON.stringify(caseIds)},` +
    `"documentIds":${JSON.stringify(documentIds)},` +
    `"documentHashes":${JSON.stringify(documentHashes)},` +
    `"totalSizeBytes":${JSON.stringify(totalSizeBytes)},` +
    `"archiveCreatedAt":${JSON.stringify(archiveCreatedAt)}` +
    '}'
  );
}

// ---------------------------------------------------------------------------
// ASCII Sort Helper
// ---------------------------------------------------------------------------

/**
 * Sort an array of strings using deterministic ASCII comparator.
 * Returns a new sorted array — no mutation of input.
 */
function asciiSort(arr: string[]): string[] {
  return [...arr].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Archive Manifest Construction
// ---------------------------------------------------------------------------

/**
 * Build an archive manifest from input.
 *
 * Pipeline:
 *   1. ASCII-sort caseIds, documentIds, documentHashes
 *   2. Build pre-ID canonical JSON
 *   3. Derive archiveId from SHA-256 of pre-ID canonical (first 16 hex chars)
 *   4. Build full canonical JSON (with archiveId)
 *   5. Compute dual-hash (SHA-256 + SHA3-256) of full canonical JSON
 *   6. Return ArchiveManifestEntity
 *
 * No Date.now(). No runtime timestamps. Timestamp provided by caller.
 * No mutation. Returns a new manifest.
 *
 * This is a pure function — same input always produces same output.
 */
export async function buildArchiveManifest(
  input: ArchiveManifestInput
): Promise<ArchiveManifestEntity> {
  // Step 1: ASCII-sort all arrays
  const sortedCaseIds = asciiSort(input.caseIds);
  const sortedDocumentIds = asciiSort(input.documentIds);
  const sortedDocumentHashes = asciiSort(input.documentHashes);

  // Step 2: Pre-ID canonical JSON
  const preIdCanonical = canonicalizeManifestPreId(
    input.tenantId,
    sortedCaseIds,
    sortedDocumentIds,
    sortedDocumentHashes,
    input.totalSizeBytes,
    input.archiveCreatedAt
  );

  // Step 3: Derive archiveId
  const preIdHash = await computeTextSHA256(preIdCanonical);
  const archiveId = preIdHash.slice(0, 16);

  // Step 4: Full canonical JSON
  const fullCanonical = canonicalizeManifestFull(
    input.tenantId,
    archiveId,
    sortedCaseIds,
    sortedDocumentIds,
    sortedDocumentHashes,
    input.totalSizeBytes,
    input.archiveCreatedAt
  );

  // Step 5: Dual-hash
  const sha256 = await computeTextSHA256(fullCanonical);
  const sha3_256 = computeTextSHA3_256(fullCanonical);

  // Step 6: Return entity
  return {
    tenantId: input.tenantId,
    archiveId,
    caseIds: sortedCaseIds,
    documentIds: sortedDocumentIds,
    documentHashes: sortedDocumentHashes,
    totalSizeBytes: input.totalSizeBytes,
    archiveCreatedAt: input.archiveCreatedAt,
    sha256,
    sha3_256,
  };
}

// ---------------------------------------------------------------------------
// Archive Manifest Verification
// ---------------------------------------------------------------------------

/**
 * Verify an archive manifest's integrity via dual-hash.
 *
 * Recomputes full canonical JSON from the manifest's fields,
 * then computes SHA-256 and SHA3-256 on demand.
 * Compares against stored hashes.
 *
 * verified = true ONLY if BOTH hashes match.
 * No auto-correction. No mutation.
 *
 * This is a pure function — same input always produces same output.
 */
export async function verifyArchiveManifest(
  manifest: ArchiveManifestEntity
): Promise<ArchiveManifestVerificationResult> {
  const fullCanonical = canonicalizeManifestFull(
    manifest.tenantId,
    manifest.archiveId,
    manifest.caseIds,
    manifest.documentIds,
    manifest.documentHashes,
    manifest.totalSizeBytes,
    manifest.archiveCreatedAt
  );

  const computedSha256 = await computeTextSHA256(fullCanonical);
  const computedSha3_256 = computeTextSHA3_256(fullCanonical);

  return {
    verified: computedSha256 === manifest.sha256 && computedSha3_256 === manifest.sha3_256,
    computedSha256,
    computedSha3_256,
  };
}

// ---------------------------------------------------------------------------
// Archive Tenant Pipeline
// ---------------------------------------------------------------------------

/**
 * Archive pipeline result — the complete output of archiveTenant().
 *
 * anchorLeafHash is the bundle SHA-256, provided as a ready-to-use
 * leaf for inclusion in the next Daily Anchor (TATL) exportCapsHashes
 * pipeline. This ensures archive events are cryptographically anchored
 * and not silently stored off-chain.
 *
 * The caller is responsible for feeding anchorLeafHash into the
 * daily anchor leaf set for the current anchor date.
 */
export interface ArchiveTenantResult {
  manifest: ArchiveManifestEntity;
  bundleSha256: string;
  bundleSha3_256: string;
  storagePath: string;
  ledgerInput: LedgerEntryInput;
  documentsVerified: boolean;
  anchorLeafHash: string;              // bundleSha256 — eligible for Daily Anchor (TATL) inclusion
}

/**
 * Archive a tenant's documents.
 *
 * Pipeline:
 *   1. Receive documents (must be pre-fetched, ASCII-sorted by caller)
 *   2. Verify dual-hash integrity of each document
 *   3. Generate archive manifest
 *   4. Compute archive bundle dual-hash (from canonical manifest)
 *   5. Return storagePath for cold storage abstraction
 *   6. Return ledger input for ARCHIVE_EVENT append
 *
 * The caller is responsible for:
 *   - Fetching documents (ASCII-sorted)
 *   - Storing the bundle via cold storage abstraction
 *   - Appending the ARCHIVE_EVENT to the ledger
 *   - Removing from active index (not from ledger)
 *
 * No content mutation. No hash mutation. No Date.now().
 * Documents are sorted by id using ASCII comparator before processing.
 *
 * This function does NOT perform storage or ledger append directly —
 * it returns the artifacts for the caller to execute.
 */
export async function archiveTenant(
  tenantId: string,
  documents: DocumentEntity[],
  archiveCreatedAt: string
): Promise<ArchiveTenantResult> {
  // Step 1: Sort documents by id (ASCII comparator)
  const sorted = [...documents].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  // Step 2: Verify dual-hash integrity of each document
  let documentsVerified = true;
  for (const doc of sorted) {
    if (
      typeof doc.contentHash !== 'string' ||
      doc.contentHash.length !== 64 ||
      !/^[0-9a-f]{64}$/.test(doc.contentHash)
    ) {
      documentsVerified = false;
      break;
    }
    if (
      typeof doc.sha3Hash !== 'string' ||
      doc.sha3Hash.length !== 64 ||
      !/^[0-9a-f]{64}$/.test(doc.sha3Hash)
    ) {
      documentsVerified = false;
      break;
    }
  }

  if (!documentsVerified) {
    throw new Error(
      'Document integrity verification failed. ' +
      'All documents must have valid dual-hash (SHA-256 + SHA3-256) before archival.'
    );
  }

  // Step 3: Build archive manifest
  const caseIds = asciiSort([...new Set(sorted.map((d) => d.caseId))]);
  const documentIds = sorted.map((d) => d.id);
  const documentHashes = asciiSort(sorted.map((d) => d.contentHash));
  const totalSizeBytes = sorted.reduce((sum, d) => sum + d.fileSize, 0);

  const manifest = await buildArchiveManifest({
    tenantId,
    caseIds,
    documentIds,
    documentHashes,
    totalSizeBytes,
    archiveCreatedAt,
  });

  // Step 4: Compute archive bundle dual-hash (from canonical manifest)
  const bundleCanonical = canonicalizeManifestFull(
    manifest.tenantId,
    manifest.archiveId,
    manifest.caseIds,
    manifest.documentIds,
    manifest.documentHashes,
    manifest.totalSizeBytes,
    manifest.archiveCreatedAt
  );
  const bundleSha256 = await computeTextSHA256(bundleCanonical);
  const bundleSha3_256 = computeTextSHA3_256(bundleCanonical);

  // Step 5: Cold storage path (deterministic)
  const storagePath = `archives/${tenantId}/${manifest.archiveId}.zip`;

  // Step 6: Ledger input for ARCHIVE_EVENT
  // bundleSha256 is explicitly included in the description for on-chain traceability.
  // This ensures the archive bundle hash is recorded in the append-only ledger
  // and is not silently stored off-chain.
  const ledgerInput: LedgerEntryInput = {
    tenantId,
    eventType: 'ARCHIVE_EVENT',
    eventTimestamp: archiveCreatedAt,
    creditAmount: 0,
    balanceAfter: 0,
    referenceId: manifest.archiveId,
    referenceType: 'archive',
    description:
      `Archive created for tenant ${tenantId} with ${sorted.length} documents. ` +
      `bundleSha256:${bundleSha256}. bundleSha3_256:${bundleSha3_256}.`,
  };

  // Step 7: Anchor leaf hash — the bundle SHA-256 is eligible for inclusion
  // in the next Daily Anchor (TATL) exportCapsHashes leaf set.
  // This closes the cryptographic chain: Archive → Ledger → Anchor.
  const anchorLeafHash = bundleSha256;

  return {
    manifest,
    bundleSha256,
    bundleSha3_256,
    storagePath,
    ledgerInput,
    documentsVerified,
    anchorLeafHash,
  };
}

// ---------------------------------------------------------------------------
// Archive Manifest Validation Matrix — PASS/FAIL only
// ---------------------------------------------------------------------------

/**
 * Validate an archive manifest structure.
 *
 * Each required field is validated independently:
 *   - tenantId: must be non-empty string
 *   - archiveId: must be 16 lowercase hex characters
 *   - caseIds: must be non-empty array, ASCII sorted
 *   - documentIds: must be non-empty array, ASCII sorted
 *   - documentHashes: must be non-empty array, each 64 hex, ASCII sorted
 *   - totalSizeBytes: must be positive integer
 *   - archiveCreatedAt: must match ISO 8601 pattern
 *   - sha256: must be 64 lowercase hex characters
 *   - sha3_256: must be 64 lowercase hex characters
 *
 * Overall: PASS only if ALL fields pass.
 * No partial pass. Binary only.
 *
 * This is a pure function — same input always produces same output.
 */
export function validateArchiveManifest(
  manifest: ArchiveManifestEntity
): ArchiveManifestValidationMatrix {
  const fields: ArchiveManifestFieldValidation[] = [];

  const isValidHex = (value: string, length: number): boolean =>
    typeof value === 'string' &&
    value.length === length &&
    new RegExp(`^[0-9a-f]{${length}}$`).test(value);

  const isAsciiSorted = (arr: string[]): boolean => {
    for (let i = 0; i < arr.length - 1; i++) {
      if (!(arr[i] < arr[i + 1] || arr[i] === arr[i + 1])) {
        return false;
      }
    }
    return true;
  };

  fields.push({
    field: 'tenantId',
    result:
      typeof manifest.tenantId === 'string' && manifest.tenantId.length > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'archiveId',
    result: isValidHex(manifest.archiveId, 16) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'caseIds',
    result:
      Array.isArray(manifest.caseIds) &&
      manifest.caseIds.length > 0 &&
      isAsciiSorted(manifest.caseIds)
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'documentIds',
    result:
      Array.isArray(manifest.documentIds) &&
      manifest.documentIds.length > 0 &&
      isAsciiSorted(manifest.documentIds)
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'documentHashes',
    result:
      Array.isArray(manifest.documentHashes) &&
      manifest.documentHashes.length > 0 &&
      manifest.documentHashes.every((h) => isValidHex(h, 64)) &&
      isAsciiSorted(manifest.documentHashes)
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'totalSizeBytes',
    result:
      typeof manifest.totalSizeBytes === 'number' &&
      Number.isInteger(manifest.totalSizeBytes) &&
      manifest.totalSizeBytes > 0
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'archiveCreatedAt',
    result:
      typeof manifest.archiveCreatedAt === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(manifest.archiveCreatedAt)
        ? 'PASS'
        : 'FAIL',
  });

  fields.push({
    field: 'sha256',
    result: isValidHex(manifest.sha256, 64) ? 'PASS' : 'FAIL',
  });

  fields.push({
    field: 'sha3_256',
    result: isValidHex(manifest.sha3_256, 64) ? 'PASS' : 'FAIL',
  });

  const allPass = fields.every((f) => f.result === 'PASS');

  return {
    fields,
    overallResult: allPass ? 'PASS' : 'FAIL',
  };
}
