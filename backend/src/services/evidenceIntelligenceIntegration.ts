// ============================================================================
// Phase 291.1 — Evidence Intelligence Integration Service
// Connects CaseAnalysisEngine to the real evidence processing pipeline.
// Consumes: evidence transcripts, OCR text, extracted timeline events,
//           OfficerActionEvent records, policy comparison results
// ============================================================================

import type { ExtractedEvent } from '../evidence/eventExtractionService';
import type { TimelineEntry, OfficerTimeline } from '../evidence/officerActionTimelineService';
import type { FindingOutput } from '../evidence/policyComplianceAnalyzer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceFile {
  fileId: string;
  fileName: string;
  fileType: 'police_report' | 'bodycam_transcript' | 'witness_statement' | 'dispatch_log' | 'forensic_report' | 'dashcam_transcript' | 'audio_transcript' | 'scene_photos';
  uploadedAt: string;
  ocrText?: string;
  transcript?: string;
  pageCount?: number;
}

export interface ProcessedEvidenceData {
  caseId: string;
  evidenceFiles: EvidenceFile[];
  extractedEvents: ExtractedEvent[];
  timelineEntries: TimelineEntry[];
  officerTimeline: OfficerTimeline | null;
  policyFindings: FindingOutput[];
  entityExtractions: EntityExtraction[];
}

export interface EntityExtraction {
  entityId: string;
  entityType: 'officer' | 'witness' | 'suspect' | 'location' | 'vehicle' | 'weapon' | 'evidence_item';
  name: string;
  sourceFileId: string;
  sourceTimestamp?: string;
  sourceParagraph?: string;
  confidence: number;
}

export interface CaseAnalysisOutput {
  caseId: string;
  generatedAt: string;
  analysisVersion: number;
  evidenceSummary: EvidenceSummaryOutput[];
  timelineEvents: TimelineEventOutput[];
  crossDocComparisons: CrossDocComparisonOutput[];
  officerActions: OfficerActionOutput[];
  policyComparisons: PolicyComparisonOutput[];
  inconsistencies: InconsistencyOutput[];
  recommendedExhibits: RecommendedExhibitOutput[];
}

export interface EvidenceSummaryOutput {
  type: string;
  count: number;
  iconType: string;
}

export interface TimelineEventOutput {
  id: string;
  timestamp: string;
  source: string;
  sourceFileId: string;
  description: string;
  sourceType: 'bodycam' | 'dispatch' | '911' | 'officer_report' | 'witness';
  confidence: number;
}

export interface CrossDocComparisonOutput {
  id: string;
  sourceA: string;
  sourceAFileId: string;
  sourceB: string;
  sourceBFileId: string;
  observation: string;
  severity: 'high' | 'medium' | 'low';
}

export interface OfficerActionOutput {
  id: string;
  officerId: string;
  actionType: string;
  timestamp: string;
  evidenceSource: string;
  evidenceFileId: string;
  confidence: number;
}

export interface PolicyComparisonOutput {
  id: string;
  officerAction: string;
  policyReference: string;
  observation: string;
  evidenceFileId: string;
  findingId: string;
  confidence: number;
}

export interface InconsistencyOutput {
  id: string;
  type: string;
  description: string;
  sources: Array<{ label: string; fileId: string; timestamp?: string; paragraph?: string }>;
  severity: 'high' | 'medium' | 'low';
}

export interface RecommendedExhibitOutput {
  id: string;
  title: string;
  type: string;
  linkedEvidence: Array<{ label: string; fileId: string }>;
}

// ---------------------------------------------------------------------------
// Evidence Intelligence Integration Engine
// ---------------------------------------------------------------------------

export class EvidenceIntelligenceIntegration {
  /**
   * Generate complete case analysis from processed evidence data.
   * This is the main entry point that connects the evidence pipeline
   * to the CaseAnalysisSection frontend component.
   */
  static generateCaseAnalysis(data: ProcessedEvidenceData): CaseAnalysisOutput {
    const evidenceSummary = EvidenceIntelligenceIntegration.buildEvidenceSummary(data.evidenceFiles);
    const timelineEvents = EvidenceIntelligenceIntegration.buildTimeline(data.extractedEvents, data.evidenceFiles);
    const crossDocComparisons = EvidenceIntelligenceIntegration.detectCrossDocInconsistencies(data.extractedEvents, data.evidenceFiles);
    const officerActions = EvidenceIntelligenceIntegration.extractOfficerActions(data.extractedEvents, data.entityExtractions, data.evidenceFiles);
    const policyComparisons = EvidenceIntelligenceIntegration.mapPolicyFindings(data.policyFindings, data.evidenceFiles);
    const inconsistencies = EvidenceIntelligenceIntegration.detectInconsistencies(data.extractedEvents, data.evidenceFiles, data.officerTimeline);
    const recommendedExhibits = EvidenceIntelligenceIntegration.generateExhibitRecommendations(inconsistencies, policyComparisons, data.evidenceFiles);

    return {
      caseId: data.caseId,
      generatedAt: new Date().toISOString(),
      analysisVersion: Date.now(),
      evidenceSummary,
      timelineEvents,
      crossDocComparisons,
      officerActions,
      policyComparisons,
      inconsistencies,
      recommendedExhibits,
    };
  }

  /**
   * Build evidence summary counts from uploaded files
   */
  private static buildEvidenceSummary(files: EvidenceFile[]): EvidenceSummaryOutput[] {
    const typeMap: Record<string, { label: string; iconType: string }> = {
      police_report: { label: 'Police Reports', iconType: 'FileText' },
      bodycam_transcript: { label: 'Bodycam Videos', iconType: 'Video' },
      dashcam_transcript: { label: 'Dashcam Videos', iconType: 'Video' },
      witness_statement: { label: 'Witness Statements', iconType: 'Users' },
      dispatch_log: { label: 'Dispatch Audio', iconType: 'Radio' },
      forensic_report: { label: 'Forensic Reports', iconType: 'FileSearch' },
      audio_transcript: { label: 'Audio Recordings', iconType: 'Mic' },
      scene_photos: { label: 'Scene Photos', iconType: 'Camera' },
    };

    const counts: Record<string, number> = {};
    for (const file of files) {
      counts[file.fileType] = (counts[file.fileType] || 0) + 1;
    }

    return Object.entries(counts).map(([type, count]) => ({
      type: typeMap[type]?.label ?? type,
      count,
      iconType: typeMap[type]?.iconType ?? 'FileText',
    }));
  }

  /**
   * Build chronological timeline from extracted events
   */
  private static buildTimeline(events: ExtractedEvent[], files: EvidenceFile[]): TimelineEventOutput[] {
    const fileMap = new Map(files.map(f => [f.fileId, f]));

    return events
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((event, index) => {
        const sourceFile = fileMap.get(event.sourceEvidence);
        const sourceTypeMap: Record<string, TimelineEventOutput['sourceType']> = {
          bodycam: 'bodycam',
          dashcam: 'bodycam',
          audio: 'dispatch',
          transcript: 'bodycam',
          police_report: 'officer_report',
        };

        return {
          id: `t-${index + 1}`,
          timestamp: event.timestamp,
          source: sourceFile?.fileName ?? event.sourceEvidence,
          sourceFileId: event.sourceEvidence,
          description: event.description ?? `${event.eventType.replace(/_/g, ' ')} detected`,
          sourceType: sourceTypeMap[event.sourceType] ?? 'officer_report',
          confidence: event.confidence,
        };
      });
  }

  /**
   * Detect cross-document inconsistencies by comparing events from different sources
   * at overlapping timestamps
   */
  private static detectCrossDocInconsistencies(events: ExtractedEvent[], files: EvidenceFile[]): CrossDocComparisonOutput[] {
    const comparisons: CrossDocComparisonOutput[] = [];
    const fileMap = new Map(files.map(f => [f.fileId, f]));

    // Group events by approximate timestamp (within 60 seconds)
    const timeGroups = new Map<string, ExtractedEvent[]>();
    for (const event of events) {
      const ts = event.timestamp.substring(0, 5); // group by HH:MM
      const group = timeGroups.get(ts) ?? [];
      group.push(event);
      timeGroups.set(ts, group);
    }

    let compId = 0;
    for (const [, group] of timeGroups) {
      // Compare events from different sources at similar timestamps
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (a.sourceEvidence === b.sourceEvidence) continue;

          // Detect contradictory event types
          const contradiction = EvidenceIntelligenceIntegration.detectContradiction(a, b);
          if (contradiction) {
            compId++;
            const fileA = fileMap.get(a.sourceEvidence);
            const fileB = fileMap.get(b.sourceEvidence);
            comparisons.push({
              id: `cd-${compId}`,
              sourceA: `${fileA?.fileName ?? a.sourceEvidence} (${a.timestamp})`,
              sourceAFileId: a.sourceEvidence,
              sourceB: `${fileB?.fileName ?? b.sourceEvidence} (${b.timestamp})`,
              sourceBFileId: b.sourceEvidence,
              observation: contradiction.observation,
              severity: contradiction.severity,
            });
          }
        }
      }
    }

    return comparisons;
  }

  /**
   * Check if two events from different sources contradict each other
   */
  private static detectContradiction(a: ExtractedEvent, b: ExtractedEvent): { observation: string; severity: 'high' | 'medium' | 'low' } | null {
    // Compliance command vs physical force at same time
    if (
      (a.eventType === 'de_escalation_attempt' && b.eventType === 'physical_strike') ||
      (a.eventType === 'physical_strike' && b.eventType === 'de_escalation_attempt')
    ) {
      return {
        observation: `De-escalation attempt reported at ${a.timestamp} while physical force detected at same time. Potential narrative discrepancy.`,
        severity: 'high',
      };
    }

    // Verbal command sequence inconsistency
    if (
      (a.eventType === 'verbal_command' && (b.eventType === 'physical_strike' || b.eventType === 'taser_deployed')) ||
      ((a.eventType === 'physical_strike' || a.eventType === 'taser_deployed') && b.eventType === 'verbal_command')
    ) {
      return {
        observation: `Force application and verbal command occur at overlapping timestamps (${a.timestamp}). Review force continuum compliance.`,
        severity: 'medium',
      };
    }

    // Different descriptions of same moment from different sources
    if (a.eventType !== b.eventType && a.sourceType !== b.sourceType) {
      const rawA = a.rawText?.toLowerCase() ?? '';
      const rawB = b.rawText?.toLowerCase() ?? '';
      if (
        (rawA.includes('running') && rawB.includes('stationary')) ||
        (rawA.includes('stationary') && rawB.includes('running')) ||
        (rawA.includes('resisting') && rawB.includes('compliant')) ||
        (rawA.includes('compliant') && rawB.includes('resisting'))
      ) {
        return {
          observation: `Conflicting descriptions between ${a.sourceType} and ${b.sourceType} at ${a.timestamp}. One source describes different subject behavior.`,
          severity: 'high',
        };
      }
    }

    return null;
  }

  /**
   * Extract officer actions from events and entity extractions
   */
  private static extractOfficerActions(
    events: ExtractedEvent[],
    entities: EntityExtraction[],
    files: EvidenceFile[],
  ): OfficerActionOutput[] {
    const fileMap = new Map(files.map(f => [f.fileId, f]));
    const officerEntities = entities.filter(e => e.entityType === 'officer');

    // Map events to officer actions
    const UOF_TYPES = new Set([
      'suspect_restrained', 'taser_deployed', 'neck_restraint', 'physical_strike',
      'weapon_drawn', 'baton_strike', 'pepper_spray', 'k9_deployment',
      'shots_fired', 'prone_restraint', 'handcuffing', 'vehicle_search',
      'pat_down_search', 'foot_pursuit', 'vehicle_pursuit',
    ]);

    return events
      .filter(e => UOF_TYPES.has(e.eventType))
      .map((event, index) => {
        // Try to match officer entity to event
        const matchedOfficer = officerEntities.find(o =>
          o.sourceFileId === event.sourceEvidence ||
          o.sourceTimestamp === event.timestamp
        );
        const sourceFile = fileMap.get(event.sourceEvidence);

        return {
          id: `oa-${index + 1}`,
          officerId: matchedOfficer?.name ?? 'Unknown Officer',
          actionType: event.eventType.replace(/_/g, ' '),
          timestamp: event.timestamp,
          evidenceSource: sourceFile?.fileName ?? event.sourceEvidence,
          evidenceFileId: event.sourceEvidence,
          confidence: event.confidence,
        };
      });
  }

  /**
   * Map policy compliance findings to frontend-consumable format
   */
  private static mapPolicyFindings(findings: FindingOutput[], files: EvidenceFile[]): PolicyComparisonOutput[] {
    return findings.map((finding, index) => {
      // Find evidence file from evidence links
      const evidenceLink = finding.evidenceLinks.find(l => l.linkType === 'video_timestamp');
      const evidenceFileId = evidenceLink?.sourceReference ?? '';

      return {
        id: `pc-${index + 1}`,
        officerAction: finding.detectedAction.replace(/_/g, ' '),
        policyReference: finding.policyReference,
        observation: finding.explanation,
        evidenceFileId,
        findingId: finding.findingId,
        confidence: finding.confidence,
      };
    });
  }

  /**
   * Detect inconsistencies across all evidence sources
   */
  private static detectInconsistencies(
    events: ExtractedEvent[],
    files: EvidenceFile[],
    timeline: OfficerTimeline | null,
  ): InconsistencyOutput[] {
    const inconsistencies: InconsistencyOutput[] = [];
    const fileMap = new Map(files.map(f => [f.fileId, f]));
    let incId = 0;

    // 1. Timeline sequence inconsistencies
    if (timeline && timeline.entries.length > 1) {
      for (let i = 1; i < timeline.entries.length; i++) {
        const prev = timeline.entries[i - 1];
        const curr = timeline.entries[i];

        // Check if force event occurs before any verbal commands
        const forceTypes = new Set(['physical_strike', 'taser_deployed', 'prone_restraint', 'baton_strike']);
        const commandTypes = new Set(['verbal_command', 'uof_warning', 'compliance_command']);

        if (forceTypes.has(curr.eventType) && commandTypes.has(prev.eventType) &&
            curr.timestampSeconds < prev.timestampSeconds) {
          incId++;
          inconsistencies.push({
            id: `inc-${incId}`,
            type: 'timeline_conflict',
            description: `Force event (${curr.eventType.replace(/_/g, ' ')}) at ${curr.timestamp} appears to precede verbal command at ${prev.timestamp}. Timeline sequence inconsistency.`,
            sources: [
              { label: curr.sourceEvidence, fileId: curr.sourceEvidence, timestamp: curr.timestamp },
              { label: prev.sourceEvidence, fileId: prev.sourceEvidence, timestamp: prev.timestamp },
            ],
            severity: 'high',
          });
        }
      }
    }

    // 2. Report vs camera inconsistencies
    const reportEvents = events.filter(e => e.sourceType === 'police_report');
    const cameraEvents = events.filter(e => e.sourceType === 'bodycam' || e.sourceType === 'dashcam');

    for (const reportEvent of reportEvents) {
      // Check if report claims events not corroborated by camera
      const corroborated = cameraEvents.some(ce =>
        ce.eventType === reportEvent.eventType &&
        Math.abs(parseTimestamp(ce.timestamp) - parseTimestamp(reportEvent.timestamp)) < 120
      );

      if (!corroborated && reportEvent.confidence >= 0.7) {
        incId++;
        const reportFile = fileMap.get(reportEvent.sourceEvidence);
        inconsistencies.push({
          id: `inc-${incId}`,
          type: 'report_vs_camera',
          description: `Officer report claims ${reportEvent.eventType.replace(/_/g, ' ')} at ${reportEvent.timestamp}. No corroborating camera footage found within 2 minutes.`,
          sources: [
            { label: reportFile?.fileName ?? reportEvent.sourceEvidence, fileId: reportEvent.sourceEvidence, paragraph: reportEvent.rawText?.substring(0, 80) },
          ],
          severity: reportEvent.eventType.includes('force') || reportEvent.eventType.includes('strike') ? 'high' : 'medium',
        });
      }
    }

    // 3. OCR text inconsistencies between witness statements
    const witnessFiles = files.filter(f => f.fileType === 'witness_statement');
    if (witnessFiles.length >= 2) {
      for (let i = 0; i < witnessFiles.length; i++) {
        for (let j = i + 1; j < witnessFiles.length; j++) {
          const textA = (witnessFiles[i].ocrText ?? witnessFiles[i].transcript ?? '').toLowerCase();
          const textB = (witnessFiles[j].ocrText ?? witnessFiles[j].transcript ?? '').toLowerCase();

          // Check for contradictory descriptions (symmetric — checks both directions)
          if (
            ((textA.includes('hands up') && textB.includes('reaching')) || (textB.includes('hands up') && textA.includes('reaching'))) ||
            ((textA.includes('compliant') && textB.includes('aggressive')) || (textB.includes('compliant') && textA.includes('aggressive'))) ||
            ((textA.includes('standing still') && textB.includes('running')) || (textB.includes('standing still') && textA.includes('running')))
          ) {
            incId++;
            inconsistencies.push({
              id: `inc-${incId}`,
              type: 'statement_vs_statement',
              description: `Witness statements contain contradictory descriptions of subject behavior. Review both accounts for reconciliation.`,
              sources: [
                { label: witnessFiles[i].fileName, fileId: witnessFiles[i].fileId },
                { label: witnessFiles[j].fileName, fileId: witnessFiles[j].fileId },
              ],
              severity: 'medium',
            });
          }
        }
      }
    }

    return inconsistencies;
  }

  /**
   * Generate exhibit recommendations based on detected inconsistencies and policy findings
   */
  private static generateExhibitRecommendations(
    inconsistencies: InconsistencyOutput[],
    policyComparisons: PolicyComparisonOutput[],
    files: EvidenceFile[],
  ): RecommendedExhibitOutput[] {
    const exhibits: RecommendedExhibitOutput[] = [];
    let exId = 0;

    // Timeline comparison exhibit for timeline conflicts
    const timelineConflicts = inconsistencies.filter(i => i.type === 'timeline_conflict');
    if (timelineConflicts.length > 0) {
      exId++;
      const sources = timelineConflicts.flatMap(tc => tc.sources);
      exhibits.push({
        id: `re-${exId}`,
        title: 'Timeline Comparison: Report vs Camera',
        type: 'timeline',
        linkedEvidence: sources.map(s => ({ label: s.label, fileId: s.fileId })),
      });
    }

    // Cross-document comparison exhibit for report vs camera
    const reportCameraConflicts = inconsistencies.filter(i => i.type === 'report_vs_camera');
    if (reportCameraConflicts.length > 0) {
      exId++;
      const sources = reportCameraConflicts.flatMap(tc => tc.sources);
      exhibits.push({
        id: `re-${exId}`,
        title: 'Officer Report vs Camera Visual Comparison',
        type: 'comparison',
        linkedEvidence: sources.map(s => ({ label: s.label, fileId: s.fileId })),
      });
    }

    // Policy compliance exhibit
    if (policyComparisons.length > 0) {
      exId++;
      exhibits.push({
        id: `re-${exId}`,
        title: 'Policy Compliance Analysis Exhibit',
        type: 'policy',
        linkedEvidence: policyComparisons.map(pc => ({ label: pc.policyReference, fileId: pc.evidenceFileId })),
      });
    }

    // Scene reconstruction if we have bodycam + photos
    const hasBodycam = files.some(f => f.fileType === 'bodycam_transcript');
    const hasPhotos = files.some(f => f.fileType === 'scene_photos');
    if (hasBodycam && hasPhotos) {
      exId++;
      exhibits.push({
        id: `re-${exId}`,
        title: 'Scene Reconstruction from Multiple Sources',
        type: 'scene',
        linkedEvidence: files
          .filter(f => f.fileType === 'bodycam_transcript' || f.fileType === 'scene_photos')
          .map(f => ({ label: f.fileName, fileId: f.fileId })),
      });
    }

    return exhibits;
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
