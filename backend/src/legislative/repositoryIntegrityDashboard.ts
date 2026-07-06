// ============================================================================
// Epic H — Repository Integrity Dashboard
// Continuous verification of all legislative repositories
// ============================================================================

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRepositories, REPOSITORY_NAMES, type RepositoryName } from './knowledgeGraph/repositories.ts';
import { collectProductionMetrics } from './productionMetrics.ts';
import { getExtractionAuditStats } from './extractionAuditLog.ts';
import type { KnowledgeGraphCoverageReport } from './knowledgeGraph/types.ts';

const DEFAULT_REPO_DIR = 'data/legislative/repositories';

const DISPLAY_NAMES: Record<RepositoryName, string> = {
  statutes: 'Statute Repository',
  offenses: 'Offense Repository',
  elements: 'Element Repository',
  mens_rea: 'Mens Rea Repository',
  exceptions: 'Exception Repository',
  defenses: 'Defense Repository',
  cross_references: 'Cross Reference Repository',
  regulatory_incorporations: 'Regulatory Incorporation Repository',
  calcrim_links: 'CALCRIM Repository',
  authorities: 'Authority Repository',
  statute_classifications: 'Statute Classification Repository',
};

const COVERAGE_KEY_MAP: Partial<Record<RepositoryName, keyof KnowledgeGraphCoverageReport>> = {
  statutes: 'statutes',
  offenses: 'offenses',
  elements: 'elements',
  mens_rea: 'mensRea',
  exceptions: 'exceptions',
  defenses: 'defenses',
  cross_references: 'crossReferences',
  regulatory_incorporations: 'regulatoryIncorporations',
  calcrim_links: 'calcrimLinks',
  authorities: 'authorities',
};

export interface RepositoryIntegrityStatus {
  name: RepositoryName;
  displayName: string;
  recordCount: number;
  integrity: 'PASS' | 'FAIL' | 'UNKNOWN';
  integrityDetail: string;
  coverage: {
    statutesCovered: number;
    unknownFieldCount: number;
    unknownFieldRate: number;
    totalRecords: number;
  } | null;
  unknowns: string[];
  manualReviewCount: number;
  auditStatus: 'PASS' | 'PARTIAL' | 'FAIL' | 'UNKNOWN';
  lastSynchronization: string | null;
  completionPercent: number;
}

export interface RepositoryIntegrityDashboard {
  generatedAt: string;
  version: string;
  overallIntegrity: 'PASS' | 'FAIL' | 'PARTIAL';
  overallCompletionPercent: number;
  repositoryIntegrity: 'PASS' | 'FAIL' | 'UNKNOWN';
  parsingFailures: number;
  manualReviewQueue: number;
  coverageAnalytics: {
    codesDiscovered: number;
    codesTotal: number;
    sectionsDiscovered: number;
    sectionsAcquired: number;
    sectionsParsed: number;
    criminalOffenses: number;
    offenseElements: number;
    mensReaCoveragePercent: number;
    authorityCoveragePercent: number;
    calcrimMappings: number;
    calcrimCoveragePercent: number;
  };
  knowledgeGraph: {
    totalRecords: number;
    repositoriesHealthy: number;
    repositoriesTotal: number;
    integrity: 'PASS' | 'FAIL' | 'PARTIAL';
  };
  repositories: RepositoryIntegrityStatus[];
  globalUnknowns: string[];
  auditSummary: {
    total: number;
    success: number;
    rejected: number;
    partial: number;
    withOffenses: number;
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadCoverageReport(repoDir: string): Promise<KnowledgeGraphCoverageReport | null> {
  try {
    const raw = await readFile(join(repoDir, 'coverage-report.json'), 'utf-8');
    return JSON.parse(raw) as KnowledgeGraphCoverageReport;
  } catch {
    return null;
  }
}

async function verifyRepositoryIntegrity(
  repoDir: string,
  name: RepositoryName,
): Promise<{ integrity: 'PASS' | 'FAIL' | 'UNKNOWN'; detail: string }> {
  try {
    const indexPath = join(repoDir, name, 'index.json');
    if (!(await fileExists(indexPath))) {
      return { integrity: 'UNKNOWN', detail: 'Index file not found' };
    }
    const index = JSON.parse(await readFile(indexPath, 'utf-8')) as {
      count: number;
      ids: Record<string, string>;
      updatedAt: string | null;
    };
    const idCount = Object.keys(index.ids).length;
    if (idCount !== index.count) {
      return { integrity: 'FAIL', detail: `Index mismatch: ${idCount} ids vs count=${index.count}` };
    }
    if (index.count > 0) {
      const recordsPath = join(repoDir, name, 'records.jsonl');
      if (!(await fileExists(recordsPath))) {
        return { integrity: 'FAIL', detail: 'Records file missing despite non-zero count' };
      }
    }
    return { integrity: 'PASS', detail: `${index.count} records, index consistent` };
  } catch (err) {
    return { integrity: 'FAIL', detail: err instanceof Error ? err.message : 'Verification failed' };
  }
}

function computeCompletion(
  name: RepositoryName,
  recordCount: number,
  coverage: RepositoryIntegrityStatus['coverage'],
  sectionsParsed: number,
): number {
  if (name === 'statutes') {
    return sectionsParsed > 0 ? Math.min(100, Math.round((recordCount / Math.max(sectionsParsed, 1)) * 100)) : 0;
  }
  if (coverage && coverage.statutesCovered > 0) {
    const rate = recordCount / coverage.statutesCovered;
    if (name === 'offenses') return Math.min(100, Math.round(rate * 50));
    if (name === 'elements') return Math.min(100, Math.round(rate * 25));
    if (name === 'calcrim_links') return Math.min(100, Math.round(rate * 100));
    return Math.min(100, Math.round(rate * 30));
  }
  return recordCount > 0 ? 50 : 0;
}

export async function generateRepositoryIntegrityDashboard(
  options?: { repositoryDir?: string },
): Promise<RepositoryIntegrityDashboard> {
  const repoDir = resolve(options?.repositoryDir ?? DEFAULT_REPO_DIR);
  const repos = createRepositories(repoDir);
  const [metrics, coverage, auditStats] = await Promise.all([
    collectProductionMetrics({ repositoryDir: repoDir }),
    loadCoverageReport(repoDir),
    getExtractionAuditStats().catch(() => ({
      total: 0,
      success: 0,
      rejected: 0,
      partial: 0,
      withOffenses: 0,
    })),
  ]);

  const globalUnknowns: string[] = [];
  if (metrics.sectionsParsed === 0) globalUnknowns.push('No statutes parsed — legislative pipeline not run');
  if (metrics.criminalOffenses === 0) globalUnknowns.push('No criminal offenses extracted');
  if ((metrics.repositories.defenses ?? 0) === 0) globalUnknowns.push('Defense repository empty — coverage UNKNOWN');
  if (metrics.calcrimMappings === 0) globalUnknowns.push('No CALCRIM mappings — jury instruction coverage UNKNOWN');

  const repositories: RepositoryIntegrityStatus[] = [];

  for (const name of REPOSITORY_NAMES) {
    const { integrity, detail } = await verifyRepositoryIntegrity(repoDir, name);
    const index = await repos[name].getIndex().catch(() => ({ count: 0, updatedAt: null, ids: {} }));
    const coverageKey = COVERAGE_KEY_MAP[name];
    const covEntry = coverageKey && coverage ? (coverage[coverageKey] as KnowledgeGraphCoverageReport['statutes'] | undefined) : undefined;

    const unknowns: string[] = [];
    if (index.count === 0 && name !== 'defenses') unknowns.push(`Repository empty — ${DISPLAY_NAMES[name]} has no records`);
    if (covEntry && covEntry.unknownFieldCount > 0) {
      unknowns.push(`${covEntry.unknownFieldCount} unknown field(s) in extraction`);
    }

    const manualReviewCount = covEntry?.unknownFieldCount ?? (integrity === 'FAIL' ? 1 : 0);

    let auditStatus: RepositoryIntegrityStatus['auditStatus'] = 'UNKNOWN';
    if (auditStats.total > 0) {
      if (auditStats.rejected === 0 && auditStats.partial === 0) auditStatus = 'PASS';
      else if (auditStats.success > auditStats.rejected) auditStatus = 'PARTIAL';
      else auditStatus = 'FAIL';
    }

    repositories.push({
      name,
      displayName: DISPLAY_NAMES[name],
      recordCount: index.count,
      integrity,
      integrityDetail: detail,
      coverage: covEntry
        ? {
            statutesCovered: covEntry.statutesCovered,
            unknownFieldCount: covEntry.unknownFieldCount,
            unknownFieldRate: covEntry.unknownFieldRate,
            totalRecords: covEntry.totalRecords,
          }
        : null,
      unknowns,
      manualReviewCount,
      auditStatus,
      lastSynchronization: index.updatedAt ?? covEntry?.lastUpdatedAt ?? null,
      completionPercent: computeCompletion(name, index.count, covEntry ? {
        statutesCovered: covEntry.statutesCovered,
        unknownFieldCount: covEntry.unknownFieldCount,
        unknownFieldRate: covEntry.unknownFieldRate,
        totalRecords: covEntry.totalRecords,
      } : null, metrics.sectionsParsed),
    });
  }

  const healthyRepos = repositories.filter((r) => r.integrity === 'PASS').length;
  const totalRecords = repositories.reduce((sum, r) => sum + r.recordCount, 0);
  const avgCompletion = repositories.length
    ? Math.round(repositories.reduce((sum, r) => sum + r.completionPercent, 0) / repositories.length)
    : 0;

  let overallIntegrity: RepositoryIntegrityDashboard['overallIntegrity'] = 'PASS';
  if (metrics.repositoryIntegrity === 'FAIL' || repositories.some((r) => r.integrity === 'FAIL')) {
    overallIntegrity = 'FAIL';
  } else if (
    metrics.repositoryIntegrity === 'UNKNOWN' ||
    repositories.some((r) => r.integrity === 'UNKNOWN') ||
    globalUnknowns.length > 2
  ) {
    overallIntegrity = 'PARTIAL';
  }

  const kgIntegrity: RepositoryIntegrityDashboard['knowledgeGraph']['integrity'] =
    healthyRepos === REPOSITORY_NAMES.length ? 'PASS' : healthyRepos > REPOSITORY_NAMES.length / 2 ? 'PARTIAL' : 'FAIL';

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    overallIntegrity,
    overallCompletionPercent: avgCompletion,
    repositoryIntegrity: metrics.repositoryIntegrity,
    parsingFailures: metrics.parsingFailures,
    manualReviewQueue: metrics.manualReviewQueue + repositories.reduce((s, r) => s + r.manualReviewCount, 0),
    coverageAnalytics: {
      codesDiscovered: metrics.californiaCodes.discovered,
      codesTotal: metrics.californiaCodes.total,
      sectionsDiscovered: metrics.sectionsDiscovered,
      sectionsAcquired: metrics.sectionsAcquired,
      sectionsParsed: metrics.sectionsParsed,
      criminalOffenses: metrics.criminalOffenses,
      offenseElements: metrics.offenseElements,
      mensReaCoveragePercent: metrics.mensReaCoveragePercent,
      authorityCoveragePercent: metrics.authorityCoveragePercent,
      calcrimMappings: metrics.calcrimMappings,
      calcrimCoveragePercent: metrics.calcrimCoveragePercent,
    },
    knowledgeGraph: {
      totalRecords,
      repositoriesHealthy: healthyRepos,
      repositoriesTotal: REPOSITORY_NAMES.length,
      integrity: kgIntegrity,
    },
    repositories,
    globalUnknowns,
    auditSummary: auditStats,
  };
}
