// ============================================
// Court Access — Analysis Service
// ============================================

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { analysisResults, documents } from '../models/schema.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/loggingUtils.js';
import { computeSHA256, computeSHA3_256 } from '../utils/hashUtils.js';

export interface AnalysisInput {
  documentId: string;
  caseId: string;
  tenantId: string;
  analysisData: Record<string, unknown>;
  modelVersion: string;
}

/**
 * Store analysis result (tenant-scoped).
 * Computes snapshot hash for integrity verification.
 */
export async function storeAnalysisResult(input: AnalysisInput) {
  const canonicalJson = JSON.stringify(input.analysisData);
  const snapshotHash = computeSHA256(canonicalJson);

  const [result] = await db
    .insert(analysisResults)
    .values({
      documentId: input.documentId,
      caseId: input.caseId,
      tenantId: input.tenantId,
      analysisSnapshotHash: snapshotHash,
      analysisDataJson: input.analysisData,
      modelVersion: input.modelVersion,
      constitutionStatus: 'PASS',
    })
    .returning();

  // Update document analysis status
  await db
    .update(documents)
    .set({ analysisStatus: 'analyzed' })
    .where(eq(documents.id, input.documentId));

  logger.info('Analysis result stored', {
    analysisId: result.id,
    documentId: input.documentId,
    tenantId: input.tenantId,
  });

  return result;
}

/**
 * Get analysis result for a document (tenant-scoped).
 */
export async function getAnalysisResult(documentId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(analysisResults)
    .where(and(eq(analysisResults.documentId, documentId), eq(analysisResults.tenantId, tenantId)))
    .orderBy(desc(analysisResults.createdAt))
    .limit(1);

  if (!result) {
    throw new AppError('Analysis result not found', 404);
  }
  return result;
}

/**
 * Get analysis result by ID (tenant-scoped).
 */
export async function getAnalysisResultById(analysisId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(analysisResults)
    .where(and(eq(analysisResults.id, analysisId), eq(analysisResults.tenantId, tenantId)))
    .limit(1);

  if (!result) {
    throw new AppError('Analysis result not found', 404);
  }
  return result;
}

/**
 * Verify analysis result integrity by recomputing hash.
 */
export function verifyAnalysisIntegrity(
  analysisData: Record<string, unknown>,
  storedHash: string
): 'PASS' | 'FAIL' {
  const canonicalJson = JSON.stringify(analysisData);
  const recomputedHash = computeSHA256(canonicalJson);
  return recomputedHash === storedHash ? 'PASS' : 'FAIL';
}
