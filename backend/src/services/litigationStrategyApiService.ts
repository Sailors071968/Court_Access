// ============================================================================
// Litigation Strategy API Service
// Builds evidence-governed strategy response for attorney UI from DB data.
// ============================================================================

import prisma from '../lib/prisma.js';
import type { ProcessedEvidenceData, EvidenceFile } from './evidenceIntelligenceIntegration.js';
import type { ExtractedEvent } from '../evidence/eventExtractionService.js';
import { LitigationRecommendationGenerator } from './litigationRecommendationGenerator.js';

export interface LitigationStrategyObservation {
  id: string;
  evidenceSource: string;
  observation: string;
  timestamp: string;
}

export interface LitigationStrategyRecommendation {
  id: string;
  type: 'INVESTIGATION' | 'MOTION' | 'SUBPOENA' | 'PUBLIC_RECORD' | 'EXPERT';
  suggestedOpportunity: string;
  evidenceSource: string;
  confidenceScore: number;
  status: 'pending' | 'addressed' | 'dismissed';
}

export interface LitigationStrategyReadiness {
  label: string;
  score: number;
  maxScore: number;
}

export interface LitigationStrategyRoadmapStep {
  stepNumber: number;
  description: string;
  category: LitigationStrategyRecommendation['type'];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface LitigationStrategyResponse {
  caseId: string;
  generatedAt: string;
  disclaimer: string;
  observations: LitigationStrategyObservation[];
  recommendations: LitigationStrategyRecommendation[];
  readiness: LitigationStrategyReadiness[];
  roadmap: LitigationStrategyRoadmapStep[];
  unknowns: string[];
}

function mapEvidenceTypeToFileType(evidenceType: string): EvidenceFile['fileType'] {
  const map: Record<string, EvidenceFile['fileType']> = {
    police_report: 'police_report',
    bodycam: 'bodycam_transcript',
    dashcam: 'dashcam_transcript',
    witness_video: 'witness_statement',
    transcript: 'audio_transcript',
    dispatch_log: 'dispatch_log',
    forensic_report: 'forensic_report',
    photo: 'scene_photos',
  };
  return map[evidenceType] ?? 'police_report';
}

function buildExtractedEventsFromTimeline(
  caseId: string,
  events: Array<{
    id: string;
    timestamp: Date | null;
    timeText: string | null;
    actor: string | null;
    action: string | null;
    description: string;
    sourceDoc: string | null;
    sourceType: string | null;
    confidence: number | null;
  }>,
): ExtractedEvent[] {
  return events.map((event) => ({
    caseId,
    timestamp: event.timestamp?.toISOString() ?? event.timeText ?? 'UNKNOWN',
    eventType: (event.action ?? 'other').replace(/\s+/g, '_').toLowerCase(),
    confidence: event.confidence ?? 0.5,
    sourceEvidence: event.sourceDoc ?? 'timeline',
    sourceType: (event.sourceType as ExtractedEvent['sourceType']) ?? 'police_report',
    description: event.description,
    rawText: [event.actor, event.action, event.description].filter(Boolean).join(' — '),
  }));
}

export async function buildLitigationStrategyResponse(
  caseId: string,
  tenantId: string,
): Promise<LitigationStrategyResponse> {
  const evidenceList = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    orderBy: { uploadedAt: 'desc' },
  });

  const evidenceIds = evidenceList.map((e) => e.evidenceId);

  const [chunks, timelineEvents] = await Promise.all([
    evidenceIds.length > 0
      ? prisma.evidenceChunk.findMany({
          where: { tenantId, evidenceId: { in: evidenceIds } },
          orderBy: { chunkIndex: 'asc' },
        })
      : Promise.resolve([]),
    prisma.timelineEvent.findMany({
      where: { caseId, tenantId },
      orderBy: { timestamp: 'asc' },
    }),
  ]);

  const chunksByEvidence = new Map<string, string>();
  for (const chunk of chunks) {
    const existing = chunksByEvidence.get(chunk.evidenceId) ?? '';
    chunksByEvidence.set(chunk.evidenceId, existing + chunk.text + '\n');
  }

  const evidenceFiles: EvidenceFile[] = evidenceList.map((ev) => ({
    fileId: ev.evidenceId,
    fileName: ev.fileName,
    fileType: mapEvidenceTypeToFileType(ev.evidenceType),
    uploadedAt: ev.uploadedAt.toISOString(),
    ocrText: chunksByEvidence.get(ev.evidenceId),
    pageCount: ev.normalizedPageCount ?? ev.pageCount ?? undefined,
  }));

  const extractedEvents = buildExtractedEventsFromTimeline(caseId, timelineEvents);

  const processedData: ProcessedEvidenceData = {
    caseId,
    evidenceFiles,
    extractedEvents,
    timelineEntries: [],
    officerTimeline: null,
    policyFindings: [],
    entityExtractions: [],
  };

  const generatorOutput = LitigationRecommendationGenerator.generate(processedData);

  const observations: LitigationStrategyObservation[] = generatorOutput.recommendations
    .slice(0, 20)
    .map((rec, index) => ({
      id: `obs-${index + 1}`,
      evidenceSource: rec.evidenceSource,
      observation: rec.observation,
      timestamp: rec.timestamp ?? generatorOutput.generatedAt,
    }));

  const recommendations: LitigationStrategyRecommendation[] = generatorOutput.recommendations.map((rec) => ({
    id: rec.id,
    type: rec.recommendationType,
    suggestedOpportunity: rec.suggestedOpportunity,
    evidenceSource: rec.evidenceSource,
    confidenceScore: rec.confidenceScore,
    status: 'pending',
  }));

  const analyzedCount = evidenceList.filter((e) => e.processingStatus === 'analyzed').length;
  const totalEvidence = evidenceList.length;
  const timelineCount = timelineEvents.length;

  const readiness: LitigationStrategyReadiness[] = [
    {
      label: 'Evidence Uploaded',
      score: Math.min(totalEvidence, 10),
      maxScore: 10,
    },
    {
      label: 'Evidence Processed',
      score: analyzedCount,
      maxScore: Math.max(totalEvidence, 1),
    },
    {
      label: 'Timeline Events',
      score: Math.min(timelineCount, 10),
      maxScore: 10,
    },
    {
      label: 'Investigation Opportunities',
      score: Math.min(recommendations.filter((r) => r.type === 'INVESTIGATION').length, 5),
      maxScore: 5,
    },
  ];

  const roadmap: LitigationStrategyRoadmapStep[] = recommendations.slice(0, 8).map((rec, index) => ({
    stepNumber: index + 1,
    description: rec.suggestedOpportunity.substring(0, 120),
    category: rec.type,
    status: index === 0 && totalEvidence > 0 ? 'in_progress' : 'pending',
  }));

  const unknowns: string[] = [];
  if (totalEvidence === 0) {
    unknowns.push('No evidence uploaded — strategy cannot be generated from case files.');
  }
  if (timelineCount === 0) {
    unknowns.push('No timeline events — run case processing to extract chronological events.');
  }
  if (analyzedCount < totalEvidence) {
    unknowns.push(`${totalEvidence - analyzedCount} evidence file(s) still processing or unanalyzed.`);
  }

  return {
    caseId,
    generatedAt: generatorOutput.generatedAt,
    disclaimer: generatorOutput.disclaimer,
    observations,
    recommendations,
    readiness,
    roadmap,
    unknowns,
  };
}
