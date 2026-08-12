// ============================================================================
// The batch lifecycle.
//
// An import moves through named states, and every transition is recorded with when,
// who, and the algorithm versions in force at that moment.
//
// The reason this is worth its own table rather than a status column: a batch that
// failed at identity analysis and a batch that failed at parsing are the same row with
// the same status, and the difference between them is the entire diagnosis. The
// sequence is also the only place the answer to "why did this take four minutes" lives.
//
// Transitions are append-only. One is never updated or deleted, because a lifecycle you
// can edit is not an audit trail.
// ============================================================================

import type { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../lib/prisma.js';

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * The states, in the order a healthy import passes through them.
 *
 * `validation_passed` is a state rather than an implicit step because it is the last
 * point at which nothing has been written: an operator who sees a batch stuck here
 * knows the repository is untouched.
 */
export const LIFECYCLE_STATES = [
  'uploaded',
  'inspection_complete',
  'validation_passed',
  'parsing',
  'observation_creation',
  'identity_analysis',
  'intelligence_generation',
  'report_generated',
  'persisted',
  'completed',
  // Terminal, reachable from anywhere.
  'failed',
  'cancelled',
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** States from which nothing further happens on its own. */
const TERMINAL: ReadonlySet<LifecycleState> = new Set(['completed', 'failed', 'cancelled']);

/**
 * Which transitions are allowed.
 *
 * Enforced rather than documented, because an out-of-order transition means the
 * pipeline did something the lifecycle does not describe — and silently recording it
 * would make the audit trail agree with a bug.
 *
 * Failure and cancellation are reachable from every non-terminal state, which is why
 * they are added below rather than listed against each one.
 */
const ALLOWED: Record<LifecycleState, LifecycleState[]> = {
  uploaded: ['inspection_complete', 'validation_passed', 'parsing'],
  // Inspection is optional: an operator who already trusts the profile goes straight to
  // validation. Skipping it is a choice, not an error.
  inspection_complete: ['validation_passed', 'parsing'],
  validation_passed: ['parsing'],
  parsing: ['observation_creation'],
  observation_creation: ['identity_analysis'],
  identity_analysis: ['intelligence_generation'],
  intelligence_generation: ['report_generated', 'persisted'],
  // The report is generated on demand, so an import can persist without one.
  report_generated: ['persisted'],
  persisted: ['completed'],
  completed: [],
  failed: [],
  cancelled: [],
};

export interface TransitionArgs {
  batchId: string;
  to: LifecycleState;
  reason?: string;
  actorId?: string;
  actor?: 'manual' | 'cli' | 'timer' | 'queue' | 'system';
  versions?: {
    parserProfileId?: string | null;
    parserVersion?: number | null;
    normalizationVersion?: string | null;
    resolverVersion?: string | null;
    mergePolicyVersion?: string | null;
  };
  metrics?: Record<string, unknown>;
}

/**
 * Move a batch to a new state.
 *
 * Returns the transition, or an explanation of why it was refused. Deliberately not a
 * throw: a lifecycle write must never be the thing that fails an import that otherwise
 * worked, and the caller decides whether a refused transition matters.
 */
export async function transition(
  tx: Tx,
  args: TransitionArgs,
): Promise<{ ok: true; durationMs: number | null } | { ok: false; reason: string }> {
  const batch = await tx.inmateIngestionBatch.findUnique({
    where: { batchId: args.batchId },
    select: { lifecycleState: true, parserProfileId: true, parserVersion: true, normalizationVersion: true },
  });
  if (!batch) return { ok: false, reason: 'No such batch.' };

  const from = batch.lifecycleState as LifecycleState;

  if (from === args.to) {
    // Re-entering a state is a no-op rather than an error: a resumed import may replay
    // the step it was interrupted in, and recording that as a transition would make the
    // trail claim the step ran twice.
    return { ok: true, durationMs: null };
  }
  if (TERMINAL.has(from)) {
    return { ok: false, reason: `The batch is ${from}, which is terminal. It cannot move to ${args.to}.` };
  }
  const permitted = args.to === 'failed' || args.to === 'cancelled' || ALLOWED[from].includes(args.to);
  if (!permitted) {
    return {
      ok: false,
      reason: `${from} → ${args.to} is not a transition this lifecycle describes. Allowed from ${from}: ${
        [...ALLOWED[from], 'failed', 'cancelled'].join(', ')}.`,
    };
  }

  // How long the state being left lasted, measured from the transition that entered it.
  const previous = await tx.inmateBatchTransition.findFirst({
    where: { batchId: args.batchId },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  const durationMs = previous ? Date.now() - previous.occurredAt.getTime() : null;

  await tx.inmateBatchTransition.create({
    data: {
      batchId: args.batchId,
      fromState: from,
      toState: args.to,
      reason: args.reason ?? null,
      actorId: args.actorId ?? null,
      actor: args.actor ?? 'system',
      // Falls back to what the batch recorded, so a transition always carries the
      // versions even when the caller did not repeat them.
      parserProfileId: args.versions?.parserProfileId ?? batch.parserProfileId,
      parserVersion: args.versions?.parserVersion ?? batch.parserVersion,
      normalizationVersion: args.versions?.normalizationVersion ?? batch.normalizationVersion,
      resolverVersion: args.versions?.resolverVersion ?? null,
      mergePolicyVersion: args.versions?.mergePolicyVersion ?? null,
      durationMs,
      metrics: (args.metrics ?? null) as object,
    },
  });

  await tx.inmateIngestionBatch.update({
    where: { batchId: args.batchId },
    data: {
      lifecycleState: args.to,
      ...(args.to === 'cancelled'
        ? { cancelledAt: new Date(), cancelledById: args.actorId ?? null, cancelReason: args.reason ?? null }
        : {}),
    },
  });

  return { ok: true, durationMs };
}

/** Best-effort: never let a lifecycle write fail the work it is describing. */
export async function recordTransition(args: TransitionArgs): Promise<void> {
  try {
    const outcome = await transition(prisma, args);
    if (!outcome.ok) {
      // Logged rather than swallowed. A refused transition means the pipeline did
      // something the lifecycle does not describe, which is worth knowing about.
      console.warn(`[niis] lifecycle transition refused for ${args.batchId}: ${outcome.reason}`);
    }
  } catch (err) {
    console.warn('[niis] lifecycle transition failed to write', err);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface BatchLifecycleView {
  batchId: string;
  facility: string;
  filename: string;
  sourceType: string;
  rosterDate: string | null;
  lifecycleState: string;
  status: string;
  isTerminal: boolean;
  operator: string | null;
  parserProfile: string | null;
  parserConfidence: number | null;
  startedAt: string;
  finishedAt: string | null;
  totalDurationMs: number | null;
  closedAt: string | null;
  cancelReason: string | null;
  failureReason: string | null;
  /** The states passed through, in order, with how long each took. */
  transitions: {
    fromState: string | null;
    toState: string;
    reason: string | null;
    actor: string;
    actorId: string | null;
    durationMs: number | null;
    occurredAt: string;
    versions: {
      parserVersion: number | null;
      normalizationVersion: string | null;
      resolverVersion: string | null;
      mergePolicyVersion: string | null;
    };
  }[];
  /** Where it is, as a step number, for a progress display. */
  progress: { step: number; total: number; label: string };
}

const STEP_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  inspection_complete: 'Inspection complete',
  validation_passed: 'Validation passed',
  parsing: 'Parsing',
  observation_creation: 'Creating observations',
  identity_analysis: 'Resolving identities',
  intelligence_generation: 'Generating intelligence',
  report_generated: 'Report generated',
  persisted: 'Persisted',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** The happy path, for measuring progress. Terminal failure states are not steps. */
const HAPPY_PATH = LIFECYCLE_STATES.filter((s) => !TERMINAL.has(s) || s === 'completed');

export async function getBatchLifecycle(batchId: string): Promise<BatchLifecycleView | null> {
  const batch = await prisma.inmateIngestionBatch.findUnique({ where: { batchId } });
  if (!batch) return null;

  // Transitions carry a batchId without a relation, in keeping with the other soft
  // references in this schema, so they are fetched separately.
  const transitions = await prisma.inmateBatchTransition.findMany({
    where: { batchId },
    orderBy: [{ occurredAt: 'asc' }, { transitionId: 'asc' }],
  });

  const upload = await prisma.inmateRosterUpload.findFirst({
    where: { batchId },
    select: { uploadedByName: true, uploadedById: true },
  });
  const profile = batch.parserProfileId
    ? await prisma.inmateParserProfile.findUnique({
        where: { profileId: batch.parserProfileId },
        select: { label: true, version: true },
      })
    : null;

  return toView(batch, transitions, upload, profile);
}

function toView(
  batch: {
    batchId: string; facility: string; sourceFilename: string; sourceType: string;
    rosterDate: Date | null; lifecycleState: string; status: string; startedAt: Date;
    finishedAt: Date | null; closedAt: Date | null; cancelReason: string | null;
    failureReason: string | null; ingestedById: string | null; parserConfidence: number | null;
  },
  transitions: {
    fromState: string | null; toState: string; reason: string | null; actor: string;
    actorId: string | null; durationMs: number | null; occurredAt: Date;
    parserVersion: number | null; normalizationVersion: string | null;
    resolverVersion: string | null; mergePolicyVersion: string | null;
  }[],
  upload: { uploadedByName: string | null; uploadedById: string } | null,
  profile: { label: string; version: number } | null,
): BatchLifecycleView {
  const state = batch.lifecycleState as LifecycleState;
  const stepIndex = HAPPY_PATH.indexOf(state);

  return {
    batchId: batch.batchId,
    facility: batch.facility,
    filename: batch.sourceFilename,
    sourceType: batch.sourceType,
    rosterDate: batch.rosterDate?.toISOString().slice(0, 10) ?? null,
    lifecycleState: state,
    status: batch.status,
    isTerminal: TERMINAL.has(state),
    operator: upload?.uploadedByName ?? upload?.uploadedById ?? batch.ingestedById ?? null,
    parserProfile: profile ? `${profile.label} (v${profile.version})` : null,
    parserConfidence: batch.parserConfidence,
    startedAt: batch.startedAt.toISOString(),
    finishedAt: batch.finishedAt?.toISOString() ?? null,
    totalDurationMs: batch.finishedAt ? batch.finishedAt.getTime() - batch.startedAt.getTime() : null,
    closedAt: batch.closedAt?.toISOString() ?? null,
    cancelReason: batch.cancelReason,
    failureReason: batch.failureReason,
    transitions: transitions.map((t) => ({
      fromState: t.fromState,
      toState: t.toState,
      reason: t.reason,
      actor: t.actor,
      actorId: t.actorId,
      durationMs: t.durationMs,
      occurredAt: t.occurredAt.toISOString(),
      versions: {
        parserVersion: t.parserVersion,
        normalizationVersion: t.normalizationVersion,
        resolverVersion: t.resolverVersion,
        mergePolicyVersion: t.mergePolicyVersion,
      },
    })),
    progress: {
      // A failed or cancelled batch reports the step it reached rather than 0, because
      // "failed at step 5 of 10" is the useful thing to show.
      step: stepIndex >= 0 ? stepIndex + 1 : Math.max(1, transitions.length),
      total: HAPPY_PATH.length,
      label: STEP_LABELS[state] ?? state,
    },
  };
}

/**
 * Close a batch.
 *
 * The last step of the daily workflow: the operator has read the intelligence and
 * printed the report, and says so. A closed batch is not a different lifecycle state —
 * it is already `completed` — but it records that a person finished with it, which is
 * what distinguishes "the import worked" from "somebody looked at it".
 */
export async function closeBatch(args: {
  batchId: string;
  actorId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const batch = await prisma.inmateIngestionBatch.findUnique({
    where: { batchId: args.batchId },
    select: { lifecycleState: true, closedAt: true },
  });
  if (!batch) return { ok: false, reason: 'No such batch.' };
  if (batch.closedAt) return { ok: true };
  if (batch.lifecycleState !== 'completed') {
    return {
      ok: false,
      reason: `The batch is ${batch.lifecycleState}. Only a completed batch can be closed — closing one that failed would record that somebody signed off on an import that did not finish.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.inmateIngestionBatch.update({
      where: { batchId: args.batchId },
      data: { closedAt: new Date(), closedById: args.actorId },
    });
    await tx.inmateBatchTransition.create({
      data: {
        batchId: args.batchId,
        fromState: 'completed',
        toState: 'completed',
        reason: 'Closed by the operator, having reviewed the intelligence.',
        actorId: args.actorId,
        actor: 'manual',
      },
    });
  });

  return { ok: true };
}

/** Cancel a batch that is stuck or was started by mistake. */
export async function cancelBatch(args: {
  batchId: string;
  actorId: string;
  reason: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!args.reason.trim()) {
    return { ok: false, reason: 'A cancellation needs a reason, or the audit trail records only that someone stopped it.' };
  }
  const outcome = await transition(prisma, {
    batchId: args.batchId,
    to: 'cancelled',
    reason: args.reason.trim(),
    actorId: args.actorId,
    actor: 'manual',
  });
  return outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason };
}
