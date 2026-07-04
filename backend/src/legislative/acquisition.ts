// ============================================================================
// Stage 2 — Leginfo HTTP acquisition with retry, resume, and raw HTML storage
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { IngestionStateRepository } from '../ingestion/ingestionStateRepository.ts';
import type { DiscoveryManifest } from './types.ts';
import type {
  AcquisitionCheckpoint,
  AcquisitionOptions,
  AcquisitionRecord,
  AcquisitionResult,
} from './types.ts';
import { fetchLeginfoPage } from './leginfoHttp.ts';
import { acquisitionIndexPath, rawHtmlExists, storeRawHtml } from './rawHtmlStore.ts';

const ACQUISITION_VERSION = '1.0.0';
const CORPUS_PREFIX = 'leginfo';

export interface AcquisitionDeps {
  fetchImpl?: typeof fetch;
  stateRepo?: IngestionStateRepository | null;
}

function checkpointPathFor(code: string, rawHtmlDir: string): string {
  return join(rawHtmlDir, code.toUpperCase(), 'acquisition-checkpoint.json');
}

async function loadManifest(manifestPath: string): Promise<DiscoveryManifest> {
  const raw = await readFile(resolve(manifestPath), 'utf-8');
  return JSON.parse(raw) as DiscoveryManifest;
}

async function loadCheckpoint(path: string): Promise<AcquisitionCheckpoint | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as AcquisitionCheckpoint;
  } catch {
    return null;
  }
}

async function saveCheckpoint(path: string, checkpoint: AcquisitionCheckpoint): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

export async function acquireStatuteHtml(
  options: AcquisitionOptions,
  deps: AcquisitionDeps = {},
): Promise<AcquisitionResult> {
  const manifest = await loadManifest(options.manifestPath);
  const code = options.code.toUpperCase();
  const rawHtmlDir = resolve(options.rawHtmlDir ?? 'data/legislative/raw');
  const ckptPath = checkpointPathFor(code, rawHtmlDir);
  const sessionId = `leginfo-acquire-${code}`;
  const corpusName = `${CORPUS_PREFIX}-${code}`;
  const fileName = resolve(options.manifestPath);

  let checkpoint: AcquisitionCheckpoint;
  if (options.resume) {
    checkpoint = (await loadCheckpoint(ckptPath)) ?? {
      version: ACQUISITION_VERSION,
      code,
      manifestPath: options.manifestPath,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextIndex: 0,
      acquired: 0,
      failed: 0,
      skipped: 0,
    };
  } else {
    checkpoint = {
      version: ACQUISITION_VERSION,
      code,
      manifestPath: options.manifestPath,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextIndex: 0,
      acquired: 0,
      failed: 0,
      skipped: 0,
    };
  }

  if (deps.stateRepo) {
    const existing = await deps.stateRepo.getState(corpusName, fileName);
    if (!existing || !options.resume) {
      await deps.stateRepo.initializeState(corpusName, fileName, manifest.sections.length);
    }
    if (options.resume && existing) {
      checkpoint.nextIndex = Math.max(checkpoint.nextIndex, existing.lastProcessedOffset);
    }
  }

  const maxSections = options.maxSections ?? Number.POSITIVE_INFINITY;
  const endIndex = Math.min(manifest.sections.length, checkpoint.nextIndex + maxSections);

  try {
    for (let i = checkpoint.nextIndex; i < endIndex; i++) {
      const sectionEntry = manifest.sections[i];
      const url = sectionEntry.canonicalUrl;

      if (options.skipExisting !== false) {
        const exists = await rawHtmlExists(rawHtmlDir, code, sectionEntry.section);
        if (exists) {
          checkpoint.skipped += 1;
          checkpoint.nextIndex = i + 1;
          checkpoint.lastSection = sectionEntry.section;
          continue;
        }
      }

      let record: AcquisitionRecord;

      try {
        const result = await fetchLeginfoPage(url, {
          sessionId,
          fetchImpl: deps.fetchImpl,
          maxRetries: 3,
        });

        record = {
          code,
          section: sectionEntry.section,
          sourceUrl: url,
          canonicalUrl: sectionEntry.canonicalUrl,
          retrievedAt: result.fetchedAt,
          html: result.html,
          httpStatus: result.status,
          status: 'success',
        };

        await storeRawHtml(rawHtmlDir, record);
        checkpoint.acquired += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        record = {
          code,
          section: sectionEntry.section,
          sourceUrl: url,
          canonicalUrl: sectionEntry.canonicalUrl,
          retrievedAt: new Date().toISOString(),
          html: '',
          httpStatus: 0,
          status: 'failed',
          errorMessage: message,
        };
        await storeRawHtml(rawHtmlDir, record);
        checkpoint.failed += 1;
      }

      checkpoint.nextIndex = i + 1;
      checkpoint.lastSection = sectionEntry.section;
      checkpoint.updatedAt = new Date().toISOString();
      await saveCheckpoint(ckptPath, checkpoint);

      if (deps.stateRepo) {
        await deps.stateRepo.checkpoint(corpusName, fileName, checkpoint.nextIndex, checkpoint.acquired);
      }
    }

    const status: AcquisitionResult['status'] =
      checkpoint.nextIndex >= manifest.sections.length ? 'completed' : 'partial';

    if (deps.stateRepo && status === 'completed') {
      await deps.stateRepo.markCompleted(corpusName, fileName, checkpoint.acquired);
    }

    return {
      code,
      status,
      acquired: checkpoint.acquired,
      failed: checkpoint.failed,
      skipped: checkpoint.skipped,
      totalSections: manifest.sections.length,
      checkpointPath: ckptPath,
      rawHtmlDir,
      indexPath: acquisitionIndexPath(rawHtmlDir, code),
    };
  } finally {
    // session closed by fetchLeginfoPage calls via closeLeginfoSession in discovery pattern
    // leginfoHttp closes per fetch batch - we should close at end
    const { closeLeginfoSession } = await import('./leginfoHttp.ts');
    closeLeginfoSession(sessionId);
  }
}
