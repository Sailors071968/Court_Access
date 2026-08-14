// ============================================================================
// INC-001 regression — Import Job multipart size matrix (file ingestion).
//
// Production bug: deferring busboy file streams until after parts() finished
// deadlocked uploads ≳100 KB (uploadedBytes stayed 0). This test drives real
// @fastify/multipart through processImportJobMultipartUpload for realistic sizes.
//
// Release rule: every size must finish with uploadedBytes > 0 and parser auto-start
// signaled. A hang/timeout fails the release.
// ============================================================================

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import Fastify from 'fastify';
import multipart from '@fastify/multipart';

import { processImportJobMultipartUpload } from '../src/intelligence/inmates/importJobMultipartUpload.js';
import { MAX_UPLOAD_BYTES } from '../src/intelligence/inmates/rosterUploads.js';

/** Sizes that must never regress. 15/30 MB match Sacramento jail-scan PDFs. */
const SIZE_MATRIX_BYTES = [
  50 * 1024,
  100 * 1024,
  500 * 1024,
  5 * 1024 * 1024,
  15 * 1024 * 1024,
  30 * 1024 * 1024,
] as const;

/** Per-size wall clock. Hang = INC-001 returned. */
const PER_SIZE_TIMEOUT_MS = 60_000;

function pdfBytes(size: number): Buffer {
  const header = Buffer.from('%PDF-1.4\n%%EOF\n');
  if (size <= header.length) return Buffer.alloc(size, 0x41);
  return Buffer.concat([header, Buffer.alloc(size - header.length, 0x42)]);
}

function buildMultipart(fields: Record<string, string>, file: { field: string; filename: string; bytes: Buffer }) {
  const boundary = `----inc001-${randomUUID()}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
    `Content-Type: application/pdf\r\n\r\n`,
  ));
  chunks.push(file.bytes);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

describe('INC-001 Import Job multipart size matrix', () => {
  let app: ReturnType<typeof Fastify>;
  const jobs = new Map<string, {
    jobId: string;
    uploadedBytes: number;
    uploadStartedAt: string | null;
    uploadFinishedAt: string | null;
    status: string;
    autoProcessStarted: boolean;
    processStarted: boolean;
    comparisonStarted: boolean;
  }>();

  before(async () => {
    app = Fastify({ bodyLimit: MAX_UPLOAD_BYTES + 1024 * 1024 });
    await app.register(async (instance) => {
      await instance.register(multipart, {
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 20 },
      });

      instance.addHook('onRequest', async (request) => {
        (request as { user?: unknown }).user = {
          userId: 'inc001-tester',
          email: 'inc001@test.local',
          role: 'admin',
        };
      });

      instance.post('/api/admin/intelligence/import-jobs/:jobId/uploads', async (request, reply) => {
        const { jobId } = request.params as { jobId: string };
        const outcome = await processImportJobMultipartUpload({
          request: request as Parameters<typeof processImportJobMultipartUpload>[0]['request'],
          jobId,
          deps: {
            getImportJob: async (id) => jobs.get(id) ?? null,
            markBatchUploading: async (id) => {
              const job = jobs.get(id);
              if (!job) return;
              job.status = 'uploading';
              job.uploadStartedAt = job.uploadStartedAt ?? new Date().toISOString();
            },
            markBatchUploadFailed: async (id) => {
              const job = jobs.get(id);
              if (!job) return;
              job.status = 'failed';
            },
            storeJobFileUpload: async ({ jobId: id, jobFileId, stream }) => {
              // Drain exactly as production storeUpload does — backpressure must flow.
              let sizeBytes = 0;
              const hash = createHash('sha256');
              for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                sizeBytes += buf.length;
                hash.update(buf);
              }
              const job = jobs.get(id);
              if (!job) return { error: 'job missing' };
              if (sizeBytes === 0) return { error: 'The uploaded file is empty.' };
              job.uploadedBytes = sizeBytes;
              job.uploadFinishedAt = new Date().toISOString();
              job.status = 'uploaded';
              return {
                uploadId: randomUUID(),
                jobFileId,
                sha256: hash.digest('hex'),
                sizeBytes,
              };
            },
            maybeAutoProcess: async (id) => {
              const job = jobs.get(id);
              if (!job || job.uploadedBytes <= 0) return null;
              job.autoProcessStarted = true;
              job.processStarted = true; // parser enqueue
              job.comparisonStarted = true; // comparison enqueue signal for release gate
              job.status = 'processing';
              return { started: [randomUUID()] };
            },
            recordAccess: async () => undefined,
            trace: () => undefined,
          },
        });
        return reply.code(outcome.statusCode).send(outcome.body);
      });
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  for (const size of SIZE_MATRIX_BYTES) {
    it(
      `uploads ${size} bytes → uploadedBytes>0 → parser started → comparison started`,
      { timeout: PER_SIZE_TIMEOUT_MS },
      async () => {
        const jobId = randomUUID();
        const jobFileId = randomUUID();
        jobs.set(jobId, {
          jobId,
          uploadedBytes: 0,
          uploadStartedAt: null,
          uploadFinishedAt: null,
          status: 'pending',
          autoProcessStarted: false,
          processStarted: false,
          comparisonStarted: false,
        });

        const bytes = pdfBytes(size);
        const { body, contentType } = buildMultipart(
          { batchIndex: '0', jobFileId },
          { field: 'files', filename: `matrix-${size}.pdf`, bytes },
        );

        const started = Date.now();
        const res = await app.inject({
          method: 'POST',
          url: `/api/admin/intelligence/import-jobs/${jobId}/uploads`,
          headers: { 'content-type': contentType },
          payload: body,
        });
        const elapsed = Date.now() - started;

        assert.equal(res.statusCode, 201, `HTTP ${res.statusCode} body=${res.body.slice(0, 300)}`);
        const payload = res.json() as {
          accepted: { sizeBytes?: number }[];
          autoProcessStarted: boolean;
          job: { uploadedBytes: number; uploadStartedAt: string | null; uploadFinishedAt: string | null };
        };

        assert.ok(payload.accepted.length >= 1, 'accepted empty');
        assert.equal(payload.accepted[0]?.sizeBytes, size);
        assert.ok(payload.job.uploadedBytes > 0, 'uploadedBytes must be > 0');
        assert.equal(payload.job.uploadedBytes, size);
        assert.ok(payload.job.uploadStartedAt, 'uploadStartedAt required');
        assert.ok(payload.job.uploadFinishedAt, 'uploadFinishedAt required');
        assert.equal(payload.autoProcessStarted, true, 'parser must auto-start');

        const job = jobs.get(jobId)!;
        assert.equal(job.processStarted, true, 'parser started');
        assert.equal(job.comparisonStarted, true, 'comparison started');
        assert.ok(elapsed < PER_SIZE_TIMEOUT_MS - 1000, `suspected hang: ${elapsed}ms for ${size} bytes`);
      },
    );
  }
});
