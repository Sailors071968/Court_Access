// ============================================================================
// Stage 1 — Failure Visibility Layer
//
// Operational visibility for failure states across all subsystems.
// NO automatic remediation — visibility ONLY.
//
// Tracks:
//   - Ingestion: failed runs, processing duration, duplicate counts, unmatched rows
//   - OCR: failed pages, confidence metrics, duration, temp storage failures
//   - Queue: retry storms, stuck jobs, dead-letter counts
//   - Identity: duplicate suppression, inmate linkage failures, orphan bookings
//
// All data is collected passively and exposed via /api/metrics/failures endpoint.
// ============================================================================

import { categoryLogger, LOG_CATEGORIES } from './logCategories.ts';

const ingestionLog = categoryLogger(LOG_CATEGORIES.INGESTION);
const ocrLog = categoryLogger(LOG_CATEGORIES.OCR);
const queueLog = categoryLogger(LOG_CATEGORIES.QUEUE);
const inmateLog = categoryLogger(LOG_CATEGORIES.INMATE_MATCH);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailureEvent {
  category: string;
  eventType: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  data?: Record<string, unknown>;
}

export interface IngestionMetrics {
  totalRuns: number;
  failedRuns: number;
  lastRunTimestamp: string | null;
  lastRunDurationMs: number;
  lastRunStatus: string;
  totalDuplicatesDetected: number;
  totalUnmatchedRows: number;
  totalRecordsProcessed: number;
}

export interface OcrMetrics {
  totalPagesProcessed: number;
  failedPages: number;
  averageConfidence: number;
  lowConfidenceCount: number;
  totalDurationMs: number;
  tempStorageFailures: number;
  lastProcessedTimestamp: string | null;
}

export interface QueueMetrics {
  retryStormEvents: number;
  stuckJobs: number;
  deadLetterCount: number;
  totalRetries: number;
  lastRetryStormTimestamp: string | null;
  queueErrors: Record<string, number>;
}

export interface IdentityMetrics {
  duplicatesSuppressed: number;
  linkageFailures: number;
  orphanBookings: number;
  totalMatchAttempts: number;
  lastMatchTimestamp: string | null;
}

export interface FailureVisibilityReport {
  timestamp: string;
  ingestion: IngestionMetrics;
  ocr: OcrMetrics;
  queues: QueueMetrics;
  identity: IdentityMetrics;
  recentFailures: FailureEvent[];
}

// ---------------------------------------------------------------------------
// Failure Visibility Collector (Singleton)
// ---------------------------------------------------------------------------

const MAX_RECENT_FAILURES = 100;

class FailureVisibilityCollector {
  private static instance: FailureVisibilityCollector | null = null;

  private recentFailures: FailureEvent[] = [];

  private ingestion: IngestionMetrics = {
    totalRuns: 0,
    failedRuns: 0,
    lastRunTimestamp: null,
    lastRunDurationMs: 0,
    lastRunStatus: 'none',
    totalDuplicatesDetected: 0,
    totalUnmatchedRows: 0,
    totalRecordsProcessed: 0,
  };

  private ocr: OcrMetrics = {
    totalPagesProcessed: 0,
    failedPages: 0,
    averageConfidence: 0,
    lowConfidenceCount: 0,
    totalDurationMs: 0,
    tempStorageFailures: 0,
    lastProcessedTimestamp: null,
  };

  private queues: QueueMetrics = {
    retryStormEvents: 0,
    stuckJobs: 0,
    deadLetterCount: 0,
    totalRetries: 0,
    lastRetryStormTimestamp: null,
    queueErrors: {},
  };

  private identity: IdentityMetrics = {
    duplicatesSuppressed: 0,
    linkageFailures: 0,
    orphanBookings: 0,
    totalMatchAttempts: 0,
    lastMatchTimestamp: null,
  };

  private constructor() {}

  static getInstance(): FailureVisibilityCollector {
    if (!FailureVisibilityCollector.instance) {
      FailureVisibilityCollector.instance = new FailureVisibilityCollector();
    }
    return FailureVisibilityCollector.instance;
  }

  // =========================================================================
  // Event Recording
  // =========================================================================

  private addFailure(event: FailureEvent): void {
    this.recentFailures.push(event);
    if (this.recentFailures.length > MAX_RECENT_FAILURES) {
      this.recentFailures.shift();
    }
  }

  // =========================================================================
  // Ingestion Events
  // =========================================================================

  recordIngestionRun(status: string, durationMs: number, recordsProcessed: number): void {
    this.ingestion.totalRuns++;
    this.ingestion.lastRunTimestamp = new Date().toISOString();
    this.ingestion.lastRunDurationMs = durationMs;
    this.ingestion.lastRunStatus = status;
    this.ingestion.totalRecordsProcessed += recordsProcessed;
    if (status === 'failed') {
      this.ingestion.failedRuns++;
      this.addFailure({
        category: 'ingestion',
        eventType: 'run_failed',
        timestamp: new Date().toISOString(),
        severity: 'error',
        message: `Ingestion run failed after ${durationMs}ms`,
        data: { durationMs, recordsProcessed },
      });
      ingestionLog.error('Ingestion run failed', { durationMs, recordsProcessed });
    }
  }

  recordIngestionDuplicate(count: number): void {
    this.ingestion.totalDuplicatesDetected += count;
    ingestionLog.info('Duplicates detected', { count, total: this.ingestion.totalDuplicatesDetected });
  }

  recordIngestionUnmatched(count: number): void {
    this.ingestion.totalUnmatchedRows += count;
    if (count > 0) {
      ingestionLog.warn('Unmatched rows detected', { count, total: this.ingestion.totalUnmatchedRows });
    }
  }

  // =========================================================================
  // OCR Events
  // =========================================================================

  recordOcrPage(confidence: number, durationMs: number): void {
    this.ocr.totalPagesProcessed++;
    this.ocr.totalDurationMs += durationMs;
    this.ocr.lastProcessedTimestamp = new Date().toISOString();

    // Running average
    this.ocr.averageConfidence =
      ((this.ocr.averageConfidence * (this.ocr.totalPagesProcessed - 1)) + confidence) /
      this.ocr.totalPagesProcessed;

    if (confidence < 0.5) {
      this.ocr.lowConfidenceCount++;
      ocrLog.warn('Low confidence OCR page', { confidence, durationMs });
    }
  }

  recordOcrFailure(error: string): void {
    this.ocr.failedPages++;
    this.addFailure({
      category: 'ocr',
      eventType: 'page_failed',
      timestamp: new Date().toISOString(),
      severity: 'error',
      message: `OCR page processing failed: ${error}`,
    });
    ocrLog.error('OCR page failed', { error });
  }

  recordOcrTempStorageFailure(): void {
    this.ocr.tempStorageFailures++;
    this.addFailure({
      category: 'ocr',
      eventType: 'temp_storage_failure',
      timestamp: new Date().toISOString(),
      severity: 'critical',
      message: 'OCR temp storage write failure',
    });
    ocrLog.error('Temp storage failure');
  }

  // =========================================================================
  // Queue Events
  // =========================================================================

  recordQueueRetry(queueName: string): void {
    this.queues.totalRetries++;
    this.queues.queueErrors[queueName] = (this.queues.queueErrors[queueName] || 0) + 1;
    queueLog.info('Queue job retry', { queueName, totalRetries: this.queues.totalRetries });
  }

  recordRetryStorm(queueName: string, retryCount: number): void {
    this.queues.retryStormEvents++;
    this.queues.lastRetryStormTimestamp = new Date().toISOString();
    this.addFailure({
      category: 'queue',
      eventType: 'retry_storm',
      timestamp: new Date().toISOString(),
      severity: 'critical',
      message: `Retry storm detected on ${queueName}: ${retryCount} retries`,
      data: { queueName, retryCount },
    });
    queueLog.error('Retry storm detected', { queueName, retryCount });
  }

  recordStuckJob(queueName: string, jobId: string): void {
    this.queues.stuckJobs++;
    this.addFailure({
      category: 'queue',
      eventType: 'stuck_job',
      timestamp: new Date().toISOString(),
      severity: 'warning',
      message: `Stuck job detected: ${jobId} in ${queueName}`,
      data: { queueName, jobId },
    });
    queueLog.warn('Stuck job detected', { queueName, jobId });
  }

  recordDeadLetter(queueName: string, jobId: string): void {
    this.queues.deadLetterCount++;
    this.addFailure({
      category: 'queue',
      eventType: 'dead_letter',
      timestamp: new Date().toISOString(),
      severity: 'error',
      message: `Job sent to dead-letter: ${jobId} in ${queueName}`,
      data: { queueName, jobId },
    });
    queueLog.error('Dead-letter job', { queueName, jobId });
  }

  // =========================================================================
  // Identity Events
  // =========================================================================

  recordDuplicateSuppression(inmateId: string): void {
    this.identity.duplicatesSuppressed++;
    inmateLog.info('Duplicate suppressed', { inmateId, total: this.identity.duplicatesSuppressed });
  }

  recordLinkageFailure(reason: string): void {
    this.identity.linkageFailures++;
    this.addFailure({
      category: 'identity',
      eventType: 'linkage_failure',
      timestamp: new Date().toISOString(),
      severity: 'warning',
      message: `Inmate linkage failure: ${reason}`,
    });
    inmateLog.warn('Linkage failure', { reason });
  }

  recordOrphanBooking(bookingId: string): void {
    this.identity.orphanBookings++;
    this.addFailure({
      category: 'identity',
      eventType: 'orphan_booking',
      timestamp: new Date().toISOString(),
      severity: 'warning',
      message: `Orphan booking detected: ${bookingId}`,
      data: { bookingId },
    });
    inmateLog.warn('Orphan booking', { bookingId });
  }

  recordMatchAttempt(): void {
    this.identity.totalMatchAttempts++;
    this.identity.lastMatchTimestamp = new Date().toISOString();
  }

  // =========================================================================
  // Report Generation
  // =========================================================================

  getReport(): FailureVisibilityReport {
    return {
      timestamp: new Date().toISOString(),
      ingestion: { ...this.ingestion },
      ocr: { ...this.ocr },
      queues: { ...this.queues },
      identity: { ...this.identity },
      recentFailures: [...this.recentFailures].reverse(),
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const failureVisibility = FailureVisibilityCollector.getInstance();
