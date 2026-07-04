// ============================================
// Objective production metrics — no subjective readiness scores
// ============================================

import { readFile, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CALIFORNIA_CODES, getCriminalPriorityCodes } from './caCodes.ts';
import { createRepositories, REPOSITORY_NAMES } from './knowledgeGraph/repositories.ts';
import type { KnowledgeGraphCoverageReport } from './knowledgeGraph/types.ts';

export interface ProductionMetrics {
  generatedAt: string;
  californiaCodes: { discovered: number; total: number };
  sectionsDiscovered: number;
  sectionsAcquired: number;
  sectionsParsed: number;
  criminalOffenses: number;
  offenseElements: number;
  mensReaCoveragePercent: number;
  authorityCoveragePercent: number;
  calcrimMappings: number;
  calcrimCoveragePercent: number;
  repositoryIntegrity: 'PASS' | 'FAIL' | 'UNKNOWN';
  parsingFailures: number;
  manualReviewQueue: number;
  repositories: Record<string, number>;
  backendCompile: 'PASS' | 'FAIL' | 'UNKNOWN';
  frontendCompile: 'PASS' | 'FAIL' | 'UNKNOWN';
  e2eWorkflows: { passed: number; total: number; status: 'PASS' | 'FAIL' | 'UNKNOWN' };
}

const DEFAULT_DISCOVERY_DIR = 'data/legislative/discovery';
const DEFAULT_RAW_DIR = 'data/legislative/raw';
const DEFAULT_REPO_DIR = 'data/legislative/repositories';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function countDiscoveredSections(discoveryDir: string): Promise<{ codes: number; sections: number }> {
  let codes = 0;
  let sections = 0;
  try {
    const files = await readdir(discoveryDir);
    for (const file of files) {
      if (!file.endsWith('-discovery-manifest.json')) continue;
      codes += 1;
      const raw = await readFile(join(discoveryDir, file), 'utf-8');
      const manifest = JSON.parse(raw) as { sections?: unknown[] };
      sections += manifest.sections?.length ?? 0;
    }
  } catch {
    // no discovery data yet
  }
  return { codes, sections };
}

async function countAcquiredSections(rawDir: string): Promise<number> {
  let count = 0;
  try {
    const codes = await readdir(rawDir);
    for (const code of codes) {
      const indexPath = join(rawDir, code, 'acquisition-index.jsonl');
      if (!(await fileExists(indexPath))) continue;
      const raw = await readFile(indexPath, 'utf-8');
      count += raw.trim().split('\n').filter(Boolean).length;
    }
  } catch {
    // no raw data
  }
  return count;
}

async function loadCoverageReport(repoDir: string): Promise<KnowledgeGraphCoverageReport | null> {
  try {
    const raw = await readFile(join(repoDir, 'coverage-report.json'), 'utf-8');
    return JSON.parse(raw) as KnowledgeGraphCoverageReport;
  } catch {
    return null;
  }
}

async function checkRepositoryIntegrity(repoDir: string): Promise<'PASS' | 'FAIL' | 'UNKNOWN'> {
  try {
    for (const name of REPOSITORY_NAMES) {
      const indexPath = join(repoDir, name, 'index.json');
      if (!(await fileExists(indexPath))) continue;
      const index = JSON.parse(await readFile(indexPath, 'utf-8')) as { count: number; ids: Record<string, string> };
      if (Object.keys(index.ids).length !== index.count) return 'FAIL';
    }
    return 'PASS';
  } catch {
    return 'UNKNOWN';
  }
}

export async function collectProductionMetrics(options?: {
  discoveryDir?: string;
  rawDir?: string;
  repositoryDir?: string;
}): Promise<ProductionMetrics> {
  const discoveryDir = resolve(options?.discoveryDir ?? DEFAULT_DISCOVERY_DIR);
  const rawDir = resolve(options?.rawDir ?? DEFAULT_RAW_DIR);
  const repoDir = resolve(options?.repositoryDir ?? DEFAULT_REPO_DIR);

  const discovery = await countDiscoveredSections(discoveryDir);
  const acquired = await countAcquiredSections(rawDir);
  const coverage = await loadCoverageReport(repoDir);
  const repos = createRepositories(repoDir);

  const repositoryCounts: Record<string, number> = {};
  for (const name of REPOSITORY_NAMES) {
    repositoryCounts[name] = await repos[name].count();
  }

  const offenses = repositoryCounts.offenses ?? 0;
  const elements = repositoryCounts.elements ?? 0;
  const mensRea = repositoryCounts.mens_rea ?? 0;
  const authorities = repositoryCounts.authorities ?? 0;
  const calcrim = repositoryCounts.calcrim_links ?? 0;

  return {
    generatedAt: new Date().toISOString(),
    californiaCodes: {
      discovered: discovery.codes,
      total: CALIFORNIA_CODES.length,
    },
    sectionsDiscovered: discovery.sections,
    sectionsAcquired: acquired,
    sectionsParsed: repositoryCounts.statutes ?? 0,
    criminalOffenses: offenses,
    offenseElements: elements,
    mensReaCoveragePercent: offenses > 0 ? Math.round((mensRea / offenses) * 100) : 0,
    authorityCoveragePercent:
      repositoryCounts.statutes > 0
        ? Math.min(100, Math.round((repositoryCounts.cross_references / repositoryCounts.statutes) * 100))
        : 0,
    calcrimMappings: calcrim,
    calcrimCoveragePercent: coverage?.calcrimCoveragePercent ?? (offenses > 0 ? Math.round((calcrim / offenses) * 100) : 0),
    repositoryIntegrity: await checkRepositoryIntegrity(repoDir),
    parsingFailures: coverage?.parsingFailures ?? 0,
    manualReviewQueue: coverage?.manualReviewCandidates ?? 0,
    repositories: repositoryCounts,
    backendCompile: 'UNKNOWN',
    frontendCompile: 'UNKNOWN',
    e2eWorkflows: { passed: 0, total: 0, status: 'UNKNOWN' },
  };
}

export function getCriminalPriorityCodeList(): string[] {
  return getCriminalPriorityCodes().map((c) => c.abbrev);
}
