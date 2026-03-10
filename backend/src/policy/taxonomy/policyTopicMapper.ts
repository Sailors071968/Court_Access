/**
 * Phase 5: Policy-to-Topic Mapping Service
 *
 * Maps any policy document (CHP or discovered agency policy) to the canonical topic taxonomy.
 * Uses keyword-based matching with confidence scoring.
 */

import { PrismaClient } from '@prisma/client';
import { CATEGORY_DEFINITIONS, type PolicyCategory } from './chpPolicyTaxonomy.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicMatch {
  topicId: string;
  topicName: string;
  category: PolicyCategory;
  confidence: number;
  matchedKeywords: string[];
}

export interface MappingResult {
  documentId: string;
  bestMatch: TopicMatch | null;
  allMatches: TopicMatch[];
}

// ---------------------------------------------------------------------------
// Match a document's text/title against all topics
// ---------------------------------------------------------------------------

export async function mapDocumentToTopic(
  documentId: string,
  title: string,
  textContent: string,
): Promise<MappingResult> {
  const topics = await prisma.policyTopic.findMany();
  const lowerText = (textContent + ' ' + title).toLowerCase();
  const allMatches: TopicMatch[] = [];

  for (const topic of topics) {
    const keywords: string[] = JSON.parse(topic.keywords);
    const matchedKeywords: string[] = [];

    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }

    if (matchedKeywords.length > 0) {
      const confidence = Math.min(matchedKeywords.length / Math.max(keywords.length * 0.3, 3), 1.0);
      allMatches.push({
        topicId: topic.id,
        topicName: topic.topicName,
        category: topic.category as PolicyCategory,
        confidence: Math.round(confidence * 100) / 100,
        matchedKeywords,
      });
    }
  }

  // Sort by confidence descending
  allMatches.sort((a, b) => b.confidence - a.confidence);

  const bestMatch = allMatches.length > 0 ? allMatches[0] : null;

  // Update the document with the best match
  if (bestMatch) {
    await prisma.policyDocument.update({
      where: { documentId },
      data: {
        topicId: bestMatch.topicId,
        matchedTopicConfidence: bestMatch.confidence,
        documentType: bestMatch.category,
        classificationStatus: 'completed',
      },
    });
  }

  return { documentId, bestMatch, allMatches };
}

// ---------------------------------------------------------------------------
// Batch map all unmapped documents for an agency
// ---------------------------------------------------------------------------

export async function mapAgencyDocuments(agencyId: string): Promise<{
  totalDocuments: number;
  mapped: number;
  unmapped: number;
  results: MappingResult[];
}> {
  const documents = await prisma.policyDocument.findMany({
    where: {
      agencyId,
      topicId: null,
      textContent: { not: null },
    },
  });

  const results: MappingResult[] = [];
  let mapped = 0;
  let unmapped = 0;

  for (const doc of documents) {
    const result = await mapDocumentToTopic(
      doc.documentId,
      doc.title || '',
      doc.textContent || '',
    );

    results.push(result);
    if (result.bestMatch) {
      mapped++;
    } else {
      unmapped++;
    }
  }

  return {
    totalDocuments: documents.length,
    mapped,
    unmapped,
    results,
  };
}

// ---------------------------------------------------------------------------
// Map a single text snippet to a category (for search results matching)
// ---------------------------------------------------------------------------

export function classifyTextToCategory(
  text: string,
): { category: PolicyCategory; confidence: number; matchedKeywords: string[] } | null {
  const lowerText = text.toLowerCase();
  let bestMatch: { category: PolicyCategory; confidence: number; matchedKeywords: string[] } | null = null;

  for (const def of CATEGORY_DEFINITIONS) {
    const matchedKeywords: string[] = [];
    for (const kw of def.keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
      }
    }

    if (matchedKeywords.length > 0) {
      const confidence = Math.min(matchedKeywords.length / 3, 1.0);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          category: def.category,
          confidence: Math.round(confidence * 100) / 100,
          matchedKeywords,
        };
      }
    }
  }

  return bestMatch;
}
