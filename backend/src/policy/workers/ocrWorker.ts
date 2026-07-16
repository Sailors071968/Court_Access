// ---------------------------------------------------------------------------
// Phase 8 — OCR Processing Worker (BullMQ)
// Extracts text from policy documents using AWS Textract or Tesseract fallback.
// ---------------------------------------------------------------------------

import { Worker, Queue, Job } from 'bullmq';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export const OCR_QUEUE = 'policy-ocr-queue';
export const CLASSIFICATION_QUEUE = 'policy-classification-queue';

const S3_REGION = process.env.AWS_REGION ?? 'us-west-2';

export interface OcrJobData {
  documentId: string;
  agencyId: string;
  s3Url: string;
  mimeType: string;
}

export interface OcrResult {
  documentId: string;
  textContent: string | null;
  error: string | null;
}

/**
 * Parse S3 URL into bucket and key.
 */
function parseS3Url(s3Url: string): { bucket: string; key: string } {
  // s3://bucket-name/path/to/object
  const match = s3Url.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid S3 URL: ${s3Url}`);
  return { bucket: match[1], key: match[2] };
}

/**
 * Get document bytes from S3.
 */
async function getDocumentFromS3(s3Url: string): Promise<Buffer> {
  const { bucket, key } = parseS3Url(s3Url);
  const s3 = new S3Client({ region: S3_REGION });

  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  if (!response.Body) throw new Error('Empty S3 response');

  // Convert stream to buffer
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Extract text using AWS Textract.
 */
async function extractTextWithTextract(
  documentBytes: Buffer
): Promise<string> {
  const textract = new TextractClient({ region: S3_REGION });

  const response = await textract.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: documentBytes },
    })
  );

  if (!response.Blocks) return '';

  // Concatenate LINE blocks in order
  const lines = response.Blocks.filter((block) => block.BlockType === 'LINE')
    .sort((a, b) => {
      const pageA = a.Page ?? 1;
      const pageB = b.Page ?? 1;
      if (pageA !== pageB) return pageA - pageB;
      const topA = a.Geometry?.BoundingBox?.Top ?? 0;
      const topB = b.Geometry?.BoundingBox?.Top ?? 0;
      return topA - topB;
    })
    .map((block) => block.Text ?? '')
    .filter(Boolean);

  return lines.join('\n');
}

/**
 * Extract text using Tesseract.js (fallback).
 */
async function extractTextWithTesseract(
  documentBytes: Buffer,
  mimeType: string
): Promise<string> {
  try {
    // Dynamic import for tesseract.js
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');

    // Tesseract works with images, not PDFs directly
    // For PDFs, we'd need pdf-to-image conversion first
    // For now, handle image-based documents
    if (mimeType.includes('pdf')) {
      // Attempt to extract text from PDF using pdf-parse
      try {
        const pdfParse = await import('pdf-parse') as unknown as {
          default: (buf: Buffer) => Promise<{ text: string }>;
        };
        const pdfData = await pdfParse.default(documentBytes);
        if (pdfData.text && pdfData.text.trim().length > 50) {
          await worker.terminate();
          return pdfData.text;
        }
      } catch {
        // pdf-parse failed, fall through to return empty
      }
      await worker.terminate();
      return ''; // Can't OCR PDF directly with Tesseract
    }

    const result = await worker.recognize(documentBytes);
    await worker.terminate();
    return result.data.text;
  } catch (error) {
    console.error(
      '[OCR] Tesseract failed:',
      error instanceof Error ? error.message : error
    );
    return '';
  }
}

/**
 * Extract text from a document using best available method.
 */
export async function extractText(data: OcrJobData): Promise<OcrResult> {
  const result: OcrResult = {
    documentId: data.documentId,
    textContent: null,
    error: null,
  };

  try {
    const documentBytes = await getDocumentFromS3(data.s3Url);

    // Try Textract first
    try {
      const text = await extractTextWithTextract(documentBytes);
      if (text.trim().length > 0) {
        result.textContent = text;
        console.log(
          `[OCR] Textract extracted ${text.length} chars from ${data.documentId}`
        );
        return result;
      }
    } catch (textractError) {
      console.warn(
        `[OCR] Textract failed for ${data.documentId}, falling back to Tesseract:`,
        textractError instanceof Error ? textractError.message : textractError
      );
    }

    // Fallback to Tesseract / pdf-parse
    const text = await extractTextWithTesseract(documentBytes, data.mimeType);
    if (text.trim().length > 0) {
      result.textContent = text;
      console.log(
        `[OCR] Tesseract/pdf-parse extracted ${text.length} chars from ${data.documentId}`
      );
    } else {
      result.error = 'No text could be extracted from document';
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`[OCR] Failed for ${data.documentId}: ${result.error}`);
  }

  return result;
}

/**
 * Create the BullMQ queue for OCR processing.
 */
export function createOcrQueue(redisUrl?: string): Queue<OcrJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<OcrJobData>(OCR_QUEUE, { connection });
}

/**
 * Create and start the OCR worker.
 */
export function createOcrWorker(
  onComplete?: (result: OcrResult) => Promise<void>,
  redisUrl?: string
): Worker<OcrJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<OcrJobData>(
    OCR_QUEUE,
    async (job: Job<OcrJobData>) => {
      console.log(`[OCR Worker] Processing: ${job.data.documentId}`);
      const result = await extractText(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[OCR Worker] Completed: ${job.data.documentId}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[OCR Worker] Failed: ${job?.data.documentId}`,
      error.message
    );
  });

  return worker;
}
