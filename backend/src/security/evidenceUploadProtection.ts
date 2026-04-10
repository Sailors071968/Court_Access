// ============================================================================
// Phase 195 — Evidence Upload Protection
// File type validation, hash verification, max file size enforcement,
// malicious file rejection
// ============================================================================

import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum file sizes by category (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  document: 500 * 1024 * 1024,   // 500MB for documents (PDF, DOCX) — large discovery packets
  video: 10 * 1024 * 1024 * 1024, // 10GB for video evidence (bodycam, dashcam)
  image: 100 * 1024 * 1024,      // 100MB for images (high-res forensic photos)
  audio: 500 * 1024 * 1024,      // 500MB for audio (long recordings)
  default: 500 * 1024 * 1024,    // 500MB default
};

// Allowed MIME types by category
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  document: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'text/plain',
    'text/csv',
    'application/json',
  ],
  video: [
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo',  // .avi
    'video/webm',
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
  ],
  audio: [
    'audio/mpeg',  // .mp3
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
  ],
};

const ALL_ALLOWED_MIME_TYPES = new Set(
  Object.values(ALLOWED_MIME_TYPES).flat(),
);

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.txt', '.csv', '.json',
  '.mp4', '.mov', '.avi', '.webm',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp',
  '.mp3', '.wav', '.ogg',
]);

// Dangerous file extensions (always reject)
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.js', '.jse', '.wsf', '.wsh', '.ps1', '.psm1',
  '.sh', '.bash', '.csh', '.ksh',
  '.php', '.asp', '.aspx', '.jsp',
  '.dll', '.sys', '.drv', '.ocx',
  '.jar', '.class', '.war',
  '.py', '.pyc', '.pyo',
  '.rb', '.pl', '.cgi',
  '.reg', '.inf', '.hta',
  '.lnk', '.url', '.desktop',
  '.svg', // SVG can contain scripts
]);

// Magic bytes for file type verification
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp at offset 4
  'application/zip': [[0x50, 0x4B, 0x03, 0x04]], // PK (also used by docx)
};

// ---------------------------------------------------------------------------
// File hash store (for deduplication and integrity)
// ---------------------------------------------------------------------------

const fileHashStore = new Map<string, { originalName: string; uploadedAt: string; userId: string }>();

// ---------------------------------------------------------------------------
// Validation Functions
// ---------------------------------------------------------------------------

export function getFileCategory(mimeType: string): string {
  for (const [category, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (types.includes(mimeType)) return category;
  }
  return 'default';
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

export function validateFileExtension(filename: string): { valid: boolean; reason?: string } {
  const ext = getFileExtension(filename);

  if (!ext) {
    return { valid: false, reason: 'File has no extension' };
  }

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension ${ext} is not allowed (potentially dangerous)` };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension ${ext} is not in the allowed list` };
  }

  return { valid: true };
}

export function validateMimeType(mimeType: string): { valid: boolean; reason?: string } {
  if (!mimeType) {
    return { valid: false, reason: 'MIME type is required' };
  }

  if (!ALL_ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, reason: `MIME type ${mimeType} is not allowed` };
  }

  return { valid: true };
}

export function validateFileSize(size: number, mimeType: string): { valid: boolean; reason?: string; maxSize: number } {
  const category = getFileCategory(mimeType);
  const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;

  if (size <= 0) {
    return { valid: false, reason: 'File size must be greater than 0', maxSize };
  }

  if (size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const fileMB = Math.round(size / (1024 * 1024));
    return {
      valid: false,
      reason: `File size (${fileMB}MB) exceeds maximum allowed size (${maxMB}MB) for ${category} files`,
      maxSize,
    };
  }

  return { valid: true, maxSize };
}

export function validateMagicBytes(buffer: Buffer, claimedMimeType: string): { valid: boolean; reason?: string } {
  const expectedSignatures = MAGIC_BYTES[claimedMimeType];
  if (!expectedSignatures) {
    // No magic bytes check available for this type
    return { valid: true };
  }

  for (const signature of expectedSignatures) {
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return { valid: true };
  }

  return {
    valid: false,
    reason: `File content does not match claimed MIME type ${claimedMimeType} (magic bytes mismatch)`,
  };
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function checkDuplicateFile(hash: string): { isDuplicate: boolean; existingRecord?: { originalName: string; uploadedAt: string } } {
  const existing = fileHashStore.get(hash);
  if (existing) {
    return { isDuplicate: true, existingRecord: { originalName: existing.originalName, uploadedAt: existing.uploadedAt } };
  }
  return { isDuplicate: false };
}

export function registerFileHash(hash: string, originalName: string, userId: string): void {
  fileHashStore.set(hash, {
    originalName,
    uploadedAt: new Date().toISOString(),
    userId,
  });
}

// ---------------------------------------------------------------------------
// Malicious Content Detection (basic patterns)
// ---------------------------------------------------------------------------

const MALICIOUS_PATTERNS = [
  /<script[\s>]/i,          // Script tags
  /javascript:/i,           // JavaScript protocol
  /on\w+\s*=/i,            // Event handlers (onclick, onerror, etc.)
  /eval\s*\(/i,            // eval() calls
  /document\.\w+/i,        // DOM manipulation
  /window\.\w+/i,          // Window object access
  /__import__/i,           // Python import
  /exec\s*\(/i,            // exec() calls
  /system\s*\(/i,          // system() calls
  /\bpasswd\b/i,           // Password file references
  /\/etc\/shadow/i,        // Shadow file references
  /rm\s+-rf/i,             // Destructive commands
];

export function scanForMaliciousContent(content: string): { safe: boolean; threats: string[] } {
  const threats: string[] = [];

  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      threats.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}

// ---------------------------------------------------------------------------
// Comprehensive Upload Validation
// ---------------------------------------------------------------------------

export interface UploadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileHash?: string;
  isDuplicate?: boolean;
}

export function validateUpload(
  filename: string,
  mimeType: string,
  size: number,
  buffer: Buffer | null,
): UploadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. File extension validation
  const extResult = validateFileExtension(filename);
  if (!extResult.valid) errors.push(extResult.reason!);

  // 2. MIME type validation
  const mimeResult = validateMimeType(mimeType);
  if (!mimeResult.valid) errors.push(mimeResult.reason!);

  // 3. File size validation
  const sizeResult = validateFileSize(size, mimeType);
  if (!sizeResult.valid) errors.push(sizeResult.reason!);

  // 4. Magic bytes validation (if buffer provided)
  let fileHash: string | undefined;
  let isDuplicate = false;

  if (buffer) {
    const magicResult = validateMagicBytes(buffer, mimeType);
    if (!magicResult.valid) errors.push(magicResult.reason!);

    // 5. Compute hash for integrity and dedup
    fileHash = computeFileHash(buffer);
    const dupResult = checkDuplicateFile(fileHash);
    isDuplicate = dupResult.isDuplicate;
    if (isDuplicate) {
      warnings.push(`Duplicate file detected (matches: ${dupResult.existingRecord?.originalName}, uploaded: ${dupResult.existingRecord?.uploadedAt})`);
    }

    // 6. Malicious content scan (for text-based files)
    const textTypes = ['text/plain', 'text/csv', 'application/json', 'text/html'];
    if (textTypes.includes(mimeType)) {
      const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024 * 1024)); // Scan first 1MB
      const scanResult = scanForMaliciousContent(content);
      if (!scanResult.safe) {
        errors.push(...scanResult.threats);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fileHash,
    isDuplicate,
  };
}

// ---------------------------------------------------------------------------
// Upload Protection Hook
// ---------------------------------------------------------------------------

export async function uploadProtectionHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = request.url.split('?')[0];

  // Only check upload routes
  if (request.method !== 'POST') return;
  if (!path.includes('/upload') && !path.includes('/ingest') && !path.includes('/import')) return;

  const contentType = request.headers['content-type'] || '';
  const contentLength = parseInt(request.headers['content-length'] || '0', 10);

  // Determine max size based on content type
  let category = 'default';
  if (contentType.startsWith('video/')) category = 'video';
  else if (contentType.startsWith('audio/')) category = 'audio';
  else if (contentType.startsWith('image/')) category = 'image';
  else if (contentType.includes('pdf') || contentType.includes('document') || contentType.includes('text')) category = 'document';

  const maxSize = MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;
  if (contentLength > maxSize) {
    const maxDisplay = maxSize >= 1024 * 1024 * 1024
      ? `${Math.round(maxSize / (1024 * 1024 * 1024))}GB`
      : `${Math.round(maxSize / (1024 * 1024))}MB`;
    const sizeDisplay = contentLength >= 1024 * 1024 * 1024
      ? `${(contentLength / (1024 * 1024 * 1024)).toFixed(1)}GB`
      : `${Math.round(contentLength / (1024 * 1024))}MB`;
    reply.code(413).send({
      error: 'Payload Too Large',
      message: `Upload size (${sizeDisplay}) exceeds maximum (${maxDisplay}) for ${category} files`,
      maxSize,
    });
    return;
  }

  // Reject clearly dangerous content types
  if (contentType.includes('application/x-executable') || contentType.includes('application/x-dosexec')) {
    reply.code(415).send({
      error: 'Unsupported Media Type',
      message: 'Executable files are not allowed',
    });
    return;
  }
}

// ---------------------------------------------------------------------------
// Exported configuration for reports
// ---------------------------------------------------------------------------

export const UPLOAD_PROTECTION_CONFIG = {
  maxFileSizes: MAX_FILE_SIZES,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  allowedExtensions: [...ALLOWED_EXTENSIONS],
  dangerousExtensions: [...DANGEROUS_EXTENSIONS],
  magicBytesChecked: Object.keys(MAGIC_BYTES),
  maliciousPatternsCount: MALICIOUS_PATTERNS.length,
  features: {
    fileExtensionValidation: true,
    mimeTypeValidation: true,
    fileSizeEnforcement: true,
    magicBytesVerification: true,
    hashComputation: true,
    duplicateDetection: true,
    maliciousContentScan: true,
    dangerousExtensionBlocking: true,
  },
};
