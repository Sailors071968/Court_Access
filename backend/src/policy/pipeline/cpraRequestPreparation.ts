// ============================================================================
// Phase 77 — CPRA Request Preparation
// Identify agencies missing critical policies (Use of Force, Internal Affairs,
// Body Camera, Discipline Matrix) and prepare the CPRA request queue.
// Output: Prioritized CPRA request queue ready for Phase 78 campaign launch.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CpraQueueEntry {
  agencyId: string;
  agencyName: string;
  city: string | null;
  county: string | null;
  website: string | null;
  populationEstimate: number | null;
  missingPolicies: MissingPolicy[];
  priority: number; // 1 = highest
  estimatedEmail: string | null;
}

export interface MissingPolicy {
  topicName: string;
  category: string;
  isCritical: boolean;
}

export interface CpraPreparationResult {
  totalAgenciesAnalyzed: number;
  agenciesWithGaps: number;
  agenciesQueuedForCpra: number;
  totalMissingPolicies: number;
  criticalMissingCount: number;
  queue: CpraQueueEntry[];
  missingByCategory: Record<string, number>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Critical policy topics that trigger CPRA requests
// ---------------------------------------------------------------------------

const CRITICAL_POLICY_CATEGORIES = [
  'USE_OF_FORCE',
  'INTERNAL_AFFAIRS',
  'BODY_CAMERA',
  'DISCIPLINE',
];

const IMPORTANT_POLICY_CATEGORIES = [
  'PURSUIT',
  'OFFICER_INVOLVED_SHOOTING',
  'TRAINING',
  'DE_ESCALATION',
  'BIAS_POLICING',
  'DUTY_TO_INTERVENE',
];

// ---------------------------------------------------------------------------
// Derive email from agency website
// ---------------------------------------------------------------------------

function deriveAgencyEmail(website: string | null): string | null {
  if (!website) return null;
  const domain = website
    .replace(/^https?:\/\//, '')
    .replace(/[\/:].*$/, '')
    .replace(/^www\./, '');
  return `records@${domain}`;
}

// ---------------------------------------------------------------------------
// Main: Prepare CPRA request queue
// ---------------------------------------------------------------------------

export async function prepareCpraRequestQueue(
  maxAgencies: number = 100,
): Promise<CpraPreparationResult> {
  console.log('[Phase 77] Preparing CPRA request queue...');
  const startTime = Date.now();

  // Step 1: Get all critical and important topic IDs
  const criticalTopics = await prisma.policyTopic.findMany({
    where: {
      category: { in: CRITICAL_POLICY_CATEGORIES },
    },
  });

  const importantTopics = await prisma.policyTopic.findMany({
    where: {
      category: { in: IMPORTANT_POLICY_CATEGORIES },
    },
  });

  const criticalTopicIds = new Set(criticalTopics.map((t) => t.id));
  const allRelevantTopics = [...criticalTopics, ...importantTopics];

  // Step 2: Get all agencies (excluding CHP which is canonical)
  const agencies = await prisma.agency.findMany({
    where: {
      agencyName: { not: { contains: 'California Highway Patrol' } },
      website: { not: null },
    },
    orderBy: [
      { jurisdictionRank: 'asc' },
      { populationEstimate: 'desc' },
    ],
  });

  console.log(`[Phase 77] Analyzing ${agencies.length} agencies for missing policies...`);

  // Step 3: Check coverage for each agency
  const queue: CpraQueueEntry[] = [];
  let totalMissing = 0;
  let criticalMissing = 0;
  const missingByCategory: Record<string, number> = {};

  for (const agency of agencies) {
    // Get existing coverage for this agency
    const coverage = await prisma.policyCoverage.findMany({
      where: { agencyId: agency.agencyId },
    });

    const coveredTopicIds = new Set(
      coverage.filter((c) => c.policyFound).map((c) => c.topicId),
    );

    // Find missing policies among critical and important topics
    const missingPolicies: MissingPolicy[] = [];

    for (const topic of allRelevantTopics) {
      if (!coveredTopicIds.has(topic.id)) {
        const isCritical = criticalTopicIds.has(topic.id);
        missingPolicies.push({
          topicName: topic.topicName,
          category: topic.category,
          isCritical,
        });

        totalMissing++;
        if (isCritical) criticalMissing++;

        missingByCategory[topic.category] = (missingByCategory[topic.category] || 0) + 1;
      }
    }

    // Only queue agencies that are missing at least one critical policy
    const hasCriticalGap = missingPolicies.some((p) => p.isCritical);
    if (hasCriticalGap && missingPolicies.length > 0) {
      // Priority: more critical gaps = higher priority, weighted by population
      const criticalCount = missingPolicies.filter((p) => p.isCritical).length;
      const populationWeight = agency.populationEstimate
        ? Math.log10(agency.populationEstimate)
        : 1;
      const priority = Math.round(criticalCount * 10 + populationWeight);

      queue.push({
        agencyId: agency.agencyId,
        agencyName: agency.agencyName,
        city: agency.city,
        county: agency.county,
        website: agency.website,
        populationEstimate: agency.populationEstimate,
        missingPolicies,
        priority,
        estimatedEmail: deriveAgencyEmail(agency.website),
      });
    }
  }

  // Sort queue by priority (highest first)
  queue.sort((a, b) => b.priority - a.priority);

  // Limit to maxAgencies
  const finalQueue = queue.slice(0, maxAgencies);

  const duration = Date.now() - startTime;
  console.log(
    `[Phase 77] CPRA queue prepared in ${duration}ms: ` +
    `${agencies.length} analyzed, ${queue.length} with gaps, ` +
    `${finalQueue.length} queued, ${criticalMissing} critical missing`,
  );

  return {
    totalAgenciesAnalyzed: agencies.length,
    agenciesWithGaps: queue.length,
    agenciesQueuedForCpra: finalQueue.length,
    totalMissingPolicies: totalMissing,
    criticalMissingCount: criticalMissing,
    queue: finalQueue,
    missingByCategory,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Get CPRA queue status (for dashboard)
// ---------------------------------------------------------------------------

export async function getCpraQueueStatus(): Promise<{
  pendingRequests: number;
  sentRequests: number;
  responsesReceived: number;
  closedRequests: number;
  agenciesInQueue: number;
}> {
  const [pendingRequests, sentRequests, responsesReceived, closedRequests] =
    await Promise.all([
      prisma.cPRAAgencyRequest.count({ where: { status: 'draft' } }),
      prisma.cPRAAgencyRequest.count({ where: { sentAt: { not: null } } }),
      prisma.cPRAAgencyRequest.count({ where: { responseReceived: true } }),
      prisma.cPRAAgencyRequest.count({ where: { closed: true } }),
    ]);

  // Count distinct agencies that have CPRA requests
  const agencyGroups = await prisma.cPRAAgencyRequest.groupBy({
    by: ['agencyId'],
  });

  return {
    pendingRequests,
    sentRequests,
    responsesReceived,
    closedRequests,
    agenciesInQueue: agencyGroups.length,
  };
}
