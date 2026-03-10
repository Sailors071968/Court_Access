// ============================================================================
// Phase 76 — Policy Coverage Matrix Generation
// Generate first statewide coverage report.
// Populates PolicyCoverage table for all agencies × all topics.
// Example: Sacramento PD → Use of Force (found), Body Camera (found),
//          Discipline Matrix (missing).
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { populateAllAgencyCoverage } from '../taxonomy/coveragePopulator.js';
import {
  getSystemCoverageStats,
  getCoverageHeatmap,
  getAgencyCoverageReport,
  type AgencyCoverageReport,
  type SystemCoverageStats,
} from '../taxonomy/policyCoverageTracker.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoverageMatrixReport {
  generatedAt: string;
  systemStats: SystemCoverageStats;
  populationResult: {
    agenciesProcessed: number;
    totalNewEntries: number;
    totalUpdated: number;
  };
  topAgencies: AgencyCoverageSummary[];
  criticalGaps: CriticalGap[];
  categoryAnalysis: CategoryAnalysis[];
  statewideCoverageByTopic: TopicStatewideStatus[];
}

export interface AgencyCoverageSummary {
  agencyId: string;
  agencyName: string;
  city: string | null;
  county: string | null;
  populationEstimate: number | null;
  totalTopics: number;
  covered: number;
  missing: number;
  coveragePercent: number;
  missingCritical: string[]; // critical topics that are missing
}

export interface CriticalGap {
  agencyId: string;
  agencyName: string;
  missingTopicName: string;
  topicCategory: string;
  isCritical: boolean;
  populationAffected: number;
}

export interface CategoryAnalysis {
  category: string;
  displayName: string;
  totalTopics: number;
  agenciesWithFullCoverage: number;
  agenciesWithPartialCoverage: number;
  agenciesWithNoCoverage: number;
  averageCoveragePercent: number;
}

export interface TopicStatewideStatus {
  topicId: string;
  topicName: string;
  category: string;
  agenciesWithPolicy: number;
  agenciesWithoutPolicy: number;
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Critical topics that every agency should have
// ---------------------------------------------------------------------------

const CRITICAL_TOPICS = [
  'Use of Force',
  'Internal Affairs',
  'Body-Worn Cameras',
  'Discipline and Corrective Action',
  'Vehicle Pursuits',
  'Officer-Involved Shootings',
  'De-escalation',
  'Racial Profiling Prohibition',
  'Duty to Intervene',
  'Training',
];

// ---------------------------------------------------------------------------
// Main: Generate statewide coverage matrix
// ---------------------------------------------------------------------------

export async function generateCoverageMatrix(): Promise<CoverageMatrixReport> {
  console.log('[Phase 76] Generating statewide coverage matrix...');
  const startTime = Date.now();

  // Step 1: Populate coverage for all agencies
  console.log('[Phase 76] Step 1: Populating coverage for all agencies...');
  const populationResult = await populateAllAgencyCoverage();

  // Step 2: Get system-wide stats
  console.log('[Phase 76] Step 2: Computing system-wide statistics...');
  const systemStats = await getSystemCoverageStats();

  // Step 3: Build top agency summaries
  console.log('[Phase 76] Step 3: Building agency coverage summaries...');
  const agencies = await prisma.agency.findMany({
    orderBy: { jurisdictionRank: 'asc' },
    take: 100,
  });

  const topAgencies: AgencyCoverageSummary[] = [];
  const allGaps: CriticalGap[] = [];

  // Find critical topic IDs
  const criticalTopicRecords = await prisma.policyTopic.findMany({
    where: {
      OR: CRITICAL_TOPICS.map((name) => ({
        topicName: { contains: name },
      })),
    },
  });
  const criticalTopicIds = new Set(criticalTopicRecords.map((t) => t.id));

  for (const agency of agencies) {
    try {
      const report = await getAgencyCoverageReport(agency.agencyId);

      // Identify missing critical topics
      const missingCritical: string[] = [];
      for (const cat of report.byCategory) {
        for (const topic of cat.topics) {
          if (!topic.policyFound && criticalTopicIds.has(topic.topicId)) {
            missingCritical.push(topic.topicName);
            allGaps.push({
              agencyId: agency.agencyId,
              agencyName: agency.agencyName,
              missingTopicName: topic.topicName,
              topicCategory: cat.category,
              isCritical: true,
              populationAffected: agency.populationEstimate ?? 0,
            });
          }
        }
      }

      topAgencies.push({
        agencyId: agency.agencyId,
        agencyName: agency.agencyName,
        city: agency.city,
        county: agency.county,
        populationEstimate: agency.populationEstimate,
        totalTopics: report.totalTopics,
        covered: report.covered,
        missing: report.missing,
        coveragePercent: report.coveragePercent,
        missingCritical,
      });
    } catch {
      // Agency may not have any coverage data yet
    }
  }

  // Step 4: Category analysis
  console.log('[Phase 76] Step 4: Analyzing coverage by category...');
  const categoryAnalysis = await buildCategoryAnalysis();

  // Step 5: Topic-level statewide status
  console.log('[Phase 76] Step 5: Computing per-topic statewide status...');
  const statewideCoverageByTopic = await buildTopicStatewideStatus();

  // Sort gaps by population affected
  allGaps.sort((a, b) => b.populationAffected - a.populationAffected);

  const duration = Date.now() - startTime;
  console.log(
    `[Phase 76] Coverage matrix generated in ${duration}ms: ` +
    `${topAgencies.length} agencies, ${allGaps.length} critical gaps, ` +
    `${statewideCoverageByTopic.length} topics tracked`,
  );

  return {
    generatedAt: new Date().toISOString(),
    systemStats,
    populationResult: {
      agenciesProcessed: populationResult.agenciesProcessed,
      totalNewEntries: populationResult.totalNewEntries,
      totalUpdated: populationResult.totalUpdated,
    },
    topAgencies,
    criticalGaps: allGaps.slice(0, 200),
    categoryAnalysis,
    statewideCoverageByTopic,
  };
}

// ---------------------------------------------------------------------------
// Category analysis
// ---------------------------------------------------------------------------

async function buildCategoryAnalysis(): Promise<CategoryAnalysis[]> {
  const topics = await prisma.policyTopic.findMany();
  const agencies = await prisma.agency.findMany({ select: { agencyId: true } });
  const coverage = await prisma.policyCoverage.findMany();

  // Group topics by category
  const categoryTopics = new Map<string, string[]>();
  for (const topic of topics) {
    if (!categoryTopics.has(topic.category)) {
      categoryTopics.set(topic.category, []);
    }
    categoryTopics.get(topic.category)!.push(topic.id);
  }

  // Build coverage lookup: agencyId → topicId → boolean
  const coverageLookup = new Map<string, Map<string, boolean>>();
  for (const entry of coverage) {
    if (!coverageLookup.has(entry.agencyId)) {
      coverageLookup.set(entry.agencyId, new Map());
    }
    coverageLookup.get(entry.agencyId)!.set(entry.topicId, entry.policyFound);
  }

  const results: CategoryAnalysis[] = [];

  for (const [category, topicIds] of categoryTopics) {
    let fullCoverage = 0;
    let partialCoverage = 0;
    let noCoverage = 0;
    const agencyCoveragePercents: number[] = [];

    for (const agency of agencies) {
      const agencyCoverage = coverageLookup.get(agency.agencyId);
      let covered = 0;

      for (const topicId of topicIds) {
        if (agencyCoverage?.get(topicId)) covered++;
      }

      const percent = topicIds.length > 0 ? (covered / topicIds.length) * 100 : 0;
      agencyCoveragePercents.push(percent);

      if (percent === 100) fullCoverage++;
      else if (percent > 0) partialCoverage++;
      else noCoverage++;
    }

    const avgPercent = agencyCoveragePercents.length > 0
      ? Math.round((agencyCoveragePercents.reduce((a, b) => a + b, 0) / agencyCoveragePercents.length) * 100) / 100
      : 0;

    results.push({
      category,
      displayName: category.replace(/_/g, ' '),
      totalTopics: topicIds.length,
      agenciesWithFullCoverage: fullCoverage,
      agenciesWithPartialCoverage: partialCoverage,
      agenciesWithNoCoverage: noCoverage,
      averageCoveragePercent: avgPercent,
    });
  }

  results.sort((a, b) => a.averageCoveragePercent - b.averageCoveragePercent);
  return results;
}

// ---------------------------------------------------------------------------
// Topic statewide status
// ---------------------------------------------------------------------------

async function buildTopicStatewideStatus(): Promise<TopicStatewideStatus[]> {
  const topics = await prisma.policyTopic.findMany({ orderBy: { sortOrder: 'asc' } });
  const totalAgencies = await prisma.agency.count();

  const results: TopicStatewideStatus[] = [];

  for (const topic of topics) {
    const withPolicy = await prisma.policyCoverage.count({
      where: { topicId: topic.id, policyFound: true },
    });

    const withoutPolicy = totalAgencies - withPolicy;
    const coveragePercent = totalAgencies > 0
      ? Math.round((withPolicy / totalAgencies) * 10000) / 100
      : 0;

    results.push({
      topicId: topic.id,
      topicName: topic.topicName,
      category: topic.category,
      agenciesWithPolicy: withPolicy,
      agenciesWithoutPolicy: withoutPolicy,
      coveragePercent,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get single agency coverage report (convenience wrapper)
// ---------------------------------------------------------------------------

export async function getAgencyCoverage(agencyId: string): Promise<AgencyCoverageReport> {
  return getAgencyCoverageReport(agencyId);
}

// ---------------------------------------------------------------------------
// Get coverage heatmap for dashboard
// ---------------------------------------------------------------------------

export async function getCoverageHeatmapData(limit: number = 25, offset: number = 0) {
  return getCoverageHeatmap(limit, offset);
}
