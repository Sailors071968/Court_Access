// ============================================================================
// Phase 69 — OCR Resource Controls
// Queue throttling: max OCR concurrency 3.
// Priority order: pdf-parse → AWS Textract → Tesseract fallback.
// Daily Textract budget limit.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrResourceConfig {
  maxConcurrency: number;
  priorityOrder: OcrMethod[];
  textractDailyBudget: number; // max Textract calls per day
  textractCostPerPage: number; // estimated cost in USD
  textractDailySpendLimitUsd: number;
  enableTesseractFallback: boolean;
  pdfParseTimeoutMs: number;
  textractTimeoutMs: number;
  tesseractTimeoutMs: number;
}

export type OcrMethod = 'pdf-parse' | 'aws-textract' | 'tesseract';

export interface OcrUsageMetrics {
  date: string; // YYYY-MM-DD
  pdfParseAttempts: number;
  pdfParseSuccesses: number;
  textractAttempts: number;
  textractSuccesses: number;
  tesseractAttempts: number;
  tesseractSuccesses: number;
  totalProcessed: number;
  totalFailed: number;
  textractSpendUsd: number;
  activeJobs: number;
}

export interface OcrJobStatus {
  jobId: string;
  documentId: string;
  method: OcrMethod;
  startedAt: number;
  status: 'running' | 'completed' | 'failed';
  pagesProcessed: number;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_OCR_CONFIG: OcrResourceConfig = {
  maxConcurrency: 3,
  priorityOrder: ['pdf-parse', 'aws-textract', 'tesseract'],
  textractDailyBudget: 500, // max 500 Textract calls per day
  textractCostPerPage: 0.0015, // $0.0015 per page
  textractDailySpendLimitUsd: 10.0, // $10/day max
  enableTesseractFallback: true,
  pdfParseTimeoutMs: 30_000,
  textractTimeoutMs: 120_000,
  tesseractTimeoutMs: 180_000,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentDate = new Date().toISOString().split('T')[0];
let dailyMetrics: OcrUsageMetrics = createEmptyMetrics(currentDate);
const activeJobs = new Map<string, OcrJobStatus>();

function createEmptyMetrics(date: string): OcrUsageMetrics {
  return {
    date,
    pdfParseAttempts: 0,
    pdfParseSuccesses: 0,
    textractAttempts: 0,
    textractSuccesses: 0,
    tesseractAttempts: 0,
    tesseractSuccesses: 0,
    totalProcessed: 0,
    totalFailed: 0,
    textractSpendUsd: 0,
    activeJobs: 0,
  };
}

function ensureCurrentDay(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== currentDate) {
    currentDate = today;
    dailyMetrics = createEmptyMetrics(today);
  }
}

// ---------------------------------------------------------------------------
// Concurrency Control
// ---------------------------------------------------------------------------

/**
 * Check if a new OCR job can start (respects max concurrency).
 */
export function canStartOcrJob(
  config: OcrResourceConfig = DEFAULT_OCR_CONFIG,
): { allowed: boolean; reason?: string } {
  const runningCount = Array.from(activeJobs.values()).filter(
    (j) => j.status === 'running'
  ).length;

  if (runningCount >= config.maxConcurrency) {
    return {
      allowed: false,
      reason: `Max OCR concurrency reached (${runningCount}/${config.maxConcurrency})`,
    };
  }

  return { allowed: true };
}

/**
 * Register a new OCR job.
 */
export function startOcrJob(
  jobId: string,
  documentId: string,
  method: OcrMethod,
): OcrJobStatus {
  const job: OcrJobStatus = {
    jobId,
    documentId,
    method,
    startedAt: Date.now(),
    status: 'running',
    pagesProcessed: 0,
  };
  activeJobs.set(jobId, job);
  dailyMetrics.activeJobs = Array.from(activeJobs.values()).filter(
    (j) => j.status === 'running'
  ).length;
  return job;
}

/**
 * Mark an OCR job as completed.
 */
export function completeOcrJob(
  jobId: string,
  pagesProcessed: number,
): void {
  ensureCurrentDay();
  const job = activeJobs.get(jobId);
  if (!job) return;

  job.status = 'completed';
  job.pagesProcessed = pagesProcessed;

  dailyMetrics.totalProcessed++;
  switch (job.method) {
    case 'pdf-parse':
      dailyMetrics.pdfParseSuccesses++;
      break;
    case 'aws-textract':
      dailyMetrics.textractSuccesses++;
      dailyMetrics.textractSpendUsd += pagesProcessed * DEFAULT_OCR_CONFIG.textractCostPerPage;
      break;
    case 'tesseract':
      dailyMetrics.tesseractSuccesses++;
      break;
  }

  activeJobs.delete(jobId);
  dailyMetrics.activeJobs = Array.from(activeJobs.values()).filter(
    (j) => j.status === 'running'
  ).length;
}

/**
 * Mark an OCR job as failed.
 */
export function failOcrJob(jobId: string): void {
  ensureCurrentDay();
  const job = activeJobs.get(jobId);
  if (!job) return;

  job.status = 'failed';
  dailyMetrics.totalFailed++;

  activeJobs.delete(jobId);
  dailyMetrics.activeJobs = Array.from(activeJobs.values()).filter(
    (j) => j.status === 'running'
  ).length;
}

// ---------------------------------------------------------------------------
// Textract Budget Control
// ---------------------------------------------------------------------------

/**
 * Check if Textract can be used (daily budget check).
 */
export function canUseTextract(
  config: OcrResourceConfig = DEFAULT_OCR_CONFIG,
): { allowed: boolean; reason?: string; remainingBudget: number } {
  ensureCurrentDay();

  // Check call count limit
  if (dailyMetrics.textractAttempts >= config.textractDailyBudget) {
    return {
      allowed: false,
      reason: `Daily Textract call limit reached (${dailyMetrics.textractAttempts}/${config.textractDailyBudget})`,
      remainingBudget: 0,
    };
  }

  // Check spend limit
  if (dailyMetrics.textractSpendUsd >= config.textractDailySpendLimitUsd) {
    return {
      allowed: false,
      reason: `Daily Textract spend limit reached ($${dailyMetrics.textractSpendUsd.toFixed(2)}/$${config.textractDailySpendLimitUsd.toFixed(2)})`,
      remainingBudget: 0,
    };
  }

  const remainingCalls = config.textractDailyBudget - dailyMetrics.textractAttempts;
  const remainingSpend = config.textractDailySpendLimitUsd - dailyMetrics.textractSpendUsd;

  return {
    allowed: true,
    remainingBudget: Math.min(remainingCalls, Math.floor(remainingSpend / config.textractCostPerPage)),
  };
}

/**
 * Record a Textract attempt (whether it succeeds or not).
 */
export function recordTextractAttempt(): void {
  ensureCurrentDay();
  dailyMetrics.textractAttempts++;
}

// ---------------------------------------------------------------------------
// Method Selection (Priority Order)
// ---------------------------------------------------------------------------

/**
 * Determine which OCR method to use next based on priority and availability.
 */
export function selectOcrMethod(
  previousFailedMethods: OcrMethod[] = [],
  config: OcrResourceConfig = DEFAULT_OCR_CONFIG,
): { method: OcrMethod | null; reason?: string } {
  for (const method of config.priorityOrder) {
    if (previousFailedMethods.includes(method)) continue;

    if (method === 'aws-textract') {
      const budget = canUseTextract(config);
      if (!budget.allowed) {
        continue; // Skip to next method
      }
    }

    if (method === 'tesseract' && !config.enableTesseractFallback) {
      continue;
    }

    return { method };
  }

  return {
    method: null,
    reason: `All OCR methods exhausted. Failed: ${previousFailedMethods.join(', ')}`,
  };
}

/**
 * Record an OCR method attempt.
 */
export function recordMethodAttempt(method: OcrMethod): void {
  ensureCurrentDay();
  switch (method) {
    case 'pdf-parse':
      dailyMetrics.pdfParseAttempts++;
      break;
    case 'aws-textract':
      dailyMetrics.textractAttempts++;
      break;
    case 'tesseract':
      dailyMetrics.tesseractAttempts++;
      break;
  }
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * Get current OCR resource status and metrics.
 */
export function getOcrResourceStatus(): {
  config: OcrResourceConfig;
  metrics: OcrUsageMetrics;
  activeJobs: OcrJobStatus[];
  textractBudgetRemaining: number;
  textractSpendRemaining: number;
} {
  ensureCurrentDay();
  const textractCheck = canUseTextract();

  return {
    config: DEFAULT_OCR_CONFIG,
    metrics: { ...dailyMetrics },
    activeJobs: Array.from(activeJobs.values()),
    textractBudgetRemaining: textractCheck.remainingBudget,
    textractSpendRemaining:
      DEFAULT_OCR_CONFIG.textractDailySpendLimitUsd - dailyMetrics.textractSpendUsd,
  };
}

/**
 * Reset daily metrics (for testing).
 */
export function resetOcrMetrics(): void {
  currentDate = new Date().toISOString().split('T')[0];
  dailyMetrics = createEmptyMetrics(currentDate);
  activeJobs.clear();
}
