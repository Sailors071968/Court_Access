// ============================================
// Court Access — Output Deduplication Service
// Phase L: Hash output results, compare with previous
// outputs, suppress duplicates
// ============================================

import prisma from './prismaClient.js';
import crypto from 'crypto';

/**
 * Check if an output is a duplicate.
 * @param {string} caseId
 * @param {string} outputType
 * @param {string|object} outputContent
 * @returns {{ isDuplicate: boolean, existingId?: string }}
 */
export async function checkOutputDuplicate(caseId, outputType, outputContent) {
  const contentStr = typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent);
  const outputHash = crypto.createHash('sha256').update(contentStr).digest('hex');

  const existing = await prisma.outputHash.findFirst({
    where: { caseId, outputType, outputHash },
  });

  if (existing) {
    console.log(`[OutputDedup] Duplicate ${outputType} detected for case ${caseId}`);
    return { isDuplicate: true, existingId: existing.id, existingHash: existing.outputHash };
  }

  return { isDuplicate: false };
}

/**
 * Register an output hash to prevent future duplicates.
 * @param {string} caseId
 * @param {string} outputType
 * @param {string|object} outputContent
 * @param {string} [entityId] - ID of the created entity
 * @returns {object} OutputHash record
 */
export async function registerOutput(caseId, outputType, outputContent, entityId = null) {
  const contentStr = typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent);
  const outputHash = crypto.createHash('sha256').update(contentStr).digest('hex');

  // Check for existing
  const existing = await prisma.outputHash.findFirst({
    where: { caseId, outputType, outputHash },
  });

  if (existing) {
    return existing;
  }

  const record = await prisma.outputHash.create({
    data: {
      caseId,
      outputType,
      outputHash,
      entityId,
      contentPreview: contentStr.substring(0, 500),
      metadata: { registeredAt: new Date().toISOString() },
    },
  });

  return record;
}

/**
 * Deduplicate an array of outputs, removing those already registered.
 * @param {string} caseId
 * @param {string} outputType
 * @param {object[]} outputs
 * @param {Function} contentExtractor - Function to extract content string from each output
 * @returns {{ unique: object[], duplicates: number }}
 */
export async function deduplicateOutputs(caseId, outputType, outputs, contentExtractor) {
  const existingHashes = await prisma.outputHash.findMany({
    where: { caseId, outputType },
    select: { outputHash: true },
  });

  const hashSet = new Set(existingHashes.map(h => h.outputHash));
  const unique = [];
  let duplicates = 0;

  for (const output of outputs) {
    const content = contentExtractor(output);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    if (hashSet.has(hash)) {
      duplicates++;
    } else {
      unique.push(output);
      hashSet.add(hash);
    }
  }

  console.log(`[OutputDedup] ${duplicates} duplicates suppressed, ${unique.length} unique for case ${caseId}`);

  return { unique, duplicates };
}

/**
 * Get output dedup stats for a case.
 * @param {string} caseId
 * @returns {object} Dedup summary
 */
export async function getOutputDedupStats(caseId) {
  const hashes = await prisma.outputHash.findMany({
    where: { caseId },
  });

  const byType = {};
  for (const hash of hashes) {
    byType[hash.outputType] = (byType[hash.outputType] || 0) + 1;
  }

  return {
    caseId,
    totalOutputs: hashes.length,
    byType,
  };
}
