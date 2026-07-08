// ============================================================================
// Evidence Direct Upload — Multipart file upload endpoint
// Accepts multipart form data, stores file to local disk (or R2 if configured),
// creates Evidence DB record, and runs text extraction + chunking synchronously.
// This provides a working upload flow without requiring R2 presigned URLs.
// ============================================================================

import type { FastifyInstance, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { validateEvidenceUpload } from './evidenceValidation.js';
import { chunkAndPersistEvidence } from '../services/evidenceChunkingService.js';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Local storage directory for uploaded evidence files */
// Default to a repo-relative path so uploads work on any host out of the box;
// override with EVIDENCE_UPLOAD_DIR in production. (Previously hardcoded to a
// non-portable /var/www path that broke on fresh deploys.)
const UPLOAD_DIR = process.env.EVIDENCE_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads', 'evidence');

/** Maximum file size for multipart upload (500 MB) */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const VALID_EVIDENCE_TYPES = [
  'transcript',
  'police_report',
  'bodycam',
  'dashcam',
  'witness_video',
  'photo',
  'dispatch_log',
  'forensic_report',
  'autopsy_report',
  'other_document',
] as const;

type EvidenceType = typeof VALID_EVIDENCE_TYPES[number];

// ---------------------------------------------------------------------------
// PDF Text Extraction (inline, no R2 dependency)
// ---------------------------------------------------------------------------

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string | null> {
  try {
    // Plain text files
    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return await fs.readFile(filePath, 'utf-8');
    }

    // PDF files
    if (mimeType === 'application/pdf') {
      try {
        const buffer = await fs.readFile(filePath);
        // pdf-parse v2 uses PDFParse class
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        await (parser as unknown as { load(): Promise<void> }).load();
        const result = await parser.getText();
        const text = (
          typeof result === 'object' && result !== null
            ? (result as { text?: string }).text || ''
            : String(result || '')
        ).trim();
        await parser.destroy();
        return text.length > 0 ? text : null;
      } catch (pdfErr) {
        console.warn('[DirectUpload] PDF extraction failed:', pdfErr instanceof Error ? pdfErr.message : pdfErr);
        return null;
      }
    }

    // Images — attempt OCR with Tesseract
    if (mimeType.startsWith('image/')) {
      try {
        const Tesseract = await import('tesseract.js');
        const buffer = await fs.readFile(filePath);
        const worker = await Tesseract.createWorker('eng');
        const result = await worker.recognize(buffer);
        await worker.terminate();
        const text = result.data.text?.trim();
        return text && text.length > 0 ? text : null;
      } catch (ocrErr) {
        console.warn('[DirectUpload] OCR failed:', ocrErr instanceof Error ? ocrErr.message : ocrErr);
        return null;
      }
    }

    // DOCX — best-effort plain text extraction
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Read as text (won't work for binary DOCX, but it's a fallback)
      const content = await fs.readFile(filePath, 'utf-8');
      if (isProbablyText(content)) return content;
      return null;
    }

    // Unknown type — try reading as text
    const content = await fs.readFile(filePath, 'utf-8');
    if (isProbablyText(content)) return content;
    return null;
  } catch (err) {
    console.error('[DirectUpload] Text extraction failed:', err);
    return null;
  }
}

function isProbablyText(content: string): boolean {
  if (content.length === 0) return false;
  const sample = content.slice(0, 1000);
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}

/** Guess MIME type from file extension */
function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    webp: 'image/webp',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export async function registerDirectUploadRoutes(app: FastifyInstance): Promise<void> {
  // Register multipart in an encapsulated plugin so it doesn't break JSON
  // body parsing on other routes. Fastify scoping keeps this isolated.
  await app.register(async function uploadPlugin(instance) {
    await instance.register(multipart, {
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
      },
    });

    // POST /api/evidence/upload — Direct multipart file upload
    instance.post('/api/evidence/upload', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' });
    }

    let data;
    try {
      data = await request.file();
    } catch (err) {
      console.error('[DirectUpload] Failed to parse multipart:', err);
      return reply.code(400).send({ error: 'Invalid multipart upload' });
    }

    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }

    // Extract form fields
    const fields = data.fields as Record<string, { value?: string } | undefined>;
    const caseId = fields.caseId?.value;
    const evidenceType = fields.evidenceType?.value || 'other_document';

    if (!caseId) {
      return reply.code(400).send({ error: 'Missing required field: caseId' });
    }

    if (!VALID_EVIDENCE_TYPES.includes(evidenceType as EvidenceType)) {
      return reply.code(400).send({
        error: `Invalid evidenceType. Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`,
      });
    }

    // Verify case access (tenant isolation)
    try {
      const caseRecord = await prisma.criminalCase.findFirst({
        where: {
          caseId,
          tenantId: user.tenantId,
          deletedAt: null,
        },
      });
      if (!caseRecord) {
        return reply.code(403).send({ error: 'Forbidden: case not found or access denied' });
      }
    } catch (err) {
      console.error('[DirectUpload] Case access check failed:', err);
      return reply.code(500).send({ error: 'Failed to verify case access' });
    }

    // Save file to local disk
    const fileId = crypto.randomUUID();
    const rawFileName = data.filename || 'unnamed-file';
    // Sanitize filename: strip path separators and traversal sequences
    const fileName = path.basename(rawFileName).replace(/\.\./g, '_');
    const mimeType = data.mimetype || guessMimeType(fileName);

    // Create tenant-scoped directory
    const uploadDir = path.join(UPLOAD_DIR, user.tenantId, caseId);
    await fs.mkdir(uploadDir, { recursive: true });

    const localPath = path.join(uploadDir, `${fileId}_${fileName}`);
    // Verify resolved path is still within the root upload directory (prevent path traversal)
    const resolvedLocal = path.resolve(localPath);
    const resolvedBase = path.resolve(UPLOAD_DIR);
    if (!resolvedLocal.startsWith(resolvedBase + path.sep)) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }
    const s3Key = `evidence/${user.tenantId}/${caseId}/${fileId}/${fileName}`;

    let fileSize = 0;
    try {
      const writeStream = createWriteStream(localPath);
      await pipeline(data.file, writeStream);
      // Check if file was truncated due to exceeding the size limit
      if (data.file.truncated) {
        await fs.unlink(localPath).catch(() => {});
        return reply.code(413).send({
          error: 'File too large',
          message: `File exceeds maximum upload size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          maxSize: MAX_FILE_SIZE,
        });
      }
      const stat = await fs.stat(localPath);
      fileSize = stat.size;
    } catch (err) {
      console.error('[DirectUpload] Failed to save file:', err);
      // Clean up partial file
      await fs.unlink(localPath).catch(() => {});
      // Return 413 if the error is a file-too-large error from @fastify/multipart
      if (err && ((err as { code?: string }).code === 'FST_FILES_LIMIT' || (err as Error)?.message?.includes('Too Large'))) {
        return reply.code(413).send({ error: 'File too large', maxSize: MAX_FILE_SIZE });
      }
      return reply.code(500).send({ error: 'Failed to save uploaded file' });
    }

    // Validate upload limits
    const validation = await validateEvidenceUpload(user.tenantId, caseId, fileSize, evidenceType);
    if (!validation.allowed) {
      await fs.unlink(localPath).catch(() => {});
      return reply.code(validation.statusCode).send({
        error: validation.error,
        limit: validation.limit,
        current: validation.current,
      });
    }

    // Calculate SHA-256 content hash (streaming — memory-safe for large files)
    let sha256: string | null = null;
    try {
      const hash = crypto.createHash('sha256');
      await pipeline(createReadStream(localPath), hash);
      sha256 = hash.digest('hex');
    } catch (err) {
      console.warn('[DirectUpload] SHA-256 hashing failed:', err instanceof Error ? err.message : err);
    }

    // Create evidence DB record
    let evidence;
    try {
      evidence = await prisma.evidence.create({
        data: {
          caseId,
          tenantId: user.tenantId,
          fileName,
          mimeType,
          size: BigInt(fileSize),
          evidenceType,
          s3Key,
          sha256,
          uploadedBy: user.userId,
          processingStatus: 'ingesting',
        },
      });
    } catch (err) {
      console.error('[DirectUpload] Failed to create evidence record:', err);
      await fs.unlink(localPath).catch(() => {});
      return reply.code(500).send({ error: 'Failed to register evidence' });
    }

    console.log(`[DirectUpload] Evidence ${evidence.evidenceId} saved: ${fileName} (${fileSize} bytes)`);

    // Run text extraction + chunking synchronously (no Redis/BullMQ dependency)
    // This runs in the background so the upload response isn't delayed
    processEvidenceAsync(evidence.evidenceId, user.tenantId, localPath, mimeType).catch((err) => {
      console.error(`[DirectUpload] Background processing failed for ${evidence.evidenceId}:`, err);
    });

    // Return response immediately
    return reply.code(201).send({
      evidence: {
        evidenceId: evidence.evidenceId,
        caseId: evidence.caseId,
        tenantId: evidence.tenantId,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        size: evidence.size.toString(),
        evidenceType: evidence.evidenceType,
        s3Key: evidence.s3Key,
        sha256: evidence.sha256,
        uploadedBy: evidence.uploadedBy,
        uploadedAt: evidence.uploadedAt,
        processingStatus: evidence.processingStatus,
        processingError: evidence.processingError,
        multiplexDetected: evidence.multiplexDetected,
        multiplexCount: evidence.multiplexCount,
        normalizedPageCount: evidence.normalizedPageCount,
        acuCost: evidence.acuCost,
        acuConsumed: evidence.acuConsumed,
        analysisStatus: evidence.analysisStatus,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt,
      },
    });
  }); // end instance.post

  }); // end uploadPlugin

  console.log('[Server] Direct evidence upload route registered: POST /api/evidence/upload');
}

// ---------------------------------------------------------------------------
// Background Processing (text extraction → chunking → DB update)
// ---------------------------------------------------------------------------

async function processEvidenceAsync(
  evidenceId: string,
  tenantId: string,
  localPath: string,
  mimeType: string,
): Promise<void> {
  try {
    console.log(`[DirectUpload] Starting text extraction for ${evidenceId}...`);

    // Step 1: Extract text from file
    const extractedText = await extractTextFromFile(localPath, mimeType);

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn(`[DirectUpload] No text extracted from ${evidenceId} (mimeType: ${mimeType})`);
      await prisma.evidence.update({
        where: { evidenceId },
        data: {
          processingStatus: 'analyzed',
          processingError: mimeType.startsWith('video/') || mimeType.startsWith('audio/')
            ? 'Audio/video files require transcript pipeline'
            : 'No extractable text found',
        },
      });
      return;
    }

    console.log(`[DirectUpload] Extracted ${extractedText.length} chars from ${evidenceId}`);

    // Step 2: Chunk text and persist to EvidenceChunk table
    const chunkResult = await chunkAndPersistEvidence(evidenceId, tenantId, extractedText);

    console.log(`[DirectUpload] Chunked ${evidenceId}: ${chunkResult.chunkCount} chunks in ${chunkResult.durationMs}ms`);

    // Step 3: Update evidence processing status
    await prisma.evidence.update({
      where: { evidenceId },
      data: {
        processingStatus: 'analyzed',
        processingError: null,
        normalizedPageCount: chunkResult.chunkCount,
      },
    });

    console.log(`[DirectUpload] Processing complete for ${evidenceId}`);
  } catch (err) {
    console.error(`[DirectUpload] Processing failed for ${evidenceId}:`, err);
    await prisma.evidence.update({
      where: { evidenceId },
      data: {
        processingStatus: 'failed',
        processingError: err instanceof Error ? err.message : 'Processing failed',
      },
    }).catch((updateErr) => {
      console.error(`[DirectUpload] Failed to update error status for ${evidenceId}:`, updateErr);
    });
  }
}
