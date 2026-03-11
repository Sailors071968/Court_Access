// ---------------------------------------------------------------------------
// Phase 15 — Automatic Topic Classification Pipeline
// Integrates keyword matching after OCR text extraction.
// Pipeline: document text → keyword matching → topic assignment → PolicyTopicMapping
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { CLASSIFICATION_KEYWORDS, type DocumentType } from '../agencyRegistry/types.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  documentId: string;
  topicId: string | null;
  topicName: string | null;
  category: string | null;
  confidence: number;
  matchedKeywords: string[];
  documentType: string | null;
}

export interface BatchClassificationResult {
  totalProcessed: number;
  classified: number;
  unclassified: number;
  results: ClassificationResult[];
}

// ---------------------------------------------------------------------------
// Classify document text against all topics
// ---------------------------------------------------------------------------

export async function classifyDocumentText(
  documentId: string,
  textContent: string,
  title: string,
): Promise<ClassificationResult> {
  const combinedText = `${title} ${textContent}`.toLowerCase();

  if (!combinedText.trim()) {
    return {
      documentId,
      topicId: null,
      topicName: null,
      category: null,
      confidence: 0,
      matchedKeywords: [],
      documentType: null,
    };
  }

  // Step 1: Determine broad document type from classification keywords
  let bestDocType: DocumentType | null = null;
  let bestDocTypeScore = 0;

  for (const [docType, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
    const matched = keywords.filter((kw) => combinedText.includes(kw));
    if (matched.length > bestDocTypeScore) {
      bestDocTypeScore = matched.length;
      bestDocType = docType as DocumentType;
    }
  }

  // Step 2: Match against specific policy topics
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
      if (combinedText.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }

    if (matched.length > 0) {
      // Confidence = ratio of matched keywords (with diminishing returns)
      const rawConfidence = matched.length / Math.max(keywords.length * 0.2, 2);
      const confidence = Math.min(rawConfidence, 1.0);

      if (confidence > bestConfidence) {
        bestTopicId = topic.id;
        bestTopicName = topic.topicName;
        bestCategory = topic.category;
        bestConfidence = Math.round(confidence * 100) / 100;
        bestMatchedKeywords = matched;
      }
    }
  }

  // Step 3: Update the document record
  if (bestTopicId) {
    await prisma.policyDocument.update({
      where: { documentId },
      data: {
        topicId: bestTopicId,
        documentType: bestCategory || bestDocType,
        matchedTopicConfidence: bestConfidence,
        classificationStatus: 'completed',
      },
    });
  } else if (bestDocType) {
    // Partial classification: we know the broad type but not the specific topic
    await prisma.policyDocument.update({
      where: { documentId },
      data: {
        documentType: bestDocType,
        classificationStatus: 'completed',
      },
    });
  }

  return {
    documentId,
    topicId: bestTopicId,
    topicName: bestTopicName,
    category: bestCategory,
    confidence: bestConfidence,
    matchedKeywords: bestMatchedKeywords,
    documentType: bestCategory || bestDocType,
  };
}

// ---------------------------------------------------------------------------
// Classify a single document by ID (fetches text from DB)
// ---------------------------------------------------------------------------

export async function classifyDocument(
  documentId: string,
): Promise<ClassificationResult> {
  const doc = await prisma.policyDocument.findUnique({
    where: { documentId },
  });

  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  return classifyDocumentText(
    documentId,
    doc.textContent || '',
    doc.title || '',
  );
}

// ---------------------------------------------------------------------------
// Batch classify all pending documents for an agency
// ---------------------------------------------------------------------------

export async function classifyAgencyDocuments(
  agencyId: string,
): Promise<BatchClassificationResult> {
  const documents = await prisma.policyDocument.findMany({
    where: {
      agencyId,
      classificationStatus: { not: 'completed' },
      textContent: { not: null },
      isChpCanonical: false,
    },
  });

  const results: ClassificationResult[] = [];
  let classified = 0;
  let unclassified = 0;

  for (const doc of documents) {
    const result = await classifyDocumentText(
      doc.documentId,
      doc.textContent || '',
      doc.title || '',
    );
    results.push(result);

    if (result.topicId) {
      classified++;
    } else {
      unclassified++;
    }
  }

  return {
    totalProcessed: documents.length,
    classified,
    unclassified,
    results,
  };
}

// ---------------------------------------------------------------------------
// Batch classify all pending documents across all agencies
// ---------------------------------------------------------------------------

export async function classifyAllPendingDocuments(): Promise<BatchClassificationResult> {
  const documents = await prisma.policyDocument.findMany({
    where: {
      classificationStatus: { not: 'completed' },
      textContent: { not: null },
      isChpCanonical: false,
    },
  });

  const results: ClassificationResult[] = [];
  let classified = 0;
  let unclassified = 0;

  for (const doc of documents) {
    const result = await classifyDocumentText(
      doc.documentId,
      doc.textContent || '',
      doc.title || '',
    );
    results.push(result);

    if (result.topicId) {
      classified++;
    } else {
      unclassified++;
    }
  }

  console.log(
    `[Classification] Processed ${documents.length} documents: ` +
    `${classified} classified, ${unclassified} unclassified`,
  );

  return {
    totalProcessed: documents.length,
    classified,
    unclassified,
    results,
  };
}

// ---------------------------------------------------------------------------
// Post-OCR classification hook (call after OCR completes)
// ---------------------------------------------------------------------------

export async function classifyAfterOcr(
  documentId: string,
  extractedText: string,
): Promise<ClassificationResult> {
  // Update document with extracted text
  await prisma.policyDocument.update({
    where: { documentId },
    data: {
      textContent: extractedText,
      textExtracted: extractedText.length > 0,
      ocrStatus: extractedText.length > 0 ? 'completed' : 'failed',
    },
  });

  const doc = await prisma.policyDocument.findUnique({
    where: { documentId },
  });

  if (!doc) {
    throw new Error(`Document not found after OCR: ${documentId}`);
  }

  // Run classification
  const result = await classifyDocumentText(
    documentId,
    extractedText,
    doc.title || '',
  );

  console.log(
    `[Classification] Post-OCR: ${documentId} → ` +
    `${result.topicName || 'unclassified'} (confidence: ${result.confidence})`,
  );

  return result;
}
