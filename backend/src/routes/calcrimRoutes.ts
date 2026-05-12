import { FastifyInstance } from 'fastify';
import { analyzeCase } from '../services/calcrimEngine.js';
import prisma from '../lib/prisma.js';

export async function registerCalcrimRoutes(fastify: FastifyInstance) {
  // Existing: analyze a case using the CALCRIM engine
  fastify.get('/api/calcrim/analyze/:caseId', async (req, reply) => {
    try {
      const { caseId } = req.params as { caseId: string };
      const result = await analyzeCase(caseId);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  });

  // Phase C.1: List all CALCRIM instructions
  fastify.get('/api/calcrim/instructions', async (_req, _reply) => {
    const instructions = await prisma.calcrimInstruction.findMany({
      include: {
        elements: {
          orderBy: { elementNumber: 'asc' },
          include: {
            aliases: true,
            keywords: true,
          },
        },
      },
      orderBy: { instructionNumber: 'asc' },
    });
    return { count: instructions.length, instructions };
  });

  // Phase C.1: Get a single CALCRIM instruction by number
  fastify.get('/api/calcrim/instructions/:number', async (req, reply) => {
    const { number } = req.params as { number: string };
    const instructionNumber = parseInt(number, 10);
    if (isNaN(instructionNumber)) {
      return reply.code(400).send({ error: 'Invalid instruction number' });
    }

    const instruction = await prisma.calcrimInstruction.findUnique({
      where: { instructionNumber },
      include: {
        elements: {
          orderBy: { elementNumber: 'asc' },
          include: {
            aliases: true,
            keywords: true,
          },
        },
      },
    });

    if (!instruction) {
      return reply.code(404).send({ error: `CALCRIM ${instructionNumber} not found` });
    }
    return instruction;
  });

  // Phase C.1: Look up CALCRIM instruction by penal code
  fastify.get('/api/calcrim/lookup', async (req, reply) => {
    const { code } = req.query as { code?: string };
    if (!code) {
      return reply.code(400).send({ error: 'Query parameter "code" required (e.g. ?code=PC 459)' });
    }

    const instructions = await prisma.calcrimInstruction.findMany({
      where: { penalCode: code },
      include: {
        elements: {
          orderBy: { elementNumber: 'asc' },
          include: {
            aliases: true,
            keywords: true,
          },
        },
      },
    });

    return { query: code, count: instructions.length, instructions };
  });

  // Phase C.1: Registry validation summary
  fastify.get('/api/calcrim/registry/status', async (_req, _reply) => {
    const instructionCount = await prisma.calcrimInstruction.count();
    const elementCount = await prisma.calcrimElement.count();
    const aliasCount = await prisma.elementAlias.count();
    const keywordCount = await prisma.elementKeyword.count();

    const categories = await prisma.calcrimInstruction.groupBy({
      by: ['crimeCategory'],
      _count: true,
    });

    return {
      status: instructionCount > 0 ? 'seeded' : 'empty',
      instructions: instructionCount,
      elements: elementCount,
      aliases: aliasCount,
      keywords: keywordCount,
      categories: categories.map((c) => ({
        category: c.crimeCategory,
        count: c._count,
      })),
    };
  });
}
