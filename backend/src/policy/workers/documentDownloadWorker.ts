// ---------------------------------------------------------------------------
// Phase 7 — Document Download Worker (BullMQ)
// Downloads policy documents, uploads to S3, creates PolicyDocument records.
// ---------------------------------------------------------------------------

import { Worker, Queue, Job } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import https from 'node:https';
import http from 'node:http';
import { DEFAULT_CRAWLER_CONFIG } from '../agencyRegistry/types.js';

export const DOCUMENT_DOWNLOAD_QUEUE = 'policy-document-download-queue';
export const OCR_QUEUE = 'policy-ocr-queue';

const S3_BUCKET = process.env.S3_POLICY_BUCKET ?? 'courtaccess-policy-library';
const S3_REGION = process.env.AWS_REGION ?? 'us-west-2';

export interface DocumentDownloadJobData {
  documentId: string;
  agencyId: string;
  sourceUrl: string;
  title: string | null;
  estimatedType: string | null;
}

export interface DownloadResult {
  documentId: string;
  agencyId: string;
  s3Url: string | null;
  mimeType: string | null;
  fileSizeBytes: number;
  error: string | null;
}

/**
 * Create an S3 client.
 */
function getS3Client(): S3Client {
  return new S3Client({
    region: S3_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });
}

/**
 * Download a file from a URL and return the buffer + content type.
 */
async function downloadFile(
  url: string,
  maxSizeBytes: number = DEFAULT_CRAWLER_CONFIG.maxDocumentSizeBytes,
  maxRedirects: number = 5
): Promise<{ buffer: Buffer; contentType: string | null }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(
      url,
      {
        headers: {
          'User-Agent': DEFAULT_CRAWLER_CONFIG.userAgent,
        },
        timeout: DEFAULT_CRAWLER_CONFIG.requestTimeoutMs,
      },
      (response) => {
        // Follow redirects
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
          downloadFile(response.headers.location, maxSizeBytes, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }

        const contentLength = parseInt(
          response.headers['content-length'] ?? '0',
          10
        );
        if (contentLength > maxSizeBytes) {
          response.destroy();
          reject(
            new Error(
              `File too large: ${contentLength} bytes (max ${maxSizeBytes})`
            )
          );
          return;
        }

        const contentType = response.headers['content-type'] ?? null;
        const chunks: Buffer[] = [];
        let totalSize = 0;

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > maxSizeBytes) {
            response.destroy();
            reject(new Error(`File exceeded max size during download`));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve({ buffer: Buffer.concat(chunks), contentType });
        });

        response.on('error', reject);
      }
    );

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Download timeout for ${url}`));
    });
  });
}

/**
 * Detect MIME type from buffer magic bytes.
 */
function detectMimeType(buffer: Buffer, fallback: string | null): string {
  // PDF: starts with %PDF
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }

  // DOCX/ZIP: starts with PK
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // DOC: starts with D0 CF 11 E0
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return 'application/msword';
  }

  return fallback ?? 'application/octet-stream';
}

/**
 * Upload a document to S3.
 */
async function uploadToS3(
  s3: S3Client,
  agencyId: string,
  documentId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const extension = mimeType.includes('pdf')
    ? '.pdf'
    : mimeType.includes('word')
      ? '.docx'
      : mimeType.includes('msword')
        ? '.doc'
        : '';

  const key = `agencies/${agencyId}/documents/${documentId}${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        agencyId,
        documentId,
      },
    })
  );

  return `s3://${S3_BUCKET}/${key}`;
}

/**
 * Download a single document, upload to S3.
 */
export async function downloadAndStoreDocument(
  data: DocumentDownloadJobData
): Promise<DownloadResult> {
  const result: DownloadResult = {
    documentId: data.documentId,
    agencyId: data.agencyId,
    s3Url: null,
    mimeType: null,
    fileSizeBytes: 0,
    error: null,
  };

  try {
    // Download the file
    const { buffer, contentType } = await downloadFile(data.sourceUrl);
    result.fileSizeBytes = buffer.length;

    // Detect MIME type
    result.mimeType = detectMimeType(buffer, contentType);

    // Upload to S3
    const s3 = getS3Client();
    result.s3Url = await uploadToS3(
      s3,
      data.agencyId,
      data.documentId,
      buffer,
      result.mimeType
    );

    console.log(
      `[Doc Download] Stored: ${data.sourceUrl} → ${result.s3Url} (${result.fileSizeBytes} bytes)`
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(
      `[Doc Download] Failed: ${data.sourceUrl}: ${result.error}`
    );
  }

  return result;
}

/**
 * Create the BullMQ queue for document downloads.
 */
export function createDocumentDownloadQueue(
  redisUrl?: string
): Queue<DocumentDownloadJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<DocumentDownloadJobData>(DOCUMENT_DOWNLOAD_QUEUE, {
    connection,
  });
}

/**
 * Create and start the document download worker.
 */
export function createDocumentDownloadWorker(
  onComplete?: (result: DownloadResult) => Promise<void>,
  redisUrl?: string
): Worker<DocumentDownloadJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<DocumentDownloadJobData>(
    DOCUMENT_DOWNLOAD_QUEUE,
    async (job: Job<DocumentDownloadJobData>) => {
      console.log(
        `[Doc Download Worker] Processing: ${job.data.sourceUrl}`
      );

      const result = await downloadAndStoreDocument(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Doc Download Worker] Completed: ${job.data.sourceUrl}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Doc Download Worker] Failed: ${job?.data.sourceUrl}`,
      error.message
    );
  });

  return worker;
}
