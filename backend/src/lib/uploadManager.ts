// ============================================================================
// CourtAccess — Upload Manager (System Hardening)
// Manages concurrent uploads per tenant, tracks upload progress,
// and enforces per-tenant resource quotas to prevent any single tenant
// from consuming all system resources.
//
// For large files (video), the client uses presigned URLs to upload
// directly to R2. This module tracks and limits those uploads.
// ============================================================================

// ---------------------------------------------------------------------------
// Configuration (tuneable via environment variables)
// ---------------------------------------------------------------------------

/** Maximum concurrent uploads per tenant */
const MAX_CONCURRENT_UPLOADS_PER_TENANT = parseInt(
  process.env.MAX_CONCURRENT_UPLOADS_PER_TENANT || '5', 10,
);

/** Maximum concurrent uploads across all tenants */
const MAX_CONCURRENT_UPLOADS_GLOBAL = parseInt(
  process.env.MAX_CONCURRENT_UPLOADS_GLOBAL || '50', 10,
);

/** Upload tracking expiry in ms (auto-cleanup stale entries) */
const UPLOAD_EXPIRY_MS = parseInt(
  process.env.UPLOAD_EXPIRY_MS || String(2 * 60 * 60 * 1000), 10, // 2 hours
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadRecord {
  uploadId: string;
  tenantId: string;
  userId: string;
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  startedAt: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
}

export interface TenantUploadQuota {
  maxConcurrentUploads: number;
  maxStorageBytes: number;
  maxFileSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Upload Tracking Store
// ---------------------------------------------------------------------------

const activeUploads = new Map<string, UploadRecord>();

// Cleanup stale uploads every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, record] of activeUploads) {
    if (now - record.startedAt > UPLOAD_EXPIRY_MS) {
      activeUploads.delete(id);
    }
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// Upload Management Functions
// ---------------------------------------------------------------------------

/**
 * Check if a tenant can start a new upload.
 * Returns an error message if the upload should be rejected.
 */
export function canStartUpload(tenantId: string): { allowed: boolean; reason?: string } {
  // Check per-tenant limit
  const tenantUploads = getTenantActiveUploads(tenantId);
  if (tenantUploads.length >= MAX_CONCURRENT_UPLOADS_PER_TENANT) {
    return {
      allowed: false,
      reason: `Concurrent upload limit reached (${MAX_CONCURRENT_UPLOADS_PER_TENANT}). Please wait for existing uploads to complete.`,
    };
  }

  // Check global limit
  const globalActive = getActiveUploadCount();
  if (globalActive >= MAX_CONCURRENT_UPLOADS_GLOBAL) {
    return {
      allowed: false,
      reason: 'System is at maximum upload capacity. Please try again shortly.',
    };
  }

  return { allowed: true };
}

/**
 * Register a new upload. Call this when a presigned URL is generated.
 */
export function registerUpload(record: UploadRecord): void {
  activeUploads.set(record.uploadId, record);
  console.log(
    `[UploadManager] Upload registered: ${record.uploadId} (tenant: ${record.tenantId}, ` +
    `file: ${record.fileName}, size: ${formatBytes(record.fileSize)})`,
  );
}

/**
 * Mark an upload as completed. Call this when evidence metadata is saved.
 */
export function completeUpload(uploadId: string): void {
  const record = activeUploads.get(uploadId);
  if (record) {
    record.status = 'completed';
    // Remove after a short delay to prevent race conditions
    setTimeout(() => activeUploads.delete(uploadId), 5_000);
  }
}

/**
 * Mark an upload as failed.
 */
export function failUpload(uploadId: string): void {
  const record = activeUploads.get(uploadId);
  if (record) {
    record.status = 'failed';
    setTimeout(() => activeUploads.delete(uploadId), 5_000);
  }
}

// ---------------------------------------------------------------------------
// Query Functions
// ---------------------------------------------------------------------------

/**
 * Get all active uploads for a tenant.
 */
export function getTenantActiveUploads(tenantId: string): UploadRecord[] {
  const uploads: UploadRecord[] = [];
  for (const record of activeUploads.values()) {
    if (record.tenantId === tenantId && (record.status === 'pending' || record.status === 'uploading')) {
      uploads.push(record);
    }
  }
  return uploads;
}

/**
 * Get total active upload count across all tenants.
 */
export function getActiveUploadCount(): number {
  let count = 0;
  for (const record of activeUploads.values()) {
    if (record.status === 'pending' || record.status === 'uploading') {
      count++;
    }
  }
  return count;
}

/**
 * Get upload manager statistics for monitoring.
 */
export function getUploadManagerStats(): {
  activeUploads: number;
  totalTracked: number;
  perTenant: Record<string, number>;
  limits: { perTenant: number; global: number };
} {
  const perTenant: Record<string, number> = {};
  let active = 0;

  for (const record of activeUploads.values()) {
    if (record.status === 'pending' || record.status === 'uploading') {
      active++;
      perTenant[record.tenantId] = (perTenant[record.tenantId] || 0) + 1;
    }
  }

  return {
    activeUploads: active,
    totalTracked: activeUploads.size,
    perTenant,
    limits: {
      perTenant: MAX_CONCURRENT_UPLOADS_PER_TENANT,
      global: MAX_CONCURRENT_UPLOADS_GLOBAL,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
