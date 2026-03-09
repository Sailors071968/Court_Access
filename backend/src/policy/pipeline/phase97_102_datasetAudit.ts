// ============================================================================
// Phases 97-102 -- CourtAccess Intelligence Dataset Audit
// Deep audit of the statewide policy dataset to verify accuracy and identify
// improvements before scaling further.
//
// Phase 97:  Policy Sample Audit -> policy_sample_audit.json
// Phase 98:  Topic Distribution Report -> topic_distribution.json
// Phase 99:  Agency Coverage Ranking -> agency_policy_coverage_ranking.json
// Phase 100: Policy Gap Report -> policy_gap_analysis.json
// Phase 101: Duplicate Document Detection -> document_duplicate_analysis.json
// Phase 102: Intelligence Summary Report -> courtaccess_statewide_intelligence_summary.json
//
// IMPORTANT: No CPRA emails are sent. This is a read-only audit.
//
// Usage: npx tsx backend/src/policy/pipeline/phase97_102_datasetAudit.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// Resolve reports directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.resolve(__dirname, '../../../reports');

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function writeReport(filename: string, data: unknown): void {
  const filePath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  -> Report saved: reports/${filename}`);
}

// ---------------------------------------------------------------------------
// Phase 97 -- Policy Sample Audit
// Select 100 random policies and report details for manual classification review
// ---------------------------------------------------------------------------

async function runPhase97(): Promise<{
  sampleSize: number;
  avgConfidence: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  unclassifiedCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log('[Phase 97] Selecting 100 random policies for audit...');

  // Get total document count
  const totalDocuments = await prisma.policyDocument.count();
  console.log(`  Total documents in database: ${totalDocuments}`);

  // Select 100 random policies using offset-based random sampling
  // We'll fetch random offsets to get a representative sample
  const sampleSize = Math.min(100, totalDocuments);
  const sampleDocs: Array<{
    documentId: string;
    agencyId: string;
    title: string | null;
    topicId: string | null;
    sourceUrl: string;
    matchedTopicConfidence: number | null;
    classificationStatus: string;
    classificationScore: number | null;
    documentType: string | null;
    isChpCanonical: boolean;
    ocrStatus: string;
  }> = [];

  // Generate random offsets
  const offsets = new Set<number>();
  while (offsets.size < sampleSize && offsets.size < totalDocuments) {
    offsets.add(Math.floor(Math.random() * totalDocuments));
  }

  // Fetch documents at random offsets
  for (const offset of offsets) {
    const docs = await prisma.policyDocument.findMany({
      skip: offset,
      take: 1,
      select: {
        documentId: true,
        agencyId: true,
        title: true,
        topicId: true,
        sourceUrl: true,
        matchedTopicConfidence: true,
        classificationStatus: true,
        classificationScore: true,
        documentType: true,
        isChpCanonical: true,
        ocrStatus: true,
      },
    });
    if (docs.length > 0) {
      sampleDocs.push(docs[0]);
    }
  }

  console.log(`  Selected ${sampleDocs.length} random policies`);

  // Enrich with agency name and topic name
  const agencyIds = Array.from(new Set(sampleDocs.map((d) => d.agencyId)));
  const agencies = await prisma.agency.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, agencyName: true },
  });
  const agencyMap = new Map(agencies.map((a) => [a.agencyId, a.agencyName]));

  const topicIds = Array.from(new Set(sampleDocs.filter((d) => d.topicId).map((d) => d.topicId as string)));
  const topics = topicIds.length > 0
    ? await prisma.policyTopic.findMany({
        where: { id: { in: topicIds } },
        select: { id: true, topicName: true, category: true },
      })
    : [];
  const topicMap = new Map(topics.map((t) => [t.id, { topicName: t.topicName, category: t.category }]));

  // Build audit entries
  const auditEntries = sampleDocs.map((doc) => {
    const topic = doc.topicId ? topicMap.get(doc.topicId) : null;
    return {
      documentId: doc.documentId,
      agency: agencyMap.get(doc.agencyId) ?? 'Unknown',
      policyTitle: doc.title ?? 'Untitled',
      detectedTopic: topic?.topicName ?? 'Unclassified',
      detectedCategory: topic?.category ?? 'N/A',
      confidenceScore: doc.matchedTopicConfidence ?? doc.classificationScore ?? 0,
      sourceUrl: doc.sourceUrl,
      classificationStatus: doc.classificationStatus,
      isChpCanonical: doc.isChpCanonical,
      ocrStatus: doc.ocrStatus,
    };
  });

  // Compute stats
  const confidenceScores = auditEntries
    .filter((e) => e.confidenceScore > 0)
    .map((e) => e.confidenceScore);
  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((s, c) => s + c, 0) / confidenceScores.length
    : 0;
  const highConfidenceCount = auditEntries.filter((e) => e.confidenceScore >= 0.65).length;
  const lowConfidenceCount = auditEntries.filter((e) => e.confidenceScore > 0 && e.confidenceScore < 0.65).length;
  const unclassifiedCount = auditEntries.filter((e) => e.detectedTopic === 'Unclassified').length;

  // Confidence distribution
  const confidenceDistribution = {
    veryHigh: auditEntries.filter((e) => e.confidenceScore >= 0.9).length,
    high: auditEntries.filter((e) => e.confidenceScore >= 0.65 && e.confidenceScore < 0.9).length,
    medium: auditEntries.filter((e) => e.confidenceScore >= 0.4 && e.confidenceScore < 0.65).length,
    low: auditEntries.filter((e) => e.confidenceScore > 0 && e.confidenceScore < 0.4).length,
    none: auditEntries.filter((e) => e.confidenceScore === 0).length,
  };

  const duration = Date.now() - startTime;

  const report = {
    phase: 97,
    title: 'Policy Sample Audit',
    generatedAt: new Date().toISOString(),
    purpose: 'Verify classification accuracy by manual review of random sample',
    summary: {
      totalDocumentsInDatabase: totalDocuments,
      sampleSize: auditEntries.length,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      highConfidenceCount,
      lowConfidenceCount,
      unclassifiedCount,
      chpCanonicalInSample: auditEntries.filter((e) => e.isChpCanonical).length,
      runtimeMs: duration,
    },
    confidenceDistribution,
    auditEntries: auditEntries.sort((a, b) => b.confidenceScore - a.confidenceScore),
  };

  writeReport('policy_sample_audit.json', report);

  console.log(`[Phase 97] Complete -- ${auditEntries.length} policies audited, avg confidence: ${(avgConfidence * 100).toFixed(1)}% in ${Math.round(duration / 1000)}s`);

  return {
    sampleSize: auditEntries.length,
    avgConfidence,
    highConfidenceCount,
    lowConfidenceCount,
    unclassifiedCount,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Phase 98 -- Topic Distribution Report
// Generate distribution statistics: policies per topic
// ---------------------------------------------------------------------------

async function runPhase98(): Promise<{
  totalTopics: number;
  totalClassifiedDocs: number;
  topTopicCount: number;
  bottomTopicCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log('[Phase 98] Generating topic distribution statistics...');

  // Get all topics
  const allTopics = await prisma.policyTopic.findMany({
    select: { id: true, topicName: true, category: true },
    orderBy: { topicName: 'asc' },
  });
  console.log(`  Total topics in taxonomy: ${allTopics.length}`);

  // Count policies per topic
  const topicCounts: Array<{
    topicName: string;
    category: string;
    policyCount: number;
    percentage: number;
  }> = [];

  const totalClassifiedDocs = await prisma.policyDocument.count({
    where: { classificationStatus: 'completed', topicId: { not: null } },
  });

  for (const topic of allTopics) {
    const count = await prisma.policyDocument.count({
      where: { topicId: topic.id },
    });
    topicCounts.push({
      topicName: topic.topicName,
      category: topic.category,
      policyCount: count,
      percentage: totalClassifiedDocs > 0 ? Math.round((count / totalClassifiedDocs) * 10000) / 100 : 0,
    });
  }

  // Sort by count descending
  topicCounts.sort((a, b) => b.policyCount - a.policyCount);

  // Category-level aggregation
  const categoryMap = new Map<string, { count: number; topics: number }>();
  for (const tc of topicCounts) {
    const existing = categoryMap.get(tc.category) ?? { count: 0, topics: 0 };
    existing.count += tc.policyCount;
    existing.topics += 1;
    categoryMap.set(tc.category, existing);
  }

  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      totalPolicies: data.count,
      topicCount: data.topics,
      avgPoliciesPerTopic: data.topics > 0 ? Math.round(data.count / data.topics) : 0,
    }))
    .sort((a, b) => b.totalPolicies - a.totalPolicies);

  // Identify over/underrepresented topics
  const avgPoliciesPerTopic = totalClassifiedDocs > 0 && allTopics.length > 0
    ? totalClassifiedDocs / allTopics.length
    : 0;

  const overrepresented = topicCounts
    .filter((t) => t.policyCount > avgPoliciesPerTopic * 2)
    .map((t) => ({ topicName: t.topicName, count: t.policyCount, ratio: Math.round((t.policyCount / avgPoliciesPerTopic) * 100) / 100 }));

  const underrepresented = topicCounts
    .filter((t) => t.policyCount > 0 && t.policyCount < avgPoliciesPerTopic * 0.5)
    .map((t) => ({ topicName: t.topicName, count: t.policyCount, ratio: Math.round((t.policyCount / avgPoliciesPerTopic) * 100) / 100 }));

  const zeroPolicyTopics = topicCounts.filter((t) => t.policyCount === 0);

  const duration = Date.now() - startTime;

  // Top 30 and bottom 30 for summary
  const top30 = topicCounts.slice(0, 30);
  const bottom30 = topicCounts.filter((t) => t.policyCount > 0).slice(-30);

  const report = {
    phase: 98,
    title: 'Topic Distribution Report',
    generatedAt: new Date().toISOString(),
    purpose: 'Identify over/underrepresented topics in the policy dataset',
    summary: {
      totalTopics: allTopics.length,
      totalClassifiedDocuments: totalClassifiedDocs,
      averagePoliciesPerTopic: Math.round(avgPoliciesPerTopic * 100) / 100,
      topicsWithPolicies: topicCounts.filter((t) => t.policyCount > 0).length,
      topicsWithZeroPolicies: zeroPolicyTopics.length,
      overrepresentedTopics: overrepresented.length,
      underrepresentedTopics: underrepresented.length,
      runtimeMs: duration,
    },
    categoryDistribution,
    top30Topics: top30,
    bottom30Topics: bottom30,
    overrepresented,
    underrepresented,
    zeroPolicyTopics: zeroPolicyTopics.map((t) => ({ topicName: t.topicName, category: t.category })),
    fullDistribution: topicCounts,
  };

  writeReport('topic_distribution.json', report);

  const topCount = topicCounts.length > 0 ? topicCounts[0].policyCount : 0;
  const bottomCount = topicCounts.filter((t) => t.policyCount > 0).length > 0
    ? topicCounts.filter((t) => t.policyCount > 0).slice(-1)[0].policyCount
    : 0;

  console.log(`[Phase 98] Complete -- ${allTopics.length} topics, ${totalClassifiedDocs} classified docs, top topic: ${topCount} policies in ${Math.round(duration / 1000)}s`);

  return {
    totalTopics: allTopics.length,
    totalClassifiedDocs,
    topTopicCount: topCount,
    bottomTopicCount: bottomCount,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Phase 99 -- Agency Coverage Ranking
// Rank agencies by policy completeness (policies found / total topics)
// ---------------------------------------------------------------------------

async function runPhase99(): Promise<{
  totalAgencies: number;
  avgCoverageScore: number;
  highTransparencyCount: number;
  lowTransparencyCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log('[Phase 99] Ranking agencies by policy completeness...');

  // Get all agencies with their coverage data
  const agencies = await prisma.agency.findMany({
    select: {
      agencyId: true,
      agencyName: true,
      agencyType: true,
      city: true,
      county: true,
      populationEstimate: true,
      jurisdictionRank: true,
    },
    orderBy: { jurisdictionRank: 'asc' },
  });

  const totalTopics = await prisma.policyTopic.count();
  console.log(`  Evaluating ${agencies.length} agencies against ${totalTopics} topics`);

  const agencyRankings: Array<{
    rank: number;
    agencyName: string;
    agencyType: string | null;
    city: string | null;
    county: string | null;
    populationEstimate: number | null;
    policiesFound: number;
    totalTopics: number;
    coverageScore: number;
    coveragePercent: string;
    transparencyTier: string;
  }> = [];

  for (const agency of agencies) {
    const policiesFound = await prisma.policyCoverage.count({
      where: { agencyId: agency.agencyId, policyFound: true },
    });

    const coverageScore = totalTopics > 0 ? policiesFound / totalTopics : 0;
    let transparencyTier: string;
    if (coverageScore >= 0.75) transparencyTier = 'High';
    else if (coverageScore >= 0.5) transparencyTier = 'Medium-High';
    else if (coverageScore >= 0.25) transparencyTier = 'Medium';
    else if (coverageScore >= 0.1) transparencyTier = 'Medium-Low';
    else if (coverageScore > 0) transparencyTier = 'Low';
    else transparencyTier = 'None';

    agencyRankings.push({
      rank: 0, // will be set after sorting
      agencyName: agency.agencyName,
      agencyType: agency.agencyType,
      city: agency.city,
      county: agency.county,
      populationEstimate: agency.populationEstimate,
      policiesFound,
      totalTopics,
      coverageScore: Math.round(coverageScore * 10000) / 10000,
      coveragePercent: `${(coverageScore * 100).toFixed(1)}%`,
      transparencyTier,
    });
  }

  // Sort by coverage score descending
  agencyRankings.sort((a, b) => b.coverageScore - a.coverageScore);
  agencyRankings.forEach((a, i) => { a.rank = i + 1; });

  // Compute stats
  const coverageScores = agencyRankings.map((a) => a.coverageScore);
  const avgCoverageScore = coverageScores.length > 0
    ? coverageScores.reduce((s, c) => s + c, 0) / coverageScores.length
    : 0;

  const highTransparency = agencyRankings.filter((a) => a.transparencyTier === 'High');
  const lowTransparency = agencyRankings.filter((a) => a.transparencyTier === 'Low' || a.transparencyTier === 'None');

  // Tier distribution
  const tierDistribution = {
    high: agencyRankings.filter((a) => a.transparencyTier === 'High').length,
    mediumHigh: agencyRankings.filter((a) => a.transparencyTier === 'Medium-High').length,
    medium: agencyRankings.filter((a) => a.transparencyTier === 'Medium').length,
    mediumLow: agencyRankings.filter((a) => a.transparencyTier === 'Medium-Low').length,
    low: agencyRankings.filter((a) => a.transparencyTier === 'Low').length,
    none: agencyRankings.filter((a) => a.transparencyTier === 'None').length,
  };

  const duration = Date.now() - startTime;

  const report = {
    phase: 99,
    title: 'Agency Coverage Ranking',
    generatedAt: new Date().toISOString(),
    purpose: 'Rank agencies by policy completeness to identify high/low transparency agencies',
    summary: {
      totalAgencies: agencyRankings.length,
      totalTopics,
      averageCoverageScore: Math.round(avgCoverageScore * 10000) / 10000,
      averageCoveragePercent: `${(avgCoverageScore * 100).toFixed(1)}%`,
      highTransparencyAgencies: highTransparency.length,
      lowTransparencyAgencies: lowTransparency.length,
      runtimeMs: duration,
    },
    tierDistribution,
    topAgencies: agencyRankings.slice(0, 25),
    bottomAgencies: agencyRankings.filter((a) => a.coverageScore > 0).slice(-25).reverse(),
    zeroCoverageAgencies: agencyRankings.filter((a) => a.coverageScore === 0).length,
    fullRanking: agencyRankings,
  };

  writeReport('agency_policy_coverage_ranking.json', report);

  console.log(`[Phase 99] Complete -- ${agencyRankings.length} agencies ranked, avg coverage: ${(avgCoverageScore * 100).toFixed(1)}% in ${Math.round(duration / 1000)}s`);

  return {
    totalAgencies: agencyRankings.length,
    avgCoverageScore,
    highTransparencyCount: highTransparency.length,
    lowTransparencyCount: lowTransparency.length,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Phase 100 -- Policy Gap Report
// Identify most common missing policies across all agencies
// ---------------------------------------------------------------------------

async function runPhase100(): Promise<{
  totalGaps: number;
  criticalGaps: number;
  topMissingPolicy: string;
  topMissingCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log('[Phase 100] Analyzing policy gaps across all agencies...');

  // Get all topics
  const allTopics = await prisma.policyTopic.findMany({
    select: { id: true, topicName: true, category: true },
  });

  const totalAgencies = await prisma.agency.count();
  console.log(`  Checking ${allTopics.length} topics across ${totalAgencies} agencies`);

  // For each topic, count how many agencies are MISSING it
  const gapAnalysis: Array<{
    topicName: string;
    category: string;
    agenciesMissingPolicy: number;
    agenciesWithPolicy: number;
    totalAgencies: number;
    gapPercent: string;
    priority: string;
  }> = [];

  for (const topic of allTopics) {
    const agenciesWithPolicy = await prisma.policyCoverage.count({
      where: { topicId: topic.id, policyFound: true },
    });
    const agenciesMissing = totalAgencies - agenciesWithPolicy;

    let priority: string;
    const criticalCategories = [
      'Use_of_Force', 'Internal_Affairs', 'Body_Camera', 'Discipline',
      'Training', 'OIS', 'Pursuit',
    ];
    const gapPercent = totalAgencies > 0 ? agenciesMissing / totalAgencies : 0;

    if (criticalCategories.includes(topic.category) && gapPercent > 0.5) priority = 'Critical';
    else if (criticalCategories.includes(topic.category)) priority = 'High';
    else if (gapPercent > 0.75) priority = 'Medium';
    else priority = 'Low';

    gapAnalysis.push({
      topicName: topic.topicName,
      category: topic.category,
      agenciesMissingPolicy: agenciesMissing,
      agenciesWithPolicy,
      totalAgencies,
      gapPercent: `${(gapPercent * 100).toFixed(1)}%`,
      priority,
    });
  }

  // Sort by missing count descending
  gapAnalysis.sort((a, b) => b.agenciesMissingPolicy - a.agenciesMissingPolicy);

  // Category-level gap analysis
  const categoryGaps = new Map<string, { totalMissing: number; topics: number; criticalMissing: number }>();
  for (const gap of gapAnalysis) {
    const existing = categoryGaps.get(gap.category) ?? { totalMissing: 0, topics: 0, criticalMissing: 0 };
    existing.totalMissing += gap.agenciesMissingPolicy;
    existing.topics += 1;
    if (gap.priority === 'Critical') existing.criticalMissing += gap.agenciesMissingPolicy;
    categoryGaps.set(gap.category, existing);
  }

  const categoryGapSummary = Array.from(categoryGaps.entries())
    .map(([category, data]) => ({
      category,
      totalMissing: data.totalMissing,
      topicCount: data.topics,
      avgMissingPerTopic: data.topics > 0 ? Math.round(data.totalMissing / data.topics) : 0,
      criticalMissing: data.criticalMissing,
    }))
    .sort((a, b) => b.totalMissing - a.totalMissing);

  const criticalGaps = gapAnalysis.filter((g) => g.priority === 'Critical');
  const highGaps = gapAnalysis.filter((g) => g.priority === 'High');
  const totalGaps = gapAnalysis.reduce((s, g) => s + g.agenciesMissingPolicy, 0);

  const duration = Date.now() - startTime;

  const report = {
    phase: 100,
    title: 'Policy Gap Analysis',
    generatedAt: new Date().toISOString(),
    purpose: 'Identify most common missing policies to prioritize CPRA requests',
    note: 'NO CPRA emails sent. This audit identifies which requests should be prioritized.',
    summary: {
      totalTopicsAnalyzed: allTopics.length,
      totalAgencies,
      totalGapInstances: totalGaps,
      criticalGaps: criticalGaps.length,
      highPriorityGaps: highGaps.length,
      mostCommonMissingPolicy: gapAnalysis.length > 0 ? gapAnalysis[0].topicName : 'N/A',
      mostCommonMissingCount: gapAnalysis.length > 0 ? gapAnalysis[0].agenciesMissingPolicy : 0,
      runtimeMs: duration,
    },
    categoryGapSummary,
    criticalGaps: criticalGaps.slice(0, 50),
    highPriorityGaps: highGaps.slice(0, 50),
    top50MissingPolicies: gapAnalysis.slice(0, 50),
    fullGapAnalysis: gapAnalysis,
  };

  writeReport('policy_gap_analysis.json', report);

  console.log(`[Phase 100] Complete -- ${criticalGaps.length} critical gaps, top missing: ${gapAnalysis[0]?.topicName ?? 'N/A'} (${gapAnalysis[0]?.agenciesMissingPolicy ?? 0} agencies) in ${Math.round(duration / 1000)}s`);

  return {
    totalGaps,
    criticalGaps: criticalGaps.length,
    topMissingPolicy: gapAnalysis[0]?.topicName ?? 'N/A',
    topMissingCount: gapAnalysis[0]?.agenciesMissingPolicy ?? 0,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Phase 101 -- Duplicate Document Detection
// Check for identical policies across agencies using SHA256 hash comparison
// ---------------------------------------------------------------------------

async function runPhase101(): Promise<{
  totalDocuments: number;
  uniqueDocuments: number;
  duplicateGroups: number;
  totalDuplicates: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log('[Phase 101] Running duplicate document detection...');

  // Fetch all documents with text content for hash comparison
  const documents = await prisma.policyDocument.findMany({
    select: {
      documentId: true,
      agencyId: true,
      title: true,
      sourceUrl: true,
      textContent: true,
      s3Url: true,
      fileSizeBytes: true,
    },
  });

  console.log(`  Analyzing ${documents.length} documents for duplicates`);

  // Get agency names for enrichment
  const agencyIds = Array.from(new Set(documents.map((d) => d.agencyId)));
  const agencies = await prisma.agency.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, agencyName: true },
  });
  const agencyMap = new Map(agencies.map((a) => [a.agencyId, a.agencyName]));

  // Compute SHA256 hashes for all documents with text content
  const hashMap = new Map<string, Array<{
    documentId: string;
    agencyName: string;
    title: string | null;
    sourceUrl: string;
  }>>();

  let hashableCount = 0;
  let noContentCount = 0;

  for (const doc of documents) {
    if (!doc.textContent || doc.textContent.trim().length === 0) {
      noContentCount++;
      continue;
    }

    // Normalize text: trim whitespace, lowercase, collapse multiple spaces
    const normalizedText = doc.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
    const hash = crypto.createHash('sha256').update(normalizedText).digest('hex');

    const entry = {
      documentId: doc.documentId,
      agencyName: agencyMap.get(doc.agencyId) ?? 'Unknown',
      title: doc.title,
      sourceUrl: doc.sourceUrl,
    };

    const existing = hashMap.get(hash);
    if (existing) {
      existing.push(entry);
    } else {
      hashMap.set(hash, [entry]);
    }
    hashableCount++;
  }

  console.log(`  Hashed ${hashableCount} documents (${noContentCount} without text content)`);

  // Find duplicate groups (hash with more than 1 document)
  const duplicateGroups: Array<{
    hash: string;
    documentCount: number;
    documents: Array<{
      documentId: string;
      agencyName: string;
      title: string | null;
      sourceUrl: string;
    }>;
    crossAgency: boolean;
    sharedTitle: string | null;
  }> = [];

  let totalDuplicates = 0;

  const hashEntries = Array.from(hashMap.entries());
  for (let i = 0; i < hashEntries.length; i++) {
    const hash = hashEntries[i][0];
    const docs = hashEntries[i][1];
    if (docs.length > 1) {
      const agencyNames = new Set(docs.map((d) => d.agencyName));
      const titles = docs.map((d) => d.title).filter(Boolean);
      const sharedTitle = titles.length > 0 ? titles[0] : null;

      duplicateGroups.push({
        hash: hash.substring(0, 16) + '...', // truncate for readability
        documentCount: docs.length,
        documents: docs,
        crossAgency: agencyNames.size > 1,
        sharedTitle,
      });

      totalDuplicates += docs.length - 1; // -1 because one is the "original"
    }
  }

  // Sort by document count descending
  duplicateGroups.sort((a, b) => b.documentCount - a.documentCount);

  // Cross-agency duplicates (identical policies shared across agencies)
  const crossAgencyDuplicates = duplicateGroups.filter((g) => g.crossAgency);

  // Same-agency duplicates (duplicate downloads within same agency)
  const sameAgencyDuplicates = duplicateGroups.filter((g) => !g.crossAgency);

  // Title-based near-duplicate detection (same title across agencies)
  const titleMap = new Map<string, Array<{ documentId: string; agencyName: string; sourceUrl: string }>>();
  for (const doc of documents) {
    if (!doc.title) continue;
    const normalizedTitle = doc.title.trim().toLowerCase();
    const existing = titleMap.get(normalizedTitle);
    const entry = {
      documentId: doc.documentId,
      agencyName: agencyMap.get(doc.agencyId) ?? 'Unknown',
      sourceUrl: doc.sourceUrl,
    };
    if (existing) {
      existing.push(entry);
    } else {
      titleMap.set(normalizedTitle, [entry]);
    }
  }

  const titleDuplicates = Array.from(titleMap.entries())
    .filter(([, docs]) => docs.length > 1)
    .map(([title, docs]) => ({
      title,
      documentCount: docs.length,
      agencyCount: new Set(docs.map((d) => d.agencyName)).size,
    }))
    .sort((a, b) => b.documentCount - a.documentCount)
    .slice(0, 50);

  const uniqueDocuments = hashMap.size;
  const duration = Date.now() - startTime;

  const report = {
    phase: 101,
    title: 'Duplicate Document Detection',
    generatedAt: new Date().toISOString(),
    purpose: 'Detect identical/duplicate policies across and within agencies',
    method: 'SHA256 hash of normalized text content + title-based near-duplicate detection',
    summary: {
      totalDocuments: documents.length,
      documentsWithContent: hashableCount,
      documentsWithoutContent: noContentCount,
      uniqueHashes: uniqueDocuments,
      duplicateGroups: duplicateGroups.length,
      totalDuplicateDocuments: totalDuplicates,
      crossAgencyDuplicateGroups: crossAgencyDuplicates.length,
      sameAgencyDuplicateGroups: sameAgencyDuplicates.length,
      deduplicationSavings: documents.length > 0
        ? `${((totalDuplicates / documents.length) * 100).toFixed(1)}%`
        : '0%',
      runtimeMs: duration,
    },
    crossAgencyDuplicates: crossAgencyDuplicates.slice(0, 50),
    sameAgencyDuplicates: sameAgencyDuplicates.slice(0, 50),
    titleBasedNearDuplicates: titleDuplicates,
    allDuplicateGroups: duplicateGroups,
  };

  writeReport('document_duplicate_analysis.json', report);

  console.log(`[Phase 101] Complete -- ${uniqueDocuments} unique hashes, ${duplicateGroups.length} duplicate groups, ${totalDuplicates} total duplicates in ${Math.round(duration / 1000)}s`);

  return {
    totalDocuments: documents.length,
    uniqueDocuments,
    duplicateGroups: duplicateGroups.length,
    totalDuplicates,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Phase 102 -- Intelligence Summary Report
// Generate single consolidated report of the entire statewide dataset
// ---------------------------------------------------------------------------

async function runPhase102(
  phase97Result: { sampleSize: number; avgConfidence: number; highConfidenceCount: number; lowConfidenceCount: number; unclassifiedCount: number },
  phase98Result: { totalTopics: number; totalClassifiedDocs: number; topTopicCount: number; bottomTopicCount: number },
  phase99Result: { totalAgencies: number; avgCoverageScore: number; highTransparencyCount: number; lowTransparencyCount: number },
  phase100Result: { totalGaps: number; criticalGaps: number; topMissingPolicy: string; topMissingCount: number },
  phase101Result: { totalDocuments: number; uniqueDocuments: number; duplicateGroups: number; totalDuplicates: number },
): Promise<{ duration: number }> {
  const startTime = Date.now();
  console.log('[Phase 102] Generating consolidated intelligence summary...');

  // Gather all database counts
  const [
    agencyCount,
    docCount,
    topicCount,
    coverageCount,
    campaignCount,
    requestCount,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.policyDocument.count(),
    prisma.policyTopic.count(),
    prisma.policyCoverage.count(),
    prisma.cPRARequestCampaign.count(),
    prisma.cPRAAgencyRequest.count(),
  ]);

  // OCR and classification breakdown
  const [
    ocrCompleted,
    ocrPending,
    ocrFailed,
    classCompleted,
    classPending,
    classFailed,
  ] = await Promise.all([
    prisma.policyDocument.count({ where: { ocrStatus: 'completed' } }),
    prisma.policyDocument.count({ where: { ocrStatus: 'pending' } }),
    prisma.policyDocument.count({ where: { ocrStatus: 'failed' } }),
    prisma.policyDocument.count({ where: { classificationStatus: 'completed' } }),
    prisma.policyDocument.count({ where: { classificationStatus: 'pending' } }),
    prisma.policyDocument.count({ where: { classificationStatus: 'failed' } }),
  ]);

  // CHP baseline
  const chpDocs = await prisma.policyDocument.count({ where: { isChpCanonical: true } });

  // Coverage stats
  const policiesFound = await prisma.policyCoverage.count({ where: { policyFound: true } });
  const policiesMissing = coverageCount - policiesFound;

  // Agency type distribution
  const agencyTypes = await prisma.agency.groupBy({
    by: ['agencyType'],
    _count: { agencyId: true },
    orderBy: { _count: { agencyId: 'desc' } },
  });

  // Top 10 most common missing policies (from gap analysis)
  const allTopics = await prisma.policyTopic.findMany({
    select: { id: true, topicName: true, category: true },
  });

  const topMissing: Array<{ policy: string; category: string; agenciesMissing: number }> = [];
  for (const topic of allTopics) {
    const withPolicy = await prisma.policyCoverage.count({
      where: { topicId: topic.id, policyFound: true },
    });
    topMissing.push({
      policy: topic.topicName,
      category: topic.category,
      agenciesMissing: agencyCount - withPolicy,
    });
  }
  topMissing.sort((a, b) => b.agenciesMissing - a.agenciesMissing);

  const duration = Date.now() - startTime;

  const report = {
    phase: 102,
    title: 'CourtAccess Statewide Intelligence Summary',
    generatedAt: new Date().toISOString(),
    purpose: 'Consolidated view of the entire statewide policy intelligence dataset',

    // Core metrics
    dataset: {
      agenciesIndexed: agencyCount,
      policiesCollected: docCount,
      chpBaselinePolicies: chpDocs,
      discoveredPolicies: docCount - chpDocs,
      topicsDetected: topicCount,
      coverageEntries: coverageCount,
    },

    // Pipeline health
    pipelineStatus: {
      ocrCompleted,
      ocrPending,
      ocrFailed,
      classificationCompleted: classCompleted,
      classificationPending: classPending,
      classificationFailed: classFailed,
    },

    // Coverage completeness
    coverageCompleteness: {
      totalCoverageEntries: coverageCount,
      policiesFound,
      policiesMissing,
      overallCoveragePercent: coverageCount > 0
        ? `${((policiesFound / coverageCount) * 100).toFixed(1)}%`
        : '0%',
    },

    // Most common missing policies (top 20)
    mostCommonMissingPolicies: topMissing.slice(0, 20).map((m) => ({
      policy: m.policy,
      category: m.category,
      missingInAgencies: m.agenciesMissing,
    })),

    // Agency distribution
    agencyTypeDistribution: agencyTypes.map((at) => ({
      type: at.agencyType ?? 'Unknown',
      count: at._count.agencyId,
    })),

    // Audit findings summary (from phases 97-101)
    auditFindings: {
      phase97_sampleAudit: {
        sampleSize: phase97Result.sampleSize,
        averageConfidence: Math.round(phase97Result.avgConfidence * 1000) / 1000,
        highConfidence: phase97Result.highConfidenceCount,
        lowConfidence: phase97Result.lowConfidenceCount,
        unclassified: phase97Result.unclassifiedCount,
      },
      phase98_topicDistribution: {
        totalTopics: phase98Result.totalTopics,
        classifiedDocuments: phase98Result.totalClassifiedDocs,
        topTopicPolicyCount: phase98Result.topTopicCount,
        bottomTopicPolicyCount: phase98Result.bottomTopicCount,
      },
      phase99_agencyCoverage: {
        totalAgencies: phase99Result.totalAgencies,
        averageCoverageScore: Math.round(phase99Result.avgCoverageScore * 10000) / 10000,
        highTransparency: phase99Result.highTransparencyCount,
        lowTransparency: phase99Result.lowTransparencyCount,
      },
      phase100_policyGaps: {
        totalGapInstances: phase100Result.totalGaps,
        criticalGaps: phase100Result.criticalGaps,
        topMissingPolicy: phase100Result.topMissingPolicy,
        topMissingCount: phase100Result.topMissingCount,
      },
      phase101_duplicates: {
        totalDocuments: phase101Result.totalDocuments,
        uniqueDocuments: phase101Result.uniqueDocuments,
        duplicateGroups: phase101Result.duplicateGroups,
        totalDuplicates: phase101Result.totalDuplicates,
      },
    },

    // CPRA campaign status
    cpraStatus: {
      activeCampaigns: campaignCount,
      totalRequests: requestCount,
      note: 'NO CPRA emails sent. Audit ensures we target the right agencies before sending.',
    },

    // Recommendations
    recommendations: [
      phase100Result.criticalGaps > 0
        ? `${phase100Result.criticalGaps} critical policy gaps identified — prioritize CPRA requests for: ${phase100Result.topMissingPolicy} (missing in ${phase100Result.topMissingCount} agencies)`
        : 'No critical gaps identified',
      phase101Result.totalDuplicates > 0
        ? `${phase101Result.totalDuplicates} duplicate documents detected — consider deduplication before next CPRA batch`
        : 'No duplicates detected',
      phase99Result.lowTransparencyCount > 0
        ? `${phase99Result.lowTransparencyCount} agencies with low/no transparency — these are top CPRA targets`
        : 'All agencies have some coverage',
      phase97Result.lowConfidenceCount > 0
        ? `${phase97Result.lowConfidenceCount} sampled policies with low confidence — review classification accuracy`
        : 'All sampled policies have acceptable confidence',
    ],

    runtimeMs: duration,
  };

  writeReport('courtaccess_statewide_intelligence_summary.json', report);

  console.log(`[Phase 102] Complete -- Intelligence summary generated in ${Math.round(duration / 1000)}s`);

  return { duration };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('');
  console.log('================================================================================');
  console.log('  CourtAccess Intelligence Dataset Audit -- Phases 97-102');
  console.log('  Deep audit of statewide policy dataset before scaling further');
  console.log('  NOTE: No CPRA emails will be sent during this audit.');
  console.log('================================================================================');
  console.log('');

  ensureReportsDir();
  const overallStart = Date.now();

  try {
    // Phase 97
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 97 -- Policy Sample Audit                                          |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    const phase97Result = await runPhase97();

    // Phase 98
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 98 -- Topic Distribution Report                                    |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    const phase98Result = await runPhase98();

    // Phase 99
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 99 -- Agency Coverage Ranking                                      |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    const phase99Result = await runPhase99();

    // Phase 100
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 100 -- Policy Gap Report                                           |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    const phase100Result = await runPhase100();

    // Phase 101
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 101 -- Duplicate Document Detection                                |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    const phase101Result = await runPhase101();

    // Phase 102
    console.log('');
    console.log('+---------------------------------------------------------------------------+');
    console.log('|  Phase 102 -- Intelligence Summary Report                                 |');
    console.log('+---------------------------------------------------------------------------+');
    console.log('');
    await runPhase102(phase97Result, phase98Result, phase99Result, phase100Result, phase101Result);

    // Final summary
    const totalRuntime = Date.now() - overallStart;
    console.log('');
    console.log('================================================================================');
    console.log('  INTELLIGENCE DATASET AUDIT COMPLETE');
    console.log('================================================================================');
    console.log('');
    console.log(`  Phase 97  (Sample Audit):     ${phase97Result.sampleSize} policies, avg confidence ${(phase97Result.avgConfidence * 100).toFixed(1)}%`);
    console.log(`  Phase 98  (Topic Distribution): ${phase98Result.totalTopics} topics, ${phase98Result.totalClassifiedDocs} classified`);
    console.log(`  Phase 99  (Coverage Ranking):  ${phase99Result.totalAgencies} agencies, avg ${(phase99Result.avgCoverageScore * 100).toFixed(1)}% coverage`);
    console.log(`  Phase 100 (Policy Gaps):       ${phase100Result.criticalGaps} critical gaps, top: ${phase100Result.topMissingPolicy}`);
    console.log(`  Phase 101 (Duplicates):        ${phase101Result.duplicateGroups} duplicate groups, ${phase101Result.totalDuplicates} duplicates`);
    console.log(`  Phase 102 (Summary):           Consolidated report generated`);
    console.log('');
    console.log(`  Total Runtime: ${Math.round(totalRuntime / 1000)}s (${Math.round(totalRuntime / 60000)}m)`);
    console.log('');
    console.log('  Reports generated:');
    console.log('    reports/policy_sample_audit.json');
    console.log('    reports/topic_distribution.json');
    console.log('    reports/agency_policy_coverage_ranking.json');
    console.log('    reports/policy_gap_analysis.json');
    console.log('    reports/document_duplicate_analysis.json');
    console.log('    reports/courtaccess_statewide_intelligence_summary.json');
    console.log('');
    console.log('  No CPRA emails were sent during this audit.');
    console.log('================================================================================');
  } catch (error) {
    console.error('FATAL ERROR during audit:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
