// ============================================================================
// Shared Cloudflare R2 Client (S3-compatible)
// Centralizes R2 configuration so it can be reused by evidence routes,
// text extraction, admin routes, etc. without duplicating env-var reads.
// ============================================================================

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? 'courtaccess-evidence';

let _client: S3Client | null = null;

/**
 * Return a singleton S3Client configured for Cloudflare R2.
 */
export function getR2Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

/**
 * Fetch an object from R2 by key. Returns the response body stream
 * and content metadata, or null if the object doesn't exist.
 */
export async function getR2Object(key: string): Promise<{
  body: Readable;
  contentType: string | undefined;
  contentLength: number | undefined;
} | null> {
  const client = getR2Client();
  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    );
    if (!response.Body) return null;
    return {
      body: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (err: unknown) {
    // NoSuchKey → return null instead of throwing
    if (err instanceof Error && 'name' in err && err.name === 'NoSuchKey') {
      return null;
    }
    throw err;
  }
}
