// ============================================================================
// Stream → Buffer utility
// Collects a readable stream into a single Buffer.
// ============================================================================

import type { Readable } from 'node:stream';

/**
 * Read a Readable stream into a Buffer.
 * Handles both Node Readable and web ReadableStream (from AWS SDK).
 */
export async function streamToBuffer(stream: Readable | ReadableStream): Promise<Buffer> {
  // Node.js Readable (has Symbol.asyncIterator)
  if (Symbol.asyncIterator in stream) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  // Web ReadableStream fallback
  const reader = (stream as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
