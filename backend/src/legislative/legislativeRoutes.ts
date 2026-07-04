// ============================================
// Legislative Intelligence API — metrics, coverage, repositories
// ============================================

import type { FastifyInstance } from 'fastify';
import { collectProductionMetrics } from './productionMetrics.ts';
import { readCoverageReport } from './legislativeIngestService.ts';
import { createRepositories, REPOSITORY_NAMES } from './knowledgeGraph/repositories.ts';
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
    '[Legislative] Routes registered: /api/legislative/metrics, /coverage, /repositories, /statutes/:code/:section',
  );
}
