// ============================================================================
// Program 1 — Document Redaction Service
// Original evidence remains immutable. Redacted copies are versioned separately.
// ============================================================================

import prisma from '../lib/prisma.js';

const PUBLICATION_PROFILES = [
  'attorney',
  'client',
  'investigator',
  'secretary',
  'family',
  'expert',
  'court',
  'public',
] as const;

export type PublicationProfile = (typeof PUBLICATION_PROFILES)[number];

export interface CreateRedactionInput {
  tenantId: string;
  caseId: string;
  documentId: string;
  profileName: string;
  createdById: string;
  redactionData: unknown[];
}

export async function createRedactionVersion(input: CreateRedactionInput) {
  if (!PUBLICATION_PROFILES.includes(input.profileName as PublicationProfile)) {
    throw new Error(`Invalid publication profile: ${input.profileName}`);
  }

  const latest = await prisma.documentRedactionVersion.findFirst({
    where: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      profileName: input.profileName,
    },
    orderBy: { versionNumber: 'desc' },
  });

  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  return prisma.documentRedactionVersion.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      profileName: input.profileName,
      versionNumber,
      createdById: input.createdById,
      redactionData: JSON.stringify(input.redactionData),
      status: 'draft',
    },
  });
}

export async function listRedactionVersions(tenantId: string, caseId: string, documentId: string) {
  return prisma.documentRedactionVersion.findMany({
    where: { tenantId, caseId, documentId },
    orderBy: [{ profileName: 'asc' }, { versionNumber: 'desc' }],
    select: {
      redactionId: true,
      profileName: true,
      versionNumber: true,
      status: true,
      createdAt: true,
      approvedById: true,
      // redactionData omitted for non-admin recipients (non-disclosure)
    },
  });
}

export async function publishRedactionVersion(redactionId: string, approvedById: string) {
  return prisma.documentRedactionVersion.update({
    where: { redactionId },
    data: { status: 'published', approvedById },
  });
}

export const AI_REDACTION_CATEGORIES = [
  'victim_names',
  'witness_names',
  'date_of_birth',
  'ssn',
  'addresses',
  'phone_numbers',
  'medical',
  'financial',
  'juvenile_identifiers',
  'confidential_informants',
  'attorney_work_product',
] as const;
