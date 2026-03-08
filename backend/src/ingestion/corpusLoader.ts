// ============================================
// Court Access — Corpus Loader (PostgreSQL Bulk Insert)
// Handles bulk insertion of documents using PostgreSQL COPY
// command for large corpora (>100k) or Prisma createMany as fallback.
// ============================================

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { NormalizedDocument } from './types.ts';

// ---------------------------------------------------------------------------
// Bulk Inserter Interface
// ---------------------------------------------------------------------------

export interface BulkInserter {
  /**
   * Insert a batch of documents into the database.
   * Returns the number of records actually inserted (after dedup).
   */
  insertBatch(documents: NormalizedDocument[]): Promise<number>;
}

// ---------------------------------------------------------------------------
// Prisma Bulk Inserter (Fallback)
// ---------------------------------------------------------------------------

export interface PrismaLegalDocumentDelegate {
  createMany(args: {
    data: Array<{
      id: string;
      tenantId: string;
      title: string;
      content: string;
      jurisdiction: string;
      documentType: string;
      source: string;
      version: string;
      corpusName: string | null;
      sourceFile: string | null;
      contentHash: string;
    }>;
    skipDuplicates: boolean;
  }): Promise<{ count: number }>;
}

export class PrismaBulkInserter implements BulkInserter {
  constructor(private readonly delegate: PrismaLegalDocumentDelegate) {}

  async insertBatch(documents: NormalizedDocument[]): Promise<number> {
    const data = documents.map(doc => ({
      id: doc.id,
      tenantId: doc.tenantId,
      title: doc.title,
      content: doc.content,
      jurisdiction: doc.jurisdiction,
      documentType: doc.documentType,
      source: doc.source,
      version: doc.version,
      corpusName: doc.corpusName ?? null,
      sourceFile: doc.sourceFile ?? null,
      contentHash: doc.contentHash,
    }));

    const result = await this.delegate.createMany({
      data,
      skipDuplicates: true,
    });

    return result.count;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL COPY Inserter (Preferred for >100k records)
// ---------------------------------------------------------------------------

export interface PgPoolClient {
  query(text: string, values?: unknown[]): Promise<{ rowCount: number | null }>;
}

export interface CopyStreamFactory {
  from(queryText: string): NodeJS.WritableStream;
}

/**
 * Escape a value for PostgreSQL COPY TEXT format.
 * Handles null, newlines, tabs, and backslashes.
 */
function escapeCopyValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '\\N';
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Convert a NormalizedDocument to a COPY TEXT format line.
 */
function documentToCopyLine(doc: NormalizedDocument): string {
  const fields = [
    doc.id,
    doc.tenantId,
    doc.title,
    doc.content,
    doc.jurisdiction,
    doc.documentType,
    doc.source,
    doc.version,
    doc.corpusName,
    doc.sourceFile,
    doc.contentHash,
    doc.createdAt.toISOString(),
    doc.updatedAt.toISOString(),
  ];

  return fields.map(f => escapeCopyValue(f as string | null)).join('\t') + '\n';
}

export class PostgresCopyInserter implements BulkInserter {
  constructor(
    private readonly client: PgPoolClient,
    private readonly copyStreamFactory: CopyStreamFactory,
  ) {}

  async insertBatch(documents: NormalizedDocument[]): Promise<number> {
    // Create a temporary staging table
    const tempTable = `_ingestion_staging_${Date.now()}`;

    await this.client.query(`
      CREATE TEMP TABLE "${tempTable}" (
        id TEXT,
        "tenantId" TEXT,
        title TEXT,
        content TEXT,
        jurisdiction TEXT,
        "documentType" TEXT,
        source TEXT,
        version TEXT,
        "corpusName" TEXT,
        "sourceFile" TEXT,
        "contentHash" TEXT,
        "createdAt" TIMESTAMPTZ,
        "updatedAt" TIMESTAMPTZ
      )
    `);

    // COPY data into staging table
    const copyStream = this.copyStreamFactory.from(
      `COPY "${tempTable}" FROM STDIN WITH (FORMAT text)`,
    );

    let pushed = false;
    const dataStream = new Readable({
      read() {
        if (!pushed) {
          pushed = true;
          for (const doc of documents) {
            this.push(documentToCopyLine(doc));
          }
          this.push(null);
        }
      },
    });

    await pipeline(dataStream, copyStream);

    // Insert from staging to production table with ON CONFLICT skip
    const result = await this.client.query(`
      INSERT INTO legal_documents (
        id, "tenantId", title, content, jurisdiction, "documentType",
        source, version, "corpusName", "sourceFile", "contentHash",
        "createdAt", "updatedAt"
      )
      SELECT
        id, "tenantId", title, content, jurisdiction, "documentType",
        source, version, "corpusName", "sourceFile", "contentHash",
        "createdAt", "updatedAt"
      FROM "${tempTable}"
      ON CONFLICT ("contentHash", "tenantId") DO NOTHING
    `);

    // Drop staging table
    await this.client.query(`DROP TABLE IF EXISTS "${tempTable}"`);

    return result.rowCount ?? 0;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a bulk inserter based on the expected corpus size.
 * Uses PostgreSQL COPY for large corpora (>100k records) if a pg client
 * and copy stream factory are provided; otherwise falls back to Prisma.
 */
export function createBulkInserter(
  prismaDelegate: PrismaLegalDocumentDelegate,
  pgClient?: PgPoolClient,
  copyFactory?: CopyStreamFactory,
  useCopy?: boolean,
): BulkInserter {
  if (useCopy && pgClient && copyFactory) {
    return new PostgresCopyInserter(pgClient, copyFactory);
  }
  return new PrismaBulkInserter(prismaDelegate);
}
