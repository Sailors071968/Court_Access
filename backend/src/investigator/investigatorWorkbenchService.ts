// ============================================================================
// Program 12 — Investigator Workbench Service
// Composes case data, intelligence gaps, and investigation persistence
// ============================================================================

import prisma from '../lib/prisma.js';
import { buildInvestigativeAnalysis } from '../intelligence/investigativeAnalysis.js';
import { buildCaseIntelligence } from '../intelligence/caseIntelligenceOrchestrator.js';
import type { InvestigatorWorkbenchBundle } from './types.js';
import { INVESTIGATOR_WORKBENCH_VERSION } from './types.js';

const PHOTO_TYPES = new Set(['photo', 'scene_photo']);
const VIDEO_TYPES = new Set(['bodycam', 'dashcam', 'witness_video', 'surveillance_video']);
const AUDIO_TYPES = new Set(['audio', 'dispatch_audio', '911_call']);

export async function buildInvestigatorWorkbench(
  caseId: string,
  tenantId: string,
): Promise<InvestigatorWorkbenchBundle | null> {
  const caseRecord = await prisma.criminalCase.findFirst({
    where: { caseId, tenantId, deletedAt: null },
  });
  if (!caseRecord) return null;

  const [
    evidence,
    timelineEvents,
    tasks,
    leads,
    witnesses,
    assignments,
    fieldNotes,
    intelligence,
  ] = await Promise.all([
    prisma.evidence.findMany({ where: { caseId, tenantId }, orderBy: { uploadedAt: 'desc' } }),
    prisma.timelineEvent.findMany({ where: { caseId, tenantId }, orderBy: { timestamp: 'asc' } }),
    prisma.investigationTask.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.investigationLead.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.caseWitness.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'asc' } }),
    prisma.investigationAssignment.findMany({ where: { caseId, tenantId } }),
    prisma.fieldNote.findMany({ where: { caseId, tenantId }, orderBy: { createdAt: 'desc' } }),
    buildCaseIntelligence(caseId, tenantId),
  ]);

  const investigative = await buildInvestigativeAnalysis(
    caseId,
    tenantId,
    timelineEvents.length,
    evidence.length,
  );

  // Index timeline actors not yet in witness table
  const witnessNames = new Set(witnesses.map((w) => w.name.toLowerCase()));
  const derivedWitnesses = timelineEvents
    .filter((e) => e.actor?.trim() && !witnessNames.has(e.actor.trim().toLowerCase()))
    .reduce((acc, e) => {
      const name = e.actor!.trim();
      if (!acc.has(name)) {
        acc.set(name, { name, timelineIds: [e.id] });
      } else {
        acc.get(name)!.timelineIds.push(e.id);
      }
      return acc;
    }, new Map<string, { name: string; timelineIds: string[] }>());

  const allWitnesses = [
    ...witnesses.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      status: w.status,
      interviewStatus: w.interviewStatus,
      contactPhone: w.contactPhone,
      sourceType: w.sourceType,
      citations: w.sourceId
        ? [{ type: w.sourceType ?? 'timeline', id: w.sourceId }]
        : [],
    })),
    ...[...derivedWitnesses.values()].map((d, i) => ({
      id: `derived-${i}`,
      name: d.name,
      role: 'timeline_actor',
      status: 'identified',
      interviewStatus: 'not_scheduled',
      contactPhone: null as string | null,
      sourceType: 'timeline' as string | null,
      citations: d.timelineIds.map((id) => ({ type: 'timeline', id })),
    })),
  ];

  const photos = evidence.filter((e) => PHOTO_TYPES.has(e.evidenceType));
  const videos = evidence.filter((e) => VIDEO_TYPES.has(e.evidenceType));
  const audio = evidence.filter((e) => AUDIO_TYPES.has(e.evidenceType));
  const other = evidence.filter(
    (e) => !PHOTO_TYPES.has(e.evidenceType) && !VIDEO_TYPES.has(e.evidenceType) && !AUDIO_TYPES.has(e.evidenceType),
  );

  return {
    generatedAt: new Date().toISOString(),
    version: INVESTIGATOR_WORKBENCH_VERSION,
    caseId,
    tenantId,
    dashboard: {
      caseTitle: caseRecord.title,
      caseNumber: caseRecord.caseNumber,
      phase: caseRecord.phase,
      assignmentCount: assignments.length,
      openTasks: tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
      openLeads: leads.filter((l) => l.status === 'open' || l.status === 'pursuing').length,
      witnessCount: allWitnesses.length,
      evidenceCount: evidence.length,
      unknownCount: intelligence?.unknowns.all.length ?? 0,
    },
    assignments: assignments.map((a) => ({
      id: a.id,
      investigatorId: a.investigatorId,
      role: a.role,
      status: a.status,
      assignedAt: a.assignedAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assignedTo: t.assignedTo,
      dueDate: t.dueDate?.toISOString() ?? null,
      sourceType: t.sourceType,
    })),
    leads: leads.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      status: l.status,
      priority: l.priority,
      assignedTo: l.assignedTo,
    })),
    witnesses: allWitnesses,
    interviews: allWitnesses.map((w) => ({
      witnessId: w.id,
      witnessName: w.name,
      interviewStatus: w.interviewStatus,
      scheduledAt: null,
      notes: witnesses.find((x) => x.id === w.id)?.notes ?? null,
    })),
    evidenceCollection: {
      photos: photos.map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, uploadedAt: e.uploadedAt.toISOString() })),
      videos: videos.map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, uploadedAt: e.uploadedAt.toISOString() })),
      audio: audio.map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, uploadedAt: e.uploadedAt.toISOString() })),
      other: other.map((e) => ({ evidenceId: e.evidenceId, fileName: e.fileName, evidenceType: e.evidenceType })),
    },
    chainOfCustody: evidence.map((e) => ({
      evidenceId: e.evidenceId,
      fileName: e.fileName,
      status: e.s3Key ? 'partial' : 'unknown',
      uploadedAt: e.uploadedAt.toISOString(),
      uploadedBy: e.uploadedBy,
    })),
    timeline: timelineEvents.map((e) => ({
      id: e.id,
      timestamp: e.timestamp?.toISOString() ?? null,
      description: e.description,
      actor: e.actor,
      conflictFlag: e.conflictFlag,
    })),
    fieldNotes: fieldNotes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      noteType: n.noteType,
      latitude: n.latitude,
      longitude: n.longitude,
      createdAt: n.createdAt.toISOString(),
    })),
    recommendedInvestigation: investigative.recommendedInvestigation,
    gaps: {
      evidence: investigative.evidenceGaps.map((g) => g.finding),
      witness: investigative.witnessGaps.map((g) => g.finding),
      timeline: investigative.timelineGaps.map((g) => g.finding),
    },
    unknowns: intelligence?.unknowns.all ?? [],
  };
}
