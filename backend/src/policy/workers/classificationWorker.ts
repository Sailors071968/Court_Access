// ---------------------------------------------------------------------------
// Phase 9 — Policy Classification Worker (BullMQ)
// Classifies policy documents by type using keyword-based NLP.
// ---------------------------------------------------------------------------

import { Worker, Queue, Job } from 'bullmq';
import {
  DocumentType,
  DOCUMENT_TYPES,
  CLASSIFICATION_KEYWORDS,
} from '../agencyRegistry/types.js';

export const CLASSIFICATION_QUEUE = 'policy-classification-queue';

export interface ClassificationJobData {
  documentId: string;
  title: string | null;
  sourceUrl: string;
  textContent: string | null;
}

export interface ClassificationResult {
  documentId: string;
  documentType: DocumentType | null;
  confidence: number;
  allScores: Record<string, number>;
  error: string | null;
}

/**
 * Score text against a set of keywords for a document type.
 * Returns a score between 0 and 1.
 */
function scoreDocumentType(
  text: string,
  keywords: string[]
): number {
  const lower = text.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // Normalize: score = matches / total keywords, capped at 1.0
  return Math.min(matchCount / Math.max(keywords.length * 0.3, 1), 1.0);
}

/**
 * Classify a document based on its title, URL, and extracted text.
 */
export function classifyDocument(
  data: ClassificationJobData
): ClassificationResult {
  const result: ClassificationResult = {
    documentId: data.documentId,
    documentType: null,
    confidence: 0,
    allScores: {},
    error: null,
  };

  try {
    // Combine all available text for classification
    const combinedText = [
      data.title ?? '',
      data.sourceUrl ?? '',
      // Use first 10,000 chars of text content to avoid processing huge documents
      (data.textContent ?? '').slice(0, 10000),
    ].join(' ');

    if (combinedText.trim().length < 5) {
      result.error = 'Insufficient text for classification';
      return result;
    }

    // Score against each document type
    let bestType: DocumentType | null = null;
    let bestScore = 0;

    for (const docType of DOCUMENT_TYPES) {
      const keywords = CLASSIFICATION_KEYWORDS[docType];
      const score = scoreDocumentType(combinedText, keywords);
      result.allScores[docType] = Math.round(score * 100) / 100;

      if (score > bestScore) {
        bestScore = score;
        bestType = docType;
      }
    }

    // Apply title/URL boost — if the title or URL strongly indicates a type,
    // give it a significant boost
    const titleUrlText = `${data.title ?? ''} ${data.sourceUrl ?? ''}`;
    for (const docType of DOCUMENT_TYPES) {
      const keywords = CLASSIFICATION_KEYWORDS[docType];
      const titleScore = scoreDocumentType(titleUrlText, keywords);
      if (titleScore > 0.3) {
        // Title/URL match is a strong signal
        const boostedScore =
          (result.allScores[docType] ?? 0) + titleScore * 0.5;
        result.allScores[docType] = Math.min(
          Math.round(boostedScore * 100) / 100,
          1.0
        );
        if (boostedScore > bestScore) {
          bestScore = boostedScore;
          bestType = docType;
        }
      }
    }

    // Only assign a type if confidence exceeds threshold
    const CONFIDENCE_THRESHOLD = 0.1;
    if (bestScore >= CONFIDENCE_THRESHOLD && bestType) {
      result.documentType = bestType;
      result.confidence = Math.min(Math.round(bestScore * 100) / 100, 1.0);
    } else {
      result.documentType = 'GENERAL_POLICY';
      result.confidence = 0.05;
    }

    console.log(
      `[Classification] ${data.documentId}: ${result.documentType} (${result.confidence})`
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(
      `[Classification] Failed for ${data.documentId}: ${result.error}`
    );
  }

  return result;
}

/**
 * Create the BullMQ queue for classification.
 */
export function createClassificationQueue(
  redisUrl?: string
): Queue<ClassificationJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<ClassificationJobData>(CLASSIFICATION_QUEUE, { connection });
}

/**
 * Create and start the classification worker.
 */
export function createClassificationWorker(
  onComplete?: (result: ClassificationResult) => Promise<void>,
  redisUrl?: string
): Worker<ClassificationJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<ClassificationJobData>(
    CLASSIFICATION_QUEUE,
    async (job: Job<ClassificationJobData>) => {
      console.log(
        `[Classification Worker] Processing: ${job.data.documentId}`
      );

      const result = classifyDocument(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(
      `[Classification Worker] Completed: ${job.data.documentId}`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Classification Worker] Failed: ${job?.data.documentId}`,
      error.message
    );
  });

  return worker;
}
