// ============================================================================
// Canonical knowledge graph repositories — deterministic, deduplicated JSONL storage
// ============================================================================

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface RepositoryRecord {
  id: string;
  [key: string]: unknown;
}

export class CanonicalRepository<T extends RepositoryRecord> {
  constructor(
    private readonly baseDir: string,
    private readonly name: string,
  ) {}

  private indexPath(): string {
    return join(this.baseDir, this.name, 'index.json');
  }

  private recordsPath(): string {
    return join(this.baseDir, this.name, 'records.jsonl');
  }

  async init(): Promise<void> {
    await mkdir(join(this.baseDir, this.name), { recursive: true });
    try {
      await readFile(this.indexPath(), 'utf-8');
    } catch {
      await writeFile(this.indexPath(), JSON.stringify({ ids: {}, count: 0, updatedAt: null }), 'utf-8');
    }
  }

  async getIndex(): Promise<{ ids: Record<string, string>; count: number; updatedAt: string | null }> {
    await this.init();
    const raw = await readFile(this.indexPath(), 'utf-8');
    return JSON.parse(raw);
  }

  async upsert(record: T): Promise<'inserted' | 'updated' | 'unchanged'> {
    await this.init();
    const index = await this.getIndex();
    const hash = contentHash(JSON.stringify(record));
    const existingHash = index.ids[record.id];

    if (existingHash === hash) return 'unchanged';

    const action = existingHash ? 'updated' : 'inserted';
    index.ids[record.id] = hash;
    index.count = Object.keys(index.ids).length;
    index.updatedAt = new Date().toISOString();

    await appendFile(this.recordsPath(), `${JSON.stringify(record)}\n`, 'utf-8');
    await writeFile(this.indexPath(), JSON.stringify(index, null, 2), 'utf-8');
    return action;
  }

  async upsertMany(records: T[]): Promise<{ inserted: number; updated: number; unchanged: number }> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    for (const record of records) {
      const result = await this.upsert(record);
      if (result === 'inserted') inserted += 1;
      else if (result === 'updated') updated += 1;
      else unchanged += 1;
    }
    return { inserted, updated, unchanged };
  }

  async count(): Promise<number> {
    const index = await this.getIndex();
    return index.count;
  }
}

export function contentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const REPOSITORY_NAMES = [
  'statutes',
  'offenses',
  'elements',
  'mens_rea',
  'exceptions',
  'defenses',
  'cross_references',
  'regulatory_incorporations',
  'calcrim_links',
  'authorities',
] as const;

export type RepositoryName = (typeof REPOSITORY_NAMES)[number];

export function createRepositories(baseDir: string): Record<RepositoryName, CanonicalRepository<RepositoryRecord>> {
  const repos = {} as Record<RepositoryName, CanonicalRepository<RepositoryRecord>>;
  for (const name of REPOSITORY_NAMES) {
    repos[name] = new CanonicalRepository<RepositoryRecord>(baseDir, name);
  }
  return repos;
}
