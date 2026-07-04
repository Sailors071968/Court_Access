// ============================================
// Corpus Governance API — Fastify route registration
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { CorpusRegistryRepository } from './corpusRegistry.ts';
import { CorpusLockManager } from './corpusLock.ts';
import { GovernanceApiHandlers } from './governanceApi.ts';
import type { ApiRequest, ApiResponse } from './governanceApi.ts';
import { createPrismaLockDb, createPrismaRegistryDb } from './prismaAdapters.ts';
import { ingestLegislativeCorpus } from '../legislative/legislativeIngestService.ts';

type HandlerFn = (req: ApiRequest) => Promise<ApiResponse>;

function adaptHandler(handler: HandlerFn) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await handler({
      body: request.body as Record<string, unknown> | undefined,
      query: request.query as Record<string, string>,
      params: request.params as Record<string, string>,
    });
    return reply.status(result.status).send(result.body);
  };
}

export async function registerGovernanceRoutes(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient();
  const registry = new CorpusRegistryRepository(createPrismaRegistryDb(prisma));
  const lockManager = new CorpusLockManager(createPrismaLockDb(prisma));
  const handlers = new GovernanceApiHandlers(registry, lockManager);

  app.get('/api/corpus/registry', adaptHandler(handlers.listRegistry.bind(handlers)));
  app.post('/api/corpus/register', adaptHandler(handlers.registerCorpus.bind(handlers)));
  app.get('/api/corpus/status', adaptHandler(handlers.getCorpusStatus.bind(handlers)));
  app.get('/api/corpus/versions', adaptHandler(handlers.getCorpusVersions.bind(handlers)));
  app.post('/api/corpus/lock', adaptHandler(handlers.acquireLock.bind(handlers)));
  app.post('/api/corpus/unlock', adaptHandler(handlers.releaseLock.bind(handlers)));

  app.post('/api/corpus/ingest', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const code = (body?.code as string | undefined)?.toUpperCase();
    const corpusName = body?.corpusName as string | undefined;

    if (!code && !corpusName) {
      return reply.status(400).send({
        error: 'Missing required field: code (e.g. PEN) or corpusName (e.g. leginfo-PEN)',
      });
    }

    const resolvedCode = code ?? corpusName!.replace(/^leginfo-/i, '').toUpperCase();
    const maxSections = body?.maxSections as number | undefined;

    const result = await ingestLegislativeCorpus(registry, lockManager, {
      code: resolvedCode,
      version: (body?.version as string | undefined) ?? '1.0',
      maxSections,
      rawHtmlDir: body?.rawHtmlDir as string | undefined,
      repositoryDir: body?.repositoryDir as string | undefined,
    });

    const statusCode = result.status === 'completed' ? 200 : 500;
    return reply.status(statusCode).send(result);
  });

  console.log(
    '[Governance] Routes registered: /api/corpus/registry, /register, /status, /versions, /lock, /unlock, /ingest',
  );
}
