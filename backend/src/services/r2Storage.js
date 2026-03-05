// ============================================
// Court Access — Cloudflare R2 Storage Service
// Phase 31: Secure Evidence Storage
//
// - Private R2 buckets (no public access)
// - Signed URLs for time-limited file access
// - Tenant-scoped upload paths
// - Access control verification before URL generation
// ============================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { config } from '../config/index.js';

let s3Client = null;

/**
 * Initialize the R2 S3-compatible client.
 */
function getClient() {
  if (s3Client) return s3Client;

  if (!config.r2AccessKeyId || !config.r2SecretAccessKey || !config.r2AccountId) {
    console.warn('[R2] Missing R2 credentials — storage operations will fail');
    return null;
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });

  console.log('[R2] Storage client initialized');
  return s3Client;
}

/**
 * Generate a tenant-scoped storage key for evidence files.
 * Format: tenants/{tenantId}/evidence/{evidenceId}/{filename}
 */
export function generateStorageKey(tenantId, evidenceId, filename) {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `tenants/${tenantId}/evidence/${evidenceId}/${sanitizedFilename}`;
}

/**
 * Upload a file buffer to R2.
 * Returns the storage key on success.
 */
export async function uploadFile(tenantId, evidenceId, filename, fileBuffer, contentType) {
  const client = getClient();
  if (!client) throw new Error('R2 storage not configured');

  const key = generateStorageKey(tenantId, evidenceId, filename);

  const command = new PutObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: {
      tenantId,
      evidenceId,
      uploadedAt: new Date().toISOString(),
      sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex'),
    },
  });

  await client.send(command);
  console.log(`[R2] Uploaded: ${key} (${fileBuffer.length} bytes)`);
  return key;
}

/**
 * Generate a signed URL for secure, time-limited file access.
 * Verifies that the requesting tenant owns the file before generating.
 *
 * @param tenantId - The tenant requesting access
 * @param storageKey - The R2 object key
 * @param expiresInSeconds - URL validity duration (default: 1 hour)
 * @returns Signed URL string
 */
export async function getSignedDownloadUrl(tenantId, storageKey, expiresInSeconds = 3600) {
  const client = getClient();
  if (!client) throw new Error('R2 storage not configured');

  // Tenant isolation: verify the key belongs to this tenant
  if (!storageKey.startsWith(`tenants/${tenantId}/`)) {
    throw new Error('Access denied: evidence does not belong to this tenant');
  }

  const command = new GetObjectCommand({
    Bucket: config.r2BucketName,
    Key: storageKey,
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  console.log(`[R2] Signed URL generated for: ${storageKey} (expires in ${expiresInSeconds}s)`);
  return signedUrl;
}

/**
 * Generate a signed upload URL for direct client-to-R2 uploads.
 * This allows the frontend to upload directly to R2 without passing through the backend.
 */
export async function getSignedUploadUrl(tenantId, evidenceId, filename, contentType, expiresInSeconds = 600) {
  const client = getClient();
  if (!client) throw new Error('R2 storage not configured');

  const key = generateStorageKey(tenantId, evidenceId, filename);

  const command = new PutObjectCommand({
    Bucket: config.r2BucketName,
    Key: key,
    ContentType: contentType,
    Metadata: {
      tenantId,
      evidenceId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return { signedUrl, storageKey: key };
}

/**
 * Delete a file from R2.
 * Verifies tenant ownership before deletion.
 */
export async function deleteFile(tenantId, storageKey) {
  const client = getClient();
  if (!client) throw new Error('R2 storage not configured');

  // Tenant isolation check
  if (!storageKey.startsWith(`tenants/${tenantId}/`)) {
    throw new Error('Access denied: evidence does not belong to this tenant');
  }

  const command = new DeleteObjectCommand({
    Bucket: config.r2BucketName,
    Key: storageKey,
  });

  await client.send(command);
  console.log(`[R2] Deleted: ${storageKey}`);
}

/**
 * Check if a file exists in R2.
 */
export async function fileExists(storageKey) {
  const client = getClient();
  if (!client) return false;

  try {
    const command = new HeadObjectCommand({
      Bucket: config.r2BucketName,
      Key: storageKey,
    });
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}
