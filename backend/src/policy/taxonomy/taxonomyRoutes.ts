/**
 * Policy Intelligence API Route Handlers
 *
 * Plain function handlers (no framework dependency) for:
 * - Taxonomy management (seed, list topics, list categories)
 * - Policy discovery and matching
 * - Comparative policy analysis
 * - Coverage tracking and heatmap
 * - Dashboard statistics
 *
 * Follows the same handler pattern as workers/adminRoutes.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  CATEGORY_DEFINITIONS,
  POLICY_CATEGORIES,
  getTaxonomySummary,
} from './chpPolicyTaxonomy.js';
import { runChpTopicExtraction } from './extractChpPolicyTopics.js';
import { mapDocumentToTopic } from './policyTopicMapper.js';
import { matchAgencyDocuments, matchAllPendingDocuments } from './policyMatchingEngine.js';
import {
  compareMultipleAgencies,
  compareAgainstChp,
  getAgencyGapAnalysis,
  getCategoryCoverage,
  getCoverageMatrix,
} from './comparativePolicyEngine.js';
import {
  getAgencyCoverageReport,
  getSystemCoverageStats,
  getCoverageHeatmap,
} from './policyCoverageTracker.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteResponse<T = unknown> {
  status: number;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// TAXONOMY MANAGEMENT HANDLERS
// ---------------------------------------------------------------------------

/** GET /api/policy-intelligence/taxonomy/summary */
export async function handleTaxonomySummary(): Promise<RouteResponse> {
  try {
    const summary = getTaxonomySummary();
    const dbTopics = await prisma.policyTopic.count();
    return {
      status: 200,
      data: {
        ...summary,
        seededInDatabase: dbTopics,
        categories: POLICY_CATEGORIES,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Taxonomy summary failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/taxonomy/categories */
export async function handleTaxonomyCategories(): Promise<RouteResponse> {
  try {
    return {
      status: 200,
      data: {
        totalCategories: CATEGORY_DEFINITIONS.length,
        categories: CATEGORY_DEFINITIONS,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Categories fetch failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/taxonomy/topics */
export async function handleTaxonomyTopics(params: {
  category?: string;
}): Promise<RouteResponse> {
  try {
    const where = params.category ? { category: params.category } : {};
    const topics = await prisma.policyTopic.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return {
      status: 200,
      data: {
        totalTopics: topics.length,
        topics: topics.map((t) => ({
          ...t,
          keywords: JSON.parse(t.keywords),
        })),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Topics fetch failed: ${message}` };
  }
}

/** POST /api/policy-intelligence/taxonomy/seed */
export async function handleTaxonomySeed(): Promise<RouteResponse> {
  try {
    const result = await runChpTopicExtraction();
    return {
      status: 200,
      data: {
        status: 'completed',
        ...result,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Taxonomy seed failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// AGENCY HANDLERS
// ---------------------------------------------------------------------------

/** GET /api/policy-intelligence/agencies */
export async function handleAgenciesList(params: {
  page?: number;
  limit?: number;
  search?: string;
  county?: string;
  type?: string;
}): Promise<RouteResponse> {
  try {
    const pageNum = params.page || 1;
    const limitNum = params.limit || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (params.search) {
      where.agencyName = { contains: params.search, mode: 'insensitive' };
    }
    if (params.county) {
      where.county = params.county;
    }
    if (params.type) {
      where.agencyType = params.type;
    }

    const [agencies, total] = await Promise.all([
      prisma.agency.findMany({
        where,
        orderBy: { jurisdictionRank: 'asc' },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: {
              PolicyDocuments: true,
              PolicyCoverage: { where: { policyFound: true } },
            },
          },
        },
      }),
      prisma.agency.count({ where }),
    ]);

    const totalTopics = await prisma.policyTopic.count();

    return {
      status: 200,
      data: {
        agencies: agencies.map((a) => ({
          agencyId: a.agencyId,
          agencyName: a.agencyName,
          agencyType: a.agencyType,
          city: a.city,
          county: a.county,
          populationEstimate: a.populationEstimate,
          jurisdictionRank: a.jurisdictionRank,
          website: a.website,
          crawlStatus: a.crawlStatus,
          policiesDiscovered: a.policiesDiscovered,
          documentsCount: a._count.PolicyDocuments,
          coveredTopics: a._count.PolicyCoverage,
          totalTopics,
          coveragePercent:
            totalTopics > 0
              ? Math.round((a._count.PolicyCoverage / totalTopics) * 10000) / 100
              : 0,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Agencies list failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/agencies/:agencyId */
export async function handleAgencyDetail(params: {
  agencyId: string;
}): Promise<RouteResponse> {
  try {
    const report = await getAgencyCoverageReport(params.agencyId);
    return { status: 200, data: report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Agency detail failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/agencies/:agencyId/gap-analysis */
export async function handleAgencyGapAnalysis(params: {
  agencyId: string;
}): Promise<RouteResponse> {
  try {
    const gaps = await getAgencyGapAnalysis(params.agencyId);
    return { status: 200, data: gaps };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Gap analysis failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// POLICY MATCHING HANDLERS
// ---------------------------------------------------------------------------

/** POST /api/policy-intelligence/match/document/:documentId */
export async function handleMatchDocument(params: {
  documentId: string;
}): Promise<RouteResponse> {
  try {
    const doc = await prisma.policyDocument.findUnique({
      where: { documentId: params.documentId },
    });
    if (!doc) {
      return { status: 404, error: 'Document not found' };
    }
    const result = await mapDocumentToTopic(params.documentId, doc.title || '', doc.textContent || '');
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Document match failed: ${message}` };
  }
}

/** POST /api/policy-intelligence/match/agency/:agencyId */
export async function handleMatchAgency(params: {
  agencyId: string;
}): Promise<RouteResponse> {
  try {
    const result = await matchAgencyDocuments(params.agencyId);
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Agency match failed: ${message}` };
  }
}

/** POST /api/policy-intelligence/match/all */
export async function handleMatchAll(): Promise<RouteResponse> {
  try {
    const result = await matchAllPendingDocuments();
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Batch match failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// COMPARATIVE ANALYSIS HANDLERS
// ---------------------------------------------------------------------------

/** POST /api/policy-intelligence/compare */
export async function handleCompareAgencies(params: {
  agencyIds: string[];
}): Promise<RouteResponse> {
  try {
    if (!params.agencyIds || params.agencyIds.length < 2) {
      return { status: 400, error: 'At least 2 agency IDs required' };
    }
    const result = await compareMultipleAgencies(params.agencyIds);
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Comparison failed: ${message}` };
  }
}

/** POST /api/policy-intelligence/compare/chp/:agencyId */
export async function handleCompareAgainstChp(params: {
  agencyId: string;
}): Promise<RouteResponse> {
  try {
    const result = await compareAgainstChp(params.agencyId);
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `CHP comparison failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// COVERAGE TRACKING HANDLERS
// ---------------------------------------------------------------------------

/** GET /api/policy-intelligence/coverage/stats */
export async function handleCoverageStats(): Promise<RouteResponse> {
  try {
    const stats = await getSystemCoverageStats();
    return { status: 200, data: stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Coverage stats failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/coverage/matrix */
export async function handleCoverageMatrix(): Promise<RouteResponse> {
  try {
    const matrix = await getCoverageMatrix();
    return { status: 200, data: matrix };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Coverage matrix failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/coverage/heatmap */
export async function handleCoverageHeatmap(params: {
  limit?: number;
  offset?: number;
}): Promise<RouteResponse> {
  try {
    const heatmap = await getCoverageHeatmap(params.limit || 20, params.offset || 0);
    return { status: 200, data: heatmap };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Coverage heatmap failed: ${message}` };
  }
}

/** GET /api/policy-intelligence/coverage/category/:category */
export async function handleCategoryDetail(params: {
  category: string;
}): Promise<RouteResponse> {
  try {
    if (!POLICY_CATEGORIES.includes(params.category as (typeof POLICY_CATEGORIES)[number])) {
      return { status: 400, error: `Invalid category: ${params.category}` };
    }
    const result = await getCategoryCoverage(params.category as (typeof POLICY_CATEGORIES)[number]);
    return { status: 200, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Category detail failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// DASHBOARD HANDLER
// ---------------------------------------------------------------------------

/** GET /api/policy-intelligence/dashboard */
export async function handleDashboard(): Promise<RouteResponse> {
  try {
    const [coverageStats, coverageMatrix] = await Promise.all([
      getSystemCoverageStats(),
      getCoverageMatrix(),
    ]);

    const summary = getTaxonomySummary();
    const dbTopics = await prisma.policyTopic.count();

    const recentAgencies = await prisma.agency.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        agencyId: true,
        agencyName: true,
        crawlStatus: true,
        policiesDiscovered: true,
        lastCrawledAt: true,
      },
    });

    return {
      status: 200,
      data: {
        coverage: coverageStats,
        taxonomy: { ...summary, seededInDatabase: dbTopics },
        matrix: coverageMatrix,
        recentActivity: recentAgencies,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 500, error: `Dashboard failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Route Registration Table
// ---------------------------------------------------------------------------

export const POLICY_INTELLIGENCE_ROUTES = [
  { method: 'GET' as const, path: '/api/policy-intelligence/taxonomy/summary', handler: handleTaxonomySummary },
  { method: 'GET' as const, path: '/api/policy-intelligence/taxonomy/categories', handler: handleTaxonomyCategories },
  { method: 'GET' as const, path: '/api/policy-intelligence/taxonomy/topics', handler: handleTaxonomyTopics },
  { method: 'POST' as const, path: '/api/policy-intelligence/taxonomy/seed', handler: handleTaxonomySeed },
  { method: 'GET' as const, path: '/api/policy-intelligence/agencies', handler: handleAgenciesList },
  { method: 'GET' as const, path: '/api/policy-intelligence/agencies/:agencyId', handler: handleAgencyDetail },
  { method: 'GET' as const, path: '/api/policy-intelligence/agencies/:agencyId/gap-analysis', handler: handleAgencyGapAnalysis },
  { method: 'POST' as const, path: '/api/policy-intelligence/match/document/:documentId', handler: handleMatchDocument },
  { method: 'POST' as const, path: '/api/policy-intelligence/match/agency/:agencyId', handler: handleMatchAgency },
  { method: 'POST' as const, path: '/api/policy-intelligence/match/all', handler: handleMatchAll },
  { method: 'POST' as const, path: '/api/policy-intelligence/compare', handler: handleCompareAgencies },
  { method: 'POST' as const, path: '/api/policy-intelligence/compare/chp/:agencyId', handler: handleCompareAgainstChp },
  { method: 'GET' as const, path: '/api/policy-intelligence/coverage/stats', handler: handleCoverageStats },
  { method: 'GET' as const, path: '/api/policy-intelligence/coverage/matrix', handler: handleCoverageMatrix },
  { method: 'GET' as const, path: '/api/policy-intelligence/coverage/heatmap', handler: handleCoverageHeatmap },
  { method: 'GET' as const, path: '/api/policy-intelligence/coverage/category/:category', handler: handleCategoryDetail },
  { method: 'GET' as const, path: '/api/policy-intelligence/dashboard', handler: handleDashboard },
] as const;
