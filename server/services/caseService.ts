// ============================================
// Court Access — Case Service
// ============================================

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { cases } from '../models/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';

export interface CreateCaseInput {
  tenantId: string;
  caseName: string;
  caseNumber?: string;
  jurisdiction?: string;
  court?: string;
  judge?: string;
}

/**
 * Create a new case (tenant-scoped).
 */
export async function createCase(input: CreateCaseInput) {
  const [newCase] = await db
    .insert(cases)
    .values({
      tenantId: input.tenantId,
      caseName: input.caseName,
      caseNumber: input.caseNumber || null,
      jurisdiction: input.jurisdiction || null,
      court: input.court || null,
      judge: input.judge || null,
    })
    .returning();

  logger.info('Case created', { caseId: newCase.id, tenantId: input.tenantId });
  return newCase;
}

/**
 * List all cases for a tenant.
 */
export async function listCases(tenantId: string) {
  return db
    .select()
    .from(cases)
    .where(eq(cases.tenantId, tenantId))
    .orderBy(desc(cases.createdAt));
}

/**
 * Get a single case by ID (tenant-scoped).
 */
export async function getCaseById(caseId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.tenantId, tenantId)))
    .limit(1);

  if (!result) {
    throw new AppError('Case not found', 404);
  }
  return result;
}

/**
 * Update a case (tenant-scoped).
 */
export async function updateCase(
  caseId: string,
  tenantId: string,
  updates: Partial<Pick<CreateCaseInput, 'caseName' | 'caseNumber' | 'jurisdiction' | 'court' | 'judge'>>
) {
  const existing = await getCaseById(caseId, tenantId);
  if (!existing) {
    throw new AppError('Case not found', 404);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.caseName !== undefined) updateData.caseName = updates.caseName;
  if (updates.caseNumber !== undefined) updateData.caseNumber = updates.caseNumber;
  if (updates.jurisdiction !== undefined) updateData.jurisdiction = updates.jurisdiction;
  if (updates.court !== undefined) updateData.court = updates.court;
  if (updates.judge !== undefined) updateData.judge = updates.judge;

  const [updated] = await db
    .update(cases)
    .set(updateData)
    .where(and(eq(cases.id, caseId), eq(cases.tenantId, tenantId)))
    .returning();

  logger.info('Case updated', { caseId, tenantId });
  return updated;
}
