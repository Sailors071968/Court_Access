// ============================================
// Court Access — File Utilities
// ============================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
  }
  return s3Client;
}

/**
 * Build deterministic S3 key from tenant, case, and document info.
 */
export function buildS3Key(tenantId: string, caseId: string, documentId: string, fileName: string): string {
  return `documents/${tenantId}/${caseId}/${documentId}-${fileName}`;
}

/**
 * Upload file to S3.
 */
export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Get a signed download URL from S3.
 */
export async function getS3DownloadUrl(key: string): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/**
 * Get file contents from S3.
 */
export async function getS3FileBuffer(key: string): Promise<Buffer> {
  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })
  );
  const stream = response.Body;
  if (!stream) throw new Error('Empty response from S3');
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Delete file from S3.
 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_NAME,
      Key: key,
    })
  );
}
