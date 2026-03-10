// ---------------------------------------------------------------------------
// Worker Startup Script
// Starts all BullMQ workers for the policy pipeline.
// Run with: npx tsx backend/src/policy/workers/startWorkers.ts
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { createSiteCrawlWorker } from './siteCrawlWorker.js';
import { createDocumentDownloadWorker } from './documentDownloadWorker.js';
import { createOcrWorker } from './ocrWorker.js';
import { createClassificationWorker } from './classificationWorker.js';
import {
  enqueueDocumentDownloads,
  enqueueOcr,
  enqueueClassification,
} from '../pipeline/pipelineOrchestrator.js';
import {
  upsertAgencyNode,
  upsertPolicyDocumentNode,
  extractAndStorePolicyRules,
} from '../pipeline/neo4jPolicyGraph.js';
import type { CrawlResult } from '../agencyRegistry/types.js';
import type { DownloadResult } from './documentDownloadWorker.js';
import type { OcrResult } from './ocrWorker.js';
import type { ClassificationResult } from './classificationWorker.js';

const prisma = new PrismaClient();

/**
 * Handle completed site crawl — update agency, enqueue document downloads.
 */
async function onSiteCrawlComplete(result: CrawlResult): Promise<void> {
  try {
    // Update agency record
    await prisma.agency.update({
      where: { agencyId: result.agencyId },
      data: {
        crawlStatus: result.error ? 'failed' : 'completed',
        crawlError: result.error,
        lastCrawledAt: new Date(),
        pagesFound: result.pagesFound,
        policyPagesFound: result.policyPagesFound,
        policiesDiscovered: result.documentUrls.length > 0,
      },
    });

    // Enqueue discovered documents for download
    if (result.documentUrls.length > 0) {
      await enqueueDocumentDownloads(
        result.agencyId,
        result.documentUrls.map((d) => ({
          url: d.url,
          title: d.title,
          estimatedType: d.estimatedType,
        }))
      );
    }

    // Update Neo4j graph
    const agency = await prisma.agency.findUnique({
      where: { agencyId: result.agencyId },
    });
    if (agency) {
      try {
        await upsertAgencyNode({
          agencyId: agency.agencyId,
          agencyName: agency.agencyName,
          agencyType: agency.agencyType,
          city: agency.city,
          county: agency.county,
          jurisdictionRank: agency.jurisdictionRank,
        });
      } catch {
        // Neo4j might not be available, that's okay
      }
    }
  } catch (error) {
    console.error(
      `[Workers] Site crawl completion handler error:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Handle completed document download — update record, enqueue OCR.
 */
async function onDocumentDownloadComplete(
  result: DownloadResult
): Promise<void> {
  try {
    await prisma.policyDocument.update({
      where: { documentId: result.documentId },
      data: {
        s3Url: result.s3Url,
        mimeType: result.mimeType,
        fileSizeBytes: result.fileSizeBytes,
        ocrStatus: result.error ? 'failed' : 'pending',
        ocrError: result.error,
      },
    });

    // Enqueue for OCR if download succeeded
    if (result.s3Url && result.mimeType) {
      await enqueueOcr(
        result.documentId,
        result.agencyId,
        result.s3Url,
        result.mimeType
      );
    }
  } catch (error) {
    console.error(
      `[Workers] Document download completion handler error:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Handle completed OCR — update record, enqueue classification.
 */
async function onOcrComplete(result: OcrResult): Promise<void> {
  try {
    await prisma.policyDocument.update({
      where: { documentId: result.documentId },
      data: {
        textExtracted: !!result.textContent,
        textContent: result.textContent,
        ocrStatus: result.error ? 'failed' : 'completed',
        ocrError: result.error,
      },
    });

    // Enqueue for classification if OCR succeeded
    if (result.textContent) {
      const doc = await prisma.policyDocument.findUnique({
        where: { documentId: result.documentId },
      });
      if (doc) {
        await enqueueClassification(
          result.documentId,
          doc.title,
          doc.sourceUrl,
          result.textContent
        );
      }
    }
  } catch (error) {
    console.error(
      `[Workers] OCR completion handler error:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Handle completed classification — update record, update Neo4j.
 */
async function onClassificationComplete(
  result: ClassificationResult
): Promise<void> {
  try {
    await prisma.policyDocument.update({
      where: { documentId: result.documentId },
      data: {
        documentType: result.documentType,
        classificationStatus: result.error ? 'failed' : 'completed',
        classificationScore: result.confidence,
      },
    });

    // Update Neo4j graph
    const doc = await prisma.policyDocument.findUnique({
      where: { documentId: result.documentId },
    });
    if (doc) {
      try {
        await upsertPolicyDocumentNode({
          documentId: doc.documentId,
          agencyId: doc.agencyId,
          title: doc.title,
          documentType: doc.documentType,
          sourceUrl: doc.sourceUrl,
          s3Url: doc.s3Url,
          classificationScore: doc.classificationScore,
        });

        // Extract rules from text if available
        if (doc.textContent && doc.documentType) {
          await extractAndStorePolicyRules(
            doc.documentId,
            doc.textContent,
            doc.documentType
          );
        }
      } catch {
        // Neo4j might not be available
      }
    }
  } catch (error) {
    console.error(
      `[Workers] Classification completion handler error:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Start all pipeline workers.
 */
export function startAllWorkers(): void {
  console.log('[Workers] Starting all policy pipeline workers...');

  const siteCrawlWorker = createSiteCrawlWorker(onSiteCrawlComplete);
  const downloadWorker = createDocumentDownloadWorker(
    onDocumentDownloadComplete
  );
  const ocrWorker = createOcrWorker(onOcrComplete);
  const classificationWorker = createClassificationWorker(
    onClassificationComplete
  );

  console.log('[Workers] All workers started:');
  console.log('  - Site Crawl Worker (concurrency: 2)');
  console.log('  - Document Download Worker (concurrency: 3)');
  console.log('  - OCR Worker (concurrency: 2)');
  console.log('  - Classification Worker (concurrency: 5)');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('[Workers] Shutting down workers...');
    await Promise.all([
      siteCrawlWorker.close(),
      downloadWorker.close(),
      ocrWorker.close(),
      classificationWorker.close(),
    ]);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run if executed directly
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].includes('startWorkers') ||
    process.argv[1].includes('start-workers'));

if (isMainModule) {
  startAllWorkers();
}
