// ============================================================================
// Reprocessing.
//
//   New algorithm → replay observations → generate improved intelligence
//                 → compare differences → approve → promote
//
// The point is that an algorithm improvement is never a destructive update. A
// reprocessing run writes its findings into its own generation, tagged with the
// run id, alongside the live ones. Nothing is superseded until a person has read
// the comparison and promoted the run, and the findings that were superseded stay
// readable afterwards.
//
// This is what makes the version bundle on every item worth carrying. Without it a
// comparison could say "these differ" but not why; with it, a diff attributes each
// difference to the component that changed.
// ============================================================================

import prisma from '../../lib/prisma.js';
import { getEngine } from './engineRegistry.js';
import { recordFinding, supersede } from './intelligenceRepository.js';
import type { EvidenceContext, IntelligenceFinding } from './types.js';

export interface ReprocessScope {
  facility?: string;
  /** Roster dates within this window, inclusive. */
  from?: string;
  to?: string;
  batchId?: string;
  /** Cap, so a first run on a large repository can be bounded. */
  maxObservations?: number;
}

/**
 * Start a run and replay the observations in scope through one engine.
 *
 * The run is created before any analysis so that a crash leaves a `running` row
 * rather than nothing — a reprocessing run that vanished without trace is
 * indistinguishable from one that was never started, and the difference matters
 * when the question is whether the repository was touched.
 */
export async function startReprocessRun(args: {
  engineName: string;
  scope: ReprocessScope;
  mode?: 'reprocess' | 'dry_run' | 'backfill';
  triggeredById?: string;
  versions?: EvidenceContext['versions'];
}): Promise<{ runId: string } | { error: string }> {
  const engine = getEngine(args.engineName);
  if (!engine) {
    return { error: `No engine registered as "${args.engineName}".` };
  }

  const mode = args.mode ?? 'reprocess';
  const run = await prisma.inmateIntelligenceRun.create({
    data: {
      engine: engine.name,
      engineVersion: engine.version,
      mode,
      status: 'running',
      scope: args.scope as object,
      triggeredById: args.triggeredById ?? null,
    },
    select: { runId: true },
  });

  try {
    const observationIds = await observationsInScope(args.scope);
    const context: EvidenceContext = {
      runId: run.runId,
      versions: args.versions ?? {},
      observationIds,
      // A dry run produces identical findings and persists none. The engine is not
      // told the difference; only the platform acts on it.
      dryRun: mode === 'dry_run',
    };

    const findings = await engine.analyse(context);

    let created = 0;
    if (mode !== 'dry_run') {
      for (const finding of findings) {
        await recordFinding(prisma, engine, finding, context);
        created += 1;
      }
    }

    const comparison = await compareWithLive(run.runId, engine.name, findings);

    await prisma.inmateIntelligenceRun.update({
      where: { runId: run.runId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        itemsCreated: created,
        itemsNew: comparison.newFindings,
        itemsChanged: comparison.changed,
        itemsUnchanged: comparison.unchanged,
        itemsWithdrawn: comparison.withdrawn,
        comparison: comparison as unknown as object,
      },
    });

    return { runId: run.runId };
  } catch (error) {
    await prisma.inmateIntelligenceRun.update({
      where: { runId: run.runId },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        failureReason: error instanceof Error ? error.message : String(error),
      },
    });
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** The observations a run replays. */
async function observationsInScope(scope: ReprocessScope): Promise<string[]> {
  const where: Record<string, unknown> = {};
  if (scope.batchId) where.batchId = scope.batchId;
  if (scope.from || scope.to) {
    where.rosterDate = {
      ...(scope.from ? { gte: new Date(scope.from) } : {}),
      ...(scope.to ? { lte: new Date(scope.to) } : {}),
    };
  }
  if (scope.facility) {
    where.booking = { facility: scope.facility };
  }

  const rows = await prisma.inmateBookingObservation.findMany({
    where,
    // Chronological, so a replay sees evidence in the order it arrived. An engine
    // whose conclusions depend on order would otherwise produce a diff that
    // reflects the query plan rather than the algorithm change.
    orderBy: [{ observedAt: 'asc' }, { observationId: 'asc' }],
    take: scope.maxObservations ?? 100_000,
    select: { observationId: true },
  });
  return rows.map((r) => r.observationId);
}

/**
 * How the run's conclusions differ from the ones currently in force.
 *
 * Matched on subject and type rather than on id, because a re-derived finding is a
 * different row describing the same question. Confidence and rule are compared
 * because those are what a reviewer needs to judge whether the change is an
 * improvement — a finding that reached the same conclusion by a different rule is
 * worth seeing.
 */
async function compareWithLive(
  runId: string,
  engineName: string,
  findings: IntelligenceFinding[],
) {
  const live = await prisma.inmateIntelligenceItem.findMany({
    where: {
      engine: engineName,
      runId: null,
      disposition: { notIn: ['superseded', 'expired'] },
    },
    select: {
      itemId: true, type: true, subjectKind: true, subjectId: true,
      confidence: true, rule: true, disposition: true, engineVersion: true,
    },
  });

  const key = (t: string, k: string, id: string | null | undefined) => `${t}|${k}|${id ?? ''}`;
  const liveByKey = new Map(live.map((i) => [key(i.type, i.subjectKind, i.subjectId), i]));

  const differences: {
    kind: 'new' | 'changed' | 'withdrawn';
    subjectKind: string;
    subjectId?: string | null;
    type: string;
    before?: { confidence: number; rule: string | null; disposition: string; itemId: string };
    after?: { confidence: number; rule?: string };
  }[] = [];

  let unchanged = 0;
  const seen = new Set<string>();

  for (const f of findings) {
    const k = key(f.type, f.subjectKind, f.subjectId);
    seen.add(k);
    const before = liveByKey.get(k);
    if (!before) {
      differences.push({ kind: 'new', subjectKind: f.subjectKind, subjectId: f.subjectId, type: f.type, after: { confidence: f.confidence, rule: f.rule } });
    } else if (before.confidence !== f.confidence || before.rule !== (f.rule ?? null)) {
      differences.push({
        kind: 'changed',
        subjectKind: f.subjectKind,
        subjectId: f.subjectId,
        type: f.type,
        before: { confidence: before.confidence, rule: before.rule, disposition: before.disposition, itemId: before.itemId },
        after: { confidence: f.confidence, rule: f.rule },
      });
    } else {
      unchanged += 1;
    }
  }

  // A finding the live repository holds that the new algorithm no longer draws.
  // Reported rather than deleted: the old conclusion may have been acted on, and
  // withdrawing it silently would leave that action unexplained.
  for (const [k, i] of liveByKey) {
    if (!seen.has(k)) {
      differences.push({
        kind: 'withdrawn',
        subjectKind: i.subjectKind,
        subjectId: i.subjectId,
        type: i.type,
        before: { confidence: i.confidence, rule: i.rule, disposition: i.disposition, itemId: i.itemId },
      });
    }
  }

  return {
    runId,
    newFindings: differences.filter((d) => d.kind === 'new').length,
    changed: differences.filter((d) => d.kind === 'changed').length,
    withdrawn: differences.filter((d) => d.kind === 'withdrawn').length,
    unchanged,
    // Bounded. A diff of ten thousand rows is not reviewable, and the counts above
    // are what tell an operator whether to look closer.
    differences: differences.slice(0, 500),
    truncated: differences.length > 500,
  };
}

/**
 * Promote a completed run: its findings become the ones in force.
 *
 * A promotion supersedes the live items the run replaced and clears the run tag
 * from the new ones, so the repository has exactly one set of findings in force
 * and one readable trail of what they replaced. Refuses anything that is not a
 * completed non-dry run, because promoting a failed run would put conclusions in
 * force that no comparison was ever produced for.
 */
export async function promoteRun(args: {
  runId: string;
  actorId: string;
}): Promise<{ ok: boolean; superseded?: number; promoted?: number; reason?: string }> {
  const run = await prisma.inmateIntelligenceRun.findUnique({ where: { runId: args.runId } });
  if (!run) return { ok: false, reason: 'No such run.' };
  if (run.status !== 'completed') {
    return { ok: false, reason: `Run is ${run.status}. Only a completed run can be promoted.` };
  }
  if (run.mode === 'dry_run') {
    return { ok: false, reason: 'A dry run persisted no findings, so there is nothing to promote.' };
  }

  const candidates = await prisma.inmateIntelligenceItem.findMany({
    where: { runId: args.runId },
    select: { itemId: true, type: true, subjectKind: true, subjectId: true },
  });

  const live = await prisma.inmateIntelligenceItem.findMany({
    where: {
      engine: run.engine,
      runId: null,
      disposition: { notIn: ['superseded', 'expired'] },
    },
    select: { itemId: true, type: true, subjectKind: true, subjectId: true },
  });

  const key = (t: string, k: string, id: string | null | undefined) => `${t}|${k}|${id ?? ''}`;
  const liveByKey = new Map(live.map((i) => [key(i.type, i.subjectKind, i.subjectId), i.itemId]));

  let supersededCount = 0;
  for (const candidate of candidates) {
    const oldItemId = liveByKey.get(key(candidate.type, candidate.subjectKind, candidate.subjectId));
    if (oldItemId) {
      await supersede({
        oldItemId,
        newItemId: candidate.itemId,
        reason: `Superseded by ${run.engine} ${run.engineVersion} in run ${args.runId}.`,
        actorId: args.actorId,
        engineVersion: run.engineVersion,
      });
      supersededCount += 1;
    }
  }

  await prisma.$transaction([
    // Clearing runId is what puts them in force: an item with no run is live.
    prisma.inmateIntelligenceItem.updateMany({
      where: { runId: args.runId },
      data: { runId: null },
    }),
    prisma.inmateIntelligenceRun.update({
      where: { runId: args.runId },
      data: { status: 'promoted', promotedById: args.actorId, promotedAt: new Date() },
    }),
  ]);

  return { ok: true, superseded: supersededCount, promoted: candidates.length };
}

/** Abandon a run, keeping its findings out of force and its record intact. */
export async function discardRun(runId: string, actorId: string): Promise<{ ok: boolean; reason?: string }> {
  const run = await prisma.inmateIntelligenceRun.findUnique({ where: { runId }, select: { status: true } });
  if (!run) return { ok: false, reason: 'No such run.' };
  if (run.status === 'promoted') {
    return { ok: false, reason: 'A promoted run is in force and cannot be discarded. Reprocess to replace it.' };
  }

  await prisma.$transaction([
    prisma.inmateIntelligenceItem.updateMany({
      where: { runId },
      data: { disposition: 'expired' },
    }),
    prisma.inmateIntelligenceRun.update({
      where: { runId },
      data: { status: 'discarded', promotedById: actorId, finishedAt: new Date() },
    }),
  ]);
  return { ok: true };
}

export async function getRun(runId: string) {
  return prisma.inmateIntelligenceRun.findUnique({ where: { runId } });
}

export async function listRuns(limit = 50) {
  return prisma.inmateIntelligenceRun.findMany({
    orderBy: [{ startedAt: 'desc' }, { runId: 'asc' }],
    take: limit,
  });
}
