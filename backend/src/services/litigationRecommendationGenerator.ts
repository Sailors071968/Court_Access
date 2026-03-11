// ============================================================================
// Phase 291.2 — Litigation Recommendation Generator
// Connects all 5 recommendation engines to real evidence outputs.
// Consumes: timeline events, officer actions, policy comparison results,
//           entity extraction results
// Phase 291.3 — Evidence Citation Linking: every recommendation links to
//               evidence file ID, timestamp, document paragraph reference
// ============================================================================

import type { ExtractedEvent } from '../evidence/eventExtractionService';
import type { TimelineEntry } from '../evidence/officerActionTimelineService';
import type { FindingOutput } from '../evidence/policyComplianceAnalyzer';
import type { EntityExtraction, EvidenceFile, ProcessedEvidenceData } from './evidenceIntelligenceIntegration';
import type { EvidenceLink, LitigationRecommendation, RecommendationType } from './litigationRecommendationSchema';
import { InvestigativeTaskEngine } from './investigativeTaskEngine';
import { MotionRecommendationEngine } from './motionRecommendationEngine';
import { SubpoenaRecommendationEngine } from './subpoenaRecommendationEngine';
import { PublicRecordsRecommendationEngine } from './publicRecordsRecommendationEngine';
import { ExpertRecommendationEngine } from './expertRecommendationEngine';
import { LITIGATION_INTELLIGENCE_DISCLAIMER } from './litigationRecommendationSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecommendationGeneratorOutput {
  caseId: string;
  generatedAt: string;
  disclaimer: string;
  recommendations: LitigationRecommendation[];
  duplicatesRemoved: number;
  totalByType: Record<RecommendationType, number>;
}

// ---------------------------------------------------------------------------
// Evidence Observation Extractor
// ---------------------------------------------------------------------------

/**
 * Transform processed evidence data into observation strings
 * that can be consumed by the 5 recommendation engines.
 */
function extractObservationsFromEvidence(data: ProcessedEvidenceData): Array<{
  source: string;
  observation: string;
  fileId: string;
  timestamp?: string;
  paragraph?: string;
}> {
  const observations: Array<{
    source: string;
    observation: string;
    fileId: string;
    timestamp?: string;
    paragraph?: string;
  }> = [];

  // 1. Extract observations from timeline events
  for (const event of data.extractedEvents) {
    const file = data.evidenceFiles.find(f => f.fileId === event.sourceEvidence);
    observations.push({
      source: file?.fileName ?? event.sourceEvidence,
      observation: buildObservationFromEvent(event),
      fileId: event.sourceEvidence,
      timestamp: event.timestamp,
    });
  }

  // 2. Extract observations from policy findings
  for (const finding of data.policyFindings) {
    const evidenceLink = finding.evidenceLinks.find(l => l.linkType === 'video_timestamp');
    observations.push({
      source: finding.policyReference,
      observation: finding.explanation,
      fileId: evidenceLink?.sourceReference ?? '',
      timestamp: finding.evidenceTimestamp,
    });
  }

  // 3. Extract observations from entity extractions
  for (const entity of data.entityExtractions) {
    const file = data.evidenceFiles.find(f => f.fileId === entity.sourceFileId);
    if (entity.entityType === 'officer' || entity.entityType === 'witness') {
      observations.push({
        source: file?.fileName ?? entity.sourceFileId,
        observation: `${entity.entityType} "${entity.name}" referenced in evidence`,
        fileId: entity.sourceFileId,
        timestamp: entity.sourceTimestamp,
        paragraph: entity.sourceParagraph,
      });
    }
  }

  // 4. Extract observations from OCR text / transcripts
  for (const file of data.evidenceFiles) {
    const text = file.ocrText ?? file.transcript ?? '';
    if (!text) continue;

    // Extract key sentences that may trigger recommendations
    const paragraphs = text.split(/\n\n+/);
    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx].trim();
      if (para.length < 20) continue;

      // Only include paragraphs with actionable keywords
      if (containsActionableKeywords(para)) {
        observations.push({
          source: file.fileName,
          observation: para.substring(0, 500),
          fileId: file.fileId,
          paragraph: `Paragraph ${pIdx + 1}`,
        });
      }
    }
  }

  return observations;
}

/**
 * Build a human-readable observation string from an extracted event
 */
function buildObservationFromEvent(event: ExtractedEvent): string {
  const action = event.eventType.replace(/_/g, ' ');
  const source = event.sourceType.replace(/_/g, ' ');
  const rawExcerpt = event.rawText ? ` — "${event.rawText.substring(0, 200)}"` : '';
  return `${action} detected in ${source} at ${event.timestamp}${rawExcerpt}`;
}

/**
 * Check if a text paragraph contains keywords that may trigger recommendations
 */
function containsActionableKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'force', 'restrain', 'taser', 'weapon', 'pursuit', 'search',
    'miranda', 'rights', 'custody', 'arrest', 'handcuff',
    'witness', 'not interviewed', 'unidentified', 'surveillance', 'camera',
    'phone', 'communication', 'dispatch', 'radio',
    'gap', 'unaccounted', 'missing', 'withheld', 'redacted',
    'policy', 'procedure', 'training', 'guideline',
    'injur', 'medical', 'hospital', 'ambulance',
    'complaint', 'prior incident', 'disciplin',
    'bodycam', 'body camera', 'bwc', 'activation',
    'discovery', 'not disclosed', 'brady',
    'digital', 'metadata', 'timestamp',
    'collision', 'crash', 'impact',
    'low-quality', 'blurry', 'enhance',
    'audio', 'inaudible', 'recording',
    'officer', 'multiple', 'prior',
  ];
  return keywords.some(kw => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Generate a deduplication key for a recommendation
 */
function generateDeduplicationKey(rec: LitigationRecommendation): string {
  const normalized = rec.suggestedOpportunity.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
  return `${rec.caseId}:${rec.recommendationType}:${normalized}`;
}

/**
 * Remove duplicate recommendations, keeping the highest confidence one
 */
function deduplicateRecommendations(recs: LitigationRecommendation[]): {
  unique: LitigationRecommendation[];
  removed: number;
} {
  const seen = new Map<string, LitigationRecommendation>();
  let removed = 0;

  for (const rec of recs) {
    const key = rec.deduplicationKey ?? generateDeduplicationKey(rec);
    const existing = seen.get(key);
    if (existing) {
      removed++;
      if (rec.confidenceScore > existing.confidenceScore) {
        seen.set(key, rec);
      }
    } else {
      seen.set(key, { ...rec, deduplicationKey: key });
    }
  }

  return { unique: Array.from(seen.values()), removed };
}

// ---------------------------------------------------------------------------
// Evidence Citation Builder (Phase 291.3)
// ---------------------------------------------------------------------------

/**
 * Build evidence citation links for a recommendation from observation metadata
 */
function buildEvidenceCitations(
  obs: { source: string; fileId: string; timestamp?: string; paragraph?: string },
  files: EvidenceFile[],
): EvidenceLink[] {
  const file = files.find(f => f.fileId === obs.fileId);
  const links: EvidenceLink[] = [];

  links.push({
    evidenceFileId: obs.fileId,
    evidenceFileName: file?.fileName ?? obs.source,
    timestamp: obs.timestamp,
    documentParagraph: obs.paragraph,
  });

  return links;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export class LitigationRecommendationGenerator {
  /**
   * Generate all litigation recommendations from processed evidence data.
   * Runs all 5 engines and merges results with evidence citations.
   */
  static generate(data: ProcessedEvidenceData): RecommendationGeneratorOutput {
    const observations = extractObservationsFromEvidence(data);

    // Convert to engine input format
    const engineInput = observations.map(obs => ({
      source: obs.source,
      observation: obs.observation,
    }));

    // Run all 5 engines
    const investigativeTasks = InvestigativeTaskEngine.generateTasks(data.caseId, engineInput);
    const motionRecs = MotionRecommendationEngine.generateRecommendations(data.caseId, engineInput);
    const subpoenaRecs = SubpoenaRecommendationEngine.generateRecommendations(data.caseId, engineInput);
    const publicRecordRecs = PublicRecordsRecommendationEngine.generateRecommendations(data.caseId, engineInput);
    const expertRecs = ExpertRecommendationEngine.generateRecommendations(data.caseId, engineInput);

    // Transform all engine outputs to unified LitigationRecommendation format
    // with evidence citations (Phase 291.3)
    const allRecommendations: LitigationRecommendation[] = [];

    // Map investigative tasks
    for (const task of investigativeTasks) {
      const matchingObs = observations.find(o => o.source === task.evidenceSource);
      allRecommendations.push({
        id: task.id,
        caseId: task.caseId,
        recommendationType: 'INVESTIGATION',
        category: 'Investigative Opportunity',
        evidenceSource: task.evidenceSource,
        observation: task.observation,
        suggestedOpportunity: task.suggestedOpportunity,
        confidenceScore: task.confidenceScore,
        timestamp: task.timestamp,
        evidenceLinks: matchingObs ? buildEvidenceCitations(matchingObs, data.evidenceFiles) : [],
      });
    }

    // Map motion recommendations
    for (const rec of motionRecs) {
      const matchingObs = observations.find(o => o.source === rec.evidenceSource);
      allRecommendations.push({
        id: rec.id,
        caseId: rec.caseId,
        recommendationType: 'MOTION',
        category: `Procedural Opportunity — ${rec.motionType}`,
        evidenceSource: rec.evidenceSource,
        observation: rec.observation,
        suggestedOpportunity: rec.suggestedOpportunity,
        confidenceScore: rec.confidenceScore,
        timestamp: rec.timestamp,
        evidenceLinks: matchingObs ? buildEvidenceCitations(matchingObs, data.evidenceFiles) : [],
      });
    }

    // Map subpoena recommendations
    for (const rec of subpoenaRecs) {
      const matchingObs = observations.find(o => o.source === rec.evidenceSource);
      allRecommendations.push({
        id: rec.id,
        caseId: rec.caseId,
        recommendationType: 'SUBPOENA',
        category: `Records to Obtain — ${rec.recordType}`,
        evidenceSource: rec.evidenceSource,
        observation: rec.observation,
        suggestedOpportunity: rec.suggestedOpportunity,
        confidenceScore: rec.confidenceScore,
        timestamp: rec.timestamp,
        evidenceLinks: matchingObs ? buildEvidenceCitations(matchingObs, data.evidenceFiles) : [],
      });
    }

    // Map public records recommendations
    for (const rec of publicRecordRecs) {
      const matchingObs = observations.find(o => o.source === rec.evidenceSource);
      allRecommendations.push({
        id: rec.id,
        caseId: rec.caseId,
        recommendationType: 'PUBLIC_RECORD',
        category: `Public Record — ${rec.recordCategory}`,
        evidenceSource: rec.evidenceSource,
        observation: rec.observation,
        suggestedOpportunity: rec.suggestedOpportunity,
        confidenceScore: rec.confidenceScore,
        timestamp: rec.timestamp,
        evidenceLinks: matchingObs ? buildEvidenceCitations(matchingObs, data.evidenceFiles) : [],
      });
    }

    // Map expert recommendations
    for (const rec of expertRecs) {
      const matchingObs = observations.find(o => o.source === rec.evidenceSource);
      allRecommendations.push({
        id: rec.id,
        caseId: rec.caseId,
        recommendationType: 'EXPERT',
        category: `Expert Consultation — ${rec.expertType}`,
        evidenceSource: rec.evidenceSource,
        observation: rec.observation,
        suggestedOpportunity: rec.suggestedOpportunity,
        confidenceScore: rec.confidenceScore,
        timestamp: rec.timestamp,
        evidenceLinks: matchingObs ? buildEvidenceCitations(matchingObs, data.evidenceFiles) : [],
      });
    }

    // Deduplicate
    const { unique, removed } = deduplicateRecommendations(allRecommendations);

    // Count by type
    const totalByType: Record<RecommendationType, number> = {
      INVESTIGATION: 0,
      MOTION: 0,
      SUBPOENA: 0,
      PUBLIC_RECORD: 0,
      EXPERT: 0,
    };
    for (const rec of unique) {
      totalByType[rec.recommendationType]++;
    }

    return {
      caseId: data.caseId,
      generatedAt: new Date().toISOString(),
      disclaimer: LITIGATION_INTELLIGENCE_DISCLAIMER,
      recommendations: unique,
      duplicatesRemoved: removed,
      totalByType,
    };
  }
}
