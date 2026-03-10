/**
 * Phase 7: Policy Matching Engine
 *
 * When crawler finds documents, matches them against topic keywords.
 * Example: if text contains "force continuum" or "deadly force" → Topic = "Use of Force"
 *
 * Provides:
 * - Text-to-topic matching with confidence scoring
 * - Batch matching for all agency documents
 * - Topic coverage updates
 */

import { PrismaClient } from '@prisma/client';
// PolicyCategory type available from chpPolicyTaxonomy if needed

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchResult {
  documentId: string;
  title: string;
  topicId: string | null;
  topicName: string | null;
  category: string | null;
  confidence: number;
  matchedKeywords: string[];
}

export interface BatchMatchResult {
  agencyId: string;
  agencyName: string;
  totalDocuments: number;
  matched: number;
  unmatched: number;
  results: MatchResult[];
}

// ---------------------------------------------------------------------------
// Match single document text against all topics
// ---------------------------------------------------------------------------

export async function matchDocumentToTopic(
  documentId: string,
): Promise<MatchResult> {
  const doc = await prisma.policyDocument.findUnique({
    where: { documentId },
  });

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const text = ((doc.textContent || '') + ' ' + (doc.title || '')).toLowerCase();

  if (!text.trim()) {
    return {
      documentId,
      title: doc.title || '',
      topicId: null,
      topicName: null,
      category: null,
      confidence: 0,
      matchedKeywords: [],
    };
  }

  const topics = await prisma.policyTopic.findMany();
  let bestTopicId: string | null = null;
  let bestTopicName: string | null = null;
  let bestCategory: string | null = null;
  let bestConfidence = 0;
  let bestMatchedKeywords: string[] = [];

  for (const topic of topics) {
    const keywords: string[] = JSON.parse(topic.keywords);
    const matched: string[] = [];

    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }

    if (matched.length > 0) {
      // Confidence = ratio of matched keywords to a reasonable threshold
      const confidence = Math.min(matched.length / Math.max(keywords.length * 0.2, 2), 1.0);

      if (confidence > bestConfidence) {
        bestTopicId = topic.id;
        bestTopicName = topic.topicName;
        bestCategory = topic.category;
        bestConfidence = Math.round(confidence * 100) / 100;
        bestMatchedKeywords = matched;
      }
    }
  }

  // Update the document
  if (bestTopicId) {
    await prisma.policyDocument.update({
      where: { documentId },
      data: {
        topicId: bestTopicId,
        documentType: bestCategory,
        matchedTopicConfidence: bestConfidence,
        classificationStatus: 'completed',
      },
    });
  }

  return {
    documentId,
    title: doc.title || '',
    topicId: bestTopicId,
    topicName: bestTopicName,
    category: bestCategory,
    confidence: bestConfidence,
    matchedKeywords: bestMatchedKeywords,
  };
}

// ---------------------------------------------------------------------------
// Batch match all unmatched documents for an agency
// ---------------------------------------------------------------------------

export async function matchAgencyDocuments(agencyId: string): Promise<BatchMatchResult> {
  const agency = await prisma.agency.findUnique({
    where: { agencyId },
  });

  if (!agency) {
    throw new Error(`Agency not found: ${agencyId}`);
  }

  const documents = await prisma.policyDocument.findMany({
    where: {
      agencyId,
      classificationStatus: { not: 'completed' },
    },
  });

  const results: MatchResult[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const doc of documents) {
    const result = await matchDocumentToTopic(doc.documentId);
    results.push(result);
    if (result.topicId) {
      matched++;
    } else {
      unmatched++;
    }
  }

  // Update policy coverage for this agency
  await updateAgencyCoverage(agencyId);

  return {
    agencyId,
    agencyName: agency.agencyName,
    totalDocuments: documents.length,
    matched,
    unmatched,
    results,
  };
}

// ---------------------------------------------------------------------------
// Update coverage tracking for an agency
// ---------------------------------------------------------------------------

export async function updateAgencyCoverage(agencyId: string): Promise<void> {
  const topics = await prisma.policyTopic.findMany();
  const agencyDocs = await prisma.policyDocument.findMany({
    where: { agencyId, topicId: { not: null } },
  });

  // Build set of topic IDs that this agency has documents for
  const coveredTopicIds = new Set(agencyDocs.map((d) => d.topicId).filter(Boolean));

  for (const topic of topics) {
    const policyFound = coveredTopicIds.has(topic.id);
    const matchingDoc = agencyDocs.find((d) => d.topicId === topic.id);

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
        policyFound,
        documentId: matchingDoc?.documentId || null,
        sourceUrl: matchingDoc?.sourceUrl || null,
      },
      update: {
        policyFound,
        documentId: matchingDoc?.documentId || null,
        sourceUrl: matchingDoc?.sourceUrl || null,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Match all pending documents across all agencies
// ---------------------------------------------------------------------------

export async function matchAllPendingDocuments(): Promise<{
  totalProcessed: number;
  totalMatched: number;
  totalUnmatched: number;
}> {
  const pendingDocs = await prisma.policyDocument.findMany({
    where: {
      classificationStatus: { not: 'completed' },
      isChpCanonical: false,
      textContent: { not: null },
    },
  });

  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const doc of pendingDocs) {
    const result = await matchDocumentToTopic(doc.documentId);
    if (result.topicId) {
      totalMatched++;
    } else {
      totalUnmatched++;
    }
  }

  // Update coverage for all agencies that had pending documents
  const agencyIds = [...new Set(pendingDocs.map((d) => d.agencyId))];
  for (const agencyId of agencyIds) {
    await updateAgencyCoverage(agencyId);
  }

  return {
    totalProcessed: pendingDocs.length,
    totalMatched,
    totalUnmatched,
  };
}
