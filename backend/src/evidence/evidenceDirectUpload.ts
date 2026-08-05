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
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { AuthenticatedRequest } from '../security/authMiddleware.js';
import { validateEvidenceUpload } from './evidenceValidation.js';
import { chunkAndPersistEvidence } from '../services/evidenceChunkingService.js';
import prisma from '../lib/prisma.js';
import {
  describe,
  detectFormat,
  extractDocxText,
  inspectPdf,
  isTruncatedIsoMedia,
  listZipEntries,
  sanitizeExtractedText,
} from './fileDiagnostics.js';
import { validateFileExtension } from '../security/evidenceUploadProtection.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Local storage directory for uploaded evidence files */
const UPLOAD_DIR = process.env.EVIDENCE_UPLOAD_DIR || '/var/www/courtaccess/uploads/evidence';

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

/** Minimum mean OCR confidence before a scan is flagged for manual review. */
const OCR_CONFIDENCE_THRESHOLD = parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '65', 10);

export interface ExtractionOutcome {
  /** Extracted text, or null when nothing could be read. */
  text: string | null;
  /** 'analyzed' when the file was handled as intended, 'failed' otherwise. */
  status: 'analyzed' | 'failed';
  /**
   * What to tell the user. Always populated when text is null, and also
   * populated for successful-but-qualified outcomes such as a low-confidence
   * scan. Null means "read cleanly, nothing to report".
   */
  message: string | null;
  detectedFormat: string;
  detectedMimeType: string;
  ocrConfidence?: number;
}

function ok(text: string, format: string, mime: string, extra: Partial<ExtractionOutcome> = {}): ExtractionOutcome {
  return { text, status: 'analyzed', message: null, detectedFormat: format, detectedMimeType: mime, ...extra };
}

function problem(
  message: string,
  format: string,
  mime: string,
  status: 'analyzed' | 'failed' = 'failed',
): ExtractionOutcome {
  return { text: null, status, message, detectedFormat: format, detectedMimeType: mime };
}

/** Extensions whose contents should match a specific detected format. */
const EXTENSION_EXPECTATION: Record<string, string[]> = {
  pdf: ['pdf'],
  docx: ['docx'],
  doc: ['docx'],
  png: ['png'],
  jpg: ['jpeg'],
  jpeg: ['jpeg'],
  tiff: ['tiff'],
  tif: ['tiff'],
  zip: ['zip', 'docx', 'xlsx', 'pptx'],
  mp4: ['mp4', 'quicktime'],
  mov: ['quicktime', 'mp4'],
};

function extensionMismatch(fileName: string, detected: string): string | null {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const expected = EXTENSION_EXPECTATION[ext];
  if (!expected || expected.includes(detected)) return null;
  return (
    `"${fileName}" is named as a .${ext} file but its contents are not a valid ${ext.toUpperCase()} — ` +
    `the file was read as ${describe(detected as never).label}. ` +
    'This usually means the export or download was incomplete. Its readable text has been indexed, ' +
    'but please confirm you have the complete original.'
  );
}

/**
 * Read the text of an uploaded file.
 *
 * The declared MIME type is only a hint — clients routinely send
 * application/octet-stream — so the format is determined from the file's own
 * bytes. Every path that cannot produce text explains why in terms the
 * uploading attorney or paralegal can act on.
 */
async function extractTextFromFile(
  filePath: string,
  declaredMimeType: string,
  fileName: string,
): Promise<ExtractionOutcome> {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (err) {
    console.error('[DirectUpload] Could not read stored file:', err);
    return problem(
      'The uploaded file could not be read back from storage. Please try uploading it again.',
      'unknown',
      declaredMimeType,
    );
  }

  const detected = detectFormat(buffer, fileName);
  const fmt = detected.format;
  const mime = detected.mimeType;

  if (fmt === 'empty') {
    return problem(
      `"${fileName}" is empty (0 bytes). The upload may have been interrupted — please re-send the file.`,
      fmt,
      mime,
    );
  }

  if (fmt === 'executable') {
    return problem(
      `"${fileName}" is a Windows executable, which cannot be accepted as evidence. ` +
        'Please upload the underlying document, image, or recording instead.',
      fmt,
      mime,
    );
  }

  // --- PDF ------------------------------------------------------------------
  if (fmt === 'pdf') {
    const inspection = inspectPdf(buffer);

    if (inspection.encrypted) {
      return problem(
        `"${fileName}" is password protected, so its pages cannot be read. ` +
          'Please remove the password and upload the file again, or supply an unrestricted copy from the producing party.',
        fmt,
        mime,
      );
    }

    try {
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

      if (text.length > 0) {
        if (inspection.truncated) {
          return ok(text, fmt, mime, {
            message:
              `"${fileName}" is missing its end-of-file marker, so the upload may be incomplete. ` +
              'The text that could be read has been indexed; please verify the page count against the source.',
          });
        }
        return ok(text, fmt, mime);
      }

      // Parsed cleanly but carries no text layer — this is a scanned PDF.
      return problem(
        `"${fileName}" contains no text layer, which means it is a scanned document. ` +
          'Page images could not be read automatically; please upload the pages as images (PNG, JPEG, or TIFF) so they can be run through OCR.',
        fmt,
        mime,
      );
    } catch (pdfErr) {
      const detail = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      console.warn('[DirectUpload] PDF extraction failed:', detail);

      if (/password|encrypt/i.test(detail)) {
        return problem(
          `"${fileName}" is password protected, so its pages cannot be read. ` +
            'Please remove the password and upload the file again.',
          fmt,
          mime,
        );
      }
      if (inspection.truncated) {
        return problem(
          `"${fileName}" is an incomplete PDF — the file ends before its final page marker, ` +
            'which usually means the upload or the original download was cut short. Please re-send the complete file.',
          fmt,
          mime,
        );
      }
      return problem(
        `"${fileName}" is a damaged PDF and its page structure could not be read. ` +
          'Please obtain a fresh copy from the producing party and upload it again.',
        fmt,
        mime,
      );
    }
  }

  // --- Images: OCR ----------------------------------------------------------
  if (detected.category === 'image') {
    try {
      const Tesseract = await import('tesseract.js');
      // Without an errorHandler tesseract.js rethrows worker failures from its
      // message callback, which arrives as an uncaught exception rather than a
      // rejected promise — a single corrupt image would take the API down.
      const worker = await Tesseract.createWorker('eng', undefined, {
        errorHandler: (err: unknown) => {
          console.warn('[DirectUpload] OCR worker reported an error:', err);
        },
      });
      let recognised;
      try {
        recognised = await worker.recognize(buffer);
      } finally {
        await worker.terminate().catch(() => {});
      }

      const text = recognised.data.text?.trim() ?? '';
      const confidence = typeof recognised.data.confidence === 'number' ? recognised.data.confidence : null;

      if (text.length === 0) {
        return problem(
          `No text could be recognised on "${fileName}". ` +
            'The page appears to be blank, or it is a photograph rather than a document. ' +
            'If it should contain text, re-scan it at 300 DPI or higher and upload it again.',
          fmt,
          mime,
          'analyzed',
        );
      }

      if (confidence !== null && confidence < OCR_CONFIDENCE_THRESHOLD) {
        return ok(text, fmt, mime, {
          ocrConfidence: confidence,
          message:
            `OCR confidence for "${fileName}" is ${confidence.toFixed(0)}%, below the ${OCR_CONFIDENCE_THRESHOLD}% threshold, ` +
            'because the scan quality is poor. The text has been indexed but requires manual review before it is relied on. ' +
            'Re-scanning at 300 DPI or higher will improve the result.',
        });
      }

      return ok(text, fmt, mime, { ocrConfidence: confidence ?? undefined });
    } catch (ocrErr) {
      const detail = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      console.warn('[DirectUpload] OCR failed:', detail);
      return problem(
        `"${fileName}" could not be processed as an image — the file is corrupt or its image data is truncated. ` +
          'Please re-export or re-scan the page and upload it again.',
        fmt,
        mime,
      );
    }
  }

  // --- Word documents -------------------------------------------------------
  if (fmt === 'docx') {
    const text = extractDocxText(buffer);
    if (text) return ok(text, fmt, mime);
    return problem(
      `"${fileName}" is a Word document whose text content could not be read; the file may be damaged. ` +
        'Please re-save it from Word, or export it as a PDF, and upload it again.',
      fmt,
      mime,
    );
  }

  if (fmt === 'xlsx' || fmt === 'pptx') {
    return problem(
      `"${fileName}" is ${describe(fmt).label === 'Excel workbook' ? 'an' : 'a'} ${describe(fmt).label}, ` +
        'which is not yet supported for text extraction. Please export it to PDF and upload the PDF.',
      fmt,
      mime,
    );
  }

  // --- Archives -------------------------------------------------------------
  if (fmt === 'zip') {
    const entries = listZipEntries(buffer).filter((e) => !e.name.endsWith('/'));
    const names = entries.slice(0, 25).map((e) => e.name);
    return problem(
      `"${fileName}" is a ZIP archive containing ${entries.length} file(s), and archives are not ingested directly. ` +
        `Please extract it and upload the documents individually` +
        (names.length ? `: ${names.join(', ')}${entries.length > names.length ? ', …' : ''}` : '') +
        '.',
      fmt,
      mime,
      'analyzed',
    );
  }

  // --- Media ----------------------------------------------------------------
  if (detected.category === 'video' || detected.category === 'audio') {
    if ((fmt === 'mp4' || fmt === 'quicktime') && isTruncatedIsoMedia(buffer)) {
      return problem(
        `"${fileName}" is an incomplete ${detected.label} — the recording is missing the index or the ` +
          'picture data that should follow its header, which means the transfer was cut short. ' +
          'Please re-export the recording from its source system and upload the complete file.',
        fmt,
        mime,
      );
    }
    const article = /^[AEIOU]/.test(detected.label) ? 'an' : 'a';
    return problem(
      `"${fileName}" is ${article} ${detected.label} and has been stored with the case. ` +
        'Automatic speech transcription is not available, so the words spoken in this recording ' +
        'are not searchable. To make its contents searchable, upload a written transcript alongside it.',
      fmt,
      mime,
      'analyzed',
    );
  }

  // --- Plain text -----------------------------------------------------------
  if (fmt === 'text' || fmt === 'rtf') {
    const content = buffer.toString('utf-8');
    if (content.trim().length === 0) {
      return problem(
        `"${fileName}" contains no readable text — the file appears to be blank.`,
        fmt,
        mime,
      );
    }
    // A file named .pdf/.docx that is really plain text is usually a failed
    // export or a truncated download, and the discrepancy must not be silent.
    const mismatch = extensionMismatch(fileName, fmt);
    return ok(content, fmt, mime, mismatch ? { message: mismatch } : {});
  }

  // --- Anything else --------------------------------------------------------
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';

  // The extension allowlist already ran, so an unrecognisable file that still
  // carries a supported extension is a damaged file rather than a wrong one.
  if (extension && ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
    return problem(
      `"${fileName}" is named as a .${extension} recording but its contents could not be recognised — ` +
        'the file header is damaged or the transfer was incomplete. ' +
        'Please re-export the recording from its source system and upload it again.',
      fmt,
      mime,
    );
  }

  const declaredHint =
    extension && !declaredMimeType.includes(extension)
      ? ` The file is named ".${extension}" but its contents do not match that format.`
      : '';
  return problem(
    `"${fileName}" is not in a supported format, so no text could be extracted.${declaredHint} ` +
      'Supported formats are PDF, DOCX, TXT, JPEG, PNG, TIFF, and common audio and video files.',
    fmt,
    mime,
  );
}

const ALLOWED_MEDIA_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'm4v', 'webm',
  'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg',
]);

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

    // The onRequest upload hook can only see the request Content-Type, which
    // for a multipart post is always multipart/form-data, so the extension
    // allowlist has to be applied here where the member filename is known.
    const extensionCheck = validateFileExtension(fileName);
    if (!extensionCheck.valid) {
      return reply.code(415).send({
        error: 'Unsupported file type',
        message:
          `"${fileName}" cannot be uploaded as evidence: ${extensionCheck.reason}. ` +
          'Supported formats are PDF, DOCX, TXT, images (JPEG, PNG, TIFF), and common audio and video files.',
        fileName,
      });
    }

    // Clients frequently send application/octet-stream; fall back to the
    // extension so the stored record is not misleading. The ingestion pipeline
    // re-derives the true type from the file's bytes regardless.
    const declaredMime = data.mimetype;
    const mimeType =
      !declaredMime || declaredMime === 'application/octet-stream'
        ? guessMimeType(fileName)
        : declaredMime;

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
    processEvidenceAsync(evidence.evidenceId, user.tenantId, localPath, mimeType, fileName).catch((err) => {
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
  fileName: string,
): Promise<void> {
  try {
    console.log(`[DirectUpload] Starting text extraction for ${evidenceId}...`);

    // Step 1: Extract text from file
    const outcome = await extractTextFromFile(localPath, mimeType, fileName);

    if (!outcome.text || outcome.text.trim().length === 0) {
      console.warn(
        `[DirectUpload] No text extracted from ${evidenceId} (detected: ${outcome.detectedFormat}) — ${outcome.message}`,
      );
      await prisma.evidence.update({
        where: { evidenceId },
        data: {
          processingStatus: outcome.status,
          processingError: outcome.message,
          mimeType: outcome.detectedMimeType,
        },
      });
      return;
    }

    console.log(`[DirectUpload] Extracted ${outcome.text.length} chars from ${evidenceId}`);

    // Step 2: Chunk text and persist to EvidenceChunk table.
    // Extraction output can carry NUL bytes and lone surrogates, neither of
    // which PostgreSQL will accept in a text column.
    const clean = sanitizeExtractedText(outcome.text);
    const chunkResult = await chunkAndPersistEvidence(evidenceId, tenantId, clean);

    console.log(`[DirectUpload] Chunked ${evidenceId}: ${chunkResult.chunkCount} chunks in ${chunkResult.durationMs}ms`);

    // Step 3: Update evidence processing status. A qualified success (for
    // example a low-confidence scan) keeps its message so the caveat survives.
    await prisma.evidence.update({
      where: { evidenceId },
      data: {
        processingStatus: 'analyzed',
        processingError: outcome.message,
        mimeType: outcome.detectedMimeType,
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
        // Internal exception text is not shown to the user; it is in the logs.
        processingError:
          `"${fileName}" could not be processed because of an unexpected error while reading it. ` +
          'The file has been stored. Please retry the upload, and contact support with the file name if it fails again.',
      },
    }).catch((updateErr) => {
      console.error(`[DirectUpload] Failed to update error status for ${evidenceId}:`, updateErr);
    });
  }
}
