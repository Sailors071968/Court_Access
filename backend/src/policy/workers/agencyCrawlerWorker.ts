// ---------------------------------------------------------------------------
// Phase 13 — Agency Policy Discovery / Crawler Worker
// Rate-limited website crawling to discover policy documents.
// Queue: agency-crawl-queue
// Rate limits: 2 concurrent agencies, 1 req/sec, max 200 pages/site
// ---------------------------------------------------------------------------

import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { crawlAgencySite, type SiteCrawlJobData } from './siteCrawlWorker.js';
import { DEFAULT_CRAWLER_CONFIG, type CrawlerConfig } from '../agencyRegistry/types.js';

const prisma = new PrismaClient();

export const AGENCY_CRAWL_QUEUE = 'agency-crawl-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgencyCrawlJobData {
  agencyId: string;
  agencyName: string;
  website: string;
  priority?: number;
  config?: Partial<CrawlerConfig>;
}

export interface AgencyCrawlResult {
  agencyId: string;
  agencyName: string;
  pagesFound: number;
  policyPagesFound: number;
  documentsDiscovered: number;
  crawlDurationMs: number;
  error: string | null;
}

// Keyword triggers for policy document identification
const POLICY_KEYWORD_TRIGGERS = [
  'use of force',
  'internal affairs',
  'body camera',
  'discipline',
  'training',
  'pursuit',
  'search',
  'general orders',
  'policy manual',
  'pdf',
  'doc',
  'docx',
];

// ---------------------------------------------------------------------------
// Crawl a single agency and persist results
// ---------------------------------------------------------------------------

export async function crawlAndPersistAgency(
  data: AgencyCrawlJobData,
): Promise<AgencyCrawlResult> {
  const start = Date.now();
  const result: AgencyCrawlResult = {
    agencyId: data.agencyId,
    agencyName: data.agencyName,
    pagesFound: 0,
    policyPagesFound: 0,
    documentsDiscovered: 0,
    crawlDurationMs: 0,
    error: null,
  };

  try {
    // Update agency status to in_progress
    await prisma.agency.update({
      where: { agencyId: data.agencyId },
      data: { crawlStatus: 'in_progress' },
    });

    // Build crawler config with safety limits
    const config: CrawlerConfig = {
      ...DEFAULT_CRAWLER_CONFIG,
      maxConcurrentSites: 2,
      requestsPerSecondPerSite: 1,
      maxPagesPerSite: 200,
      maxDocumentSizeBytes: 50 * 1024 * 1024, // 50MB
      ...data.config,
    };

    // Execute the crawl
    const crawlJobData: SiteCrawlJobData = {
      agencyId: data.agencyId,
      agencyName: data.agencyName,
      website: data.website,
      config,
    };

    const crawlResult = await crawlAgencySite(crawlJobData, config);

    result.pagesFound = crawlResult.pagesFound;
    result.policyPagesFound = crawlResult.policyPagesFound;
    result.documentsDiscovered = crawlResult.documentUrls.length;
    result.error = crawlResult.error;

    // Persist discovered document URLs as PolicyDocument records (pending download)
    for (const docUrl of crawlResult.documentUrls) {
      const documentId = `${data.agencyId}-${Buffer.from(docUrl.url).toString('base64url').substring(0, 32)}`;

      await prisma.policyDocument.upsert({
        where: { documentId },
        create: {
          documentId,
          agencyId: data.agencyId,
          title: docUrl.title,
          sourceUrl: docUrl.url,
          mimeType: docUrl.mimeType,
          documentType: docUrl.estimatedType,
          ocrStatus: 'pending',
          classificationStatus: 'pending',
        },
        update: {
          title: docUrl.title || undefined,
          mimeType: docUrl.mimeType || undefined,
          documentType: docUrl.estimatedType || undefined,
        },
      });
    }

    // Update agency with crawl results
    await prisma.agency.update({
      where: { agencyId: data.agencyId },
      data: {
        crawlStatus: crawlResult.error ? 'failed' : 'completed',
        crawlError: crawlResult.error,
        lastCrawledAt: new Date(),
        pagesFound: crawlResult.pagesFound,
        policyPagesFound: crawlResult.policyPagesFound,
        policiesDiscovered: crawlResult.documentUrls.length > 0,
      },
    });

    console.log(
      `[Agency Crawler] ${data.agencyName}: ${result.pagesFound} pages, ` +
      `${result.policyPagesFound} policy pages, ${result.documentsDiscovered} documents`,
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);

    await prisma.agency.update({
      where: { agencyId: data.agencyId },
      data: {
        crawlStatus: 'failed',
        crawlError: result.error,
        lastCrawledAt: new Date(),
      },
    }).catch(() => { /* best effort */ });

    console.error(`[Agency Crawler] ${data.agencyName} failed: ${result.error}`);
  }

  result.crawlDurationMs = Date.now() - start;
  return result;
}

// ---------------------------------------------------------------------------
// Enqueue agencies for crawling (batch)
// ---------------------------------------------------------------------------

export async function enqueueAgenciesForCrawling(
  queue: Queue<AgencyCrawlJobData>,
  options?: {
    county?: string;
    limit?: number;
    skipAlreadyCrawled?: boolean;
  },
): Promise<number> {
  const where: Record<string, unknown> = {};

  if (options?.county) {
    where.county = options.county;
  }
  if (options?.skipAlreadyCrawled) {
    where.crawlStatus = { in: ['pending', 'failed'] };
  }
  where.website = { not: null };

  const agencies = await prisma.agency.findMany({
    where,
    orderBy: { jurisdictionRank: 'asc' },
    take: options?.limit || 50,
  });

  let enqueued = 0;
  for (const agency of agencies) {
    if (!agency.website) continue;

    await queue.add(
      `crawl-${agency.agencyId}`,
      {
        agencyId: agency.agencyId,
        agencyName: agency.agencyName,
        website: agency.website,
        priority: agency.jurisdictionRank || 999,
      },
      {
        priority: agency.jurisdictionRank || 999,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    );
    enqueued++;
  }

  console.log(`[Agency Crawler] Enqueued ${enqueued} agencies for crawling`);
  return enqueued;
}

// ---------------------------------------------------------------------------
// Create the BullMQ queue
// ---------------------------------------------------------------------------

export function createAgencyCrawlQueue(
  redisUrl?: string,
): Queue<AgencyCrawlJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  return new Queue<AgencyCrawlJobData>(AGENCY_CRAWL_QUEUE, { connection });
}

// ---------------------------------------------------------------------------
// Create and start the agency crawler worker
// ---------------------------------------------------------------------------

export function createAgencyCrawlerWorker(
  onComplete?: (result: AgencyCrawlResult) => Promise<void>,
  redisUrl?: string,
): Worker<AgencyCrawlJobData> {
  const connection = redisUrl
    ? { url: redisUrl }
    : { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 };

  const worker = new Worker<AgencyCrawlJobData>(
    AGENCY_CRAWL_QUEUE,
    async (job: Job<AgencyCrawlJobData>) => {
      console.log(
        `[Agency Crawler Worker] Processing: ${job.data.agencyName} (${job.data.website})`,
      );

      const result = await crawlAndPersistAgency(job.data);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 2, // Max 2 concurrent agencies
      limiter: {
        max: 2,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[Agency Crawler Worker] Completed: ${job.data.agencyName}`);
  });

  worker.on('failed', (job, error) => {
    console.error(
      `[Agency Crawler Worker] Failed: ${job?.data.agencyName}`,
      error.message,
    );
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Check if URL text matches policy keyword triggers
// ---------------------------------------------------------------------------

export function matchesPolicyKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return POLICY_KEYWORD_TRIGGERS.some((kw) => lower.includes(kw));
}
