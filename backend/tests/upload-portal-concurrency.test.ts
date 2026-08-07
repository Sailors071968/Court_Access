// ============================================================================
// Upload portal — transfer integrity under concurrency and retry.
//
// receiveChunk reads the staged size, compares it to the declared offset, and
// then appends. That is a check-then-act sequence, so two chunks in flight for
// the same file could both pass the check and both append, duplicating or
// interleaving bytes. A client retrying a chunk that actually succeeded is the
// realistic way this happens.
//
// These tests hold the failure open rather than describing it: they fire
// genuinely concurrent chunks and assert the staged file is exactly the size it
// should be.
// ============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import prisma from '../src/lib/prisma.js';
import { receiveChunk } from '../src/certification/uploadPortal.js';

const TENANT = 'tenant-upload-concurrency-test';
let stagingDir: string;
let sessionId: string;

/** A fresh stream per call; a stream cannot be consumed twice. */
const chunkOf = (bytes: number) => Readable.from([Buffer.alloc(bytes, 0x41)]);

before(async () => {
  stagingDir = await mkdtemp(join(tmpdir(), 'upload-concurrency-'));
  const session = await prisma.certificationUploadSession.create({
    data: {
      reference: 'CONCURRENCY-TEST',
      label: 'Concurrency test corpus',
      tenantId: TENANT,
      createdById: 'test-user',
      stagingDir,
      status: 'staging',
    },
  });
  sessionId = session.uploadSessionId;
});

after(async () => {
  await prisma.certificationUploadSession
    .delete({ where: { uploadSessionId: sessionId } })
    .catch(() => undefined);
  await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
});

describe('Upload portal transfer integrity', () => {
  it('accepts a sequential chunk and reports the new offset', async () => {
    const result = await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'sequential.bin',
      declaredOffset: 0,
      totalSize: 200,
      isFinal: false,
      stream: chunkOf(100),
      tenantId: TENANT,
    });

    assert.equal(result.ok, true);
    assert.equal(result.offset, 100);
  });

  it('rejects a chunk sent for the wrong offset and says where to resume', async () => {
    const result = await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'sequential.bin',
      declaredOffset: 0, // the file already holds 100 bytes
      totalSize: 200,
      isFinal: false,
      stream: chunkOf(100),
      tenantId: TENANT,
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.equal(result.offset, 100, 'the client must be told the real offset');
  });

  it('does not duplicate bytes when the same chunk is sent twice concurrently', async () => {
    // Both calls declare offset 0. Exactly one may be applied; the other must
    // be refused. Without serialisation both could observe size 0 and append.
    const [a, b] = await Promise.all([
      receiveChunk({
        uploadSessionId: sessionId,
        relativePath: 'concurrent.bin',
        declaredOffset: 0,
        totalSize: 500,
        isFinal: false,
        stream: chunkOf(500),
        tenantId: TENANT,
      }),
      receiveChunk({
        uploadSessionId: sessionId,
        relativePath: 'concurrent.bin',
        declaredOffset: 0,
        totalSize: 500,
        isFinal: false,
        stream: chunkOf(500),
        tenantId: TENANT,
      }),
    ]);

    const accepted = [a, b].filter((r) => r.ok);
    assert.equal(accepted.length, 1, 'exactly one of two identical chunks may be applied');

    const staged = await stat(join(stagingDir, 'concurrent.bin'));
    assert.equal(staged.size, 500, 'the staged file must not contain duplicated bytes');
  });

  it('keeps bytes intact when several distinct files upload in parallel', async () => {
    const results = await Promise.all(
      ['a.bin', 'b.bin', 'c.bin', 'd.bin'].map((name, i) =>
        receiveChunk({
          uploadSessionId: sessionId,
          relativePath: name,
          declaredOffset: 0,
          totalSize: 64 * (i + 1),
          isFinal: true,
          stream: chunkOf(64 * (i + 1)),
          tenantId: TENANT,
        }),
      ),
    );

    assert.ok(results.every((r) => r.ok), 'parallel uploads of different files must all succeed');
    for (const [i, name] of ['a.bin', 'b.bin', 'c.bin', 'd.bin'].entries()) {
      const staged = await stat(join(stagingDir, name));
      assert.equal(staged.size, 64 * (i + 1), `${name} must hold exactly its own bytes`);
    }
  });

  it('refuses to finalise a file that arrived short', async () => {
    const result = await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'truncated.bin',
      declaredOffset: 0,
      totalSize: 1000,
      isFinal: true,
      stream: chunkOf(400),
      tenantId: TENANT,
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 422);
    assert.match(String(result.message), /truncated|needs to be sent again/i);
  });

  it('refuses to let a file grow past its declared size', async () => {
    const first = await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'overrun.bin',
      declaredOffset: 0,
      totalSize: 100,
      isFinal: false,
      stream: chunkOf(100),
      tenantId: TENANT,
    });
    assert.equal(first.ok, true);

    const overrun = await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'overrun.bin',
      declaredOffset: 100,
      totalSize: 100,
      isFinal: true,
      stream: chunkOf(50),
      tenantId: TENANT,
    });

    assert.equal(overrun.ok, false);
    assert.equal(overrun.status, 422);

    const staged = await stat(join(stagingDir, 'overrun.bin'));
    assert.ok(staged.size <= 150, 'the overrun must be reported, not silently accepted');
  });

  it('writes the bytes it was given, not a corrupted interleaving', async () => {
    await receiveChunk({
      uploadSessionId: sessionId,
      relativePath: 'content.bin',
      declaredOffset: 0,
      totalSize: 10,
      isFinal: true,
      stream: Readable.from([Buffer.from('0123456789')]),
      tenantId: TENANT,
    });

    const contents = await readFile(join(stagingDir, 'content.bin'), 'utf8');
    assert.equal(contents, '0123456789');
  });
});
