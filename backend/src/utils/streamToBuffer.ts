// ============================================================================
// Stream → Buffer utility
// Collects a readable stream into a single Buffer with memory safety limits.
// ============================================================================

import type { Readable } from 'node:stream';

/** Default maximum buffer size: 100 MB */
export const DEFAULT_MAX_BUFFER_BYTES = 100 * 1024 * 1024;

export class StreamSizeLimitError extends Error {
  constructor(bytesRead: number, maxBytes: number) {
    super(
      `Stream exceeded maximum buffer size: ${(bytesRead / (1024 * 1024)).toFixed(1)} MB read, ` +
      `limit is ${(maxBytes / (1024 * 1024)).toFixed(1)} MB`,
    );
    this.name = 'StreamSizeLimitError';
  }
}

/**
 * Read a Readable stream into a Buffer.
 * Handles both Node Readable and web ReadableStream (from AWS SDK).
 *
 * @param stream - Source stream
 * @param maxBytes - Maximum allowed buffer size in bytes (default: 100 MB).
 *                   Throws StreamSizeLimitError if exceeded.
 */
export async function streamToBuffer(
  stream: Readable | ReadableStream,
  maxBytes: number = DEFAULT_MAX_BUFFER_BYTES,
): Promise<Buffer> {
  // Node.js Readable (has Symbol.asyncIterator)
  if (Symbol.asyncIterator in stream) {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
      const buf = Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        // Attempt to destroy the stream to free resources
        if ('destroy' in stream && typeof (stream as Readable).destroy === 'function') {
          (stream as Readable).destroy();
        }
        throw new StreamSizeLimitError(totalBytes, maxBytes);
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  // Web ReadableStream fallback
  const reader = (stream as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new StreamSizeLimitError(totalBytes, maxBytes);
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
