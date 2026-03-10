// ============================================================================
// Phase 70 — Policy Topic Confidence Scoring
// Enhances classifier output with topicConfidenceScore field.
// Documents below 0.65 confidence are flagged for manual review.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfidenceResult {
  topicId: string;
  topicName: string;
  confidenceScore: number; // 0.0 - 1.0
  matchedKeywords: string[];
  totalKeywords: number;
  needsManualReview: boolean;
  scoringMethod: 'keyword-density' | 'exact-match' | 'weighted';
}

export interface ClassificationWithConfidence {
  documentId: string;
  topConfidence: ConfidenceResult | null;
  allMatches: ConfidenceResult[];
  flaggedForReview: boolean;
  classifiedAt: string;
}

export interface ConfidenceThresholds {
  autoAccept: number;    // >= this → auto-accept classification
  manualReview: number;  // < this → flag for manual review
  reject: number;        // < this → reject classification entirely
}

// ---------------------------------------------------------------------------
// Default Thresholds
// ---------------------------------------------------------------------------

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  autoAccept: 0.80,
  manualReview: 0.65,
  reject: 0.20,
};

// ---------------------------------------------------------------------------
// Scoring Engine
// ---------------------------------------------------------------------------

/**
 * Compute confidence score for a document against a topic.
 * Uses keyword density analysis with position weighting.
 */
export function computeTopicConfidence(
  documentText: string,
  topicKeywords: string[],
  topicName: string,
  topicId: string,
): ConfidenceResult {
  if (!documentText || documentText.trim().length === 0 || topicKeywords.length === 0) {
    return {
      topicId,
      topicName,
      confidenceScore: 0,
      matchedKeywords: [],
      totalKeywords: topicKeywords.length,
      needsManualReview: true,
      scoringMethod: 'keyword-density',
    };
  }

  const normalizedText = documentText.toLowerCase();
  const textWords = normalizedText.split(/\s+/);
  const textLength = textWords.length;
  const matchedKeywords: string[] = [];
  let weightedScore = 0;

  for (const keyword of topicKeywords) {
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (normalizedKeyword.length === 0) continue;

    // Check for exact phrase match
    if (normalizedText.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);

      // Weighted scoring based on keyword position and frequency
      const occurrences = countOccurrences(normalizedText, normalizedKeyword);
      const frequencyWeight = Math.min(occurrences / 3, 1.0); // Cap at 3 occurrences

      // Title/header bonus: keywords in first 500 chars get +0.1
      const inTitle = normalizedText.slice(0, 500).includes(normalizedKeyword);
      const positionBonus = inTitle ? 0.1 : 0;

      // Multi-word keywords are more specific → higher weight
      const wordCount = normalizedKeyword.split(/\s+/).length;
      const specificityWeight = Math.min(wordCount / 3, 1.0);

      weightedScore += (0.5 + frequencyWeight * 0.3 + positionBonus + specificityWeight * 0.1);
    }
  }

  // Normalize score to 0-1 range
  const maxPossibleScore = topicKeywords.length * 1.0;
  let confidenceScore = maxPossibleScore > 0
    ? Math.min(weightedScore / maxPossibleScore, 1.0)
    : 0;

  // Boost if many keywords match (breadth bonus)
  const matchRatio = matchedKeywords.length / topicKeywords.length;
  if (matchRatio >= 0.5) {
    confidenceScore = Math.min(confidenceScore + 0.1, 1.0);
  }

  // Round to 4 decimal places
  confidenceScore = Math.round(confidenceScore * 10000) / 10000;

  return {
    topicId,
    topicName,
    confidenceScore,
    matchedKeywords,
    totalKeywords: topicKeywords.length,
    needsManualReview: confidenceScore < DEFAULT_THRESHOLDS.manualReview,
    scoringMethod: 'weighted',
  };
}

/**
 * Count occurrences of a substring in text.
 */
function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

/**
 * Classify a document against all topics and return ranked results.
 */
export function classifyWithConfidence(
  documentId: string,
  documentText: string,
  topics: Array<{ id: string; name: string; keywords: string[] }>,
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS,
): ClassificationWithConfidence {
  const allMatches: ConfidenceResult[] = [];

  for (const topic of topics) {
    const result = computeTopicConfidence(
      documentText,
      topic.keywords,
      topic.name,
      topic.id,
    );

    // Only include results above rejection threshold
    if (result.confidenceScore >= thresholds.reject) {
      allMatches.push(result);
    }
  }

  // Sort by confidence descending
  allMatches.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const topConfidence = allMatches.length > 0 ? allMatches[0] : null;
  const flaggedForReview = !topConfidence || topConfidence.confidenceScore < thresholds.manualReview;

  return {
    documentId,
    topConfidence,
    allMatches: allMatches.slice(0, 5), // Top 5 matches
    flaggedForReview,
    classifiedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------

const reviewQueue: Array<{
  documentId: string;
  topicId: string | null;
  confidenceScore: number;
  addedAt: string;
}> = [];

/**
 * Add a document to the manual review queue.
 */
export function addToReviewQueue(
  documentId: string,
  topicId: string | null,
  confidenceScore: number,
): void {
  reviewQueue.push({
    documentId,
    topicId,
    confidenceScore,
    addedAt: new Date().toISOString(),
  });
}

/**
 * Get all documents in the review queue.
 */
export function getReviewQueue(): typeof reviewQueue {
  return [...reviewQueue];
}

/**
 * Get review queue size.
 */
export function getReviewQueueSize(): number {
  return reviewQueue.length;
}

/**
 * Remove a document from the review queue (after manual review).
 */
export function removeFromReviewQueue(documentId: string): boolean {
  const index = reviewQueue.findIndex((r) => r.documentId === documentId);
  if (index >= 0) {
    reviewQueue.splice(index, 1);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

export function getConfidenceServiceStatus(): {
  thresholds: ConfidenceThresholds;
  reviewQueueSize: number;
  recentReviewItems: typeof reviewQueue;
} {
  return {
    thresholds: DEFAULT_THRESHOLDS,
    reviewQueueSize: reviewQueue.length,
    recentReviewItems: reviewQueue.slice(-10),
  };
}
