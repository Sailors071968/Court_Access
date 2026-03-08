// ============================================
// Court Access — Relationship Candidate Store
// Stores below-threshold relationships for
// human review before graph insertion.
// ============================================

import { randomUUID } from 'node:crypto';
import type {
  RelationshipCandidate,
  CandidateStatus,
  EvidenceRelationship,
} from './types.ts';

// ---------------------------------------------------------------------------
// RelationshipCandidateStore
// ---------------------------------------------------------------------------

export class RelationshipCandidateStore {
  /**
   * In-memory store keyed by candidate ID.
   * Production would use PostgreSQL via Prisma; this implementation
   * provides the interface + <500MB memory contract.
   */
  private readonly candidates: Map<string, RelationshipCandidate> = new Map();

  /** Maximum candidates to retain (evict oldest when exceeded) */
  private readonly maxCapacity: number;

  constructor(maxCapacity = 50_000) {
    this.maxCapacity = maxCapacity;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Store a below-threshold relationship as a candidate for review.
   * Returns the generated candidate ID.
   */
  store(relationship: EvidenceRelationship): string {
    const id = randomUUID();
    const candidate: RelationshipCandidate = {
      id,
      relationship,
      status: 'pending',
      reviewNotes: null,
      createdAt: new Date(),
      reviewedAt: null,
    };

    this.candidates.set(id, candidate);
    this.enforceCapacity();
    return id;
  }

  /**
   * Store multiple candidates in bulk.
   * Returns the generated candidate IDs.
   */
  storeBulk(relationships: EvidenceRelationship[]): string[] {
    const ids: string[] = [];
    for (const rel of relationships) {
      ids.push(this.store(rel));
    }
    return ids;
  }

  /**
   * Retrieve a single candidate by ID.
   */
  get(id: string): RelationshipCandidate | undefined {
    return this.candidates.get(id);
  }

  /**
   * List candidates with optional filtering.
   */
  list(options?: {
    tenantId?: string;
    status?: CandidateStatus;
    limit?: number;
    offset?: number;
  }): RelationshipCandidate[] {
    let results = Array.from(this.candidates.values());

    if (options?.tenantId) {
      results = results.filter(
        (c) => c.relationship.tenantId === options.tenantId,
      );
    }

    if (options?.status) {
      results = results.filter((c) => c.status === options.status);
    }

    // Sort by creation date descending (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Mark a candidate as reviewed (approved or rejected).
   * If approved, returns the relationship for graph insertion.
   */
  markReviewed(
    id: string,
    status: 'approved' | 'rejected',
    reviewNotes?: string,
  ): RelationshipCandidate | undefined {
    const candidate = this.candidates.get(id);
    if (!candidate) return undefined;

    const updated: RelationshipCandidate = {
      ...candidate,
      status,
      reviewNotes: reviewNotes ?? null,
      reviewedAt: new Date(),
    };
    this.candidates.set(id, updated);
    return updated;
  }

  /**
   * Remove a candidate from the store.
   */
  remove(id: string): boolean {
    return this.candidates.delete(id);
  }

  /**
   * Count candidates by status for a tenant.
   */
  countByStatus(tenantId: string): Record<CandidateStatus, number> {
    const counts: Record<CandidateStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const candidate of this.candidates.values()) {
      if (candidate.relationship.tenantId === tenantId) {
        counts[candidate.status]++;
      }
    }

    return counts;
  }

  /** Total number of candidates in store */
  get size(): number {
    return this.candidates.size;
  }

  /** Clear all candidates */
  clear(): void {
    this.candidates.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Evict oldest candidates when over capacity.
   */
  private enforceCapacity(): void {
    if (this.candidates.size <= this.maxCapacity) return;

    // Sort by creation date ascending and remove oldest
    const sorted = Array.from(this.candidates.entries()).sort(
      ([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const toRemove = sorted.length - this.maxCapacity;
    for (let i = 0; i < toRemove; i++) {
      this.candidates.delete(sorted[i][0]);
    }
  }
}
