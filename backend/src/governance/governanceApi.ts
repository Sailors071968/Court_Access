// ============================================
// Court Access — Corpus Governance API
// HTTP endpoint handlers for corpus governance operations.
// Designed as framework-agnostic handlers (adaptable to Express, Fastify, etc.)
// ============================================

import type { CorpusRegistryRepository } from './corpusRegistry.ts';
import type { CorpusLockManager } from './corpusLock.ts';
import type { CorpusIngestionStatus, RegisterCorpusInput } from './types.ts';

// ---------------------------------------------------------------------------
// Request / Response Types
// ---------------------------------------------------------------------------

export interface ApiRequest {
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  params?: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

// ---------------------------------------------------------------------------
// API Handlers
// ---------------------------------------------------------------------------

export class GovernanceApiHandlers {
  constructor(
    private readonly registry: CorpusRegistryRepository,
    private readonly lockManager: CorpusLockManager,
  ) {}

  /**
   * GET /api/corpus/registry
   * List all registered corpora with optional filters.
   */
  async listRegistry(req: ApiRequest): Promise<ApiResponse> {
    const filters: {
      corpusName?: string;
      jurisdiction?: string;
      ingestionStatus?: CorpusIngestionStatus;
    } = {};

    if (req.query?.corpusName) filters.corpusName = req.query.corpusName;
    if (req.query?.jurisdiction) filters.jurisdiction = req.query.jurisdiction;
    if (req.query?.status) {
      filters.ingestionStatus = req.query.status as CorpusIngestionStatus;
    }

    const entries = await this.registry.list(filters);

    return {
      status: 200,
      body: {
        corpora: entries.map(e => ({
          id: e.id,
          corpusName: e.corpusName,
          jurisdiction: e.jurisdiction,
          sourceAuthority: e.sourceAuthority,
          version: e.version,
          releaseDate: e.releaseDate?.toISOString() ?? null,
          ingestionStatus: e.ingestionStatus,
          totalDocuments: e.totalDocuments,
          totalBytes: e.totalBytes,
          checksum: e.checksum,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
        total: entries.length,
      },
    };
  }

  /**
   * POST /api/corpus/register
   * Register a new corpus for ingestion.
   */
  async registerCorpus(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body;
    if (!body) {
      return { status: 400, body: { error: 'Request body is required' } };
    }

    const corpusName = body.corpusName as string | undefined;
    const jurisdiction = body.jurisdiction as string | undefined;
    const sourceAuthority = body.sourceAuthority as string | undefined;
    const version = body.version as string | undefined;

    if (!corpusName || !jurisdiction || !sourceAuthority || !version) {
      return {
        status: 400,
        body: {
          error: 'Missing required fields: corpusName, jurisdiction, sourceAuthority, version',
        },
      };
    }

    const input: RegisterCorpusInput = {
      corpusName,
      jurisdiction,
      sourceAuthority,
      version,
      releaseDate: body.releaseDate ? new Date(body.releaseDate as string) : undefined,
      checksum: body.checksum as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    };

    try {
      const entry = await this.registry.register(input);
      return { status: 201, body: { corpus: entry } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already ingested')) {
        return { status: 409, body: { error: message } };
      }
      return { status: 500, body: { error: message } };
    }
  }

  /**
   * GET /api/corpus/status
   * Get status of a specific corpus (by name and version).
   */
  async getCorpusStatus(req: ApiRequest): Promise<ApiResponse> {
    const corpusName = req.query?.corpusName;
    const version = req.query?.version ?? '1.0';

    if (!corpusName) {
      return { status: 400, body: { error: 'corpusName query parameter is required' } };
    }

    const entry = await this.registry.get(corpusName, version);
    if (!entry) {
      return { status: 404, body: { error: `Corpus "${corpusName}" version "${version}" not found` } };
    }

    const lock = await this.lockManager.getLock(corpusName);

    return {
      status: 200,
      body: {
        corpus: entry,
        locked: lock !== null,
        lock: lock ? {
          workerId: lock.workerId,
          lockedAt: lock.lockedAt.toISOString(),
          expiresAt: lock.expiresAt.toISOString(),
        } : null,
      },
    };
  }

  /**
   * POST /api/corpus/lock
   * Acquire an ingestion lock on a corpus.
   */
  async acquireLock(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body;
    if (!body) {
      return { status: 400, body: { error: 'Request body is required' } };
    }

    const corpusName = body.corpusName as string | undefined;
    const workerId = body.workerId as string | undefined;

    if (!corpusName || !workerId) {
      return {
        status: 400,
        body: { error: 'Missing required fields: corpusName, workerId' },
      };
    }

    const lock = await this.lockManager.acquire({
      corpusName,
      workerId,
      durationMs: body.durationMs as number | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });

    if (!lock) {
      const existingLock = await this.lockManager.getLock(corpusName);
      return {
        status: 409,
        body: {
          error: `Corpus "${corpusName}" is already locked`,
          lockedBy: existingLock?.workerId ?? 'unknown',
          expiresAt: existingLock?.expiresAt.toISOString() ?? null,
        },
      };
    }

    return {
      status: 200,
      body: {
        lock: {
          id: lock.id,
          corpusName: lock.corpusName,
          workerId: lock.workerId,
          lockedAt: lock.lockedAt.toISOString(),
          expiresAt: lock.expiresAt.toISOString(),
        },
      },
    };
  }

  /**
   * POST /api/corpus/unlock
   * Release an ingestion lock on a corpus.
   */
  async releaseLock(req: ApiRequest): Promise<ApiResponse> {
    const body = req.body;
    if (!body) {
      return { status: 400, body: { error: 'Request body is required' } };
    }

    const corpusName = body.corpusName as string | undefined;
    const workerId = body.workerId as string | undefined;
    const force = body.force as boolean | undefined;

    if (!corpusName) {
      return { status: 400, body: { error: 'Missing required field: corpusName' } };
    }

    try {
      let released: boolean;
      if (force) {
        released = await this.lockManager.forceRelease(corpusName);
      } else {
        if (!workerId) {
          return { status: 400, body: { error: 'Missing required field: workerId (or set force=true)' } };
        }
        released = await this.lockManager.release(corpusName, workerId);
      }

      if (!released) {
        return { status: 404, body: { error: `No active lock found for corpus "${corpusName}"` } };
      }

      return { status: 200, body: { released: true, corpusName } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 403, body: { error: message } };
    }
  }

  /**
   * GET /api/corpus/versions
   * Get all versions of a corpus.
   */
  async getCorpusVersions(req: ApiRequest): Promise<ApiResponse> {
    const corpusName = req.query?.corpusName;
    if (!corpusName) {
      return { status: 400, body: { error: 'corpusName query parameter is required' } };
    }

    const versions = await this.registry.getVersions(corpusName);
    return {
      status: 200,
      body: {
        corpusName,
        versions: versions.map(v => ({
          version: v.version,
          ingestionStatus: v.ingestionStatus,
          totalDocuments: v.totalDocuments,
          releaseDate: v.releaseDate?.toISOString() ?? null,
          createdAt: v.createdAt.toISOString(),
        })),
        total: versions.length,
      },
    };
  }
}
