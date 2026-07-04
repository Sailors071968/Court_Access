// ============================================================================
// Case Analysis API Service
// Builds evidence-governed case analysis for attorney UI from DB data.
// ============================================================================

import prisma from '../lib/prisma.js';
import type { ExtractedEvent } from '../evidence/eventExtractionService.js';
import {
  EvidenceIntelligenceIntegration,
  type CaseAnalysisOutput,
  type EvidenceFile,
  type ProcessedEvidenceData,
} from './evidenceIntelligenceIntegration.js';
import { buildOfficerTimeline } from '../evidence/officerActionTimelineService.js';
import { caseAnalysisCache } from './caseAnalysisCacheService.js';

export interface CaseAnalysisResponse extends CaseAnalysisOutput {
  unknowns: string[];
  fromCache: boolean;
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

function buildEvidenceFingerprint(evidenceIds: string[]): string {
  return evidenceIds.slice().sort().join('|');
}

function toExtractedEvent(
  event: {
    eventId: string;
    caseId: string;
    timestamp: string;
    eventType: string;
    confidence: number;
    sourceEvidence: string;
    sourceType: string;
    description: string | null;
    rawText: string | null;
  },
): ExtractedEvent {
  return {
    caseId: event.caseId,
    timestamp: event.timestamp,
    eventType: event.eventType,
    confidence: event.confidence,
    sourceEvidence: event.sourceEvidence,
    sourceType: event.sourceType as ExtractedEvent['sourceType'],
    description: event.description ?? undefined,
    rawText: event.rawText ?? undefined,
  };
}

export async function buildCaseAnalysisResponse(
  caseId: string,
  tenantId: string,
): Promise<CaseAnalysisResponse> {
  const evidenceList = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    orderBy: { uploadedAt: 'desc' },
  });

  const evidenceIds = evidenceList.map((e) => e.evidenceId);
  const fingerprint = buildEvidenceFingerprint(evidenceIds);

  const cached = caseAnalysisCache.getAnalysis(caseId);
  if (cached) {
    return { ...cached, unknowns: [], fromCache: true };
  }

  const [chunks, evidenceEvents, complianceFindings] = await Promise.all([
    evidenceIds.length > 0
      ? prisma.evidenceChunk.findMany({
          where: { tenantId, evidenceId: { in: evidenceIds } },
          orderBy: { chunkIndex: 'asc' },
        })
      : Promise.resolve([]),
    prisma.evidenceEvent.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.complianceFinding.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

  const extractedEvents = evidenceEvents.map(toExtractedEvent);
  const officerTimeline = await buildOfficerTimeline(caseId).catch(() => null);

  const policyFindings = complianceFindings.map((finding) => ({
    findingId: finding.findingId,
    findingType: finding.findingType,
    policyReference: finding.policyReference,
    evidenceTimestamp: finding.evidenceTimestamp,
    detectedAction: finding.detectedAction,
    ruleDescription: finding.ruleDescription,
    confidence: finding.confidence,
    evidenceConfidence: finding.evidenceConfidence,
    ruleConfidence: finding.ruleConfidence,
    analysisConfidence: finding.analysisConfidence,
    explanation: finding.explanation ?? finding.ruleDescription,
    safetyLanguage: finding.safetyLanguage,
    evidenceLinks: finding.evidenceEventId
      ? [{ linkType: 'video_timestamp', sourceReference: finding.evidenceEventId }]
      : [],
  }));

  const processedData: ProcessedEvidenceData = {
    caseId,
    evidenceFiles,
    extractedEvents,
    timelineEntries: officerTimeline?.entries ?? [],
    officerTimeline,
    policyFindings,
    entityExtractions: [],
  };

  const analysis = EvidenceIntelligenceIntegration.generateCaseAnalysis(processedData);

  const unknowns: string[] = [];
  if (evidenceList.length === 0) {
    unknowns.push('No evidence uploaded — analysis requires case files.');
  }
  if (extractedEvents.length === 0 && evidenceList.length > 0) {
    unknowns.push('No extracted events — run evidence processing to populate timeline events.');
  }
  const pendingCount = evidenceList.filter((e) => e.processingStatus !== 'analyzed').length;
  if (pendingCount > 0) {
    unknowns.push(`${pendingCount} evidence file(s) still processing or unanalyzed.`);
  }

  caseAnalysisCache.setAnalysis(caseId, analysis, fingerprint);

  return { ...analysis, unknowns, fromCache: false };
}
