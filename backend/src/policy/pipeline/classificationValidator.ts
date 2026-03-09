// ============================================================================
// Phase 75 — Policy Classification Validation
// Audit classification accuracy across all ingested documents.
// Output: top 50 classified policies with topic assignment and confidence score.
// Goal: Ensure classification accuracy above 85%.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifiedPolicyEntry {
  documentId: string;
  title: string;
  agencyName: string;
  topicName: string;
  category: string;
  confidence: number;
  isCorrect: boolean; // heuristic correctness check
  matchReason: string;
}

export interface ClassificationValidationReport {
  totalDocumentsAudited: number;
  documentsWithTopic: number;
  documentsWithoutTopic: number;
  averageConfidence: number;
  medianConfidence: number;
  accuracyEstimate: number; // percentage
  aboveThreshold: boolean; // >= 85%
  confidenceDistribution: {
    high: number;    // >= 0.85
    medium: number;  // 0.65 - 0.84
    low: number;     // 0.40 - 0.64
    veryLow: number; // < 0.40
  };
  topClassifiedPolicies: ClassifiedPolicyEntry[];
  categoryBreakdown: CategoryAccuracy[];
  flaggedForReview: ClassifiedPolicyEntry[];
  generatedAt: string;
}

export interface CategoryAccuracy {
  category: string;
  totalDocuments: number;
  averageConfidence: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  estimatedAccuracy: number;
}

// ---------------------------------------------------------------------------
// Heuristic correctness check
// ---------------------------------------------------------------------------

function checkClassificationCorrectness(
  title: string,
  documentType: string | null,
  topicCategory: string,
  topicName: string,
): { isCorrect: boolean; reason: string } {
  const titleLower = (title || '').toLowerCase();
  const categoryLower = (topicCategory || '').toLowerCase().replace(/_/g, ' ');
  const topicLower = (topicName || '').toLowerCase();

  // Check if title contains keywords from the assigned topic
  const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);
  const titleMatchCount = topicWords.filter((w) => titleLower.includes(w)).length;

  if (titleMatchCount >= 2) {
    return { isCorrect: true, reason: `Title matches ${titleMatchCount} topic keywords` };
  }

  // Check if document type matches category
  if (documentType && documentType.toLowerCase() === categoryLower) {
    return { isCorrect: true, reason: 'Document type matches topic category' };
  }

  // Check category keywords in title
  const categoryWords = categoryLower.split(/\s+/).filter((w) => w.length > 3);
  const categoryMatchCount = categoryWords.filter((w) => titleLower.includes(w)).length;

  if (categoryMatchCount >= 1) {
    return { isCorrect: true, reason: `Title matches ${categoryMatchCount} category keywords` };
  }

  // CHP canonical documents are always correct
  if (titleLower.startsWith('chp:') || titleLower.startsWith('chp ')) {
    return { isCorrect: true, reason: 'CHP canonical reference document' };
  }

  // If confidence is very high (>0.9), trust the classification
  return { isCorrect: false, reason: 'No keyword overlap between title and assigned topic' };
}

// ---------------------------------------------------------------------------
// Main: Run classification validation audit
// ---------------------------------------------------------------------------

export async function runClassificationValidation(
  topN: number = 50,
): Promise<ClassificationValidationReport> {
  console.log('[Phase 75] Running classification validation audit...');

  // Fetch all classified documents with their topics
  const documents = await prisma.policyDocument.findMany({
    where: {
      classificationStatus: 'completed',
      topicId: { not: null },
    },
    include: {
      Topic: true,
      Agency: { select: { agencyName: true } },
    },
    orderBy: { matchedTopicConfidence: 'desc' },
  });

  const allDocuments = await prisma.policyDocument.count({
    where: { classificationStatus: 'completed' },
  });

  const documentsWithTopic = documents.length;
  const documentsWithoutTopic = allDocuments - documentsWithTopic;

  // Build classified entries
  const entries: ClassifiedPolicyEntry[] = [];
  const confidences: number[] = [];
  let correctCount = 0;

  for (const doc of documents) {
    const confidence = doc.matchedTopicConfidence ?? 0;
    confidences.push(confidence);

    const { isCorrect, reason } = checkClassificationCorrectness(
      doc.title ?? '',
      doc.documentType,
      doc.Topic?.category ?? '',
      doc.Topic?.topicName ?? '',
    );

    if (isCorrect) correctCount++;

    entries.push({
      documentId: doc.documentId,
      title: doc.title ?? 'Untitled',
      agencyName: doc.Agency?.agencyName ?? 'Unknown',
      topicName: doc.Topic?.topicName ?? 'Unknown',
      category: doc.Topic?.category ?? 'Unknown',
      confidence,
      isCorrect,
      matchReason: reason,
    });
  }

  // Calculate statistics
  const averageConfidence = confidences.length > 0
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
    : 0;

  const sortedConfidences = [...confidences].sort((a, b) => a - b);
  const medianConfidence = sortedConfidences.length > 0
    ? sortedConfidences[Math.floor(sortedConfidences.length / 2)]
    : 0;

  const accuracyEstimate = entries.length > 0
    ? Math.round((correctCount / entries.length) * 10000) / 100
    : 0;

  // Confidence distribution
  const confidenceDistribution = {
    high: confidences.filter((c) => c >= 0.85).length,
    medium: confidences.filter((c) => c >= 0.65 && c < 0.85).length,
    low: confidences.filter((c) => c >= 0.40 && c < 0.65).length,
    veryLow: confidences.filter((c) => c < 0.40).length,
  };

  // Category breakdown
  const categoryMap = new Map<string, { confidences: number[]; correct: number }>();
  for (const entry of entries) {
    if (!categoryMap.has(entry.category)) {
      categoryMap.set(entry.category, { confidences: [], correct: 0 });
    }
    const cat = categoryMap.get(entry.category)!;
    cat.confidences.push(entry.confidence);
    if (entry.isCorrect) cat.correct++;
  }

  const categoryBreakdown: CategoryAccuracy[] = [];
  for (const [category, data] of categoryMap) {
    const avgConf = data.confidences.length > 0
      ? Math.round((data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length) * 100) / 100
      : 0;

    categoryBreakdown.push({
      category,
      totalDocuments: data.confidences.length,
      averageConfidence: avgConf,
      highConfidenceCount: data.confidences.filter((c) => c >= 0.85).length,
      lowConfidenceCount: data.confidences.filter((c) => c < 0.65).length,
      estimatedAccuracy: data.confidences.length > 0
        ? Math.round((data.correct / data.confidences.length) * 10000) / 100
        : 0,
    });
  }
  categoryBreakdown.sort((a, b) => b.totalDocuments - a.totalDocuments);

  // Top N classified policies
  const topClassifiedPolicies = entries.slice(0, topN);

  // Flagged for review (low confidence or incorrect classification)
  const flaggedForReview = entries
    .filter((e) => !e.isCorrect || e.confidence < 0.65)
    .slice(0, 50);

  const report: ClassificationValidationReport = {
    totalDocumentsAudited: allDocuments,
    documentsWithTopic,
    documentsWithoutTopic,
    averageConfidence,
    medianConfidence,
    accuracyEstimate,
    aboveThreshold: accuracyEstimate >= 85,
    confidenceDistribution,
    topClassifiedPolicies,
    categoryBreakdown,
    flaggedForReview,
    generatedAt: new Date().toISOString(),
  };

  console.log(
    `[Phase 75] Validation complete: ${allDocuments} audited, ` +
    `${documentsWithTopic} with topics, accuracy ${accuracyEstimate}% ` +
    `(${accuracyEstimate >= 85 ? 'PASS' : 'NEEDS REVIEW'})`,
  );

  return report;
}

// ---------------------------------------------------------------------------
// Get quick accuracy check (for dashboard)
// ---------------------------------------------------------------------------

export async function getClassificationAccuracySummary(): Promise<{
  totalClassified: number;
  averageConfidence: number;
  highConfidencePercent: number;
  estimatedAccuracy: number;
  aboveThreshold: boolean;
}> {
  const documents = await prisma.policyDocument.findMany({
    where: {
      classificationStatus: 'completed',
      matchedTopicConfidence: { not: null },
    },
    select: { matchedTopicConfidence: true },
  });

  const confidences = documents.map((d) => d.matchedTopicConfidence ?? 0);
  const total = confidences.length;

  if (total === 0) {
    return {
      totalClassified: 0,
      averageConfidence: 0,
      highConfidencePercent: 0,
      estimatedAccuracy: 0,
      aboveThreshold: false,
    };
  }

  const avg = Math.round((confidences.reduce((a, b) => a + b, 0) / total) * 100) / 100;
  const highCount = confidences.filter((c) => c >= 0.85).length;
  const highPercent = Math.round((highCount / total) * 10000) / 100;

  // Estimated accuracy: weighted combination of high-confidence ratio and average confidence
  const estimatedAccuracy = Math.round((highPercent * 0.6 + avg * 100 * 0.4) * 100) / 100;

  return {
    totalClassified: total,
    averageConfidence: avg,
    highConfidencePercent: highPercent,
    estimatedAccuracy,
    aboveThreshold: estimatedAccuracy >= 85,
  };
}
