// ============================================
// Court Access — Verified Fact Registry (VFR)
// Phase A: Canonical database of verified facts
//
// Every fact has full provenance:
// document_id, page, line, timestamp, speaker, confidence
// Facts are never altered — tracked via FactRevision
// ============================================

import prisma from './prismaClient.js';
import crypto from 'crypto';

/**
 * Register a verified fact in the VFR.
 * @param {object} params
 * @returns {object} VerifiedFact record
 */
export async function registerVerifiedFact({
  caseId,
  factText,
  factType,
  normalizedValue,
  documentId,
  page,
  line,
  timestamp,
  speaker,
  confidence,
  extractionMethod,
  metadata = {},
}) {
  const factHash = crypto.createHash('sha256')
    .update(`${caseId}:${factText}:${documentId}:${page}:${line}`)
    .digest('hex');

  // Check for duplicate via hash stored in metadata
  const existing = await prisma.verifiedFact.findFirst({
    where: { caseId, statementText: factText, sourceDocumentId: documentId },
  });

  if (existing) {
    console.log(`[VFR] Duplicate fact detected: ${factHash.substring(0, 12)}`);
    return existing;
  }

  const record = await prisma.verifiedFact.create({
    data: {
      caseId,
      statementText: factText,
      factType,
      normalizedValue: normalizedValue || factText.toLowerCase().trim(),
      sourceDocumentId: documentId,
      pageNumber: page || null,
      lineNumber: line || null,
      timestamp: timestamp ? new Date(timestamp) : null,
      speaker: speaker || '',
      confidenceScore: confidence || 0.5,
      metadata: {
        ...metadata,
        factHash,
        extractionMethod: extractionMethod || 'pattern_matching',
        verificationStatus: 'unverified',
      },
    },
  });

  // Create initial revision
  await prisma.factRevision.create({
    data: {
      factId: record.id,
      previousConfidence: 0,
      newConfidence: confidence || 0.5,
      reason: 'Initial extraction',
      sourceDocumentId: documentId,
      metadata: {
        changeType: 'created',
        factText,
        factType,
        normalizedValue,
        changedBy: 'system',
      },
    },
  });

  console.log(`[VFR] Registered fact: ${factType} — "${factText.substring(0, 60)}" (${confidence})`);
  return record;
}

/**
 * Update a verified fact's status (creates a revision, never alters original).
 * @param {string} factId
 * @param {string} newStatus - 'verified', 'disputed', 'retracted'
 * @param {string} changedBy
 * @param {string} reason
 * @returns {object} Updated VerifiedFact
 */
export async function updateFactStatus(factId, newStatus, changedBy, reason) {
  const fact = await prisma.verifiedFact.findUnique({ where: { id: factId } });
  if (!fact) throw new Error(`Fact ${factId} not found`);

  const previousStatus = fact.metadata?.verificationStatus || 'unverified';

  await prisma.factRevision.create({
    data: {
      factId,
      previousConfidence: fact.confidenceScore,
      newConfidence: fact.confidenceScore,
      reason,
      sourceDocumentId: fact.sourceDocumentId,
      metadata: {
        changeType: 'status_change',
        previousStatus,
        newStatus,
        changedBy,
      },
    },
  });

  const updated = await prisma.verifiedFact.update({
    where: { id: factId },
    data: {
      metadata: {
        ...((fact.metadata && typeof fact.metadata === 'object') ? fact.metadata : {}),
        verificationStatus: newStatus,
      },
    },
  });

  console.log(`[VFR] Fact ${factId} status: ${fact.verificationStatus} → ${newStatus} by ${changedBy}`);
  return updated;
}

/**
 * Get all verified facts for a case.
 * @param {string} caseId
 * @param {object} [filters]
 * @returns {object[]} VerifiedFact records
 */
export async function getCaseVerifiedFacts(caseId, filters = {}) {
  const where = { caseId };
  if (filters.factType) where.factType = filters.factType;
  if (filters.speaker) where.speaker = { contains: filters.speaker, mode: 'insensitive' };
  if (filters.documentId) where.sourceDocumentId = filters.documentId;
  if (filters.minConfidence) where.confidenceScore = { gte: filters.minConfidence };

  return prisma.verifiedFact.findMany({
    where,
    orderBy: filters.orderBy || { createdAt: 'desc' },
    take: filters.limit || 500,
  });
}

/**
 * Get fact revision history.
 * @param {string} factId
 * @returns {object[]} FactRevision records
 */
export async function getFactRevisions(factId) {
  return prisma.factRevision.findMany({
    where: { factId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get VFR summary for a case.
 * @param {string} caseId
 * @returns {object} Summary
 */
export async function getVFRSummary(caseId) {
  const facts = await prisma.verifiedFact.findMany({ where: { caseId } });

  const byType = {};
  const byStatus = {};
  const byDocument = {};
  let totalConfidence = 0;

  for (const fact of facts) {
    byType[fact.factType] = (byType[fact.factType] || 0) + 1;
    const status = fact.metadata?.verificationStatus || 'unverified';
    byStatus[status] = (byStatus[status] || 0) + 1;
    byDocument[fact.sourceDocumentId] = (byDocument[fact.sourceDocumentId] || 0) + 1;
    totalConfidence += fact.confidenceScore;
  }

  return {
    caseId,
    totalFacts: facts.length,
    byType,
    byStatus,
    byDocument,
    avgConfidence: facts.length > 0 ? Math.round((totalConfidence / facts.length) * 100) / 100 : 0,
    uniqueDocuments: Object.keys(byDocument).length,
    uniqueSpeakers: [...new Set(facts.filter(f => f.speaker).map(f => f.speaker))].length,
  };
}
