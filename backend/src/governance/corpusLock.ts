// ============================================
// Court Access — Corpus Ingestion Lock
// Prevents simultaneous ingestion of the same corpus.
// Uses database-backed locks with automatic expiry.
// ============================================

import type { CorpusLock, AcquireLockInput } from './types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface CorpusLockRecord {
  id: string;
  corpusName: string;
  workerId: string;
  lockedAt: Date;
  expiresAt: Date;
  metadata: string | null;
}

export interface CorpusLockDb {
  findUnique(args: {
    where: { corpusName: string };
  }): Promise<CorpusLockRecord | null>;
  create(args: {
    data: Omit<CorpusLockRecord, 'id'>;
  }): Promise<CorpusLockRecord>;
  delete(args: {
    where: { corpusName: string };
  }): Promise<CorpusLockRecord>;
  deleteMany(args: {
    where: { expiresAt: { lt: Date } };
  }): Promise<{ count: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default lock duration: 30 minutes */
const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lock Manager
// ---------------------------------------------------------------------------

export class CorpusLockManager {
  constructor(private readonly db: CorpusLockDb) {}

  /**
   * Attempt to acquire an exclusive lock on a corpus.
   * Returns the lock if acquired, null if the corpus is already locked.
   */
  async acquire(input: AcquireLockInput): Promise<CorpusLock | null> {
    const { corpusName, workerId, durationMs, metadata } = input;
    const duration = durationMs ?? DEFAULT_LOCK_DURATION_MS;

    // First, clean up expired locks
    await this.cleanExpired();

    // Check for existing lock
    const existing = await this.db.findUnique({
      where: { corpusName },
    });

    if (existing) {
      // Lock exists — check if expired
      if (existing.expiresAt > new Date()) {
        // Lock is still active — cannot acquire
        return null;
      }
      // Lock expired — remove it
      try {
        await this.db.delete({ where: { corpusName } });
      } catch {
        // Race condition: another worker already cleaned it up
        return null;
      }
    }

    // Create new lock
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration);

    try {
      const record = await this.db.create({
        data: {
          corpusName,
          workerId,
          lockedAt: now,
          expiresAt,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return this.recordToLock(record);
    } catch {
      // Unique constraint violation: another worker acquired the lock first
      return null;
    }
  }

  /**
   * Release a lock on a corpus.
   * Only the worker that acquired the lock can release it.
   */
  async release(corpusName: string, workerId: string): Promise<boolean> {
    const existing = await this.db.findUnique({
      where: { corpusName },
    });

    if (!existing) {
      return false; // No lock to release
    }

    if (existing.workerId !== workerId) {
      throw new Error(
        `Cannot release lock on "${corpusName}": locked by worker "${existing.workerId}", ` +
        `not "${workerId}"`,
      );
    }

    try {
      await this.db.delete({ where: { corpusName } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Force-release a lock (admin operation).
   * Does not check worker ownership.
   */
  async forceRelease(corpusName: string): Promise<boolean> {
    try {
      await this.db.delete({ where: { corpusName } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a corpus is currently locked.
   */
  async isLocked(corpusName: string): Promise<boolean> {
    const existing = await this.db.findUnique({
      where: { corpusName },
    });
    if (!existing) return false;
    return existing.expiresAt > new Date();
  }

  /**
   * Get the current lock for a corpus, if any.
   */
  async getLock(corpusName: string): Promise<CorpusLock | null> {
    const existing = await this.db.findUnique({
      where: { corpusName },
    });
    if (!existing) return null;
    if (existing.expiresAt <= new Date()) {
      // Expired — clean up
      try {
        await this.db.delete({ where: { corpusName } });
      } catch {
        // Already cleaned
      }
      return null;
    }
    return this.recordToLock(existing);
  }

  /**
   * Extend a lock's expiry time.
   * Only the owning worker can extend.
   */
  async extend(corpusName: string, workerId: string, additionalMs: number): Promise<CorpusLock | null> {
    const existing = await this.db.findUnique({
      where: { corpusName },
    });

    if (!existing || existing.workerId !== workerId) {
      return null;
    }

    const newExpiry = new Date(existing.expiresAt.getTime() + additionalMs);

    // Delete and recreate (simulating update since interface is minimal)
    try {
      await this.db.delete({ where: { corpusName } });
      const record = await this.db.create({
        data: {
          corpusName,
          workerId,
          lockedAt: existing.lockedAt,
          expiresAt: newExpiry,
          metadata: existing.metadata,
        },
      });
      return this.recordToLock(record);
    } catch {
      return null;
    }
  }

  /**
   * Clean up all expired locks.
   */
  async cleanExpired(): Promise<number> {
    const result = await this.db.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  private recordToLock(record: CorpusLockRecord): CorpusLock {
    return {
      id: record.id,
      corpusName: record.corpusName,
      workerId: record.workerId,
      lockedAt: record.lockedAt,
      expiresAt: record.expiresAt,
      metadata: record.metadata,
    };
  }
}
