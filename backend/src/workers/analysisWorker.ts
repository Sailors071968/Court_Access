// ============================================
// Court Access — Analysis Worker (BullMQ)
// Pipeline: upload → OCR extraction → intelligence engine → snapshot creation → result storage
// ============================================

import { Worker, type ConnectionOptions } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { getS3FileBuffer } from '../config/s3.js';
import { extractText } from '../engines/extractionEngine.js';
import { runAIAnalysis, validateConstitutionalCompliance } from '../engines/intelligenceEngine.js';
import { createSnapshot } from '../services/snapshotService.js';
import { updateDocumentAnalysisStatus } from '../services/documentService.js';
import type { AnalysisJobData } from '../services/analysisQueueService.js';

const QUEUE_NAME = 'analysis-pipeline';

function getFileType(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return 'unknown';
  const ext = fileName.substring(lastDot + 1);
  let result = '';
  for (let i = 0; i < ext.length; i++) {
    const code = ext.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      result = result + String.fromCharCode(code + 32);
    } else {
      result = result + ext.charAt(i);
    }
  }
  return result;
}

async function processDocument(data: AnalysisJobData): Promise<void> {
  const { documentId, storagePath, fileName } = data;

  logger.info('Processing document', { documentId, fileName });

  // Stage 1: Fetch file from S3
  const buffer = await getS3FileBuffer(storagePath);

  // Stage 2: OCR extraction
  const fileType = getFileType(fileName);
  const extractedText = await extractText(buffer, fileType);

  if (!extractedText || extractedText.length === 0) {
    await updateDocumentAnalysisStatus(documentId, 'extraction_failed', '');
    logger.warn('Text extraction returned empty', { documentId });
    return;
  }

  // Store extracted text
  await updateDocumentAnalysisStatus(documentId, 'analyzing', extractedText);

  // Stage 3: Intelligence engine
  const aiResult = await runAIAnalysis({ documentText: extractedText });

  // Stage 4: Constitutional enforcement
  const compliance = validateConstitutionalCompliance(aiResult.structuredAnalysis);
  if (compliance.status === 'FAIL') {
    logger.warn('Constitutional violation in AI output', {
      documentId,
      violatingTerm: compliance.violatingTerm,
    });
  }

  // Stage 5: Snapshot creation
  await createSnapshot({
    documentId,
    modelVersion: aiResult.modelVersion,
    analysisData: {
      ...aiResult.structuredAnalysis,
      constitutionStatus: compliance.status,
      tokenUsage: aiResult.tokenUsage,
    },
  });

  // Stage 6: Update document status
  await updateDocumentAnalysisStatus(documentId, 'analyzed');

  logger.info('Document analysis complete', {
    documentId,
    modelVersion: aiResult.modelVersion,
    constitutionStatus: compliance.status,
  });
}

export function startAnalysisWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data as AnalysisJobData;
      try {
        await processDocument(data);
      } catch (error) {
        logger.error('Analysis job failed', {
          jobId: job.id,
          documentId: data.documentId,
          error: (error as Error).message,
        });
        await updateDocumentAnalysisStatus(data.documentId, 'failed');
        throw error;
      }
    },
    {
      connection: getRedisConnection() as unknown as ConnectionOptions,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    logger.info('Analysis job completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Analysis job failed permanently', {
      jobId: job?.id,
      error: err.message,
    });
  });

  logger.info('Analysis worker started');
  return worker;
}

// Allow running as standalone worker process
if (process.argv[1]?.endsWith('analysisWorker.ts') || process.argv[1]?.endsWith('analysisWorker.js')) {
  startAnalysisWorker();
}
