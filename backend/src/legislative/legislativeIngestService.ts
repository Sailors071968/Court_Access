// ============================================
// Legislative corpus ingest — integrates governance + knowledge graph pipeline
// ============================================

import { randomUUID } from 'node:crypto';
import { CorpusRegistryRepository } from '../governance/corpusRegistry.ts';
import { CorpusLockManager } from '../governance/corpusLock.ts';
import { processStatutePipeline } from './knowledgeGraph/pipeline.ts';
import { createRepositories } from './knowledgeGraph/repositories.ts';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import prisma from '../lib/prisma.ts';

export interface LegislativeIngestInput {
  code: string;
  version?: string;
  maxSections?: number;
  rawHtmlDir?: string;
  repositoryDir?: string;
}

export interface LegislativeIngestResult {
  corpusName: string;
  version: string;
  status: 'completed' | 'failed';
  processed: number;
  rejected: number;
  offenses: number;
  totalStatutes: number;
  coverageReportPath: string;
  errorMessage?: string;
}

export async function ingestLegislativeCorpus(
  registry: CorpusRegistryRepository,
  lockManager: CorpusLockManager,
  input: LegislativeIngestInput,
): Promise<LegislativeIngestResult> {
  const code = input.code.toUpperCase();
  const version = input.version ?? '1.0';
  const corpusName = `leginfo-${code}`;
  const workerId = `legislative-ingest-${randomUUID().slice(0, 8)}`;

  const lock = await lockManager.acquire({ corpusName, workerId });
  if (!lock) {
    return {
      corpusName,
      version,
      status: 'failed',
      processed: 0,
      rejected: 0,
      offenses: 0,
      totalStatutes: 0,
      coverageReportPath: '',
      errorMessage: `Corpus "${corpusName}" is locked by another worker`,
    };
  }

  try {
    await registry.register({
      corpusName,
      jurisdiction: 'CA',
      sourceAuthority: 'California Legislature',
      version,
      metadata: { code, source: 'leginfo.legislature.ca.gov' },
    });

    await registry.markInProgress(corpusName, version);

    const result = await processStatutePipeline({
      code,
      rawHtmlDir: resolve(input.rawHtmlDir ?? 'data/legislative/raw'),
      repositoryDir: resolve(input.repositoryDir ?? 'data/legislative/repositories'),
      maxSections: input.maxSections,
      prisma,
    });

    const repos = createRepositories(resolve(input.repositoryDir ?? 'data/legislative/repositories'));
    const totalStatutes = await repos.statutes.count();

    await registry.markCompleted(corpusName, version, totalStatutes, 0);

    return {
      corpusName,
      version,
      status: 'completed',
      processed: result.processed,
      rejected: result.rejected,
      offenses: result.offenses,
      totalStatutes,
      coverageReportPath: result.coverageReportPath,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await registry.markFailed(corpusName, version).catch(() => undefined);
    return {
      corpusName,
      version,
      status: 'failed',
      processed: 0,
      rejected: 0,
      offenses: 0,
      totalStatutes: 0,
      coverageReportPath: '',
      errorMessage: message,
    };
  } finally {
    await lockManager.release(corpusName, workerId);
  }
}

export async function readCoverageReport(repositoryDir: string): Promise<unknown | null> {
  try {
    const raw = await readFile(join(repositoryDir, 'coverage-report.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
