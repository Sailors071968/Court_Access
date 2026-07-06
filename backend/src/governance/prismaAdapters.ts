// ============================================
// Prisma adapters for corpus governance repositories
// ============================================

import type { PrismaClient } from '@prisma/client';
import type { CorpusRegistryDb, CorpusRegistryRecord } from './corpusRegistry.ts';
import type { CorpusLockDb, CorpusLockRecord } from './corpusLock.ts';

export function createPrismaRegistryDb(prisma: PrismaClient): CorpusRegistryDb {
  return {
    async findUnique(args) {
      const row = await prisma.corpusRegistry.findUnique({
        where: {
          corpusName_version: {
            corpusName: args.where.corpusName_version.corpusName,
            version: args.where.corpusName_version.version,
          },
        },
      });
      return row ? mapRegistryRow(row) : null;
    },
    async findMany(args) {
      const rows = await prisma.corpusRegistry.findMany({
        where: {
          corpusName: args?.where?.corpusName,
          jurisdiction: args?.where?.jurisdiction,
          ingestionStatus: args?.where?.ingestionStatus,
        },
        orderBy: { createdAt: args?.orderBy?.createdAt ?? 'asc' },
      });
      return rows.map(mapRegistryRow);
    },
    async create(args) {
      const row = await prisma.corpusRegistry.create({
        data: {
          corpusName: args.data.corpusName,
          jurisdiction: args.data.jurisdiction,
          sourceAuthority: args.data.sourceAuthority,
          version: args.data.version,
          releaseDate: args.data.releaseDate,
          ingestionStatus: args.data.ingestionStatus,
          totalDocuments: args.data.totalDocuments,
          totalBytes: BigInt(args.data.totalBytes),
          checksum: args.data.checksum,
          metadata: args.data.metadata,
        },
      });
      return mapRegistryRow(row);
    },
    async update(args) {
      const row = await prisma.corpusRegistry.update({
        where: {
          corpusName_version: {
            corpusName: args.where.corpusName_version.corpusName,
            version: args.where.corpusName_version.version,
          },
        },
        data: {
          jurisdiction: args.data.jurisdiction,
          sourceAuthority: args.data.sourceAuthority,
          releaseDate: args.data.releaseDate,
          ingestionStatus: args.data.ingestionStatus,
          totalDocuments: args.data.totalDocuments,
          totalBytes: args.data.totalBytes !== undefined ? BigInt(args.data.totalBytes) : undefined,
          checksum: args.data.checksum,
          metadata: args.data.metadata,
        },
      });
      return mapRegistryRow(row);
    },
    async count(args) {
      return prisma.corpusRegistry.count({
        where: {
          corpusName: args?.where?.corpusName,
          ingestionStatus: args?.where?.ingestionStatus,
        },
      });
    },
  };
}

export function createPrismaLockDb(prisma: PrismaClient): CorpusLockDb {
  return {
    async findUnique(args) {
      const row = await prisma.corpusIngestionLock.findUnique({
        where: { corpusName: args.where.corpusName },
      });
      return row ? mapLockRow(row) : null;
    },
    async create(args) {
      const row = await prisma.corpusIngestionLock.create({ data: args.data });
      return mapLockRow(row);
    },
    async update(args) {
      const row = await prisma.corpusIngestionLock.update({
        where: { corpusName: args.where.corpusName },
        data: args.data,
      });
      return mapLockRow(row);
    },
    async updateMany(args) {
      const result = await prisma.corpusIngestionLock.updateMany({
        where: {
          corpusName: args.where.corpusName,
          workerId: args.where.workerId,
          expiresAt: args.where.expiresAt,
        },
        data: args.data,
      });
      return { count: result.count };
    },
    async delete(args) {
      const row = await prisma.corpusIngestionLock.delete({
        where: { corpusName: args.where.corpusName },
      });
      return mapLockRow(row);
    },
    async deleteMany(args) {
      const result = await prisma.corpusIngestionLock.deleteMany({ where: args.where as never });
      return { count: result.count };
    },
  };
}

function mapRegistryRow(row: {
  id: string;
  corpusName: string;
  jurisdiction: string;
  sourceAuthority: string;
  version: string;
  releaseDate: Date | null;
  ingestionStatus: string;
  totalDocuments: number;
  totalBytes: bigint;
  checksum: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CorpusRegistryRecord {
  return {
    id: row.id,
    corpusName: row.corpusName,
    jurisdiction: row.jurisdiction,
    sourceAuthority: row.sourceAuthority,
    version: row.version,
    releaseDate: row.releaseDate,
    ingestionStatus: row.ingestionStatus,
    totalDocuments: row.totalDocuments,
    totalBytes: Number(row.totalBytes),
    checksum: row.checksum,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLockRow(row: {
  id: string;
  corpusName: string;
  workerId: string;
  lockedAt: Date;
  expiresAt: Date;
  metadata: string | null;
}): CorpusLockRecord {
  return {
    id: row.id,
    corpusName: row.corpusName,
    workerId: row.workerId,
    lockedAt: row.lockedAt,
    expiresAt: row.expiresAt,
    metadata: row.metadata,
  };
}
