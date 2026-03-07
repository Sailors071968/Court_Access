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

  // Check for duplicate
  const existing = await prisma.verifiedFact.findFirst({
    where: { factHash },
  });

  if (existing) {
    console.log(`[VFR] Duplicate fact detected: ${factHash.substring(0, 12)}`);
    return existing;
  }

  const record = await prisma.verifiedFact.create({
    data: {
      caseId,
      factHash,
      factText,
      factType,
      normalizedValue: normalizedValue || factText.toLowerCase().trim(),
      documentId,
      page: page || null,
      line: line || null,
      timestamp: timestamp ? new Date(timestamp) : null,
      speaker: speaker || null,
      confidence: confidence || 0.5,
      extractionMethod: extractionMethod || 'pattern_matching',
      verificationStatus: 'unverified',
      metadata,
    },
  });

  // Create initial revision
  await prisma.factRevision.create({
    data: {
      verifiedFactId: record.id,
      revisionNumber: 1,
      changeType: 'created',
      previousValue: null,
      newValue: { factText, factType, normalizedValue, confidence },
      changedBy: 'system',
      reason: 'Initial extraction',
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

  const revisionCount = await prisma.factRevision.count({ where: { verifiedFactId: factId } });

  await prisma.factRevision.create({
    data: {
      verifiedFactId: factId,
      revisionNumber: revisionCount + 1,
      changeType: 'status_change',
      previousValue: { verificationStatus: fact.verificationStatus },
      newValue: { verificationStatus: newStatus },
      changedBy,
      reason,
    },
  });

  const updated = await prisma.verifiedFact.update({
    where: { id: factId },
    data: { verificationStatus: newStatus },
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
  if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
  if (filters.speaker) where.speaker = { contains: filters.speaker, mode: 'insensitive' };
  if (filters.documentId) where.documentId = filters.documentId;
  if (filters.minConfidence) where.confidence = { gte: filters.minConfidence };

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
    where: { verifiedFactId: factId },
    orderBy: { revisionNumber: 'asc' },
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
    byStatus[fact.verificationStatus] = (byStatus[fact.verificationStatus] || 0) + 1;
    byDocument[fact.documentId] = (byDocument[fact.documentId] || 0) + 1;
    totalConfidence += fact.confidence;
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
