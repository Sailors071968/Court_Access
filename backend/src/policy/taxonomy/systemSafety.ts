// ---------------------------------------------------------------------------
// Phase 20 — System Safety
// Crawler safeguards: max 2 concurrent crawls, 200 pages/agency, 50MB file
// size, 3 retry attempts with exponential backoff.
// Centralizes all safety constraints and provides runtime validation.
// ---------------------------------------------------------------------------

import { DEFAULT_CRAWLER_CONFIG } from '../agencyRegistry/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafetyLimits {
  maxConcurrentCrawls: number;
  maxPagesPerAgency: number;
  maxDocumentSizeBytes: number;
  maxRetryAttempts: number;
  retryBackoffBaseMs: number;
  requestsPerSecond: number;
  requestTimeoutMs: number;
  maxQueueDepth: number;
  maxMemoryUsageMb: number;
}

export interface SafetyStatus {
  withinLimits: boolean;
  activeCrawls: number;
  queueDepth: number;
  memoryUsageMb: number;
  violations: string[];
  limits: SafetyLimits;
}

export interface RetryConfig {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  shouldRetry: boolean;
}

// ---------------------------------------------------------------------------
// Safety constants (derived from DEFAULT_CRAWLER_CONFIG)
// ---------------------------------------------------------------------------

export const SAFETY_LIMITS: SafetyLimits = {
  maxConcurrentCrawls: DEFAULT_CRAWLER_CONFIG.maxConcurrentSites,       // 2
  maxPagesPerAgency: DEFAULT_CRAWLER_CONFIG.maxPagesPerSite,            // 200
  maxDocumentSizeBytes: DEFAULT_CRAWLER_CONFIG.maxDocumentSizeBytes,    // 50MB
  maxRetryAttempts: 3,
  retryBackoffBaseMs: 5000,
  requestsPerSecond: DEFAULT_CRAWLER_CONFIG.requestsPerSecondPerSite,   // 1
  requestTimeoutMs: DEFAULT_CRAWLER_CONFIG.requestTimeoutMs,            // 30000
  maxQueueDepth: 10000,
  maxMemoryUsageMb: 2048,
};

// ---------------------------------------------------------------------------
// Runtime safety state tracking
// ---------------------------------------------------------------------------

let activeCrawlCount = 0;
let currentQueueDepth = 0;

export function incrementActiveCrawls(): boolean {
  if (activeCrawlCount >= SAFETY_LIMITS.maxConcurrentCrawls) {
    console.warn(
      `[Safety] Rejecting crawl: active=${activeCrawlCount}, limit=${SAFETY_LIMITS.maxConcurrentCrawls}`,
    );
    return false;
  }
  activeCrawlCount++;
  return true;
}

export function decrementActiveCrawls(): void {
  activeCrawlCount = Math.max(0, activeCrawlCount - 1);
}

export function getActiveCrawlCount(): number {
  return activeCrawlCount;
}

export function updateQueueDepth(depth: number): void {
  currentQueueDepth = depth;
}

// ---------------------------------------------------------------------------
// Validate document size before download
// ---------------------------------------------------------------------------

export function validateDocumentSize(sizeBytes: number): {
  valid: boolean;
  reason: string | null;
} {
  if (sizeBytes > SAFETY_LIMITS.maxDocumentSizeBytes) {
    return {
      valid: false,
      reason: `Document size ${(sizeBytes / 1024 / 1024).toFixed(1)}MB exceeds limit of ${(SAFETY_LIMITS.maxDocumentSizeBytes / 1024 / 1024).toFixed(0)}MB`,
    };
  }
  return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// Validate page count during crawl
// ---------------------------------------------------------------------------

export function validatePageCount(pagesVisited: number): {
  valid: boolean;
  reason: string | null;
} {
  if (pagesVisited >= SAFETY_LIMITS.maxPagesPerAgency) {
    return {
      valid: false,
      reason: `Page limit reached: ${pagesVisited}/${SAFETY_LIMITS.maxPagesPerAgency}`,
    };
  }
  return { valid: true, reason: null };
}

// ---------------------------------------------------------------------------
// Exponential backoff retry calculation
// ---------------------------------------------------------------------------

export function calculateRetry(attempt: number): RetryConfig {
  const shouldRetry = attempt < SAFETY_LIMITS.maxRetryAttempts;
  const delayMs = shouldRetry
    ? SAFETY_LIMITS.retryBackoffBaseMs * Math.pow(2, attempt)
    : 0;

  return {
    attempt,
    maxAttempts: SAFETY_LIMITS.maxRetryAttempts,
    delayMs,
    shouldRetry,
  };
}

// ---------------------------------------------------------------------------
// Get full system safety status
// ---------------------------------------------------------------------------

export function getSystemSafetyStatus(): SafetyStatus {
  const memoryUsage = process.memoryUsage();
  const memoryUsageMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

  const violations: string[] = [];

  if (activeCrawlCount > SAFETY_LIMITS.maxConcurrentCrawls) {
    violations.push(
      `Active crawls (${activeCrawlCount}) exceed limit (${SAFETY_LIMITS.maxConcurrentCrawls})`,
    );
  }

  if (currentQueueDepth > SAFETY_LIMITS.maxQueueDepth) {
    violations.push(
      `Queue depth (${currentQueueDepth}) exceeds limit (${SAFETY_LIMITS.maxQueueDepth})`,
    );
  }

  if (memoryUsageMb > SAFETY_LIMITS.maxMemoryUsageMb) {
    violations.push(
      `Memory usage (${memoryUsageMb}MB) exceeds limit (${SAFETY_LIMITS.maxMemoryUsageMb}MB)`,
    );
  }

  return {
    withinLimits: violations.length === 0,
    activeCrawls: activeCrawlCount,
    queueDepth: currentQueueDepth,
    memoryUsageMb,
    violations,
    limits: SAFETY_LIMITS,
  };
}

// ---------------------------------------------------------------------------
// BullMQ job options with retry/backoff built in
// ---------------------------------------------------------------------------

export function getSafeJobOptions(): {
  attempts: number;
  backoff: { type: 'exponential'; delay: number };
  removeOnComplete: number;
  removeOnFail: number;
} {
  return {
    attempts: SAFETY_LIMITS.maxRetryAttempts,
    backoff: {
      type: 'exponential',
      delay: SAFETY_LIMITS.retryBackoffBaseMs,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
}

// ---------------------------------------------------------------------------
// Rate limit helper: sleep for rate-limit duration
// ---------------------------------------------------------------------------

export function rateLimitDelay(): Promise<void> {
  const delayMs = Math.ceil(1000 / SAFETY_LIMITS.requestsPerSecond);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
