// ============================================
// Court Access — Corpus Registry
// Tracks all registered corpora and their versions.
// Prevents duplicate corpus ingestion, supports versioning.
// ============================================

import type {
  CorpusRegistryEntry,
  RegisterCorpusInput,
  UpdateCorpusInput,
  CorpusIngestionStatus,
} from './types.ts';

// ---------------------------------------------------------------------------
// Database Interface (Prisma-compatible)
// ---------------------------------------------------------------------------

export interface CorpusRegistryRecord {
  id: string;
  corpusName: string;
  jurisdiction: string;
  sourceAuthority: string;
  version: string;
  releaseDate: Date | null;
  ingestionStatus: string;
  totalDocuments: number;
  totalBytes: number;
  checksum: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorpusRegistryDb {
  findUnique(args: {
    where: { corpusName_version: { corpusName: string; version: string } };
  }): Promise<CorpusRegistryRecord | null>;
  findMany(args?: {
    where?: Partial<{ corpusName: string; jurisdiction: string; ingestionStatus: string }>;
    orderBy?: { createdAt: 'asc' | 'desc' };
  }): Promise<CorpusRegistryRecord[]>;
  create(args: {
    data: Omit<CorpusRegistryRecord, 'id' | 'createdAt' | 'updatedAt'>;
  }): Promise<CorpusRegistryRecord>;
  update(args: {
    where: { corpusName_version: { corpusName: string; version: string } };
    data: Partial<Omit<CorpusRegistryRecord, 'id' | 'createdAt' | 'updatedAt'>>;
  }): Promise<CorpusRegistryRecord>;
  count(args?: {
    where?: Partial<{ corpusName: string; ingestionStatus: string }>;
  }): Promise<number>;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class CorpusRegistryRepository {
  constructor(private readonly db: CorpusRegistryDb) {}

  /**
   * Register a new corpus or return existing entry if already registered.
   * Throws if the same corpus+version already exists and is completed.
   */
  async register(input: RegisterCorpusInput): Promise<CorpusRegistryEntry> {
    const existing = await this.db.findUnique({
      where: {
        corpusName_version: {
          corpusName: input.corpusName,
          version: input.version,
        },
      },
    });

    if (existing) {
      if (existing.ingestionStatus === 'completed') {
        throw new Error(
          `Corpus "${input.corpusName}" version "${input.version}" is already ingested. ` +
          `Use a new version number for updated content.`,
        );
      }
      // If pending or failed, allow re-registration (idempotent)
      return this.recordToEntry(existing);
    }

    const record = await this.db.create({
      data: {
        corpusName: input.corpusName,
        jurisdiction: input.jurisdiction,
        sourceAuthority: input.sourceAuthority,
        version: input.version,
        releaseDate: input.releaseDate ?? null,
        ingestionStatus: 'pending',
        totalDocuments: 0,
        totalBytes: 0,
        checksum: input.checksum ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    return this.recordToEntry(record);
  }

  /**
   * Get a specific corpus entry by name and version.
   */
  async get(corpusName: string, version: string): Promise<CorpusRegistryEntry | null> {
    const record = await this.db.findUnique({
      where: { corpusName_version: { corpusName, version } },
    });
    return record ? this.recordToEntry(record) : null;
  }

  /**
   * List all registered corpora, optionally filtered.
   */
  async list(filters?: {
    corpusName?: string;
    jurisdiction?: string;
    ingestionStatus?: CorpusIngestionStatus;
  }): Promise<CorpusRegistryEntry[]> {
    const where: Partial<{ corpusName: string; jurisdiction: string; ingestionStatus: string }> = {};
    if (filters?.corpusName) where.corpusName = filters.corpusName;
    if (filters?.jurisdiction) where.jurisdiction = filters.jurisdiction;
    if (filters?.ingestionStatus) where.ingestionStatus = filters.ingestionStatus;

    const records = await this.db.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return records.map(r => this.recordToEntry(r));
  }

  /**
   * Update a corpus entry (e.g., status, document count).
   */
  async update(
    corpusName: string,
    version: string,
    input: UpdateCorpusInput,
  ): Promise<CorpusRegistryEntry> {
    const data: Partial<Omit<CorpusRegistryRecord, 'id' | 'createdAt' | 'updatedAt'>> = {};
    if (input.ingestionStatus !== undefined) data.ingestionStatus = input.ingestionStatus;
    if (input.totalDocuments !== undefined) data.totalDocuments = input.totalDocuments;
    if (input.totalBytes !== undefined) data.totalBytes = input.totalBytes;
    if (input.checksum !== undefined) data.checksum = input.checksum;
    if (input.metadata !== undefined) data.metadata = JSON.stringify(input.metadata);

    const record = await this.db.update({
      where: { corpusName_version: { corpusName, version } },
      data,
    });

    return this.recordToEntry(record);
  }

  /**
   * Mark a corpus as in_progress.
   */
  async markInProgress(corpusName: string, version: string): Promise<void> {
    await this.update(corpusName, version, { ingestionStatus: 'in_progress' });
  }

  /**
   * Mark a corpus as completed with final document count.
   */
  async markCompleted(
    corpusName: string,
    version: string,
    totalDocuments: number,
    totalBytes: number,
  ): Promise<void> {
    await this.update(corpusName, version, {
      ingestionStatus: 'completed',
      totalDocuments,
      totalBytes,
    });
  }

  /**
   * Mark a corpus as failed.
   */
  async markFailed(corpusName: string, version: string): Promise<void> {
    await this.update(corpusName, version, { ingestionStatus: 'failed' });
  }

  /**
   * Check if a corpus+version has already been fully ingested.
   */
  async isIngested(corpusName: string, version: string): Promise<boolean> {
    const entry = await this.get(corpusName, version);
    return entry?.ingestionStatus === 'completed';
  }

  /**
   * Get the latest version of a corpus.
   * Optionally exclude a specific version (useful when looking for the
   * previous completed version during a new ingestion run).
   */
  async getLatestVersion(
    corpusName: string,
    excludeVersion?: string,
  ): Promise<CorpusRegistryEntry | null> {
    const records = await this.db.findMany({
      where: { corpusName },
      orderBy: { createdAt: 'desc' },
    });
    const filtered = excludeVersion
      ? records.filter(r => r.version !== excludeVersion)
      : records;
    return filtered.length > 0 ? this.recordToEntry(filtered[0]) : null;
  }

  /**
   * Get all versions of a corpus.
   */
  async getVersions(corpusName: string): Promise<CorpusRegistryEntry[]> {
    const records = await this.db.findMany({
      where: { corpusName },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(r => this.recordToEntry(r));
  }

  private recordToEntry(record: CorpusRegistryRecord): CorpusRegistryEntry {
    return {
      id: record.id,
      corpusName: record.corpusName,
      jurisdiction: record.jurisdiction,
      sourceAuthority: record.sourceAuthority,
      version: record.version,
      releaseDate: record.releaseDate,
      ingestionStatus: record.ingestionStatus as CorpusIngestionStatus,
      totalDocuments: record.totalDocuments,
      totalBytes: record.totalBytes,
      checksum: record.checksum,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
