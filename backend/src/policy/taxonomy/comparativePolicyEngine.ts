/**
 * Phase 8: Comparative Policy Engine
 *
 * Enables side-by-side comparison of policies across agencies.
 * Example:
 *   Sacramento PD — chokehold banned
 *   Agency X — chokehold allowed
 *
 * Provides:
 * - Agency-to-agency policy comparison
 * - Agency-to-CHP canonical comparison
 * - Topic-level comparison across all agencies
 * - Gap analysis (missing policies)
 */

import { PrismaClient } from '@prisma/client';
import type { PolicyCategory } from './chpPolicyTaxonomy.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgencyPolicySnapshot {
  agencyId: string;
  agencyName: string;
  topicId: string;
  topicName: string;
  category: string;
  policyFound: boolean;
  documentTitle: string | null;
  policyNumber: string | null;
  sourceUrl: string | null;
  confidence: number | null;
  textExcerpt: string | null;
}

export interface PolicyComparison {
  topicId: string;
  topicName: string;
  category: string;
  agencies: AgencyPolicySnapshot[];
}

export interface ComparisonResult {
  topics: PolicyComparison[];
  summary: {
    totalTopics: number;
    agenciesCompared: number;
    topicsWithFullCoverage: number;
    topicsWithPartialCoverage: number;
    topicsWithNoCoverage: number;
  };
}

export interface GapAnalysis {
  agencyId: string;
  agencyName: string;
  totalTopics: number;
  coveredTopics: number;
  missingTopics: {
    topicId: string;
    topicName: string;
    category: string;
  }[];
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Compare two agencies side-by-side
// ---------------------------------------------------------------------------

export async function compareAgencies(
  agencyIdA: string,
  agencyIdB: string,
): Promise<ComparisonResult> {
  return compareMultipleAgencies([agencyIdA, agencyIdB]);
}

// ---------------------------------------------------------------------------
// Compare multiple agencies across all topics
// ---------------------------------------------------------------------------

export async function compareMultipleAgencies(
  agencyIds: string[],
): Promise<ComparisonResult> {
  const topics = await prisma.policyTopic.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const agencies = await prisma.agency.findMany({
    where: { agencyId: { in: agencyIds } },
  });

  const agencyMap = new Map(agencies.map((a) => [a.agencyId, a]));

  const comparisons: PolicyComparison[] = [];
  let topicsWithFullCoverage = 0;
  let topicsWithPartialCoverage = 0;
  let topicsWithNoCoverage = 0;

  for (const topic of topics) {
    const agencySnapshots: AgencyPolicySnapshot[] = [];

    for (const agencyId of agencyIds) {
      const agency = agencyMap.get(agencyId);
      if (!agency) continue;

      // Check coverage
      const coverage = await prisma.policyCoverage.findUnique({
        where: {
          agencyId_topicId: {
            agencyId,
            topicId: topic.id,
          },
        },
      });

      // Get the policy document if it exists
      let doc = null;
      if (coverage?.documentId) {
        doc = await prisma.policyDocument.findUnique({
          where: { documentId: coverage.documentId },
        });
      } else if (coverage?.policyFound) {
        doc = await prisma.policyDocument.findFirst({
          where: { agencyId, topicId: topic.id },
        });
      }

      agencySnapshots.push({
        agencyId,
        agencyName: agency.agencyName,
        topicId: topic.id,
        topicName: topic.topicName,
        category: topic.category,
        policyFound: coverage?.policyFound || false,
        documentTitle: doc?.title || null,
        policyNumber: doc?.policyNumber || null,
        sourceUrl: doc?.sourceUrl || null,
        confidence: doc?.matchedTopicConfidence || null,
        textExcerpt: doc?.textContent ? doc.textContent.substring(0, 300) : null,
      });
    }

    comparisons.push({
      topicId: topic.id,
      topicName: topic.topicName,
      category: topic.category,
      agencies: agencySnapshots,
    });

    // Count coverage
    const foundCount = agencySnapshots.filter((s) => s.policyFound).length;
    if (foundCount === agencyIds.length) {
      topicsWithFullCoverage++;
    } else if (foundCount > 0) {
      topicsWithPartialCoverage++;
    } else {
      topicsWithNoCoverage++;
    }
  }

  return {
    topics: comparisons,
    summary: {
      totalTopics: topics.length,
      agenciesCompared: agencyIds.length,
      topicsWithFullCoverage,
      topicsWithPartialCoverage,
      topicsWithNoCoverage,
    },
  };
}

// ---------------------------------------------------------------------------
// Compare a single agency against CHP canonical baseline
// ---------------------------------------------------------------------------

export async function compareAgainstChp(agencyId: string): Promise<ComparisonResult> {
  // Find CHP agency
  const chp = await prisma.agency.findFirst({
    where: { agencyName: { contains: 'California Highway Patrol' } },
  });

  if (!chp) {
    throw new Error('CHP agency not found in database. Run taxonomy extraction first.');
  }

  return compareAgencies(chp.agencyId, agencyId);
}

// ---------------------------------------------------------------------------
// Gap analysis for a single agency
// ---------------------------------------------------------------------------

export async function getAgencyGapAnalysis(agencyId: string): Promise<GapAnalysis> {
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

  const coveredTopicIds = new Set(
    coverage.filter((c) => c.policyFound).map((c) => c.topicId),
  );

  const missingTopics = topics
    .filter((t) => !coveredTopicIds.has(t.id))
    .map((t) => ({
      topicId: t.id,
      topicName: t.topicName,
      category: t.category,
    }));

  return {
    agencyId,
    agencyName: agency.agencyName,
    totalTopics: topics.length,
    coveredTopics: coveredTopicIds.size,
    missingTopics,
    coveragePercent:
      topics.length > 0
        ? Math.round((coveredTopicIds.size / topics.length) * 10000) / 100
        : 0,
  };
}

// ---------------------------------------------------------------------------
// Get topic coverage across all agencies for a specific category
// ---------------------------------------------------------------------------

export async function getCategoryCoverage(
  category: PolicyCategory,
): Promise<{
  category: string;
  topics: {
    topicId: string;
    topicName: string;
    agenciesWithPolicy: number;
    totalAgencies: number;
    coveragePercent: number;
  }[];
}> {
  const topics = await prisma.policyTopic.findMany({
    where: { category },
    orderBy: { sortOrder: 'asc' },
  });

  const totalAgencies = await prisma.agency.count();

  const topicCoverage = [];

  for (const topic of topics) {
    const agenciesWithPolicy = await prisma.policyCoverage.count({
      where: { topicId: topic.id, policyFound: true },
    });

    topicCoverage.push({
      topicId: topic.id,
      topicName: topic.topicName,
      agenciesWithPolicy,
      totalAgencies,
      coveragePercent:
        totalAgencies > 0
          ? Math.round((agenciesWithPolicy / totalAgencies) * 10000) / 100
          : 0,
    });
  }

  return {
    category,
    topics: topicCoverage,
  };
}

// ---------------------------------------------------------------------------
// Get overall coverage matrix
// ---------------------------------------------------------------------------

export async function getCoverageMatrix(): Promise<{
  totalAgencies: number;
  totalTopics: number;
  overallCoveragePercent: number;
  categoryBreakdown: {
    category: string;
    displayName: string;
    topicCount: number;
    avgCoveragePercent: number;
  }[];
  topAgencies: {
    agencyId: string;
    agencyName: string;
    coveragePercent: number;
    coveredTopics: number;
    totalTopics: number;
  }[];
  bottomAgencies: {
    agencyId: string;
    agencyName: string;
    coveragePercent: number;
    coveredTopics: number;
    totalTopics: number;
  }[];
}> {
  const totalAgencies = await prisma.agency.count();
  const totalTopics = await prisma.policyTopic.count();

  const totalCoverageEntries = await prisma.policyCoverage.count({
    where: { policyFound: true },
  });

  const maxPossibleCoverage = totalAgencies * totalTopics;
  const overallCoveragePercent =
    maxPossibleCoverage > 0
      ? Math.round((totalCoverageEntries / maxPossibleCoverage) * 10000) / 100
      : 0;

  // Category breakdown
  const categories = await prisma.policyTopic.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  const categoryBreakdown = [];
  for (const cat of categories) {
    const topicIds = await prisma.policyTopic.findMany({
      where: { category: cat.category },
      select: { id: true },
    });

    const coveredEntries = await prisma.policyCoverage.count({
      where: {
        topicId: { in: topicIds.map((t) => t.id) },
        policyFound: true,
      },
    });

    const maxForCategory = totalAgencies * topicIds.length;
    categoryBreakdown.push({
      category: cat.category,
      displayName: cat.category.replace(/_/g, ' '),
      topicCount: cat._count.id,
      avgCoveragePercent:
        maxForCategory > 0
          ? Math.round((coveredEntries / maxForCategory) * 10000) / 100
          : 0,
    });
  }

  // Top agencies by coverage
  const allAgencies = await prisma.agency.findMany();
  const agencyCoverage: {
    agencyId: string;
    agencyName: string;
    coveragePercent: number;
    coveredTopics: number;
    totalTopics: number;
  }[] = [];

  for (const agency of allAgencies) {
    const covered = await prisma.policyCoverage.count({
      where: { agencyId: agency.agencyId, policyFound: true },
    });

    agencyCoverage.push({
      agencyId: agency.agencyId,
      agencyName: agency.agencyName,
      coveragePercent:
        totalTopics > 0 ? Math.round((covered / totalTopics) * 10000) / 100 : 0,
      coveredTopics: covered,
      totalTopics,
    });
  }

  agencyCoverage.sort((a, b) => b.coveragePercent - a.coveragePercent);

  return {
    totalAgencies,
    totalTopics,
    overallCoveragePercent,
    categoryBreakdown,
    topAgencies: agencyCoverage.slice(0, 10),
    bottomAgencies: agencyCoverage.slice(-10).reverse(),
  };
}
