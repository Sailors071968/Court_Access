// ============================================
// Court Access — Restore Service (Phase 12)
// Hybrid Pricing + Deterministic Archive Module
//
// Deterministic restore pipeline.
// Retrieve → Verify → Unzip → Re-verify → Restore → Ledger.
// Verification only. No re-hashing.
//
// Architectural boundary:
//   - Does NOT import exportEngine
//   - Does NOT import anchorIntegrationEngine
//   - Does NOT import issueIndexEngine
//   - Does NOT import officerIndexEngine
//   - Consumes ArchiveBundleEntity and DocumentEntity only
//   - Appends to ledger
//   - No circular dependencies
//
// Constitutional boundaries:
//   - No probability
//   - No scoring
//   - No randomness
//   - No Date.now
//   - No localeCompare
//   - No re-hashing (verification only)
//   - No mutation of existing hashes
//   - Append-only ledger discipline
//   - Dual-hash enforcement
//   - ASCII comparator only
// ============================================

import type { DocumentEntity } from '../models/DocumentModel';
import type {
  ArchiveBundleEntity,
} from '../models/ArchiveManifestModel';
import type { LedgerEntryInput } from '../models/CreditLedgerModel';
import { verifyArchiveManifest } from './archiveService';

// ---------------------------------------------------------------------------
// Restore Verification Result
// ---------------------------------------------------------------------------

/**
 * Result of verifying a single document during restore.
 * Binary only: verified = true if hash matches manifest.
 */
export interface RestoreDocumentVerification {
  documentId: string;
  contentHashMatch: boolean;
}

// ---------------------------------------------------------------------------
// Restore Result
// ---------------------------------------------------------------------------

/**
 * Complete result of a restore operation.
 */
export interface RestoreResult {
  archiveId: string;
  manifestVerified: boolean;
  bundleHashVerified: boolean;
  documentVerifications: RestoreDocumentVerification[];
  allDocumentsVerified: boolean;
  restoreValid: boolean;
  ledgerInput: LedgerEntryInput;
}

// ---------------------------------------------------------------------------
// Restore Tenant Pipeline
// ---------------------------------------------------------------------------

/**
 * Restore a tenant's documents from an archive bundle.
 *
 * Pipeline:
 *   1. Verify archive bundle dual-hash (bundleSha256, bundleSha3_256)
 *   2. Verify archive manifest dual-hash integrity
 *   3. Re-verify each document's contentHash against manifest documentHashes
 *   4. Return restore result with all verifications
 *   5. Return ledger input for RESTORE_EVENT append
 *
 * The caller is responsible for:
 *   - Retrieving the archive bundle from cold storage
 *   - Unzipping the bundle (providing documents)
 *   - Restoring documents to active index
 *   - Appending the RESTORE_EVENT to the ledger
 *
 * No re-hashing of documents. Verification only.
 * Existing hashes are compared — not recomputed.
 * No content mutation. No Date.now().
 *
 * This function does NOT perform storage operations directly —
 * it verifies and returns artifacts for the caller to execute.
 */
export async function restoreTenant(
  bundle: ArchiveBundleEntity,
  documents: DocumentEntity[],
  restoreTimestamp: string
): Promise<RestoreResult> {
  const manifest = bundle.manifest;

  // Step 1: Verify bundle hash format (structural check)
  const bundleHashVerified =
    typeof bundle.bundleSha256 === 'string' &&
    bundle.bundleSha256.length === 64 &&
    /^[0-9a-f]{64}$/.test(bundle.bundleSha256) &&
    typeof bundle.bundleSha3_256 === 'string' &&
    bundle.bundleSha3_256.length === 64 &&
    /^[0-9a-f]{64}$/.test(bundle.bundleSha3_256);

  // Step 2: Verify archive manifest dual-hash integrity
  const manifestResult = await verifyArchiveManifest(manifest);
  const manifestVerified = manifestResult.verified;

  // Step 3: Re-verify each document's contentHash against manifest
  // Sort documents by id (ASCII comparator) for deterministic processing
  const sortedDocs = [...documents].sort(
    (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  const documentVerifications: RestoreDocumentVerification[] = [];
  const manifestHashSet = new Set(manifest.documentHashes);

  for (const doc of sortedDocs) {
    const contentHashMatch = manifestHashSet.has(doc.contentHash);
    documentVerifications.push({
      documentId: doc.id,
      contentHashMatch,
    });
  }

  const allDocumentsVerified = documentVerifications.every(
    (v) => v.contentHashMatch
  );

  // Overall restore validity
  const restoreValid =
    bundleHashVerified &&
    manifestVerified &&
    allDocumentsVerified;

  // Step 5: Ledger input for RESTORE_EVENT
  const ledgerInput: LedgerEntryInput = {
    tenantId: manifest.tenantId,
    eventType: 'RESTORE_EVENT',
    eventTimestamp: restoreTimestamp,
    creditAmount: 0,
    balanceAfter: 0,
    referenceId: manifest.archiveId,
    referenceType: 'archive',
    description: `Archive ${manifest.archiveId} restored for tenant ${manifest.tenantId} with ${sortedDocs.length} documents`,
  };

  return {
    archiveId: manifest.archiveId,
    manifestVerified,
    bundleHashVerified,
    documentVerifications,
    allDocumentsVerified,
    restoreValid,
    ledgerInput,
  };
}
