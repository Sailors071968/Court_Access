// ============================================================================
// Stage 6 — Repository update pipeline + coverage analytics
// ============================================================================

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { CriminalKnowledgeBundle, KnowledgeGraphCoverageReport, RepositoryCoverageMetrics } from './types.ts';
import { createRepositories, type RepositoryName } from './repositories.ts';
import { EXTRACTOR_VERSION } from './intelligenceExtractor.ts';
import { parseLeginfoStatuteHtml } from '../statuteParser.ts';
import { extractCriminalKnowledge } from './intelligenceExtractor.ts';
import { readRawHtml, rawHtmlPath } from '../rawHtmlStore.ts';
import {
  appendExtractionAudit,
  buildExtractAuditEntry,
  buildParseAuditEntry,
} from '../extractionAuditLog.ts';
import { classifyStatute } from '../liabilityDiscovery/classificationEngine.ts';
import {
  collectLiabilityDiscoveryMetrics,
  writeLiabilityDiscoveryReport,
} from '../liabilityDiscovery/metrics.ts';

export interface ProcessPipelineOptions {
  code: string;
  rawHtmlDir?: string;
  repositoryDir?: string;
  auditDir?: string;
  prisma?: PrismaClient;
  sections?: string[];
  maxSections?: number;
}

export interface ProcessPipelineResult {
  processed: number;
  rejected: number;
  offenses: number;
  classified: number;
  likelyCriminal: number;
  repositoryDir: string;
  coverageReportPath: string;
  liabilityReportPath: string;
}

function countUnknownFields(record: Record<string, unknown>): number {
  let count = 0;
  for (const value of Object.values(record)) {
    if (value === 'UNKNOWN') count += 1;
    else if (value && typeof value === 'object' && 'value' in value && (value as { value: unknown }).value === 'UNKNOWN') {
      count += 1;
    }
  }
  return count;
}

async function buildRepoMetrics(
  repoName: RepositoryName,
  baseDir: string,
  statuteIds: Set<string>,
): Promise<RepositoryCoverageMetrics> {
  const repo = createRepositories(baseDir)[repoName];
  const count = await repo.count();
  const index = await repo.getIndex();

  let unknownFieldCount = 0;
  try {
    const recordsRaw = await readFile(join(baseDir, repoName, 'records.jsonl'), 'utf-8');
    const lines = recordsRaw.trim().split('\n').filter(Boolean);
    for (const line of lines.slice(-100)) {
      unknownFieldCount += countUnknownFields(JSON.parse(line));
    }
  } catch {
    // no records yet
  }

  return {
    repository: repoName,
    totalRecords: count,
    unknownFieldCount,
    unknownFieldRate: count > 0 ? unknownFieldCount / (count * 3) : 0,
    statutesCovered: statuteIds.size,
    lastUpdatedAt: index.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateRepositoriesFromBundle(
  bundle: CriminalKnowledgeBundle,
  repositoryDir: string,
): Promise<void> {
  const repos = createRepositories(repositoryDir);

  await repos.statutes.upsert(bundle.statute as unknown as Record<string, unknown> & { id: string });
  await repos.offenses.upsertMany(bundle.offenses as unknown as Array<Record<string, unknown> & { id: string }>);
  await repos.elements.upsertMany(bundle.elements as unknown as Array<Record<string, unknown> & { id: string }>);
  await repos.mens_rea.upsertMany(bundle.mensRea as unknown as Array<Record<string, unknown> & { id: string }>);
  await repos.exceptions.upsertMany(bundle.exceptions as unknown as Array<Record<string, unknown> & { id: string }>);
  await repos.defenses.upsertMany(bundle.defenses as unknown as Array<Record<string, unknown> & { id: string }>);
  await repos.cross_references.upsertMany(
    bundle.crossReferences as unknown as Array<Record<string, unknown> & { id: string }>,
  );
  await repos.regulatory_incorporations.upsertMany(
    bundle.regulatoryIncorporations as unknown as Array<Record<string, unknown> & { id: string }>,
  );
  await repos.calcrim_links.upsertMany(
    bundle.calcrimLinks as unknown as Array<Record<string, unknown> & { id: string }>,
  );
  await repos.authorities.upsertMany(
    bundle.authorities as unknown as Array<Record<string, unknown> & { id: string }>,
  );
}

export async function updateClassificationRecord(
  classification: Record<string, unknown> & { id: string },
  repositoryDir: string,
): Promise<void> {
  const repos = createRepositories(repositoryDir);
  await repos.statute_classifications.upsert(classification);
}

export async function generateCoverageReport(
  repositoryDir: string,
  statuteIds: Set<string>,
  parsingFailures: number,
): Promise<KnowledgeGraphCoverageReport> {
  const repos = createRepositories(repositoryDir);
  const offenseCount = await repos.offenses.count();
  const calcrimCount = await repos.calcrim_links.count();
  const statutes = await buildRepoMetrics('statutes', repositoryDir, statuteIds);

  const report: KnowledgeGraphCoverageReport = {
    generatedAt: new Date().toISOString(),
    extractorVersion: EXTRACTOR_VERSION,
    statutes,
    offenses: await buildRepoMetrics('offenses', repositoryDir, statuteIds),
    elements: await buildRepoMetrics('elements', repositoryDir, statuteIds),
    mensRea: await buildRepoMetrics('mens_rea', repositoryDir, statuteIds),
    exceptions: await buildRepoMetrics('exceptions', repositoryDir, statuteIds),
    defenses: await buildRepoMetrics('defenses', repositoryDir, statuteIds),
    crossReferences: await buildRepoMetrics('cross_references', repositoryDir, statuteIds),
    regulatoryIncorporations: await buildRepoMetrics('regulatory_incorporations', repositoryDir, statuteIds),
    calcrimLinks: await buildRepoMetrics('calcrim_links', repositoryDir, statuteIds),
    authorities: await buildRepoMetrics('authorities', repositoryDir, statuteIds),
    criminalOffensesIdentified: offenseCount,
    calcrimCoveragePercent: offenseCount > 0 ? (calcrimCount / offenseCount) * 100 : 0,
    parsingFailures,
    manualReviewCandidates: parsingFailures,
  };

  return report;
}

export async function processStatutePipeline(
  options: ProcessPipelineOptions,
): Promise<ProcessPipelineResult> {
  const rawDir = resolve(options.rawHtmlDir ?? 'data/legislative/raw');
  const repoDir = resolve(options.repositoryDir ?? 'data/legislative/repositories');
  await mkdir(repoDir, { recursive: true });

  const rejectionsPath = join(repoDir, 'parse-rejections.jsonl');
  const statuteIds = new Set<string>();
  let processed = 0;
  let rejected = 0;
  let offenses = 0;
  let classified = 0;
  let likelyCriminal = 0;

  let sections = options.sections ?? [];
  if (sections.length === 0) {
    const indexPath = join(rawDir, options.code.toUpperCase(), 'acquisition-index.jsonl');
    try {
      const indexRaw = await readFile(indexPath, 'utf-8');
      sections = indexRaw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line).section as string)
        .filter(Boolean);
    } catch {
      sections = [];
    }
  }

  const limit = options.maxSections ?? sections.length;
  const toProcess = sections.slice(0, limit);

  const auditOptions = {
    auditDir: options.auditDir,
    prisma: options.prisma,
  };

  for (const section of toProcess) {
    const sourceUrl = `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${options.code}&sectionNum=${section}`;
    const html = await readRawHtml(rawDir, options.code, section);
    const parseResult = parseLeginfoStatuteHtml({
      html,
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      code: options.code,
      section,
    });

    if (!parseResult.ok) {
      rejected += 1;
      await writeFile(rejectionsPath, `${JSON.stringify(parseResult.rejection)}\n`, { flag: 'a' });
      await appendExtractionAudit(
        buildParseAuditEntry({
          code: parseResult.rejection.code,
          section: parseResult.rejection.section,
          sourceUrl: parseResult.rejection.sourceUrl,
          contentHash: parseResult.rejection.contentHash,
          status: 'rejected',
          rejectionReason: parseResult.rejection.reason,
        }),
        auditOptions,
      );
      continue;
    }

    await appendExtractionAudit(
      buildParseAuditEntry({
        code: parseResult.record.code,
        section: parseResult.record.section,
        sourceUrl,
        contentHash: parseResult.record.contentHash,
        status: 'success',
        sourceStatuteId: parseResult.record.id,
      }),
      auditOptions,
    );

    const bundle = extractCriminalKnowledge(parseResult.record);
    await updateRepositoriesFromBundle(bundle, repoDir);

    const classification = classifyStatute(parseResult.record, {
      confirmedOffenseCount: bundle.offenses.length,
    });
    await updateClassificationRecord(
      classification as unknown as Record<string, unknown> & { id: string },
      repoDir,
    );
    classified += 1;
    if (classification.criminalLiabilityLikely) likelyCriminal += 1;

    statuteIds.add(parseResult.record.id);
    processed += 1;
    offenses += bundle.offenses.length;

    const extractStatus = bundle.offenses.length > 0 ? 'success' : 'partial';
    await appendExtractionAudit(
      buildExtractAuditEntry({
        code: parseResult.record.code,
        section: parseResult.record.section,
        sourceUrl,
        contentHash: parseResult.record.contentHash,
        sourceStatuteId: parseResult.record.id,
        status: extractStatus,
        offenseCount: bundle.offenses.length,
        elementCount: bundle.elements.length,
      }),
      auditOptions,
    );
  }

  const report = await generateCoverageReport(repoDir, statuteIds, rejected);
  const coverageReportPath = join(repoDir, 'coverage-report.json');
  await writeFile(coverageReportPath, JSON.stringify(report, null, 2), 'utf-8');

  const liabilityMetrics = await collectLiabilityDiscoveryMetrics({ repositoryDir: repoDir });
  const liabilityReportPath = await writeLiabilityDiscoveryReport(repoDir, liabilityMetrics);

  return {
    processed,
    rejected,
    offenses,
    classified,
    likelyCriminal,
    repositoryDir: repoDir,
    coverageReportPath,
    liabilityReportPath,
  };
}

export { rawHtmlPath };
