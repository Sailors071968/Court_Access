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
import { scanFile, isClamAVAvailable } from '../services/virusScanner.js';
import { uploadFile, getSignedDownloadUrl, getSignedUploadUrl, deleteFile, downloadFile } from '../services/r2Storage.js';
import { enqueueProcessingJob, getQueueStats } from '../workers/evidenceProcessor.js';
import { captureException, trackUploadFailure } from '../services/errorMonitoring.js';

const router = Router();

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

// In-memory evidence store (replace with database in production)
const evidenceRecords = new Map();

// Rate limiting — per-tenant upload tracking
const uploadRateLimits = new Map();

// Cleanup stale rate limit entries every 60 seconds (unref to not block graceful shutdown)
const rateLimitCleanupTimer = setInterval(() => {
  const currentMinute = Math.floor(Date.now() / 60000);
  for (const [key] of uploadRateLimits) {
    const parts = key.split('-');
    const keyMinute = parseInt(parts[parts.length - 1], 10);
    if (currentMinute - keyMinute > 2) {
      uploadRateLimits.delete(key);
    }
  }
}, 60000);
if (rateLimitCleanupTimer.unref) rateLimitCleanupTimer.unref();

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

    res.json({
      queue: stats || { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      totalRecords: evidenceRecords.size,
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
router.get('/list/:caseId', (req, res) => {
  const { caseId } = req.params;
  const tenantId = req.headers['x-tenant-id'] || 'default';

  const records = Array.from(evidenceRecords.values())
    .filter((r) => r.caseId === caseId && r.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ evidence: records, total: records.length });
});

/**
 * POST /api/evidence/presigned-upload
 * Generate a presigned upload URL for direct client-to-R2 uploads.
 * Used for large files to avoid passing through the backend.
 */
router.post('/presigned-upload', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'default';
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
      tenantId, evidenceId, filename, contentType
    );

    // Create a pending evidence record
    evidenceRecords.set(evidenceId, {
      id: evidenceId,
      tenantId,
      caseId: caseId || 'unassigned',
      filename,
      contentType,
      evidenceType: mimeConfig.type,
      fileSize: 0, // Updated after upload completes
      storageKey,
      status: 'pending_upload',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
 * Headers: x-tenant-id (required)
 * Body: multipart form with 'file' field + optional 'caseId', 'description'
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'default';
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

  // Rate limiting: max 20 uploads per tenant per minute
  const rateLimitKey = `${tenantId}-${Math.floor(Date.now() / 60000)}`;
  const currentCount = uploadRateLimits.get(rateLimitKey) || 0;
  if (currentCount >= 20) {
    return res.status(429).json({ error: 'Upload rate limit exceeded. Try again in a minute.' });
  }
  uploadRateLimits.set(rateLimitKey, currentCount + 1);

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
        tenantId,
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
        tenantId,
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

    // Step 4: Create evidence record
    const record = {
      id: evidenceId,
      tenantId,
      caseId,
      filename: file.originalname,
      contentType: file.mimetype,
      evidenceType: mimeConfig.type,
      fileSize: file.size,
      sha256,
      storageKey,
      description,
      status: 'pending', // pending → processing → complete | error
      processingResult: null,
      scanResult: {
        safe: scanResult.safe,
        scanner: scanResult.scanner,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evidenceRecords.set(evidenceId, record);

    // Step 5: Queue processing job
    let jobId = null;
    try {
      const job = await enqueueProcessingJob(
        evidenceId,
        tenantId,
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
        record.status = 'processing';
        record.jobId = jobId;
        evidenceRecords.set(evidenceId, record);
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
      fileSize: record.fileSize,
      sha256: record.sha256,
      jobId,
      storageKey: record.storageKey,
    });
  } catch (err) {
    console.error(`[Upload] Error: ${err.message}`);
    captureException(err, { filename: file.originalname, tenantId });
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/evidence/:evidenceId
 * Get evidence record by ID.
 */
router.get('/:evidenceId', (req, res) => {
  const { evidenceId } = req.params;
  const tenantId = req.headers['x-tenant-id'] || 'default';

  const record = evidenceRecords.get(evidenceId);
  if (!record) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  // Tenant isolation
  if (record.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  res.json(record);
});

/**
 * GET /api/evidence/:evidenceId/download
 * Get a signed download URL for the evidence file.
 */
router.get('/:evidenceId/download', async (req, res) => {
  const { evidenceId } = req.params;
  const tenantId = req.headers['x-tenant-id'] || 'default';

  const record = evidenceRecords.get(evidenceId);
  if (!record) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (record.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (!record.storageKey) {
    return res.status(404).json({ error: 'File not available in storage' });
  }

  try {
    const signedUrl = await getSignedDownloadUrl(tenantId, record.storageKey);
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
  const tenantId = req.headers['x-tenant-id'] || 'default';

  const record = evidenceRecords.get(evidenceId);
  if (!record) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (record.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  // Delete from R2
  if (record.storageKey) {
    try {
      await deleteFile(tenantId, record.storageKey);
    } catch (err) {
      console.warn(`[Evidence] R2 deletion failed: ${err.message}`);
    }
  }

  evidenceRecords.delete(evidenceId);
  res.json({ deleted: true, evidenceId });
});

/**
 * POST /api/evidence/:evidenceId/confirm-upload
 * Confirm that a presigned upload completed and trigger processing.
 */
router.post('/:evidenceId/confirm-upload', async (req, res) => {
  const { evidenceId } = req.params;
  const tenantId = req.headers['x-tenant-id'] || 'default';
  const { fileSize, sha256 } = req.body;

  const record = evidenceRecords.get(evidenceId);
  if (!record || record.tenantId !== tenantId) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  if (record.status !== 'pending_upload') {
    return res.status(400).json({ error: 'Evidence is not in pending_upload state' });
  }

  // Virus scan: download file from R2 and scan before proceeding
  try {
    const fileBuffer = await downloadFile(tenantId, record.storageKey);
    console.log(`[Evidence] Downloaded ${record.storageKey} for virus scan (${fileBuffer.length} bytes)`);

    const scanResult = await scanFile(fileBuffer);
    if (!scanResult.safe) {
      console.warn(`[Evidence] REJECTED presigned upload — malware detected: ${scanResult.threat}`);
      // Delete infected file from R2
      try {
        await deleteFile(tenantId, record.storageKey);
      } catch (delErr) {
        console.error(`[Evidence] Failed to delete infected file: ${delErr.message}`);
      }
      record.status = 'rejected';
      record.scanResult = { safe: false, threat: scanResult.threat, scanner: scanResult.scanner };
      record.updatedAt = new Date().toISOString();
      evidenceRecords.set(evidenceId, record);
      return res.status(422).json({
        error: 'File rejected: malware detected',
        threat: scanResult.threat,
        scanner: scanResult.scanner,
      });
    }
    console.log(`[Evidence] Presigned upload scan passed (scanner: ${scanResult.scanner})`);
    record.scanResult = { safe: true, scanner: scanResult.scanner };
  } catch (err) {
    console.warn(`[Evidence] Could not scan presigned upload (${err.message}) — proceeding with caution`);
    // If R2 download fails (e.g. R2 not configured), proceed but flag as unscanned
    record.scanResult = { safe: null, scanner: 'none', note: 'scan skipped — file not downloadable' };
  }

  // Update record
  record.fileSize = fileSize || 0;
  record.sha256 = sha256 || '';
  record.status = 'pending';
  record.updatedAt = new Date().toISOString();

  // Queue processing
  try {
    const job = await enqueueProcessingJob(
      evidenceId, tenantId, record.evidenceType, record.storageKey,
      { filename: record.filename, contentType: record.contentType, fileSize: record.fileSize }
    );
    if (job) {
      record.status = 'processing';
      record.jobId = job.id;
    }
  } catch (err) {
    console.warn(`[Evidence] Failed to queue processing: ${err.message}`);
  }

  evidenceRecords.set(evidenceId, record);
  res.json({ evidenceId, status: record.status });
});

export default router;
