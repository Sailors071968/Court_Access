// ============================================
// Court Access — Ingestion Audit Logger
// Records batch-level ingestion events for monitoring and debugging.
// Every batch insertion is logged with duration, status, and error details.
// ============================================

import type { BatchResult, BatchStatus } from './types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface IngestionLogRecord {
  id: string;
  corpusName: string;
  batchNumber: number;
  recordsInserted: number;
  durationMs: number;
  status: string;
  errorMessage: string | null;
  timestamp: Date;
}

export interface IngestionLogDb {
  create(args: {
    data: Omit<IngestionLogRecord, 'id' | 'timestamp'>;
  }): Promise<IngestionLogRecord>;
  findMany(args: {
    where: { corpusName: string };
    orderBy: { timestamp: 'asc' | 'desc' };
    take?: number;
  }): Promise<IngestionLogRecord[]>;
  count(args: {
    where: { corpusName: string; status?: string };
  }): Promise<number>;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export class IngestionLogger {
  constructor(private readonly db: IngestionLogDb) {}

  /**
   * Log a batch insertion result.
   */
  async logBatch(corpusName: string, result: BatchResult): Promise<void> {
    await this.db.create({
      data: {
        corpusName,
        batchNumber: result.batchNumber,
        recordsInserted: result.recordsInserted,
        durationMs: result.durationMs,
        status: result.status,
        errorMessage: result.errorMessage ?? null,
      },
    });
  }

  /**
   * Get recent logs for a corpus.
   */
  async getRecentLogs(corpusName: string, limit: number = 50): Promise<IngestionLogRecord[]> {
    return this.db.findMany({
      where: { corpusName },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get total batch counts by status for a corpus.
   */
  async getBatchCounts(corpusName: string): Promise<Record<BatchStatus, number>> {
    const [successCount, failedCount, skippedCount] = await Promise.all([
      this.db.count({ where: { corpusName, status: 'success' } }),
      this.db.count({ where: { corpusName, status: 'failed' } }),
      this.db.count({ where: { corpusName, status: 'skipped' } }),
    ]);

    return {
      success: successCount,
      failed: failedCount,
      skipped: skippedCount,
    };
  }

  /**
   * Console-based progress reporter for CLI usage.
   * Prints batch progress to stdout.
   */
  logProgress(
    corpusName: string,
    batchNumber: number,
    recordsProcessed: number,
    totalRecords: number | null,
    durationMs: number,
    status: BatchStatus,
  ): void {
    const pct = totalRecords
      ? ` (${((recordsProcessed / totalRecords) * 100).toFixed(1)}%)`
      : '';
    const throughput = durationMs > 0
      ? ` [${Math.round((60000 / durationMs) * recordsProcessed)} rec/min]`
      : '';

    const statusIcon = status === 'success' ? 'OK' : status === 'failed' ? 'FAIL' : 'SKIP';

    process.stdout.write(
      `[${statusIcon}] ${corpusName} batch #${batchNumber}: ` +
      `${recordsProcessed} records${pct}${throughput} (${durationMs}ms)\n`,
    );
  }
}
