// ============================================
// Court Access — Ingestion State Repository
// Checkpoint/resume system for crash-resilient corpus ingestion.
// Checkpoints progress every batch so ingestion can resume after failure.
// ============================================

import type { IngestionStatus, IngestionProgress } from './types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface IngestionStateRecord {
  id: string;
  corpusName: string;
  fileName: string;
  lastProcessedOffset: number;
  recordsProcessed: number;
  totalRecords: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionStateDb {
  findUnique(args: {
    where: { corpusName_fileName: { corpusName: string; fileName: string } };
  }): Promise<IngestionStateRecord | null>;
  upsert(args: {
    where: { corpusName_fileName: { corpusName: string; fileName: string } };
    create: Omit<IngestionStateRecord, 'id' | 'createdAt' | 'updatedAt'>;
    update: Partial<Omit<IngestionStateRecord, 'id' | 'createdAt' | 'updatedAt'>>;
  }): Promise<IngestionStateRecord>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class IngestionStateRepository {
  constructor(private readonly db: IngestionStateDb) {}

  /**
   * Get the current ingestion state for a corpus/file pair.
   * Returns null if no previous ingestion exists.
   */
  async getState(corpusName: string, fileName: string): Promise<IngestionProgress | null> {
    const record = await this.db.findUnique({
      where: { corpusName_fileName: { corpusName, fileName } },
    });

    if (!record) return null;

    return {
      corpusName: record.corpusName,
      fileName: record.fileName,
      lastProcessedOffset: record.lastProcessedOffset,
      recordsProcessed: record.recordsProcessed,
      totalRecords: record.totalRecords,
      status: record.status as IngestionStatus,
      startedAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Initialize or reset ingestion state for a new run.
   */
  async initializeState(
    corpusName: string,
    fileName: string,
    totalRecords: number | null,
  ): Promise<IngestionProgress> {
    const record = await this.db.upsert({
      where: { corpusName_fileName: { corpusName, fileName } },
      create: {
        corpusName,
        fileName,
        lastProcessedOffset: 0,
        recordsProcessed: 0,
        totalRecords,
        status: 'in_progress',
        errorMessage: null,
      },
      update: {
        lastProcessedOffset: 0,
        recordsProcessed: 0,
        totalRecords,
        status: 'in_progress',
        errorMessage: null,
      },
    });

    return {
      corpusName: record.corpusName,
      fileName: record.fileName,
      lastProcessedOffset: record.lastProcessedOffset,
      recordsProcessed: record.recordsProcessed,
      totalRecords: record.totalRecords,
      status: record.status as IngestionStatus,
      startedAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Checkpoint progress after a batch completes.
   * This is called after every successful batch insertion.
   */
  async checkpoint(
    corpusName: string,
    fileName: string,
    lastProcessedOffset: number,
    recordsProcessed: number,
  ): Promise<void> {
    await this.db.upsert({
      where: { corpusName_fileName: { corpusName, fileName } },
      create: {
        corpusName,
        fileName,
        lastProcessedOffset,
        recordsProcessed,
        totalRecords: null,
        status: 'in_progress',
        errorMessage: null,
      },
      update: {
        lastProcessedOffset,
        recordsProcessed,
        status: 'in_progress',
      },
    });
  }

  /**
   * Mark ingestion as completed.
   */
  async markCompleted(
    corpusName: string,
    fileName: string,
    totalRecordsProcessed: number,
  ): Promise<void> {
    await this.db.upsert({
      where: { corpusName_fileName: { corpusName, fileName } },
      create: {
        corpusName,
        fileName,
        lastProcessedOffset: totalRecordsProcessed,
        recordsProcessed: totalRecordsProcessed,
        totalRecords: totalRecordsProcessed,
        status: 'completed',
        errorMessage: null,
      },
      update: {
        recordsProcessed: totalRecordsProcessed,
        status: 'completed',
        errorMessage: null,
      },
    });
  }

  /**
   * Mark ingestion as failed with error message.
   */
  async markFailed(
    corpusName: string,
    fileName: string,
    errorMessage: string,
  ): Promise<void> {
    await this.db.upsert({
      where: { corpusName_fileName: { corpusName, fileName } },
      create: {
        corpusName,
        fileName,
        lastProcessedOffset: 0,
        recordsProcessed: 0,
        totalRecords: null,
        status: 'failed',
        errorMessage,
      },
      update: {
        status: 'failed',
        errorMessage,
      },
    });
  }

  /**
   * Get resume offset for a previously interrupted ingestion.
   * Returns 0 if no previous state or if not resumable.
   */
  async getResumeOffset(corpusName: string, fileName: string): Promise<number> {
    const state = await this.getState(corpusName, fileName);
    if (!state) return 0;
    if (state.status === 'completed') return 0;
    if (state.status === 'failed' || state.status === 'in_progress' || state.status === 'paused') {
      return state.lastProcessedOffset;
    }
    return 0;
  }
}
