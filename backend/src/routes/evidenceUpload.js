// ============================================
// Court Access — Evidence Upload Routes
// Phase 28: Real Evidence Processing Pipeline
//
// Upload flow:
// 1. Client sends file via multipart form
// 2. Server validates file (size, type)
// 3. Virus scan (Phase 29)
// 4. Upload to R2 (Phase 31)
// 5. Create EvidenceRecord
// 6. Queue processing job (Phase 28)
// 7. Return evidence ID + status
// ============================================

import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { config } from '../config/index.js';
import prisma from '../services/prismaClient.js';
import { scanFile, isClamAVAvailable } from '../services/virusScanner.js';
import { uploadFile, getSignedDownloadUrl, getSignedUploadUrl, deleteFile, downloadFile } from '../services/r2Storage.js';
import { enqueueProcessingJob, getQueueStats } from '../workers/evidenceProcessor.js';
import { captureException, trackUploadFailure } from '../services/errorMonitoring.js';
import { authenticate } from '../middleware/auth.js';
import { uploadLimiterPerMinute, uploadLimiterPerHour } from '../middleware/rateLimiter.js';

const router = Router();

// Phase 94: All evidence routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// File Upload Configuration
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = {
  // Documents
  'application/pdf': { type: 'document', maxSize: 50 * 1024 * 1024 },
  'application/msword': { type: 'document', maxSize: 50 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', maxSize: 50 * 1024 * 1024 },
  'text/plain': { type: 'document', maxSize: 10 * 1024 * 1024 },
  // Images
  'image/jpeg': { type: 'image', maxSize: 25 * 1024 * 1024 },
  'image/png': { type: 'image', maxSize: 25 * 1024 * 1024 },
  'image/tiff': { type: 'image', maxSize: 25 * 1024 * 1024 },
  'image/webp': { type: 'image', maxSize: 25 * 1024 * 1024 },
  'image/bmp': { type: 'image', maxSize: 25 * 1024 * 1024 },
  // Audio
  'audio/mpeg': { type: 'audio', maxSize: 500 * 1024 * 1024 },
  'audio/wav': { type: 'audio', maxSize: 500 * 1024 * 1024 },
  'audio/mp4': { type: 'audio', maxSize: 500 * 1024 * 1024 },
  'audio/ogg': { type: 'audio', maxSize: 500 * 1024 * 1024 },
  'audio/flac': { type: 'audio', maxSize: 500 * 1024 * 1024 },
  // Video
  'video/mp4': { type: 'video', maxSize: 1024 * 1024 * 1024 },
  'video/quicktime': { type: 'video', maxSize: 1024 * 1024 * 1024 },
  'video/x-msvideo': { type: 'video', maxSize: 1024 * 1024 * 1024 },
  'video/webm': { type: 'video', maxSize: 1024 * 1024 * 1024 },
};

// Multer configuration — store in memory for virus scanning before R2 upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max (enforced per-type below)
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

// Phase 98: Rate limiting now handled by Redis-backed middleware (rateLimiter.js)
// In-memory Maps replaced with uploadLimiterPerMinute + uploadLimiterPerHour

/**
 * Helper: convert BigInt fields to Number for JSON serialization.
 * Prisma returns fileSize as BigInt; JSON.stringify cannot handle BigInt natively.
 */
function formatEvidenceRecord(record) {
  if (!record) return null;
  return {
    ...record,
    fileSize: typeof record.fileSize === 'bigint' ? Number(record.fileSize) : record.fileSize,
  };
}

// ---------------------------------------------------------------------------
// Routes — Static paths MUST be registered before parameterized /:evidenceId
// ---------------------------------------------------------------------------

/**
 * GET /api/evidence/queue/stats
 * Get processing queue statistics (admin).
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    const clamavAvailable = await isClamAVAvailable();
    const totalRecords = await prisma.evidenceRecord.count();

    res.json({
      queue: stats || { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      totalRecords,
      clamavAvailable,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

/**
 * GET /api/evidence/list/:caseId
 * List all evidence for a case.
 */
router.get('/list/:caseId', async (req, res) => {
  const { caseId } = req.params;
  const userId = req.user?.id || 'default';

  try {
    const records = await prisma.evidenceRecord.findMany({
      where: { caseId, userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ evidence: records.map(formatEvidenceRecord), total: records.length });
  } catch (err) {
    console.error(`[Evidence] List failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to list evidence' });
  }
});

/**
 * POST /api/evidence/presigned-upload
 * Generate a presigned upload URL for direct client-to-R2 uploads.
 * Used for large files to avoid passing through the backend.
 */
router.post('/presigned-upload', async (req, res) => {
  const userId = req.user?.id || 'default';
  const { filename, contentType, caseId } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename and contentType are required' });
  }

  const mimeConfig = ALLOWED_MIME_TYPES[contentType];
  if (!mimeConfig) {
    return res.status(400).json({ error: `Unsupported file type: ${contentType}` });
  }

  try {
    const evidenceId = `ev-${crypto.randomBytes(8).toString('hex')}`;
    const { signedUrl, storageKey } = await getSignedUploadUrl(
      userId, evidenceId, filename, contentType
    );

    // Create a pending evidence record in the database
    await prisma.evidenceRecord.create({
      data: {
        id: evidenceId,
        userId,
        caseId: caseId || 'unassigned',
        filename,
        contentType,
        evidenceType: mimeConfig.type,
        fileSize: BigInt(0),
        storageKey,
        status: 'pending_upload',
      },
    });

    res.json({
      evidenceId,
      uploadUrl: signedUrl,
      storageKey,
      expiresIn: 600, // 10 minutes
    });
  } catch (err) {
    console.error(`[Evidence] Presigned URL generation failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// ---------------------------------------------------------------------------
// Routes — Upload + parameterized routes
// ---------------------------------------------------------------------------

/**
 * POST /api/evidence/upload
 * Upload a single evidence file.
 *
 * Body: multipart form with 'file' field + optional 'caseId', 'description'
 */
router.post('/upload', uploadLimiterPerMinute, uploadLimiterPerHour, upload.single('file'), async (req, res) => {
  const userId = req.user?.id || 'default';
  const caseId = req.body?.caseId || 'unassigned';
  const description = req.body?.description || '';

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.file;
  const mimeConfig = ALLOWED_MIME_TYPES[file.mimetype];

  if (!mimeConfig) {
    return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
  }

  // Check per-type size limit
  if (file.size > mimeConfig.maxSize) {
    return res.status(400).json({
      error: `File too large. Maximum for ${mimeConfig.type}: ${Math.round(mimeConfig.maxSize / (1024 * 1024))}MB`,
    });
  }

  try {
    // Step 1: Generate evidence ID from file hash
    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const evidenceId = `ev-${sha256.substring(0, 16)}-${crypto.randomBytes(4).toString('hex')}`;

    console.log(`[Upload] Processing: ${file.originalname} (${mimeConfig.type}, ${file.size} bytes) → ${evidenceId}`);

    // Step 2: Virus scan
    console.log(`[Upload] Scanning file for malware...`);
    const scanResult = await scanFile(file.buffer);

    if (!scanResult.safe) {
      console.warn(`[Upload] REJECTED — malware detected: ${scanResult.threat} (scanner: ${scanResult.scanner})`);
      trackUploadFailure(evidenceId, new Error(`Malware detected: ${scanResult.threat}`), {
        filename: file.originalname,
        userId,
        scanner: scanResult.scanner,
      });
      return res.status(422).json({
        error: 'File rejected: malware detected',
        threat: scanResult.threat,
        scanner: scanResult.scanner,
      });
    }

    console.log(`[Upload] Scan passed (scanner: ${scanResult.scanner})`);

    // Step 3: Upload to R2
    let storageKey = null;
    try {
      storageKey = await uploadFile(
        userId,
        evidenceId,
        file.originalname,
        file.buffer,
        file.mimetype
      );
      console.log(`[Upload] Stored in R2: ${storageKey}`);
    } catch (err) {
      console.warn(`[Upload] R2 upload failed (${err.message}) — storing metadata only`);
      // Continue without R2 — the evidence record is still created
      // and can be re-processed when R2 becomes available
    }

    // Step 4: Create evidence record in database
    let record = await prisma.evidenceRecord.create({
      data: {
        id: evidenceId,
        userId,
        caseId,
        filename: file.originalname,
        contentType: file.mimetype,
        evidenceType: mimeConfig.type,
        fileSize: BigInt(file.size),
        sha256,
        storageKey,
        description,
        status: 'pending',
        scanResult: {
          safe: scanResult.safe,
          scanner: scanResult.scanner,
        },
      },
    });

    // Step 5: Queue processing job
    let jobId = null;
    try {
      const job = await enqueueProcessingJob(
        evidenceId,
        userId,
        mimeConfig.type,
        storageKey,
        {
          filename: file.originalname,
          contentType: file.mimetype,
          fileSize: file.size,
        }
      );
      jobId = job?.id || null;

      if (jobId) {
        record = await prisma.evidenceRecord.update({
          where: { id: evidenceId },
          data: { status: 'processing', jobId },
        });
      }
    } catch (err) {
      console.warn(`[Upload] Failed to queue processing job: ${err.message}`);
      // Record stays in 'pending' status — can be manually reprocessed
    }

    console.log(`[Upload] Complete: ${evidenceId} (status: ${record.status}, job: ${jobId || 'none'})`);

    res.status(201).json({
      evidenceId: record.id,
      status: record.status,
      evidenceType: record.evidenceType,
      filename: record.filename,
      fileSize: Number(record.fileSize),
      sha256: record.sha256,
      jobId,
      storageKey: record.storageKey,
    });
  } catch (err) {
    console.error(`[Upload] Error: ${err.message}`);
    captureException(err, { filename: file.originalname, userId });
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/evidence/:evidenceId
 * Get evidence record by ID.
 */
router.get('/:evidenceId', async (req, res) => {
  const { evidenceId } = req.params;
  const userId = req.user?.id || 'default';

  try {
    const record = await prisma.evidenceRecord.findFirst({
      where: { id: evidenceId, userId },
    });
    if (!record) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    res.json(formatEvidenceRecord(record));
  } catch (err) {
    console.error(`[Evidence] Get failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to get evidence record' });
  }
});

/**
 * GET /api/evidence/:evidenceId/download
 * Get a signed download URL for the evidence file.
 */
router.get('/:evidenceId/download', async (req, res) => {
  const { evidenceId } = req.params;
  const userId = req.user?.id || 'default';

  try {
    const record = await prisma.evidenceRecord.findFirst({
      where: { id: evidenceId, userId },
    });
    if (!record) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (!record.storageKey) {
      return res.status(404).json({ error: 'File not available in storage' });
    }

    const signedUrl = await getSignedDownloadUrl(userId, record.storageKey);
    res.json({ url: signedUrl, expiresIn: 3600 });
  } catch (err) {
    console.error(`[Evidence] Download URL generation failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * DELETE /api/evidence/:evidenceId
 * Delete an evidence record and its R2 file.
 */
router.delete('/:evidenceId', async (req, res) => {
  const { evidenceId } = req.params;
  const userId = req.user?.id || 'default';

  try {
    const record = await prisma.evidenceRecord.findFirst({
      where: { id: evidenceId, userId },
    });
    if (!record) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Delete from R2
    if (record.storageKey) {
      try {
        await deleteFile(userId, record.storageKey);
      } catch (err) {
        console.warn(`[Evidence] R2 deletion failed: ${err.message}`);
      }
    }

    await prisma.evidenceRecord.delete({ where: { id: evidenceId } });
    res.json({ deleted: true, evidenceId });
  } catch (err) {
    console.error(`[Evidence] Delete failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

/**
 * POST /api/evidence/:evidenceId/confirm-upload
 * Confirm that a presigned upload completed and trigger processing.
 */
router.post('/:evidenceId/confirm-upload', async (req, res) => {
  const { evidenceId } = req.params;
  const userId = req.user?.id || 'default';
  const { fileSize, sha256 } = req.body;

  try {
    const record = await prisma.evidenceRecord.findFirst({
      where: { id: evidenceId, userId },
    });
    if (!record) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (record.status !== 'pending_upload') {
      return res.status(400).json({ error: 'Evidence is not in pending_upload state' });
    }

    // Virus scan: download file from R2 and scan before proceeding
    let downloadedBuffer = null;
    let scanResultData = null;
    try {
      const fileBuffer = await downloadFile(userId, record.storageKey);
      downloadedBuffer = fileBuffer;
      console.log(`[Evidence] Downloaded ${record.storageKey} for virus scan (${fileBuffer.length} bytes)`);

      const scanResult = await scanFile(fileBuffer);
      if (!scanResult.safe) {
        console.warn(`[Evidence] REJECTED presigned upload — malware detected: ${scanResult.threat}`);
        // Delete infected file from R2
        try {
          await deleteFile(userId, record.storageKey);
        } catch (delErr) {
          console.error(`[Evidence] Failed to delete infected file: ${delErr.message}`);
        }
        await prisma.evidenceRecord.update({
          where: { id: evidenceId },
          data: {
            status: 'rejected',
            scanResult: { safe: false, threat: scanResult.threat, scanner: scanResult.scanner },
          },
        });
        return res.status(422).json({
          error: 'File rejected: malware detected',
          threat: scanResult.threat,
          scanner: scanResult.scanner,
        });
      }
      console.log(`[Evidence] Presigned upload scan passed (scanner: ${scanResult.scanner})`);
      scanResultData = { safe: true, scanner: scanResult.scanner };
    } catch (err) {
      console.warn(`[Evidence] Could not scan presigned upload (${err.message}) — proceeding with caution`);
      scanResultData = { safe: null, scanner: 'none', note: 'scan skipped — file not downloadable' };
    }

    // Compute fileSize and sha256 server-side when possible
    const computedFileSize = downloadedBuffer
      ? BigInt(downloadedBuffer.length)
      : BigInt(fileSize || 0);
    const computedSha256 = downloadedBuffer
      ? crypto.createHash('sha256').update(downloadedBuffer).digest('hex')
      : ''; // Server-side computation unavailable — hash left empty

    // Update record status and queue processing
    let updatedStatus = 'pending';
    let jobId = null;
    try {
      const job = await enqueueProcessingJob(
        evidenceId, userId, record.evidenceType, record.storageKey,
        { filename: record.filename, contentType: record.contentType, fileSize: Number(computedFileSize) }
      );
      if (job) {
        updatedStatus = 'processing';
        jobId = job.id;
      }
    } catch (err) {
      console.warn(`[Evidence] Failed to queue processing: ${err.message}`);
    }

    const updated = await prisma.evidenceRecord.update({
      where: { id: evidenceId },
      data: {
        fileSize: computedFileSize,
        sha256: computedSha256,
        status: updatedStatus,
        jobId,
        scanResult: scanResultData,
      },
    });

    res.json({ evidenceId, status: updated.status });
  } catch (err) {
    console.error(`[Evidence] Confirm upload failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

export default router;
