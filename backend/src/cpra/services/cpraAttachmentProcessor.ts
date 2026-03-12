// ============================================================================
// Autonomous CPRA System — Attachment Processor
// Downloads, uploads to R2, classifies documents, and triggers ingestion.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createNotification } from './cpraNotificationService.js';
import { addTimelineEvent } from './cpraTimelineService.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// R2 Configuration
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'courtaccess-policies';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentClassification =
  | 'policy_document'
  | 'procedural_manual'
  | 'training_bulletin'
  | 'general_response'
  | 'non_policy';

export interface AttachmentProcessResult {
  attachmentId: string;
  fileName: string;
  fileUrl: string | null;
  documentType: DocumentClassification | null;
  policyTopic: string | null;
  status: string;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Upload attachment to R2
// ---------------------------------------------------------------------------

export async function uploadAttachmentToR2(
  attachmentId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ fileUrl: string | null; error: string | null }> {
  try {
    const r2Key = `cpra-attachments/${new Date().toISOString().slice(0, 10)}/${attachmentId}/${fileName}`;
    const r2 = getR2Client();

    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    const fileUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${r2Key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${r2Key}`;

    // Update attachment record
    await prisma.cpraEmailAttachment.update({
      where: { attachmentId },
      data: {
        fileUrl,
        uploadTimestamp: new Date(),
        processingStatus: 'uploaded',
      },
    });

    return { fileUrl, error: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CPRA Attachment] R2 upload failed for ${fileName}: ${msg}`);

    await prisma.cpraEmailAttachment.update({
      where: { attachmentId },
      data: { processingStatus: 'failed' },
    });

    return { fileUrl: null, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Classify document type using heuristics (OpenAI fallback available)
// ---------------------------------------------------------------------------

const POLICY_KEYWORDS = [
  'policy', 'procedure', 'general order', 'special order', 'directive',
  'use of force', 'body worn camera', 'body camera', 'pursuit',
  'search and seizure', 'evidence handling', 'discipline', 'internal affairs',
  'miranda', 'arrest', 'detention', 'report writing', 'training bulletin',
  'operational manual', 'department manual', 'standard operating',
  'rules and regulations', 'code of conduct',
];

const TRAINING_KEYWORDS = [
  'training bulletin', 'training manual', 'lesson plan', 'curriculum',
  'academy', 'in-service training', 'roll call training',
];

const PROCEDURAL_KEYWORDS = [
  'procedures manual', 'operations manual', 'field manual',
  'tactical manual', 'reference guide', 'handbook',
];

export function classifyDocumentType(
  fileName: string,
  textContent?: string,
): { documentType: DocumentClassification; confidence: number } {
  const lowerName = fileName.toLowerCase();
  const lowerContent = (textContent ?? '').toLowerCase();
  const combined = `${lowerName} ${lowerContent}`;

  // Check for training bulletins first (more specific)
  if (TRAINING_KEYWORDS.some((kw) => combined.includes(kw))) {
    return { documentType: 'training_bulletin', confidence: 0.85 };
  }

  // Check for procedural manuals
  if (PROCEDURAL_KEYWORDS.some((kw) => combined.includes(kw))) {
    return { documentType: 'procedural_manual', confidence: 0.8 };
  }

  // Check for policy documents
  if (POLICY_KEYWORDS.some((kw) => combined.includes(kw))) {
    return { documentType: 'policy_document', confidence: 0.8 };
  }

  // Check file extension for common policy formats
  if (lowerName.endsWith('.pdf') || lowerName.endsWith('.docx')) {
    return { documentType: 'general_response', confidence: 0.5 };
  }

  return { documentType: 'non_policy', confidence: 0.6 };
}

// ---------------------------------------------------------------------------
// Process a single attachment: classify + update status
// ---------------------------------------------------------------------------

export async function processAttachment(
  attachmentId: string,
): Promise<AttachmentProcessResult> {
  const attachment = await prisma.cpraEmailAttachment.findUnique({
    where: { attachmentId },
    include: { Email: true },
  });

  if (!attachment) {
    return {
      attachmentId,
      fileName: '',
      fileUrl: null,
      documentType: null,
      policyTopic: null,
      status: 'failed',
      error: 'Attachment not found',
    };
  }

  // Classify document type
  const { documentType, confidence } = classifyDocumentType(
    attachment.fileName,
    attachment.Email.body,
  );

  // Update attachment with classification
  await prisma.cpraEmailAttachment.update({
    where: { attachmentId },
    data: {
      documentType,
      classificationConfidence: confidence,
      processingStatus: documentType === 'non_policy' ? 'classified' : 'classified',
    },
  });

  const agencyId = attachment.Email.agencyId;

  // Create notification for document upload
  if (agencyId && documentType !== 'non_policy') {
    await createNotification({
      agencyId,
      eventType: 'DOCUMENT_UPLOADED',
      title: `Document classified: ${attachment.fileName}`,
      message: `Attachment "${attachment.fileName}" classified as ${documentType} (confidence: ${(confidence * 100).toFixed(0)}%)`,
      metadata: { attachmentId, documentType, confidence },
    });

    await addTimelineEvent({
      agencyId,
      eventType: 'ATTACHMENT_DETECTED',
      title: `Attachment detected: ${attachment.fileName}`,
      description: `Document type: ${documentType}`,
      metadata: { attachmentId, fileName: attachment.fileName, documentType },
    });
  }

  return {
    attachmentId,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    documentType,
    policyTopic: attachment.policyTopicDetected,
    status: 'classified',
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Process all pending attachments
// ---------------------------------------------------------------------------

export async function processAllPendingAttachments(): Promise<{
  processed: number;
  failed: number;
  results: AttachmentProcessResult[];
}> {
  const pending = await prisma.cpraEmailAttachment.findMany({
    where: { processingStatus: 'pending' },
    take: 50,
  });

  const results: AttachmentProcessResult[] = [];
  let failed = 0;

  for (const attachment of pending) {
    const result = await processAttachment(attachment.attachmentId);
    results.push(result);
    if (result.error) failed++;
  }

  return { processed: results.length, failed, results };
}
