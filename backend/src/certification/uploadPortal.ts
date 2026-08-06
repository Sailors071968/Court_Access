// ============================================================================
// Gold Standard upload portal.
//
// Lets an administrator send a complete discovery set from their own machine —
// a folder, a pile of PDFs, a ZIP, mixed media — with no shell, no SFTP and no
// server-side file handling. Bytes arrive in chunks and are appended to a
// staging tree that mirrors the folder the operator selected, so the existing
// importer can then treat it exactly like a delivery already on disk.
//
// Resume is deliberately derived from the staging file's size on disk rather
// than from a bookkeeping row: a crash mid-upload cannot leave the two
// disagreeing, and the browser can always ask where to continue from.
// ============================================================================

import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import prisma from '../lib/prisma.js';

export const STAGING_ROOT = process.env.CERTIFICATION_STAGING_DIR || '/var/tmp/courtaccess-certification-staging';

/** Chunk size the browser is told to use. Small enough to resume cheaply. */
export const CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Reject anything that would escape the staging directory. Browsers send the
 * folder path the operator chose, which is untrusted input.
 */
export function safeRelativePath(relativePath: string): string | null {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter((s) => s.length > 0);

  if (segments.length === 0) return null;
  if (segments.some((s) => s === '.' || s === '..')) return null;
  // Windows drive letters and reserved device names.
  if (/^[a-z]:$/i.test(segments[0])) return null;
  if (segments.some((s) => /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s))) return null;
  if (segments.some((s) => s.includes('\0'))) return null;

  return segments.join('/');
}

export function stagingPathFor(stagingDir: string, relativePath: string): string | null {
  const safe = safeRelativePath(relativePath);
  if (!safe) return null;
  const target = path.join(stagingDir, safe);
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(stagingDir);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) return null;
  return target;
}

export interface CreateSessionInput {
  reference: string;
  label: string;
  description?: string;
  declaredFileCount: number;
  declaredBytes: number;
  user: { userId: string; tenantId: string };
}

export async function createUploadSession(input: CreateSessionInput) {
  const session = await prisma.certificationUploadSession.create({
    data: {
      reference: input.reference,
      label: input.label,
      description: input.description,
      tenantId: input.user.tenantId,
      createdById: input.user.userId,
      stagingDir: '',
      declaredFileCount: input.declaredFileCount,
      declaredBytes: BigInt(input.declaredBytes),
      progressTotal: input.declaredFileCount,
      stage: 'Waiting for files',
    },
  });

  const stagingDir = path.join(STAGING_ROOT, session.uploadSessionId);
  await fs.mkdir(stagingDir, { recursive: true });

  return prisma.certificationUploadSession.update({
    where: { uploadSessionId: session.uploadSessionId },
    data: { stagingDir },
  });
}

export interface ChunkResult {
  ok: boolean;
  status: number;
  error?: string;
  message?: string;
  /** Bytes now held for this file; where the browser should resume from. */
  offset?: number;
  complete?: boolean;
}

/**
 * Append one chunk. The client states the offset it believes the server holds;
 * a mismatch is reported with the true offset rather than silently corrupting
 * the file by appending in the wrong place.
 */
export async function receiveChunk(params: {
  uploadSessionId: string;
  relativePath: string;
  declaredOffset: number;
  totalSize: number;
  lastModifiedMs?: number;
  isFinal: boolean;
  stream: NodeJS.ReadableStream;
  tenantId: string;
}): Promise<ChunkResult> {
  const session = await prisma.certificationUploadSession.findUnique({
    where: { uploadSessionId: params.uploadSessionId },
  });

  if (!session || session.tenantId !== params.tenantId) {
    return { ok: false, status: 404, error: 'Not Found', message: 'No such upload session.' };
  }
  if (session.status === 'cancelled') {
    return { ok: false, status: 409, error: 'Cancelled', message: 'This upload was cancelled.' };
  }
  if (session.status !== 'staging') {
    return {
      ok: false,
      status: 409,
      error: 'Closed',
      message: `This upload has moved on to ${session.status} and is no longer accepting files.`,
    };
  }

  const target = stagingPathFor(session.stagingDir, params.relativePath);
  if (!target) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid path',
      message: `"${params.relativePath}" is not a usable path inside the upload.`,
    };
  }

  await fs.mkdir(path.dirname(target), { recursive: true });

  const current = await fs.stat(target).then((s) => s.size).catch(() => 0);
  if (current !== params.declaredOffset) {
    // Tell the browser where the file really stands so it can resume correctly.
    return {
      ok: false,
      status: 409,
      error: 'Offset mismatch',
      message:
        `The server holds ${current} byte(s) of "${params.relativePath}" but the chunk was sent for offset ` +
        `${params.declaredOffset}. Resume from ${current}.`,
      offset: current,
    };
  }

  const writeStream = createWriteStream(target, { flags: 'a' });
  await pipeline(params.stream, writeStream);

  const offset = await fs.stat(target).then((s) => s.size).catch(() => 0);

  if (params.isFinal) {
    if (params.totalSize > 0 && offset !== params.totalSize) {
      return {
        ok: false,
        status: 422,
        error: 'Incomplete file',
        message:
          `"${params.relativePath}" finished at ${offset} bytes but was declared as ${params.totalSize}. ` +
          'The transfer was truncated; the file needs to be sent again.',
        offset,
      };
    }
    // Preserve the modification time from the operator's machine.
    if (params.lastModifiedMs && Number.isFinite(params.lastModifiedMs)) {
      const when = new Date(params.lastModifiedMs);
      await fs.utimes(target, when, when).catch(() => {});
    }
  }

  return { ok: true, status: 200, offset, complete: params.isFinal };
}

export interface StagedFile {
  relativePath: string;
  bytes: number;
  modifiedAt: Date | null;
}

/** What the server currently holds, so an interrupted upload can resume. */
export async function stagedManifest(stagingDir: string): Promise<StagedFile[]> {
  const out: StagedFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(abs);
      } else if (e.isFile()) {
        const st = await fs.stat(abs).catch(() => null);
        if (!st) continue;
        out.push({
          relativePath: path.relative(stagingDir, abs).split(path.sep).join('/'),
          bytes: st.size,
          modifiedAt: st.mtime ?? null,
        });
      }
    }
  }

  await walk(stagingDir);
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

/** Report progress so the operator is never left wondering. */
export async function setProgress(
  uploadSessionId: string,
  update: {
    status?: string;
    stage?: string;
    stageDetail?: string | null;
    progressCurrent?: number;
    progressTotal?: number;
    error?: string | null;
    certificationCaseId?: string;
    certificationRunId?: string;
    completedAt?: Date;
  },
): Promise<void> {
  await prisma.certificationUploadSession
    .update({ where: { uploadSessionId }, data: update })
    .catch(() => {
      // Progress reporting must never take down the work it is reporting on.
    });
}

export async function discardStaging(stagingDir: string): Promise<void> {
  if (!stagingDir) return;
  const resolved = path.resolve(stagingDir);
  // Refuse to remove anything outside the staging root.
  if (!resolved.startsWith(path.resolve(STAGING_ROOT) + path.sep)) return;
  await fs.rm(resolved, { recursive: true, force: true }).catch(() => {});
}
