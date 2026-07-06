// ============================================================================
// Criminal Liability Discovery — metrics aggregation
// ============================================================================

import { readFile, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CALIFORNIA_CODES } from '../caCodes.ts';
import { createRepositories } from '../knowledgeGraph/repositories.ts';
import type {
  DiscoveryPriority,
  LiabilityDiscoveryMetrics,
  StatuteClassificationRecord,
  StatutoryClassification,
} from './types.ts';
import { CLASSIFIER_VERSION } from './types.ts';

const DEFAULT_DISCOVERY_DIR = 'data/legislative/discovery';
const DEFAULT_REPO_DIR = 'data/legislative/repositories';

const ALL_CLASSIFICATIONS: StatutoryClassification[] = [
  'criminal_offense',
  'criminal_penalty',
  'criminal_enhancement',
  'sentencing_provision',
  'definitions',
  'procedure',
  'evidence',
  'regulatory_incorporation',
  'licensing',
  'administrative',
  'civil',
  'tax',
  'environmental',
  'cross_reference',
  'unknown',
];

const ALL_PRIORITIES: DiscoveryPriority[] = ['critical', 'high', 'medium', 'low', 'deferred'];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function countDiscoveredCodes(discoveryDir: string): Promise<number> {
  try {
    const files = await readdir(discoveryDir);
    return files.filter((f) => f.endsWith('-discovery-manifest.json')).length;
  } catch {
    return 0;
  }
}

async function loadClassificationRecords(repoDir: string): Promise<StatuteClassificationRecord[]> {
  const recordsPath = join(repoDir, 'statute_classifications', 'records.jsonl');
  if (!(await fileExists(recordsPath))) return [];
  const raw = await readFile(recordsPath, 'utf-8');
  return raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StatuteClassificationRecord);
}

export async function collectLiabilityDiscoveryMetrics(options?: {
  discoveryDir?: string;
  repositoryDir?: string;
}): Promise<LiabilityDiscoveryMetrics> {
  const discoveryDir = resolve(options?.discoveryDir ?? DEFAULT_DISCOVERY_DIR);
  const repoDir = resolve(options?.repositoryDir ?? DEFAULT_REPO_DIR);

  const records = await loadClassificationRecords(repoDir);
  const repos = createRepositories(repoDir);

  const byClassification = Object.fromEntries(ALL_CLASSIFICATIONS.map((c) => [c, 0])) as Record<
    StatutoryClassification,
    number
  >;
  const byPriority = Object.fromEntries(ALL_PRIORITIES.map((p) => [p, 0])) as Record<DiscoveryPriority, number>;
  const byCode: Record<string, { classified: number; likelyCriminal: number; confirmedOffenses: number }> = {};

  let likelyCriminal = 0;
  let confirmedOffenses = 0;
  let regulatoryCandidates = 0;
  let manualReview = 0;
  let unknownCount = 0;

  const latestByStatute = new Map<string, StatuteClassificationRecord>();
  for (const record of records) {
    latestByStatute.set(record.sourceStatuteId, record);
  }

  for (const record of latestByStatute.values()) {
    const cls = record.classification.value as StatutoryClassification;
    if (cls in byClassification) byClassification[cls] += 1;
    byPriority[record.discoveryPriority] += 1;

    if (!byCode[record.code]) {
      byCode[record.code] = { classified: 0, likelyCriminal: 0, confirmedOffenses: 0 };
    }
    byCode[record.code].classified += 1;

    if (record.criminalLiabilityLikely) {
      likelyCriminal += 1;
      byCode[record.code].likelyCriminal += 1;
    }
    if (record.confirmedOffense) {
      confirmedOffenses += 1;
      byCode[record.code].confirmedOffenses += 1;
    }
    if (cls === 'regulatory_incorporation') regulatoryCandidates += 1;
    if (record.manualReviewRequired) manualReview += 1;
    if (cls === 'unknown') unknownCount += 1;
  }

  const codesAnalyzed = Object.keys(byCode).length;
  const classificationCount = await repos.statute_classifications.count();

  return {
    generatedAt: new Date().toISOString(),
    classifierVersion: CLASSIFIER_VERSION,
    californiaCodesDiscovered: await countDiscoveredCodes(discoveryDir),
    californiaCodesTotal: CALIFORNIA_CODES.length,
    codesAnalyzed,
    statutesClassified: classificationCount,
    likelyCriminalStatutes: likelyCriminal,
    confirmedCriminalOffenses: confirmedOffenses,
    regulatoryIncorporationCandidates: regulatoryCandidates,
    manualReviewQueue: manualReview,
    unknownClassifications: unknownCount,
    byClassification,
    byPriority,
    byCode,
  };
}

export async function writeLiabilityDiscoveryReport(
  repositoryDir: string,
  metrics: LiabilityDiscoveryMetrics,
): Promise<string> {
  const reportPath = join(resolve(repositoryDir), 'liability-discovery-report.json');
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(reportPath, JSON.stringify(metrics, null, 2), 'utf-8'),
  );
  return reportPath;
}
