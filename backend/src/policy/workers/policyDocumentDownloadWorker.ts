// ---------------------------------------------------------------------------
// Phase 14 — Policy Document Download Pipeline
// Steps: download document → verify mime type → store in S3 → create
//        PolicyDocument record → enqueue OCR job
// S3 structure: /agencies/{agencyId}/policies/{documentId}.pdf
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { Worker, Queue, Job } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import https from 'node:https';
import http from 'node:http';
import { DEFAULT_CRAWLER_CONFIG } from '../agencyRegistry/types.js';

const prisma = new PrismaClient();

const S3_BUCKET = process.env.S3_POLICY_BUCKET ?? 'courtaccess-policy-library';
const S3_REGION = process.env.AWS_REGION ?? 'us-west-2';

export const POLICY_DOWNLOAD_QUEUE = 'policy-download-queue';
export const OCR_PROCESSING_QUEUE = 'policy-ocr-processing-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyDownloadJobData {
  documentId: string;
  agencyId: string;
  sourceUrl: string;
  title: string | null;
  expectedMimeType: string | null;
}

export interface PolicyDownloadResult {
  documentId: string;
  agencyId: string;
  s3Url: string | null;
  mimeType: string;
  fileSizeBytes: number;
  downloaded: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// MIME type detection from buffer
// ---------------------------------------------------------------------------

function detectMimeType(buffer: Buffer, fallbackType: string | null): string {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return 'application/msword';
  }
  return fallbackType ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// File extension from MIME type
// ---------------------------------------------------------------------------

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.includes('wordprocessingml')) return '.docx';
  if (mimeType.includes('msword')) return '.doc';
  return '';
}

// ---------------------------------------------------------------------------
// Download file with redirect limit and response cleanup
// ---------------------------------------------------------------------------

async function downloadDocument(
  url: string,
  maxSizeBytes: number = DEFAULT_CRAWLER_CONFIG.maxDocumentSizeBytes,
  maxRedirects: number = 5,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(
      url,
      {
        headers: { 'User-Agent': DEFAULT_CRAWLER_CONFIG.userAgent },
        timeout: DEFAULT_CRAWLER_CONFIG.requestTimeoutMs,
      },
      (response) => {
        // Follow redirects with limit
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.destroy();
          if (maxRedirects <= 0) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          downloadDocument(response.headers.location, maxSizeBytes, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        const contentLength = parseInt(response.headers['content-length'] ?? '0', 10);
        if (contentLength > maxSizeBytes) {
          response.destroy();
          reject(new Error(`File too large: ${contentLength} bytes (max ${maxSizeBytes})`));
          return;
        }

        const contentType = response.headers['content-type'] ?? null;
        const chunks: Buffer[] = [];
        let totalSize = 0;

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > maxSizeBytes) {
            response.destroy();
            reject(new Error('File exceeded max size during download'));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve({ buffer: Buffer.concat(chunks), contentType });
        });

        response.on('error', reject);
      },
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Download timeout for ${url}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Upload to S3 with proper directory structure
// ---------------------------------------------------------------------------

async function uploadPolicyToS3(
  agencyId: string,
  documentId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = extensionForMime(mimeType);
  const key = `agencies/${agencyId}/policies/${documentId}${ext}`;

  const s3 = new S3Client({
    region: S3_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: { agencyId, documentId },
    }),
  );

  return `s3://${S3_BUCKET}/${key}`;
}

// ---------------------------------------------------------------------------
// Download, verify, store, and create PolicyDocument record
// ---------------------------------------------------------------------------

export async function downloadAndStorePolicyDocument(
  data: PolicyDownloadJobData,
): Promise<PolicyDownloadResult> {
  const result: PolicyDownloadResult = {
    documentId: data.documentId,
    agencyId: data.agencyId,
    s3Url: null,
    mimeType: 'application/octet-stream',
    fileSizeBytes: 0,
    downloaded: false,
    error: null,
  };

  try {
    // Step 1: Download
    const { buffer, contentType } = await downloadDocument(data.sourceUrl);
    result.fileSizeBytes = buffer.length;

    // Step 2: Verify MIME type
    result.mimeType = detectMimeType(buffer, contentType);

    // Step 3: Upload to S3
    result.s3Url = await uploadPolicyToS3(
      data.agencyId,
      data.documentId,
      buffer,
      result.mimeType,
    );

    // Step 4: Update PolicyDocument record
    await prisma.policyDocument.update({
      where: { documentId: data.documentId },
      data: {
        s3Url: result.s3Url,
        mimeType: result.mimeType,
        fileSizeBytes: buffer.length,
        ocrStatus: 'pending', // Ready for OCR
      },
    });

    result.downloaded = true;

    console.log(
      `[Policy Download] Stored: ${data.sourceUrl} → ${result.s3Url} (${result.fileSizeBytes} bytes, ${result.mimeType})`,
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);

    // Mark document as failed
    await prisma.policyDocument.update({
      where: { documentId: data.documentId },
      data: { ocrStatus: 'failed' },
    }).catch(() => { /* best effort */ });

    console.error(`[Policy Download] Failed: ${data.sourceUrl}: ${result.error}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Enqueue pending documents for download
// ---------------------------------------------------------------------------

export async function enqueuePendingDownloads(
  queue: Queue<PolicyDownloadJobData>,
  agencyId?: string,
): Promise<number> {
  const where: Record<string, unknown> = {
    s3Url: null,
    sourceUrl: { not: null },
    isChpCanonical: false,
  };
  if (agencyId) {
    where.agencyId = agencyId;
  }

  const docs = await prisma.policyDocument.findMany({
    where,
    take: 100,
  });

  let enqueued = 0;
  for (const doc of docs) {
    await queue.add(
      `download-${doc.documentId}`,
      {
        documentId: doc.documentId,
        agencyId: doc.agencyId,
        sourceUrl: doc.sourceUrl,
        title: doc.title,
        expectedMimeType: doc.mimeType,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    enqueued++;
  }

  console.log(`[Policy Download] Enqueued ${enqueued} documents for download`);
  return enqueued;
}

// ---------------------------------------------------------------------------
// Create BullMQ queue
// ---------------------------------------------------------------------------

export function createPolicyDownloadQueue(
  redisUrl?: string,
): Queue<PolicyDownloadJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<PolicyDownloadJobData>(POLICY_DOWNLOAD_QUEUE, { connection });
}

// ---------------------------------------------------------------------------
// Create worker
// ---------------------------------------------------------------------------

export function createPolicyDownloadWorker(
  onComplete?: (result: PolicyDownloadResult) => Promise<void>,
  redisUrl?: string,
): Worker<PolicyDownloadJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<PolicyDownloadJobData>(
    POLICY_DOWNLOAD_QUEUE,
    async (job: Job<PolicyDownloadJobData>) => {
      console.log(`[Policy Download Worker] Processing: ${job.data.sourceUrl}`);
      const result = await downloadAndStorePolicyDocument(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 3,
      limiter: { max: 5, duration: 1000 },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Policy Download Worker] Completed: ${job.data.documentId}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Policy Download Worker] Failed: ${job?.data.documentId}`,
      error.message,
    );
  });

  return worker;
}
