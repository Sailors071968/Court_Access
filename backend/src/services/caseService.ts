// ============================================
// Court Access — Case Service
// ============================================

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../config/logger.js';

export interface CreateCaseInput {
  tenantId: string;
  title: string;
  caseNumber?: string;
}

export async function createCase(input: CreateCaseInput) {
  const newCase = await prisma.case.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      caseNumber: input.caseNumber || null,
    },
  });

  logger.info('Case created', { caseId: newCase.id, tenantId: input.tenantId });
  return newCase;
}

export async function listCases(tenantId: string) {
  return prisma.case.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCaseById(caseId: string, tenantId: string) {
  const result = await prisma.case.findFirst({
    where: { id: caseId, tenantId },
  });
  if (!result) {
    throw new AppError('Case not found', 404);
  }
  return result;
}
