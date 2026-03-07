// ============================================
// Court Access — Evidence Integrity Service
// Phase 120: Evidence Registry System
//
// SHA-256 hashing, chain of custody tracking,
// and evidence registration for every uploaded file.
// ============================================

import crypto from 'crypto';
import prisma from './prismaClient.js';

// ---------------------------------------------------------------------------
// Evidence Type Constants
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPES = {
  POLICE_REPORT: 'POLICE_REPORT',
  TRANSCRIPT: 'TRANSCRIPT',
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  PHONE_RECORD: 'PHONE_RECORD',
  GPS_LOG: 'GPS_LOG',
  COURT_DOCUMENT: 'COURT_DOCUMENT',
  OTHER: 'OTHER',
};

// ---------------------------------------------------------------------------
// SHA-256 Hash Computation
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a file buffer.
 * @param {Buffer} fileBuffer
 * @returns {string} hex-encoded SHA-256
 */
export function computeSHA256(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Register Evidence
// ---------------------------------------------------------------------------

/**
 * Register a new piece of evidence in the registry.
 * Every file receives: evidence_id, case_id, hash, source, metadata.
 *
 * @param {object} params
 * @param {string} params.evidenceId
 * @param {string} params.caseId
 * @param {Buffer} params.fileBuffer
 * @param {string} params.originalFilename
 * @param {string} params.evidenceType
 * @param {string} [params.source]
 * @param {object} [params.metadata]
 * @param {string} [params.actor]
 * @returns {object} EvidenceRegistry record
 */
export async function registerEvidence({
  evidenceId,
  caseId,
  fileBuffer,
  originalFilename,
  evidenceType,
  source = '',
  metadata = {},
  actor = 'system',
}) {
  const fileHash = computeSHA256(fileBuffer);

  const chainEntry = {
    actor,
    action: 'registered',
    timestamp: new Date().toISOString(),
    hash: fileHash,
  };

  const registry = await prisma.evidenceRegistry.upsert({
    where: { evidenceId },
    create: {
      evidenceId,
      caseId,
      fileHash,
      originalFilename,
      evidenceType: EVIDENCE_TYPES[evidenceType] || EVIDENCE_TYPES.OTHER,
      source,
      chainOfCustody: [chainEntry],
      metadata,
    },
    update: {
      fileHash,
      originalFilename,
      evidenceType: EVIDENCE_TYPES[evidenceType] || EVIDENCE_TYPES.OTHER,
      source,
      metadata,
    },
  });

  console.log(`[EvidenceRegistry] Registered evidence ${evidenceId} for case ${caseId} — hash: ${fileHash.substring(0, 16)}...`);
  return registry;
}

// ---------------------------------------------------------------------------
// Verify Evidence Integrity
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of an evidence file against its stored hash.
 * @param {string} evidenceId
 * @param {Buffer} fileBuffer
 * @returns {{ valid: boolean, storedHash: string, computedHash: string }}
 */
export async function verifyIntegrity(evidenceId, fileBuffer) {
  const registry = await prisma.evidenceRegistry.findUnique({
    where: { evidenceId },
  });

  if (!registry) {
    return { valid: false, storedHash: null, computedHash: null, error: 'Evidence not found in registry' };
  }

  const computedHash = computeSHA256(fileBuffer);
  const valid = computedHash === registry.fileHash;

  return {
    valid,
    storedHash: registry.fileHash,
    computedHash,
  };
}

// ---------------------------------------------------------------------------
// Chain of Custody Management
// ---------------------------------------------------------------------------

/**
 * Append a custody event to an evidence record.
 * @param {string} evidenceId
 * @param {{ actor: string, action: string }} custodyEvent
 * @returns {object} Updated registry record
 */
export async function appendCustodyEvent(evidenceId, custodyEvent) {
  const registry = await prisma.evidenceRegistry.findUnique({
    where: { evidenceId },
  });

  if (!registry) {
    throw new Error(`Evidence ${evidenceId} not found in registry`);
  }

  const chain = Array.isArray(registry.chainOfCustody) ? registry.chainOfCustody : [];
  chain.push({
    ...custodyEvent,
    timestamp: new Date().toISOString(),
  });

  return prisma.evidenceRegistry.update({
    where: { evidenceId },
    data: { chainOfCustody: chain },
  });
}

/**
 * Get the full chain of custody for evidence.
 * @param {string} evidenceId
 * @returns {object[]} Chain of custody entries
 */
export async function getChainOfCustody(evidenceId) {
  const registry = await prisma.evidenceRegistry.findUnique({
    where: { evidenceId },
  });

  if (!registry) return [];
  return Array.isArray(registry.chainOfCustody) ? registry.chainOfCustody : [];
}

// ---------------------------------------------------------------------------
// Registry Queries
// ---------------------------------------------------------------------------

/**
 * Get all evidence for a case from the registry.
 * @param {string} caseId
 * @returns {object[]}
 */
export async function getCaseEvidence(caseId) {
  return prisma.evidenceRegistry.findMany({
    where: { caseId },
    orderBy: { uploadTimestamp: 'desc' },
  });
}

/**
 * Find evidence by hash (detect duplicates).
 * @param {string} fileHash
 * @returns {object[]}
 */
export async function findByHash(fileHash) {
  return prisma.evidenceRegistry.findMany({
    where: { fileHash },
  });
}
