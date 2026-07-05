// ============================================================================
// Program 6A — Publication Engine
// Immutable original, working copy, redacted copy, publication copy.
// Publication sets, profiles, full audit trail.
// ============================================================================

import prisma from '../lib/prisma.js';
import { publishRedactionVersion } from './redactionService.js';
import { publishDisclosurePackage } from './disclosureService.js';

export const DOCUMENT_COPY_TYPES = [
  'original',
  'working',
  'redacted',
  'publication',
] as const;

export type DocumentCopyType = (typeof DOCUMENT_COPY_TYPES)[number];

export interface CreateDocumentCopyInput {
  tenantId: string;
  caseId: string;
  documentId: string;
  copyType: DocumentCopyType;
  s3Key?: string;
  parentCopyId?: string;
  redactionId?: string;
  publicationSetId?: string;
  createdById: string;
  immutable?: boolean;
}

export async function logPublicationAudit(
  tenantId: string,
  caseId: string,
  action: string,
  entityType: string,
  entityId: string,
  actorId: string,
  metadata: Record<string, unknown> = {},
) {
  return prisma.publicationAuditLog.create({
    data: {
      tenantId,
      caseId,
      action,
      entityType,
      entityId,
      actorId,
      metadata: JSON.stringify(metadata),
    },
  });
}

export async function createDocumentCopy(input: CreateDocumentCopyInput) {
  if (!DOCUMENT_COPY_TYPES.includes(input.copyType)) {
    throw new Error(`Invalid copy type: ${input.copyType}`);
  }
  const copy = await prisma.documentCopy.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      documentId: input.documentId,
      copyType: input.copyType,
      s3Key: input.s3Key ?? null,
      parentCopyId: input.parentCopyId ?? null,
      redactionId: input.redactionId ?? null,
      publicationSetId: input.publicationSetId ?? null,
      createdById: input.createdById,
      immutable: input.immutable ?? input.copyType === 'original',
    },
  });
  await logPublicationAudit(
    input.tenantId,
    input.caseId,
    'copy_created',
    'document_copy',
    copy.copyId,
    input.createdById,
    { copyType: input.copyType, documentId: input.documentId },
  );
  return copy;
}

export async function ensureDocumentCopyChain(
  tenantId: string,
  caseId: string,
  documentId: string,
  s3Key: string | null,
  createdById: string,
) {
  const existing = await prisma.documentCopy.findFirst({
    where: { tenantId, caseId, documentId, copyType: 'original' },
  });
  if (existing) return existing;

  return createDocumentCopy({
    tenantId,
    caseId,
    documentId,
    copyType: 'original',
    s3Key: s3Key ?? undefined,
    createdById,
    immutable: true,
  });
}

export interface CreatePublicationSetInput {
  tenantId: string;
  caseId: string;
  name: string;
  profileName: string;
  documentIds: string[];
  redactionIds?: Record<string, string>;
  createdById: string;
}

export async function createPublicationSet(input: CreatePublicationSetInput) {
  const set = await prisma.publicationSet.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      name: input.name,
      profileName: input.profileName,
      status: 'draft',
      items: {
        create: input.documentIds.map((documentId) => ({
          documentId,
          redactionId: input.redactionIds?.[documentId] ?? null,
        })),
      },
    },
    include: { items: true },
  });

  await logPublicationAudit(
    input.tenantId,
    input.caseId,
    'set_created',
    'publication_set',
    set.setId,
    input.createdById,
    { name: input.name, profileName: input.profileName, itemCount: input.documentIds.length },
  );

  return set;
}

export async function publishPublicationSet(setId: string, publishedById: string) {
  const set = await prisma.publicationSet.findUnique({
    where: { setId },
    include: { items: true },
  });
  if (!set) throw new Error('Publication set not found');
  if (set.status === 'published') throw new Error('Publication set already published');

  const publishedItems = [];
  for (const item of set.items) {
    let publicationCopyId: string | null = null;

    if (item.redactionId) {
      await publishRedactionVersion(item.redactionId, publishedById);
      const redacted = await createDocumentCopy({
        tenantId: set.tenantId,
        caseId: set.caseId,
        documentId: item.documentId,
        copyType: 'redacted',
        redactionId: item.redactionId,
        publicationSetId: setId,
        createdById: publishedById,
      });
      const publication = await createDocumentCopy({
        tenantId: set.tenantId,
        caseId: set.caseId,
        documentId: item.documentId,
        copyType: 'publication',
        parentCopyId: redacted.copyId,
        redactionId: item.redactionId,
        publicationSetId: setId,
        createdById: publishedById,
      });
      publicationCopyId = publication.copyId;
    } else {
      const publication = await createDocumentCopy({
        tenantId: set.tenantId,
        caseId: set.caseId,
        documentId: item.documentId,
        copyType: 'publication',
        publicationSetId: setId,
        createdById: publishedById,
      });
      publicationCopyId = publication.copyId;
    }

    await prisma.publicationSetItem.update({
      where: { itemId: item.itemId },
      data: { publicationCopyId },
    });
    publishedItems.push({ documentId: item.documentId, publicationCopyId });
  }

  const updated = await prisma.publicationSet.update({
    where: { setId },
    data: {
      status: 'published',
      publishedById,
      publishedAt: new Date(),
    },
    include: { items: true },
  });

  await logPublicationAudit(
    set.tenantId,
    set.caseId,
    'set_published',
    'publication_set',
    setId,
    publishedById,
    { itemCount: set.items.length },
  );

  return { set: updated, publishedItems };
}

export async function listPublicationSets(tenantId: string, caseId: string) {
  return prisma.publicationSet.findMany({
    where: { tenantId, caseId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listDocumentCopies(tenantId: string, caseId: string, documentId: string) {
  return prisma.documentCopy.findMany({
    where: { tenantId, caseId, documentId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function publishDisclosurePackageWithAudit(packageId: string, actorId: string) {
  const pkg = await publishDisclosurePackage(packageId);
  await logPublicationAudit(
    pkg.tenantId,
    pkg.caseId,
    'disclosure_published',
    'disclosure_package',
    packageId,
    actorId,
    { recipientType: pkg.recipientType, documentId: pkg.documentId },
  );
  return pkg;
}

export async function publishRedactionWithAudit(redactionId: string, actorId: string) {
  const redaction = await publishRedactionVersion(redactionId, actorId);
  await logPublicationAudit(
    redaction.tenantId,
    redaction.caseId,
    'redaction_published',
    'document_redaction',
    redactionId,
    actorId,
    { profileName: redaction.profileName, documentId: redaction.documentId },
  );
  return redaction;
}
