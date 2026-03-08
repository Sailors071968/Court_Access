// ============================================
// Court Access — Governance Pipeline
// Orchestrates the governed ingestion flow:
// register corpus → validate version → lock → ingest → update registry → unlock
// ============================================

import { randomUUID } from 'node:crypto';
import { CorpusRegistryRepository } from './corpusRegistry.ts';
import { CorpusLockManager } from './corpusLock.ts';
import { DuplicateDetector } from './duplicateDetector.ts';
import { CorpusVersionManager } from './corpusVersioning.ts';
import type { GovernedIngestionConfig, DuplicateReport } from './types.ts';
import type { NormalizedDocument } from '../ingestion/types.ts';

// ---------------------------------------------------------------------------
// Pipeline Result
// ---------------------------------------------------------------------------

export interface GovernancePipelineResult {
  corpusName: string;
  version: string;
  workerId: string;
  status: 'completed' | 'failed' | 'skipped';
  totalDocuments: number;
  duplicatesSkipped: number;
  newDocuments: number;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Pipeline Orchestrator
// ---------------------------------------------------------------------------

export class GovernancePipeline {
  private readonly workerId: string;

  constructor(
    private readonly registry: CorpusRegistryRepository,
    private readonly lockManager: CorpusLockManager,
    private readonly duplicateDetector: DuplicateDetector,
    private readonly versionManager: CorpusVersionManager,
    workerId?: string,
  ) {
    this.workerId = workerId ?? `worker-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Execute the full governed ingestion pipeline.
   * Steps: register → validate → lock → ingest → update → unlock
   */
  async execute(
    config: GovernedIngestionConfig,
    ingestFn: (filteredDocs: NormalizedDocument[]) => Promise<number>,
    documents: NormalizedDocument[],
  ): Promise<GovernancePipelineResult> {
    const { corpusName, version, jurisdiction, sourceAuthority, tenantId } = config;

    // Dry run: skip all registry/lock mutations, only compute counts
    if (config.dryRun) {
      const { newDocuments, skippedCount } = await this.duplicateDetector.filterDuplicates(
        documents,
        tenantId,
      );
      return {
        corpusName,
        version,
        workerId: this.workerId,
        status: 'completed',
        totalDocuments: documents.length,
        duplicatesSkipped: skippedCount,
        newDocuments: newDocuments.length,
      };
    }

    // Step 1: Register corpus in the registry
    let registryEntry;
    try {
      registryEntry = await this.registry.register({
        corpusName,
        jurisdiction,
        sourceAuthority,
        version,
        releaseDate: config.releaseDate,
        checksum: config.checksum,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already ingested')) {
        return {
          corpusName,
          version,
          workerId: this.workerId,
          status: 'skipped',
          totalDocuments: documents.length,
          duplicatesSkipped: documents.length,
          newDocuments: 0,
          errorMessage: message,
        };
      }
      throw err;
    }

    // Step 2: Validate version (check if already completed)
    const isIngested = await this.registry.isIngested(corpusName, version);
    if (isIngested) {
      return {
        corpusName,
        version,
        workerId: this.workerId,
        status: 'skipped',
        totalDocuments: documents.length,
        duplicatesSkipped: documents.length,
        newDocuments: 0,
        errorMessage: `Corpus "${corpusName}" version "${version}" is already fully ingested`,
      };
    }

    // Step 3: Acquire lock
    const lock = await this.lockManager.acquire({
      corpusName,
      workerId: this.workerId,
      durationMs: config.lockDurationMs,
    });

    if (!lock) {
      return {
        corpusName,
        version,
        workerId: this.workerId,
        status: 'failed',
        totalDocuments: documents.length,
        duplicatesSkipped: 0,
        newDocuments: 0,
        errorMessage: `Failed to acquire lock on corpus "${corpusName}" — another worker is ingesting`,
      };
    }

    try {
      // Step 4: Mark as in_progress
      await this.registry.markInProgress(corpusName, version);

      // Step 5: Filter duplicates
      const { newDocuments, skippedCount } = await this.duplicateDetector.filterDuplicates(
        documents,
        tenantId,
      );

      // Step 6: Stamp version on new documents
      const stampedDocuments = this.versionManager.stampVersion(newDocuments, version);

      // Step 7: Run ingestion
      let insertedCount = 0;
      if (stampedDocuments.length > 0) {
        insertedCount = await ingestFn(stampedDocuments);
      }

      // Step 8: Supersede previous version if applicable
      const latestVersion = await this.registry.getLatestVersion(corpusName, version);
      if (latestVersion && latestVersion.ingestionStatus === 'completed') {
        await this.versionManager.supersedePreviousVersion(
          corpusName,
          tenantId,
          latestVersion.version,
          registryEntry.id,
        );
      }

      // Step 9: Update registry with final counts
      const totalBytes = stampedDocuments.reduce((sum, d) => sum + Buffer.byteLength(d.content, 'utf8'), 0);
      await this.registry.markCompleted(corpusName, version, insertedCount, totalBytes);

      return {
        corpusName,
        version,
        workerId: this.workerId,
        status: 'completed',
        totalDocuments: documents.length,
        duplicatesSkipped: skippedCount,
        newDocuments: insertedCount,
      };
    } catch (err) {
      // Mark as failed
      await this.registry.markFailed(corpusName, version);

      return {
        corpusName,
        version,
        workerId: this.workerId,
        status: 'failed',
        totalDocuments: documents.length,
        duplicatesSkipped: 0,
        newDocuments: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    } finally {
      // Step 10: Always release the lock
      try {
        await this.lockManager.release(corpusName, this.workerId);
      } catch {
        // Lock release failed — will expire automatically
      }
    }
  }

  /**
   * Generate a duplicate report without performing ingestion.
   */
  async preflightCheck(
    config: GovernedIngestionConfig,
    documents: NormalizedDocument[],
  ): Promise<DuplicateReport> {
    return this.duplicateDetector.generateReport(
      config.corpusName,
      config.version,
      documents,
      config.tenantId,
    );
  }

  /**
   * Get the worker ID for this pipeline instance.
   */
  getWorkerId(): string {
    return this.workerId;
  }
}
