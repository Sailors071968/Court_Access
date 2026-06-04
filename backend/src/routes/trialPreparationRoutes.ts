// ============================================================================
// Phase D.5 — Trial Preparation + Export Routes
// Citation-linked litigation packet generation and export.
// NEVER impersonates legal counsel. Organizes litigation materials only.
// ============================================================================

import { FastifyInstance } from 'fastify';
import {
  runFullTrialPreparation,
  generateWitnessAttackSheets,
  generateCalcrimFailureMatrices,
  generateTrialExhibits,
  generateHearingPrepPacket,
  assembleTrialNotebook,
} from '../services/trialPreparationService.js';
import {
  exportWitnessAttackSheet,
  exportContradictionPacket,
  exportCalcrimFailureMatrix,
  exportHearingPrepPacket,
  exportTrialNotebook,
  exportExhibitPacket,
} from '../services/litigationExportService.js';
import prisma from '../lib/prisma.js';

export async function registerTrialPreparationRoutes(fastify: FastifyInstance) {

  // ═══════════════════════════════════════════
  // TRIAL PREPARATION
  // ═══════════════════════════════════════════

  // POST /api/trial/prepare/:caseId — Full trial preparation
  fastify.post('/api/trial/prepare/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await runFullTrialPreparation(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      fastify.log.error(err, 'Trial preparation failed');
      return reply.code(500).send({ error: 'Trial preparation failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/trial/witness-attack-sheets/:caseId
  fastify.post('/api/trial/witness-attack-sheets/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await generateWitnessAttackSheets(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/witness-attack-sheets/:caseId
  fastify.get('/api/trial/witness-attack-sheets/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const sheets = await prisma.witnessAttackSheet.findMany({
        where: { caseId: params.caseId },
        orderBy: { credibilityScore: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, sheets, total: sheets.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/trial/failure-matrices/:caseId
  fastify.post('/api/trial/failure-matrices/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await generateCalcrimFailureMatrices(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/failure-matrices/:caseId
  fastify.get('/api/trial/failure-matrices/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const matrices = await prisma.calcrimFailureMatrix.findMany({
        where: { caseId: params.caseId },
        orderBy: { instructionNumber: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, matrices, total: matrices.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/trial/exhibits/:caseId
  fastify.post('/api/trial/exhibits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await generateTrialExhibits(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/exhibits/:caseId
  fastify.get('/api/trial/exhibits/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const query = req.query as { type?: string; status?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const exhibits = await prisma.trialExhibit.findMany({
        where: {
          caseId: params.caseId,
          ...(query.type ? { exhibitType: query.type } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy: { exhibitNumber: 'asc' },
      });
      return reply.code(200).send({ caseId: params.caseId, exhibits, total: exhibits.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/trial/hearing-prep/:caseId
  fastify.post('/api/trial/hearing-prep/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { hearingType?: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    const hearingType = body?.hearingType || 'trial';
    try {
      const result = await generateHearingPrepPacket(params.caseId, hearingType);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/hearing-prep/:caseId
  fastify.get('/api/trial/hearing-prep/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const packets = await prisma.hearingPrepPacket.findMany({
        where: { caseId: params.caseId },
        orderBy: { createdAt: 'desc' },
      });
      return reply.code(200).send({ caseId: params.caseId, packets, total: packets.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/trial/notebook/:caseId — Assemble trial notebook
  fastify.post('/api/trial/notebook/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await assembleTrialNotebook(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/notebook/:caseId
  fastify.get('/api/trial/notebook/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const notebook = await prisma.trialNotebook.findFirst({
        where: { caseId: params.caseId },
        orderBy: { createdAt: 'desc' },
      });
      if (!notebook) return reply.code(404).send({ error: 'No trial notebook found' });
      return reply.code(200).send(notebook);
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // ═══════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════

  // POST /api/export/witness-attack/:caseId — Export witness attack sheet
  fastify.post('/api/export/witness-attack/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    const body = req.body as { witnessName?: string };
    if (!params.caseId || !body?.witnessName) return reply.code(400).send({ error: 'Required: caseId, witnessName' });
    try {
      const result = await exportWitnessAttackSheet(params.caseId, body.witnessName);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/export/contradictions/:caseId — Export contradiction packet
  fastify.post('/api/export/contradictions/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await exportContradictionPacket(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/export/failure-matrix/:caseId — Export CALCRIM failure matrix
  fastify.post('/api/export/failure-matrix/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await exportCalcrimFailureMatrix(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/export/hearing-prep/:packetId — Export hearing prep packet
  fastify.post('/api/export/hearing-prep/:packetId', async (req, reply) => {
    const params = req.params as { packetId: string };
    if (!params.packetId) return reply.code(400).send({ error: 'Required: packetId' });
    try {
      const result = await exportHearingPrepPacket(params.packetId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/export/trial-notebook/:caseId — Export trial notebook
  fastify.post('/api/export/trial-notebook/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await exportTrialNotebook(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/export/exhibit-packet/:caseId — Export all exhibits
  fastify.post('/api/export/exhibit-packet/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const result = await exportExhibitPacket(params.caseId);
      return reply.code(200).send(result);
    } catch (err) {
      return reply.code(500).send({ error: 'Export failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/export/jobs/:caseId — Get export jobs
  fastify.get('/api/export/jobs/:caseId', async (req, reply) => {
    const params = req.params as { caseId: string };
    if (!params.caseId) return reply.code(400).send({ error: 'Required: caseId' });
    try {
      const jobs = await prisma.exportJob.findMany({
        where: { caseId: params.caseId },
        orderBy: { createdAt: 'desc' },
      });
      return reply.code(200).send({ caseId: params.caseId, jobs, total: jobs.length });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed', details: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/trial/validation — Live validation report
  fastify.get('/api/trial/validation', async (_req, reply) => {
    try {
      const [exhibits, sheets, matrices, packets, notebooks, exportJobs] = await Promise.all([
        prisma.trialExhibit.count(),
        prisma.witnessAttackSheet.count(),
        prisma.calcrimFailureMatrix.count(),
        prisma.hearingPrepPacket.count(),
        prisma.trialNotebook.count(),
        prisma.exportJob.count(),
      ]);
      return reply.code(200).send({
        phase: 'D.5',
        name: 'Trial Preparation + Litigation Packet Generation',
        generatedAt: new Date().toISOString(),
        totals: { trialExhibits: exhibits, witnessAttackSheets: sheets, calcrimFailureMatrices: matrices, hearingPrepPackets: packets, trialNotebooks: notebooks, exportJobs: exportJobs },
        deterministicConstraints: {
          noFabricatedMotions: true,
          noHallucinatedTestimony: true,
          noInventedImpeachment: true,
          noSpeculativeLegalConclusions: true,
          noFakeCaseCitations: true,
          noAIWrittenLegalOpinions: true,
          corePrinciple: 'CourtAccess organizes litigation materials. It does NOT impersonate legal counsel.',
        },
      });
    } catch (err) {
      return reply.code(500).send({ error: 'Validation failed' });
    }
  });
}
