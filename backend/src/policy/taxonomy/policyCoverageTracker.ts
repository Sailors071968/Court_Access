/**
 * Phase 9: Policy Coverage Tracking
 *
 * Tracks which agencies have policies for each topic:
 *   - agencyId
 *   - topicId
 *   - policyFound (boolean)
 *
 * Example:
 *   Sacramento PD + Use of Force → found
 *   Sacramento PD + Body Camera → found
 *   Sacramento PD + Discipline Matrix → missing
 */

import { PrismaClient } from '@prisma/client';
// PolicyCategory type available from chpPolicyTaxonomy if needed

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgencyCoverageReport {
  agencyId: string;
  agencyName: string;
  totalTopics: number;
  covered: number;
  missing: number;
  coveragePercent: number;
  byCategory: CategoryCoverage[];
}

export interface CategoryCoverage {
  category: string;
  displayName: string;
  totalTopics: number;
  covered: number;
  missing: number;
  coveragePercent: number;
  topics: TopicCoverageEntry[];
}

export interface TopicCoverageEntry {
  topicId: string;
  topicName: string;
  policyFound: boolean;
  documentTitle: string | null;
  sourceUrl: string | null;
}

export interface SystemCoverageStats {
  totalAgencies: number;
  totalTopics: number;
  totalCoverageEntries: number;
  totalFound: number;
  totalMissing: number;
  overallCoveragePercent: number;
  agenciesWithFullCoverage: number;
  agenciesWithNoCoverage: number;
}

// ---------------------------------------------------------------------------
// Get coverage report for a single agency
// ---------------------------------------------------------------------------

export async function getAgencyCoverageReport(
  agencyId: string,
): Promise<AgencyCoverageReport> {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    throw new Error(`Agency not found: ${agencyId}`);
  }

  const topics = await prisma.policyTopic.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const coverage = await prisma.policyCoverage.findMany({
    where: { agencyId },
  });

  const coverageMap = new Map(coverage.map((c) => [c.topicId, c]));

  // Group by category
  const categoryMap = new Map<string, TopicCoverageEntry[]>();
  let totalCovered = 0;

  for (const topic of topics) {
    const entry = coverageMap.get(topic.id);
    const policyFound = entry?.policyFound || false;
    if (policyFound) totalCovered++;

    // Get document info if found
    let documentTitle: string | null = null;
    let sourceUrl: string | null = null;
    if (entry?.documentId) {
      const doc = await prisma.policyDocument.findUnique({
        where: { documentId: entry.documentId },
        select: { title: true, sourceUrl: true },
      });
      documentTitle = doc?.title || null;
      sourceUrl = doc?.sourceUrl || null;
    }

    const topicEntry: TopicCoverageEntry = {
      topicId: topic.id,
      topicName: topic.topicName,
      policyFound,
      documentTitle,
      sourceUrl,
    };

    if (!categoryMap.has(topic.category)) {
      categoryMap.set(topic.category, []);
    }
    categoryMap.get(topic.category)!.push(topicEntry);
  }

  const byCategory: CategoryCoverage[] = [];
  for (const [category, topicEntries] of categoryMap) {
    const covered = topicEntries.filter((t) => t.policyFound).length;
    byCategory.push({
      category,
      displayName: category.replace(/_/g, ' '),
      totalTopics: topicEntries.length,
      covered,
      missing: topicEntries.length - covered,
      coveragePercent:
        topicEntries.length > 0
          ? Math.round((covered / topicEntries.length) * 10000) / 100
          : 0,
      topics: topicEntries,
    });
  }

  return {
    agencyId,
    agencyName: agency.agencyName,
    totalTopics: topics.length,
    covered: totalCovered,
    missing: topics.length - totalCovered,
    coveragePercent:
      topics.length > 0
        ? Math.round((totalCovered / topics.length) * 10000) / 100
        : 0,
    byCategory,
  };
}

// ---------------------------------------------------------------------------
// Get system-wide coverage statistics
// ---------------------------------------------------------------------------

export async function getSystemCoverageStats(): Promise<SystemCoverageStats> {
  const totalAgencies = await prisma.agency.count();
  const totalTopics = await prisma.policyTopic.count();

  const totalCoverageEntries = await prisma.policyCoverage.count();
  const totalFound = await prisma.policyCoverage.count({
    where: { policyFound: true },
  });
  const totalMissing = totalCoverageEntries - totalFound;

  const maxPossible = totalAgencies * totalTopics;
  const overallCoveragePercent =
    maxPossible > 0 ? Math.round((totalFound / maxPossible) * 10000) / 100 : 0;

  // Count agencies with full coverage
  const agenciesWithCoverage = await prisma.policyCoverage.groupBy({
    by: ['agencyId'],
    _count: { id: true },
    where: { policyFound: true },
  });

  let agenciesWithFullCoverage = 0;
  for (const entry of agenciesWithCoverage) {
    if (entry._count.id >= totalTopics) {
      agenciesWithFullCoverage++;
    }
  }

  // Count agencies with no coverage entries at all
  const agenciesWithAnyCoverage = new Set(agenciesWithCoverage.map((e) => e.agencyId));
  const agenciesWithNoCoverage = totalAgencies - agenciesWithAnyCoverage.size;

  return {
    totalAgencies,
    totalTopics,
    totalCoverageEntries,
    totalFound,
    totalMissing,
    overallCoveragePercent,
    agenciesWithFullCoverage,
    agenciesWithNoCoverage,
  };
}

// ---------------------------------------------------------------------------
// Get coverage heatmap data (agencies × topics matrix)
// ---------------------------------------------------------------------------

export async function getCoverageHeatmap(
  limit: number = 20,
  offset: number = 0,
): Promise<{
  agencies: { agencyId: string; agencyName: string }[];
  topics: { topicId: string; topicName: string; category: string }[];
  matrix: Record<string, Record<string, boolean>>;
}> {
  const agencies = await prisma.agency.findMany({
    orderBy: { jurisdictionRank: 'asc' },
    skip: offset,
    take: limit,
    select: { agencyId: true, agencyName: true },
  });

  const topics = await prisma.policyTopic.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, topicName: true, category: true },
  });

  const agencyIds = agencies.map((a) => a.agencyId);
  const coverage = await prisma.policyCoverage.findMany({
    where: { agencyId: { in: agencyIds } },
  });

  // Build matrix: agencyId → topicId → boolean
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const agency of agencies) {
    matrix[agency.agencyId] = {};
    for (const topic of topics) {
      matrix[agency.agencyId][topic.id] = false;
    }
  }

  for (const entry of coverage) {
    if (matrix[entry.agencyId]) {
      matrix[entry.agencyId][entry.topicId] = entry.policyFound;
    }
  }

  return {
    agencies,
    topics: topics.map((t) => ({
      topicId: t.id,
      topicName: t.topicName,
      category: t.category,
    })),
    matrix,
  };
}

// ---------------------------------------------------------------------------
// Initialize coverage tracking for an agency (sets all to false)
// ---------------------------------------------------------------------------

export async function initializeAgencyCoverage(agencyId: string): Promise<number> {
  const topics = await prisma.policyTopic.findMany();
  let created = 0;

  for (const topic of topics) {
    await prisma.policyCoverage.upsert({
      where: {
        agencyId_topicId: {
          agencyId,
          topicId: topic.id,
        },
      },
      create: {
        agencyId,
        topicId: topic.id,
        policyFound: false,
      },
      update: {},
    });
    created++;
  }

  return created;
}
