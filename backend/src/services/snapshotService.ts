// ============================================
// Court Access — Snapshot Service
// ============================================

import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';
import { computeSnapshotHash } from '../engines/intelligenceEngine.js';

export interface CreateSnapshotInput {
  documentId: string;
  modelVersion: string;
  analysisData: Record<string, unknown>;
}

export async function createSnapshot(input: CreateSnapshotInput) {
  const snapshotHash = computeSnapshotHash(input.analysisData);

  const snapshot = await prisma.snapshot.create({
    data: {
      documentId: input.documentId,
      snapshotHash,
      modelVersion: input.modelVersion,
      analysisJson: input.analysisData as Prisma.InputJsonValue,
    },
  });

  logger.info('Snapshot created', {
    snapshotId: snapshot.id,
    documentId: input.documentId,
    modelVersion: input.modelVersion,
  });

  return snapshot;
}

export async function getSnapshotsByDocument(documentId: string) {
  return prisma.snapshot.findMany({
    where: { documentId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSnapshotById(snapshotId: string) {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) {
    throw new AppError('Snapshot not found', 404);
  }
  return snapshot;
}
