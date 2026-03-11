// ---------------------------------------------------------------------------
// Phase 16 — Coverage Matrix Population
// Automatically populates PolicyCoverage when an agency has a policy matching
// a topic. Runs after classification completes.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoveragePopulationResult {
  agencyId: string;
  agencyName: string;
  totalTopics: number;
  covered: number;
  missing: number;
  coveragePercent: number;
  newEntriesCreated: number;
  entriesUpdated: number;
}

export interface SystemCoveragePopulationResult {
  agenciesProcessed: number;
  totalNewEntries: number;
  totalUpdated: number;
  agencyResults: CoveragePopulationResult[];
}

// ---------------------------------------------------------------------------
// Populate coverage for a single agency
// ---------------------------------------------------------------------------

export async function populateAgencyCoverage(
  agencyId: string,
): Promise<CoveragePopulationResult> {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    throw new Error(`Agency not found: ${agencyId}`);
  }

  const topics = await prisma.policyTopic.findMany();

  // Find all classified documents for this agency
  const agencyDocs = await prisma.policyDocument.findMany({
    where: {
      agencyId,
      topicId: { not: null },
      classificationStatus: 'completed',
    },
  });

  // Build map: topicId → best matching document
  const topicDocMap = new Map<string, { documentId: string; sourceUrl: string; confidence: number }>();

  for (const doc of agencyDocs) {
    if (!doc.topicId) continue;

    const existing = topicDocMap.get(doc.topicId);
    const confidence = doc.matchedTopicConfidence ?? 0;

    if (!existing || confidence > existing.confidence) {
      topicDocMap.set(doc.topicId, {
        documentId: doc.documentId,
        sourceUrl: doc.sourceUrl,
        confidence,
      });
    }
  }

  let newEntriesCreated = 0;
  let entriesUpdated = 0;
  let covered = 0;

  for (const topic of topics) {
    const matchingDoc = topicDocMap.get(topic.id);
    const policyFound = !!matchingDoc;
    if (policyFound) covered++;

    const existing = await prisma.policyCoverage.findUnique({
      where: {
        agencyId_topicId: {
          agencyId,
          topicId: topic.id,
        },
      },
    });

    if (existing) {
      // Update if coverage status changed
      if (existing.policyFound !== policyFound || (matchingDoc && existing.documentId !== matchingDoc.documentId)) {
        await prisma.policyCoverage.update({
          where: { id: existing.id },
          data: {
            policyFound,
            documentId: matchingDoc?.documentId || null,
            sourceUrl: matchingDoc?.sourceUrl || null,
          },
        });
        entriesUpdated++;
      }
    } else {
      await prisma.policyCoverage.create({
        data: {
          agencyId,
          topicId: topic.id,
          policyFound,
          documentId: matchingDoc?.documentId || null,
          sourceUrl: matchingDoc?.sourceUrl || null,
          notes: policyFound
            ? `Auto-populated from classified document`
            : null,
        },
      });
      newEntriesCreated++;
    }
  }

  const missing = topics.length - covered;
  const coveragePercent = topics.length > 0
    ? Math.round((covered / topics.length) * 10000) / 100
    : 0;

  console.log(
    `[Coverage] ${agency.agencyName}: ${covered}/${topics.length} topics covered ` +
    `(${coveragePercent}%) — ${newEntriesCreated} new, ${entriesUpdated} updated`,
  );

  return {
    agencyId,
    agencyName: agency.agencyName,
    totalTopics: topics.length,
    covered,
    missing,
    coveragePercent,
    newEntriesCreated,
    entriesUpdated,
  };
}

// ---------------------------------------------------------------------------
// Populate coverage for all agencies
// ---------------------------------------------------------------------------

export async function populateAllAgencyCoverage(): Promise<SystemCoveragePopulationResult> {
  const agencies = await prisma.agency.findMany({
    orderBy: { jurisdictionRank: 'asc' },
  });

  const agencyResults: CoveragePopulationResult[] = [];
  let totalNewEntries = 0;
  let totalUpdated = 0;

  for (const agency of agencies) {
    try {
      const result = await populateAgencyCoverage(agency.agencyId);
      agencyResults.push(result);
      totalNewEntries += result.newEntriesCreated;
      totalUpdated += result.entriesUpdated;
    } catch (error) {
      console.error(
        `[Coverage] Failed for ${agency.agencyName}: ` +
        (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  console.log(
    `[Coverage] System-wide: ${agencies.length} agencies processed, ` +
    `${totalNewEntries} new entries, ${totalUpdated} updated`,
  );

  return {
    agenciesProcessed: agencies.length,
    totalNewEntries,
    totalUpdated,
    agencyResults,
  };
}

// ---------------------------------------------------------------------------
// Post-classification hook: update coverage for a specific document
// ---------------------------------------------------------------------------

export async function updateCoverageAfterClassification(
  documentId: string,
  agencyId: string,
  topicId: string,
): Promise<void> {
  await prisma.policyCoverage.upsert({
    where: {
      agencyId_topicId: {
        agencyId,
        topicId,
      },
    },
    create: {
      agencyId,
      topicId,
      policyFound: true,
      documentId,
      notes: 'Auto-populated after document classification',
    },
    update: {
      policyFound: true,
      documentId,
    },
  });
}

// ---------------------------------------------------------------------------
// Get coverage summary for dashboard
// ---------------------------------------------------------------------------

export async function getCoverageSummary(): Promise<{
  totalAgencies: number;
  totalTopics: number;
  totalPoliciesCollected: number;
  overallCoveragePercent: number;
  missingTopicsCount: number;
  agenciesIndexed: number;
}> {
  const [totalAgencies, totalTopics, totalPolicies, coverageFound, agenciesWithDocs] =
    await Promise.all([
      prisma.agency.count(),
      prisma.policyTopic.count(),
      prisma.policyDocument.count({ where: { isChpCanonical: false } }),
      prisma.policyCoverage.count({ where: { policyFound: true } }),
      prisma.agency.count({ where: { policiesDiscovered: true } }),
    ]);

  const maxPossible = totalAgencies * totalTopics;
  const overallCoveragePercent = maxPossible > 0
    ? Math.round((coverageFound / maxPossible) * 10000) / 100
    : 0;

  const totalCoverageEntries = await prisma.policyCoverage.count();
  const missingTopicsCount = totalCoverageEntries - coverageFound;

  return {
    totalAgencies,
    totalTopics,
    totalPoliciesCollected: totalPolicies,
    overallCoveragePercent,
    missingTopicsCount: Math.max(0, missingTopicsCount),
    agenciesIndexed: agenciesWithDocs,
  };
}
