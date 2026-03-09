// ---------------------------------------------------------------------------
// Phase 10 — Queue Orchestration Pipeline
// Phase 11 — Crawler Safety (integrated via config)
// Manages the full pipeline: POST crawl → site crawl → download → OCR → classify
// ---------------------------------------------------------------------------

import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { crawlPostDirectory, inferAgencyType, inferCity, inferCounty } from '../agencyRegistry/postCrawler.js';
import { rankAgencies, inferCountyFromCity } from '../agencyRegistry/populationRanker.js';
import { SiteCrawlJobData, SITE_CRAWL_QUEUE } from '../workers/siteCrawlWorker.js';
import { DocumentDownloadJobData, DOCUMENT_DOWNLOAD_QUEUE } from '../workers/documentDownloadWorker.js';
import { OcrJobData, OCR_QUEUE } from '../workers/ocrWorker.js';
import { ClassificationJobData, CLASSIFICATION_QUEUE } from '../workers/classificationWorker.js';
import { DEFAULT_CRAWLER_CONFIG, PipelineStats } from '../agencyRegistry/types.js';

const prisma = new PrismaClient();

/**
 * Redis connection config for BullMQ queues.
 */
function getRedisConnection() {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
}

/**
 * Phase 1 — Run the POST directory crawler and populate the Agency table.
 */
export async function runPostDirectoryCrawl(): Promise<{
  agenciesCreated: number;
  agenciesUpdated: number;
  errors: string[];
}> {
  const result = { agenciesCreated: 0, agenciesUpdated: 0, errors: [] as string[] };

  console.log('[Pipeline] Phase 1: Starting POST directory crawl...');

  const entries = await crawlPostDirectory();
  console.log(`[Pipeline] Found ${entries.length} agencies from POST directory`);

  for (const entry of entries) {
    try {
      const agencyType = inferAgencyType(entry.agencyName);
      const city = inferCity(entry.agencyName);
      const county = inferCounty(entry.agencyName) ?? inferCountyFromCity(city);

      const existing = await prisma.agency.findFirst({
        where: { agencyName: entry.agencyName },
      });

      if (existing) {
        await prisma.agency.update({
          where: { agencyId: existing.agencyId },
          data: {
            website: entry.website ?? existing.website,
            postDirectoryUrl: entry.postDirectoryUrl,
            agencyType: agencyType ?? existing.agencyType,
            city: city ?? existing.city,
            county: county ?? existing.county,
          },
        });
        result.agenciesUpdated++;
      } else {
        await prisma.agency.create({
          data: {
            agencyName: entry.agencyName,
            agencyType,
            city,
            county,
            website: entry.website,
            postDirectoryUrl: entry.postDirectoryUrl,
          },
        });
        result.agenciesCreated++;
      }
    } catch (error) {
      const msg = `Failed to upsert ${entry.agencyName}: ${error instanceof Error ? error.message : error}`;
      result.errors.push(msg);
      console.error(`[Pipeline] ${msg}`);
    }
  }

  console.log(
    `[Pipeline] Phase 1 complete: ${result.agenciesCreated} created, ${result.agenciesUpdated} updated`
  );
  return result;
}

/**
 * Phase 2 — Run population ranking for all agencies.
 */
export async function runPopulationRanking(): Promise<{ ranked: number }> {
  console.log('[Pipeline] Phase 2: Running population ranking...');

  const agencies = await prisma.agency.findMany({
    select: {
      agencyId: true,
      agencyName: true,
      agencyType: true,
      city: true,
      county: true,
    },
  });

  const rankings = rankAgencies(agencies);
  let ranked = 0;

  for (const [agencyName, rank] of rankings) {
    const agency = agencies.find((a) => a.agencyName === agencyName);
    if (!agency) continue;

    await prisma.agency.update({
      where: { agencyId: agency.agencyId },
      data: {
        populationEstimate: rank.populationEstimate,
        jurisdictionRank: rank.jurisdictionRank,
        county: rank.county ?? agency.county,
      },
    });
    ranked++;
  }

  console.log(`[Pipeline] Phase 2 complete: ${ranked} agencies ranked`);
  return { ranked };
}

/**
 * Phase 4 — Enqueue agency websites for crawling (by jurisdiction rank).
 */
export async function enqueueSiteCrawls(limit?: number): Promise<{ enqueued: number }> {
  console.log('[Pipeline] Phase 4: Enqueueing site crawls...');

  const connection = getRedisConnection();
  const queue = new Queue<SiteCrawlJobData>(SITE_CRAWL_QUEUE, { connection });

  const agencies = await prisma.agency.findMany({
    where: {
      website: { not: null },
      crawlStatus: 'pending',
    },
    orderBy: { jurisdictionRank: 'asc' },
    take: limit,
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
        config: DEFAULT_CRAWLER_CONFIG,
      },
      {
        priority: agency.jurisdictionRank ?? 999,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    await prisma.agency.update({
      where: { agencyId: agency.agencyId },
      data: { crawlStatus: 'in_progress' },
    });

    enqueued++;
  }

  await queue.close();
  console.log(`[Pipeline] Phase 4 complete: ${enqueued} sites enqueued`);
  return { enqueued };
}

/**
 * Phase 7 — Enqueue discovered documents for download.
 */
export async function enqueueDocumentDownloads(
  agencyId: string,
  documentUrls: Array<{ url: string; title: string | null; estimatedType: string | null }>
): Promise<{ enqueued: number }> {
  const connection = getRedisConnection();
  const queue = new Queue<DocumentDownloadJobData>(DOCUMENT_DOWNLOAD_QUEUE, {
    connection,
  });

  let enqueued = 0;
  for (const doc of documentUrls) {
    // Create PolicyDocument record first
    const policyDoc = await prisma.policyDocument.create({
      data: {
        agencyId,
        sourceUrl: doc.url,
        title: doc.title,
        documentType: doc.estimatedType,
      },
    });

    await queue.add(
      `download-${policyDoc.documentId}`,
      {
        documentId: policyDoc.documentId,
        agencyId,
        sourceUrl: doc.url,
        title: doc.title,
        estimatedType: doc.estimatedType,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
      }
    );

    enqueued++;
  }

  await queue.close();
  return { enqueued };
}

/**
 * Phase 8 — Enqueue a document for OCR processing.
 */
export async function enqueueOcr(
  documentId: string,
  agencyId: string,
  s3Url: string,
  mimeType: string
): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue<OcrJobData>(OCR_QUEUE, { connection });

  await queue.add(
    `ocr-${documentId}`,
    { documentId, agencyId, s3Url, mimeType },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  await queue.close();
}

/**
 * Phase 9 — Enqueue a document for classification.
 */
export async function enqueueClassification(
  documentId: string,
  title: string | null,
  sourceUrl: string,
  textContent: string | null
): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue<ClassificationJobData>(CLASSIFICATION_QUEUE, {
    connection,
  });

  await queue.add(
    `classify-${documentId}`,
    { documentId, title, sourceUrl, textContent },
    { attempts: 2 }
  );

  await queue.close();
}

/**
 * Phase 12 — Get pipeline statistics for the dashboard.
 */
export async function getPipelineStats(): Promise<PipelineStats> {
  const [
    totalAgencies,
    websitesFound,
    sitesCrawled,
    crawlInProgress,
    crawlFailed,
    documentsFound,
    documentsDownloaded,
    documentsOcr,
    documentsClassified,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.agency.count({ where: { website: { not: null } } }),
    prisma.agency.count({ where: { crawlStatus: 'completed' } }),
    prisma.agency.count({ where: { crawlStatus: 'in_progress' } }),
    prisma.agency.count({ where: { crawlStatus: 'failed' } }),
    prisma.policyDocument.count(),
    prisma.policyDocument.count({ where: { s3Url: { not: null } } }),
    prisma.policyDocument.count({ where: { ocrStatus: 'completed' } }),
    prisma.policyDocument.count({ where: { classificationStatus: 'completed' } }),
  ]);

  return {
    totalAgencies,
    websitesFound,
    sitesCrawled,
    documentsFound,
    documentsDownloaded,
    documentsOcr,
    documentsClassified,
    crawlInProgress,
    crawlFailed,
  };
}

/**
 * Get agencies with their policy documents (for intelligence linking).
 */
export async function getAgencyWithPolicies(agencyId: string) {
  return prisma.agency.findUnique({
    where: { agencyId },
    include: {
      PolicyDocuments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/**
 * Search agencies by name or county.
 */
export async function searchAgencies(
  query: string,
  limit: number = 20,
  offset: number = 0
) {
  return prisma.agency.findMany({
    where: {
      OR: [
        { agencyName: { contains: query, mode: 'insensitive' } },
        { county: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      PolicyDocuments: {
        select: {
          documentId: true,
          documentType: true,
          title: true,
          classificationStatus: true,
        },
      },
    },
    orderBy: { jurisdictionRank: 'asc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get all agencies ordered by jurisdiction rank with policy counts.
 */
export async function getAgenciesPaginated(
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    agencyType?: string;
    county?: string;
    crawlStatus?: string;
    search?: string;
  }
) {
  const where: Record<string, unknown> = {};

  if (filters?.agencyType) where.agencyType = filters.agencyType;
  if (filters?.county) where.county = { contains: filters.county, mode: 'insensitive' };
  if (filters?.crawlStatus) where.crawlStatus = filters.crawlStatus;
  if (filters?.search) {
    where.OR = [
      { agencyName: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
      { county: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [agencies, total] = await Promise.all([
    prisma.agency.findMany({
      where,
      include: {
        _count: {
          select: { PolicyDocuments: true },
        },
      },
      orderBy: { jurisdictionRank: 'asc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.agency.count({ where }),
  ]);

  return {
    agencies,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
