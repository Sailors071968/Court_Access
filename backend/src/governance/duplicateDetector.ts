// ============================================
// Court Access — Duplicate Detector
// Checks for existing documents by content hash before insertion.
// Prevents duplicate corpus ingestion at the document level.
// ============================================

import { createHash } from 'node:crypto';
import type { DuplicateReport } from './types.ts';
import type { NormalizedDocument } from '../ingestion/types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface DuplicateCheckDb {
  findMany(args: {
    where: { contentHash: { in: string[] }; tenantId: string };
    select: { contentHash: true };
  }): Promise<Array<{ contentHash: string }>>;
  count(args: {
    where: { corpusName: string; tenantId: string };
  }): Promise<number>;
}

// ---------------------------------------------------------------------------
// Duplicate Detector
// ---------------------------------------------------------------------------

export class DuplicateDetector {
  constructor(private readonly db: DuplicateCheckDb) {}

  /**
   * Check which documents in a batch already exist in the database.
   * Returns a Set of content hashes that already exist.
   */
  async findExistingHashes(
    contentHashes: string[],
    tenantId: string,
  ): Promise<Set<string>> {
    if (contentHashes.length === 0) return new Set();

    const existing = await this.db.findMany({
      where: {
        contentHash: { in: contentHashes },
        tenantId,
      },
      select: { contentHash: true },
    });

    return new Set(existing.map(r => r.contentHash));
  }

  /**
   * Filter a batch of documents, removing those that already exist.
   * Returns { newDocuments, skippedCount }.
   */
  async filterDuplicates(
    documents: NormalizedDocument[],
    tenantId: string,
  ): Promise<{ newDocuments: NormalizedDocument[]; skippedCount: number }> {
    const hashes = documents.map(d => d.contentHash);
    const existingHashes = await this.findExistingHashes(hashes, tenantId);

    const newDocuments: NormalizedDocument[] = [];
    let skippedCount = 0;

    for (const doc of documents) {
      if (existingHashes.has(doc.contentHash)) {
        skippedCount++;
      } else {
        newDocuments.push(doc);
      }
    }

    return { newDocuments, skippedCount };
  }

  /**
   * Generate a report of duplicates for a corpus ingestion.
   */
  async generateReport(
    corpusName: string,
    version: string,
    documents: NormalizedDocument[],
    tenantId: string,
  ): Promise<DuplicateReport> {
    const { newDocuments, skippedCount } = await this.filterDuplicates(documents, tenantId);

    return {
      corpusName,
      version,
      totalDocuments: documents.length,
      duplicatesSkipped: skippedCount,
      newDocuments: newDocuments.length,
      updatedDocuments: 0, // Future: track updates via versioning
    };
  }

  /**
   * Compute SHA-256 hash of content for deduplication.
   * Static utility for external callers.
   */
  static computeHash(content: string, tenantId: string): string {
    return createHash('sha256')
      .update(`${tenantId}:${content}`)
      .digest('hex');
  }
}
