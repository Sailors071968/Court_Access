// ============================================
// Court Access — Corpus Versioning
// Supports corpus version management and deterministic updates.
// Tracks document versions and supersession chains.
// ============================================

import { createHash } from 'node:crypto';
import type { VersionDiff } from './types.ts';
import type { NormalizedDocument } from '../ingestion/types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface VersioningDb {
  findMany(args: {
    where: { corpusName: string; tenantId: string; corpusVersion?: string };
    select: { id: true; contentHash: true; corpusVersion: true | null };
  }): Promise<Array<{ id: string; contentHash: string; corpusVersion: string | null }>>;
  updateMany(args: {
    where: { id: { in: string[] } };
    data: { supersededBy: string; updatedAt: Date };
  }): Promise<{ count: number }>;
}

// ---------------------------------------------------------------------------
// Version Manager
// ---------------------------------------------------------------------------

export class CorpusVersionManager {
  constructor(private readonly db: VersioningDb) {}

  /**
   * Compare two versions of a corpus to compute a diff.
   * Identifies added, removed, modified, and unchanged documents.
   */
  async computeVersionDiff(
    corpusName: string,
    tenantId: string,
    fromVersion: string,
    toVersion: string,
    toVersionDocuments: NormalizedDocument[],
  ): Promise<VersionDiff> {
    // Get all documents from the previous version
    const existingDocs = await this.db.findMany({
      where: { corpusName, tenantId, corpusVersion: fromVersion },
      select: { id: true, contentHash: true, corpusVersion: true },
    });

    const existingHashes = new Set(existingDocs.map(d => d.contentHash));
    const newHashes = new Set(toVersionDocuments.map(d => d.contentHash));

    let added = 0;
    let unchanged = 0;

    for (const doc of toVersionDocuments) {
      if (existingHashes.has(doc.contentHash)) {
        unchanged++;
      } else {
        added++;
      }
    }

    let removed = 0;
    for (const hash of existingHashes) {
      if (!newHashes.has(hash)) {
        removed++;
      }
    }

    return {
      corpusName,
      fromVersion,
      toVersion,
      added,
      removed,
      modified: 0, // Content-hash based: modified = removed old + added new
      unchanged,
    };
  }

  /**
   * Mark documents from a previous version as superseded.
   * Sets the `supersededBy` field to point to the new version's corpus entry.
   */
  async supersedePreviousVersion(
    corpusName: string,
    tenantId: string,
    previousVersion: string,
    newVersionId: string,
  ): Promise<number> {
    const existingDocs = await this.db.findMany({
      where: { corpusName, tenantId, corpusVersion: previousVersion },
      select: { id: true, contentHash: true, corpusVersion: true },
    });

    if (existingDocs.length === 0) return 0;

    const ids = existingDocs.map(d => d.id);
    const result = await this.db.updateMany({
      where: { id: { in: ids } },
      data: { supersededBy: newVersionId, updatedAt: new Date() },
    });

    return result.count;
  }

  /**
   * Stamp all documents in a batch with the corpus version.
   * Returns new documents with corpusVersion set.
   */
  stampVersion(documents: NormalizedDocument[], corpusVersion: string): NormalizedDocument[] {
    return documents.map(doc => ({
      ...doc,
      corpusVersion,
    }));
  }

  /**
   * Compute a deterministic version string from a set of document hashes.
   * Useful for verifying corpus integrity across ingestions.
   */
  static computeCorpusChecksum(contentHashes: string[]): string {
    const sorted = [...contentHashes].sort();
    return createHash('sha256')
      .update(sorted.join(':'))
      .digest('hex');
  }
}
