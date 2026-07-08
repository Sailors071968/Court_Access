// ============================================
// Legislative Intelligence API — metrics, coverage, repositories
// ============================================

import type { FastifyInstance } from 'fastify';
import { collectProductionMetrics } from './productionMetrics.ts';
import { readCoverageReport } from './legislativeIngestService.ts';
import { createRepositories, REPOSITORY_NAMES } from './knowledgeGraph/repositories.ts';
import { collectLiabilityDiscoveryMetrics } from './liabilityDiscovery/metrics.ts';
import { getAttorneyStatuteIntelligence } from './attorneyIntelligence.ts';
import {
  getExtractionAuditStats,
  queryExtractionAudit,
  type ExtractionAuditStatus,
  type ExtractionStage,
} from './extractionAuditLog.ts';
import { generateRepositoryIntegrityDashboard } from './repositoryIntegrityDashboard.ts';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_REPO_DIR = 'data/legislative/repositories';

export async function registerLegislativeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/legislative/metrics', async () => {
    return collectProductionMetrics();
  });

  app.get('/api/legislative/coverage', async (_req, reply) => {
    const report = await readCoverageReport(resolve(DEFAULT_REPO_DIR));
    if (!report) {
      return reply.status(404).send({ error: 'No coverage report found. Run leginfo:process first.' });
    }
    return report;
  });

  app.get('/api/legislative/repositories', async () => {
    const repoDir = resolve(DEFAULT_REPO_DIR);
    const repos = createRepositories(repoDir);
    const inventory: Record<string, { count: number; lastUpdatedAt: string | null }> = {};

    for (const name of REPOSITORY_NAMES) {
      const index = await repos[name].getIndex();
      inventory[name] = { count: index.count, lastUpdatedAt: index.updatedAt };
    }

    return { repositoryDir: repoDir, repositories: inventory };
  });

  app.get('/api/legislative/liability', async (_req, reply) => {
    const repoDir = resolve(DEFAULT_REPO_DIR);
    try {
      const metrics = await collectLiabilityDiscoveryMetrics({ repositoryDir: repoDir });
      return metrics;
    } catch {
      return reply.status(404).send({ error: 'Liability discovery metrics unavailable. Run leginfo:process first.' });
    }
  });

  // GET /api/legislative/codes — distinct California codes present in the repository (never hardcoded)
  app.get('/api/legislative/codes', async (_req, reply) => {
    const repoDir = resolve(DEFAULT_REPO_DIR);
    const recordsPath = join(repoDir, 'statutes', 'records.jsonl');
    try {
      const raw = await readFile(recordsPath, 'utf-8');
      const counts = new Map<string, { count: number; name: string }>();
      for (const line of raw.trim().split('\n')) {
        if (!line) continue;
        const r = JSON.parse(line) as { code: string; title?: string };
        const code = r.code;
        if (!code) continue;
        const existing = counts.get(code);
        // Derive the human name from the statute title prefix, e.g. "Penal Code - PEN PART 1" → "Penal Code".
        const derivedName = r.title && r.title.includes(' - ') ? r.title.split(' - ')[0].trim() : code;
        counts.set(code, { count: (existing?.count ?? 0) + 1, name: existing?.name && existing.name !== code ? existing.name : derivedName });
      }
      const codes = Array.from(counts.entries())
        .map(([code, v]) => ({ code, name: v.name, sectionCount: v.count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return reply.send({ source: 'repository', repositoryDir: repoDir, codes });
    } catch {
      return reply.status(404).send({ error: 'Statute repository not initialized' });
    }
  });

  // GET /api/legislative/sections?code=PEN&q=459 — searchable repository-backed section selector
  app.get('/api/legislative/sections', async (request, reply) => {
    const { code, q, limit } = request.query as { code?: string; q?: string; limit?: string };
    const repoDir = resolve(DEFAULT_REPO_DIR);
    const statutesPath = join(repoDir, 'statutes', 'records.jsonl');
    const classPath = join(repoDir, 'statute_classifications', 'records.jsonl');
    const max = Math.min(limit ? parseInt(limit, 10) : 50, 200);
    try {
      // Build a classification lookup (code|section → classification value/confidence).
      const classMap = new Map<string, { value: string; confidence: string }>();
      try {
        const craw = await readFile(classPath, 'utf-8');
        for (const line of craw.trim().split('\n')) {
          if (!line) continue;
          const c = JSON.parse(line) as { code: string; section: string; classification?: { value?: string; confidence?: string } };
          classMap.set(`${c.code}|${c.section}`, { value: c.classification?.value ?? 'UNKNOWN', confidence: c.classification?.confidence ?? 'UNKNOWN' });
        }
      } catch { /* classifications optional */ }

      const raw = await readFile(statutesPath, 'utf-8');
      const needle = (q ?? '').trim().toLowerCase();
      const wantCode = code ? code.toUpperCase() : null;
      const results: Array<Record<string, unknown>> = [];
      for (const line of raw.trim().split('\n')) {
        if (!line) continue;
        const r = JSON.parse(line) as { code: string; section: string; title?: string; fullText?: string };
        if (wantCode && r.code !== wantCode) continue;
        const sectionClean = r.section.replace(/\.$/, '');
        const citation = `${r.code} ${sectionClean}`;
        if (needle) {
          const hay = `${r.code} ${sectionClean} ${citation} ${r.title ?? ''} ${(r.fullText ?? '').slice(0, 400)}`.toLowerCase();
          if (!hay.includes(needle)) continue;
        }
        const cls = classMap.get(`${r.code}|${r.section}`);
        results.push({
          code: r.code,
          section: sectionClean,
          citation,
          title: r.title ?? null,
          classification: cls?.value ?? 'UNKNOWN',
          classificationConfidence: cls?.confidence ?? 'UNKNOWN',
        });
        if (results.length >= max) break;
      }
      // Prioritize exact section-number matches when searching.
      if (needle) {
        results.sort((a, b) => {
          const ae = String(a.section).toLowerCase() === needle ? 0 : 1;
          const be = String(b.section).toLowerCase() === needle ? 0 : 1;
          return ae - be;
        });
      }
      return reply.send({ source: 'repository', query: q ?? null, code: wantCode, count: results.length, sections: results });
    } catch {
      return reply.status(404).send({ error: 'Statute repository not initialized' });
    }
  });

  app.get('/api/legislative/classifications/:code/:section', async (request, reply) => {
    const { code, section } = request.params as { code: string; section: string };
    const repoDir = resolve(DEFAULT_REPO_DIR);
    const recordsPath = join(repoDir, 'statute_classifications', 'records.jsonl');

    try {
      const raw = await readFile(recordsPath, 'utf-8');
      const normalizedSection = section.endsWith('.') ? section : `${section}.`;
      let latest: unknown = null;
      for (const line of raw.trim().split('\n')) {
        if (!line) continue;
        const record = JSON.parse(line) as { code: string; section: string };
        if (record.code === code.toUpperCase() && record.section === normalizedSection) {
          latest = record;
        }
      }
      if (!latest) return reply.status(404).send({ error: 'Classification not found' });
      return latest;
    } catch {
      return reply.status(404).send({ error: 'Classification repository not initialized' });
    }
  });

  app.get('/api/legislative/intelligence/:code/:section', async (request, reply) => {
    const { code, section } = request.params as { code: string; section: string };
    const intel = await getAttorneyStatuteIntelligence(code, section, {
      repositoryDir: resolve(DEFAULT_REPO_DIR),
    });
    if (!intel) {
      return reply.status(404).send({ error: 'Statute intelligence not found. Run leginfo:process first.' });
    }
    return intel;
  });

  app.get('/api/legislative/audit', async (request) => {
    const query = request.query as {
      code?: string;
      section?: string;
      status?: ExtractionAuditStatus;
      stage?: ExtractionStage;
      limit?: string;
      offset?: string;
      stats?: string;
    };

    const auditOptions = { prisma };

    if (query.stats === 'true') {
      return getExtractionAuditStats(auditOptions);
    }

    return queryExtractionAudit(
      {
        code: query.code,
        section: query.section,
        status: query.status,
        stage: query.stage,
        limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
        offset: query.offset ? Number.parseInt(query.offset, 10) : undefined,
      },
      auditOptions,
    );
  });

  app.get('/api/legislative/repository-integrity', async () => {
    return generateRepositoryIntegrityDashboard();
  });

  app.get('/api/legislative/statutes/:code/:section', async (request, reply) => {
    const { code, section } = request.params as { code: string; section: string };
    const repoDir = resolve(DEFAULT_REPO_DIR);
    const recordsPath = join(repoDir, 'statutes', 'records.jsonl');

    try {
      const raw = await readFile(recordsPath, 'utf-8');
      const normalizedSection = section.endsWith('.') ? section : `${section}.`;
      for (const line of raw.trim().split('\n')) {
        if (!line) continue;
        const record = JSON.parse(line) as { code: string; section: string };
        if (record.code === code.toUpperCase() && record.section === normalizedSection) {
          return record;
        }
      }
      return reply.status(404).send({ error: 'Statute not found in repository' });
    } catch {
      return reply.status(404).send({ error: 'Statute repository not initialized' });
    }
  });

  console.log(
    '[Legislative] Routes registered: /metrics, /coverage, /liability, /intelligence/:code/:section, /repositories, /audit, /repository-integrity, /classifications/:code/:section, /statutes/:code/:section',
  );
}
