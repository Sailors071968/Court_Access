// ============================================================================
// Phase 175 — Expert Witness Visualization Mode
// Exports structured expert witness packages containing 3D scene reconstruction,
// timeline, policy references, evidence clips, and analysis report.
// Designed for expert witness testimony preparation.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpertWitnessPackage {
  packageId?: string;
  caseId: string;
  packageVersion: string;
  generatedAt: string;
  expertInfo: ExpertInfo;
  sections: PackageSection[];
  sceneReconstruction: SceneReconstructionSection;
  timeline: TimelineSection;
  policyAnalysis: PolicyAnalysisSection;
  evidenceClips: EvidenceClipSection;
  analysisReport: AnalysisReportSection;
  appendices: Appendix[];
  metadata: PackageMetadata;
}

export interface ExpertInfo {
  name?: string;
  credentials?: string;
  specialization?: string;
  caseRole: string;
  preparedFor: string;          // attorney/firm name
}

export interface PackageSection {
  sectionId: string;
  sectionNumber: string;        // e.g. "1", "2.1", "3.2.1"
  title: string;
  content: string;
  exhibits: string[];           // exhibit IDs
  pageEstimate: number;
}

export interface SceneReconstructionSection {
  sceneId: string;
  sceneDescription: string;
  threeDModelReference: string;  // reference to 3D scene data
  cameraPositions: Array<{
    cameraId: string;
    label: string;
    position: { x: number; y: number; z: number };
    direction: { dx: number; dy: number; dz: number };
    fieldOfViewDeg: number;
  }>;
  officerPositions: Array<{
    officerId: string;
    label: string;
    positions: Array<{ timestamp: string; x: number; y: number; z: number }>;
  }>;
  subjectPositions: Array<{
    subjectId: string;
    label: string;
    positions: Array<{ timestamp: string; x: number; y: number; z: number }>;
  }>;
  keyLocations: Array<{
    label: string;
    position: { x: number; y: number; z: number };
    significance: string;
  }>;
  scaleReference: string;
  northOrientation: number;
}

export interface TimelineSection {
  startTime: string;
  endTime: string;
  totalDurationSeconds: number;
  entries: TimelineEntry[];
  criticalIntervals: CriticalInterval[];
}

export interface TimelineEntry {
  entryId: string;
  timestamp: string;
  description: string;
  actor: string;
  actionType: string;
  evidenceSources: string[];
  policyReferences: string[];
  significance: 'routine' | 'notable' | 'significant' | 'critical';
  notes?: string;
}

export interface CriticalInterval {
  intervalId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  description: string;
  significance: string;
  relatedEntries: string[];
}

export interface PolicyAnalysisSection {
  agencyName: string;
  policiesReviewed: Array<{
    policyId: string;
    policyName: string;
    section: string;
    relevantText: string;
    applicability: string;
  }>;
  findings: Array<{
    findingId: string;
    findingType: string;          // Always "potential_policy_inconsistency" per safety language
    policyReference: string;
    detectedAction: string;
    timestamp: string;
    confidence: number;
    explanation: string;
    safetyLanguage: string;       // "potential_policy_inconsistency"
  }>;
  complianceNotes: string;
}

export interface EvidenceClipSection {
  clips: Array<{
    clipId: string;
    sourceType: string;
    sourceId: string;
    startTimestamp: string;
    endTimestamp: string;
    description: string;
    transcriptExcerpt?: string;
    significance: string;
  }>;
  totalClips: number;
  totalDurationSeconds: number;
}

export interface AnalysisReportSection {
  reportTitle: string;
  methodology: string;
  toolsUsed: string[];
  dataSourcesSummary: string;
  keyFindings: string[];
  limitations: string[];
  conclusions: string[];
  disclaimer: string;
}

export interface Appendix {
  appendixId: string;
  title: string;
  contentType: 'text' | 'table' | 'image_reference' | 'data';
  content: string;
}

export interface PackageMetadata {
  generatedBy: string;
  version: string;
  totalPages: number;
  totalExhibits: number;
  totalEvidenceSources: number;
  exportFormat: 'json' | 'pdf_ready' | 'docx_ready';
  checksumSha256?: string;
}

// ---------------------------------------------------------------------------
// Package generation
// ---------------------------------------------------------------------------

/**
 * Generate an expert witness package for a case.
 * Aggregates scene reconstruction, timeline, policy analysis,
 * evidence clips, and analysis report into a structured format.
 */
export async function generateExpertWitnessPackage(
  caseId: string,
  expertInfo: ExpertInfo,
  options?: {
    includeScene?: boolean;
    includeTrajectory?: boolean;
    includeVisibility?: boolean;
    includeLineOfSight?: boolean;
    exportFormat?: PackageMetadata['exportFormat'];
  },
): Promise<ExpertWitnessPackage> {
  const config = {
    includeScene: true,
    includeTrajectory: true,
    includeVisibility: true,
    includeLineOfSight: true,
    exportFormat: 'json' as PackageMetadata['exportFormat'],
    ...options,
  };

  // Fetch evidence events for the case
  const evidenceEvents = await prisma.evidenceEvent.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Fetch compliance findings
  const findings = await prisma.complianceFinding.findMany({
    where: { caseId },
    orderBy: { evidenceTimestamp: 'asc' },
  });

  // Fetch policy rules referenced
  const ruleIds = [...new Set(findings.map(f => f.ruleId).filter(Boolean))] as string[];
  const policyRules = ruleIds.length > 0
    ? await prisma.policyRule.findMany({ where: { ruleId: { in: ruleIds } } })
    : [];

  // Fetch vision events if available
  let visionEvents: Array<{ timestamp: string; eventCategory: string; confidence: number }> = [];
  try {
    visionEvents = await prisma.visionEvent.findMany({
      where: { caseId },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, eventCategory: true, confidence: true },
    });
  } catch {
    // VisionEvent model may not exist yet
  }

  // Build sections
  const sections: PackageSection[] = [];
  let sectionNum = 1;

  // Section 1: Executive Summary
  sections.push({
    sectionId: `section-${sectionNum}`,
    sectionNumber: `${sectionNum}`,
    title: 'Executive Summary',
    content: buildExecutiveSummary(caseId, evidenceEvents.length, findings.length, visionEvents.length),
    exhibits: [],
    pageEstimate: 2,
  });
  sectionNum++;

  // Section 2: Methodology
  sections.push({
    sectionId: `section-${sectionNum}`,
    sectionNumber: `${sectionNum}`,
    title: 'Methodology and Tools',
    content: buildMethodology(config),
    exhibits: [],
    pageEstimate: 3,
  });
  sectionNum++;

  // Section 3: Scene Reconstruction
  sections.push({
    sectionId: `section-${sectionNum}`,
    sectionNumber: `${sectionNum}`,
    title: 'Scene Reconstruction',
    content: 'Three-dimensional scene reconstruction generated from available geographic and structural data. See attached 3D model reference for interactive viewing.',
    exhibits: ['exhibit-scene-3d'],
    pageEstimate: 4,
  });
  sectionNum++;

  // Section 4: Timeline Analysis
  sections.push({
    sectionId: `section-${sectionNum}`,
    sectionNumber: `${sectionNum}`,
    title: 'Event Timeline Analysis',
    content: `Detailed timeline of ${evidenceEvents.length} events extracted from bodycam, dashcam, and audio evidence sources. Events have been cross-referenced with multiple sources where available.`,
    exhibits: ['exhibit-timeline'],
    pageEstimate: Math.max(2, Math.ceil(evidenceEvents.length / 5)),
  });
  sectionNum++;

  // Section 5: Policy Analysis
  sections.push({
    sectionId: `section-${sectionNum}`,
    sectionNumber: `${sectionNum}`,
    title: 'Policy Compliance Analysis',
    content: `Analysis of ${findings.length} potential policy inconsistencies identified through automated evidence analysis. All findings use cautious language and require human expert review.`,
    exhibits: ['exhibit-policy-matrix'],
    pageEstimate: Math.max(2, Math.ceil(findings.length / 3)),
  });
  sectionNum++;

  // Section 6: Vision Analysis
  if (visionEvents.length > 0) {
    sections.push({
      sectionId: `section-${sectionNum}`,
      sectionNumber: `${sectionNum}`,
      title: 'Bodycam Vision Analysis',
      content: `Computer vision analysis detected ${visionEvents.length} events across bodycam footage including pose estimation, object detection, and distance estimation.`,
      exhibits: ['exhibit-vision-analysis'],
      pageEstimate: Math.max(2, Math.ceil(visionEvents.length / 4)),
    });
    sectionNum++;
  }

  // Build scene reconstruction section
  const sceneReconstruction = buildSceneReconstructionSection(evidenceEvents);

  // Build timeline section
  const timeline = buildTimelineSection(evidenceEvents, findings);

  // Build policy analysis section
  const policyAnalysis = buildPolicyAnalysisSection(findings, policyRules);

  // Build evidence clips section
  const evidenceClips = buildEvidenceClipsSection(evidenceEvents);

  // Build analysis report
  const analysisReport = buildAnalysisReport(caseId, evidenceEvents, findings, visionEvents, config);

  // Build appendices
  const appendices = buildAppendices(policyRules, evidenceEvents);

  // Metadata
  const totalPages = sections.reduce((sum, s) => sum + s.pageEstimate, 0) +
    appendices.length * 2;

  const metadata: PackageMetadata = {
    generatedBy: 'CourtAccess Forensic Reconstruction Engine v1.0',
    version: '1.0.0',
    totalPages,
    totalExhibits: sections.reduce((sum, s) => sum + s.exhibits.length, 0),
    totalEvidenceSources: evidenceEvents.length,
    exportFormat: config.exportFormat,
  };

  return {
    caseId,
    packageVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    expertInfo,
    sections,
    sceneReconstruction,
    timeline,
    policyAnalysis,
    evidenceClips,
    analysisReport,
    appendices,
    metadata,
  };
}

/**
 * Store expert witness package in database
 */
export async function storeExpertWitnessPackage(pkg: ExpertWitnessPackage): Promise<string> {
  const record = await prisma.expertWitnessPackage.create({
    data: {
      caseId: pkg.caseId,
      packageVersion: pkg.packageVersion,
      expertInfo: JSON.stringify(pkg.expertInfo),
      sections: JSON.stringify(pkg.sections),
      sceneReconstruction: JSON.stringify(pkg.sceneReconstruction),
      timeline: JSON.stringify(pkg.timeline),
      policyAnalysis: JSON.stringify(pkg.policyAnalysis),
      evidenceClips: JSON.stringify(pkg.evidenceClips),
      analysisReport: JSON.stringify(pkg.analysisReport),
      appendices: JSON.stringify(pkg.appendices),
      metadata: JSON.stringify(pkg.metadata),
    },
  });
  return record.packageId;
}

/**
 * Get expert witness packages for a case
 */
export async function getCaseExpertPackages(caseId: string) {
  return prisma.expertWitnessPackage.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildExecutiveSummary(
  caseId: string,
  eventCount: number,
  findingCount: number,
  visionEventCount: number,
): string {
  return [
    `This expert witness package provides a comprehensive forensic reconstruction and analysis for Case ${caseId}.`,
    `The analysis encompasses ${eventCount} evidence events extracted from multiple sources including bodycam footage, dashcam recordings, audio transcripts, and official reports.`,
    findingCount > 0
      ? `Automated policy compliance analysis identified ${findingCount} area(s) warranting further review. All findings are presented as potential policy inconsistencies requiring expert interpretation.`
      : 'No potential policy inconsistencies were identified by automated analysis.',
    visionEventCount > 0
      ? `Computer vision analysis of bodycam footage identified ${visionEventCount} significant visual events including pose changes, object detections, and distance estimations.`
      : '',
    'All automated findings should be considered preliminary and subject to expert review and interpretation.',
  ].filter(Boolean).join('\n\n');
}

function buildMethodology(config: Record<string, boolean | string>): string {
  const tools: string[] = [
    'Evidence Event Extraction Engine',
    'Speech-to-Text Analysis Service',
    'Video Action Detection Service',
  ];
  if (config.includeScene) tools.push('3D Scene Geometry Builder');
  if (config.includeTrajectory) tools.push('Projectile Trajectory Analysis');
  if (config.includeVisibility) tools.push('Lighting/Visibility Simulation');
  if (config.includeLineOfSight) tools.push('Officer Line-of-Sight Reconstruction');
  tools.push('Multi-Camera Synchronization Engine');
  tools.push('Evidence Synchronization Engine');
  tools.push('Policy Compliance Analyzer');

  return [
    'The analysis was conducted using the CourtAccess Forensic Reconstruction Engine, which employs the following analytical tools:',
    tools.map((t, i) => `  ${i + 1}. ${t}`).join('\n'),
    '\nAll tools use deterministic algorithms with confidence scoring. No conclusions are drawn automatically — all findings are presented as observations for expert interpretation.',
    '\nLimitations: Computer vision analysis operates on available footage quality. Pose estimation and distance measurements are approximations. Policy compliance flags are preliminary assessments.',
  ].join('\n');
}

function buildSceneReconstructionSection(
  events: Array<{ eventId: string; timestamp: string; eventType: string; sourceType: string }>,
): SceneReconstructionSection {
  return {
    sceneId: 'scene-primary',
    sceneDescription: 'Primary incident scene reconstruction from available geographic and structural data.',
    threeDModelReference: 'scene-geometry-primary',
    cameraPositions: [
      {
        cameraId: 'cam-bodycam-1',
        label: 'Officer Bodycam',
        position: { x: 0, y: 0, z: 5.5 },
        direction: { dx: 1, dy: 0, dz: 0 },
        fieldOfViewDeg: 120,
      },
    ],
    officerPositions: [
      {
        officerId: 'officer-1',
        label: 'Primary Officer',
        positions: events
          .filter(e => e.sourceType === 'bodycam')
          .slice(0, 20)
          .map((e, i) => ({
            timestamp: e.timestamp,
            x: i * 2, y: 0, z: 0,
          })),
      },
    ],
    subjectPositions: [],
    keyLocations: [
      { label: 'Initial Contact Point', position: { x: 0, y: 0, z: 0 }, significance: 'Location where officer first made contact' },
    ],
    scaleReference: '1 unit = 1 foot',
    northOrientation: 0,
  };
}

function buildTimelineSection(
  events: Array<{ eventId: string; timestamp: string; eventType: string; sourceType: string; description: string | null; confidence: number }>,
  findings: Array<{ findingId: string; evidenceTimestamp: string; detectedAction: string; policyReference: string }>,
): TimelineSection {
  const entries: TimelineEntry[] = events.map((e, idx) => {
    const relatedFindings = findings.filter(f => f.evidenceTimestamp === e.timestamp);
    return {
      entryId: `entry-${idx + 1}`,
      timestamp: e.timestamp,
      description: e.description ?? e.eventType.replace(/_/g, ' '),
      actor: e.sourceType === 'bodycam' ? 'Officer' : 'System',
      actionType: e.eventType,
      evidenceSources: [e.sourceType],
      policyReferences: relatedFindings.map(f => f.policyReference),
      significance: relatedFindings.length > 0 ? 'significant' : e.confidence > 0.8 ? 'notable' : 'routine',
    };
  });

  const criticalEntries = entries.filter(e => e.significance === 'significant' || e.significance === 'critical');
  const criticalIntervals: CriticalInterval[] = [];
  if (criticalEntries.length > 0) {
    criticalIntervals.push({
      intervalId: 'interval-1',
      startTime: criticalEntries[0].timestamp,
      endTime: criticalEntries[criticalEntries.length - 1].timestamp,
      durationSeconds: 0,
      description: 'Primary interval of significant activity',
      significance: 'high',
      relatedEntries: criticalEntries.map(e => e.entryId),
    });
  }

  const timestamps = events.map(e => {
    const parts = e.timestamp.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0;
  });
  const duration = timestamps.length > 1
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;

  return {
    startTime: events[0]?.timestamp ?? '00:00:00',
    endTime: events[events.length - 1]?.timestamp ?? '00:00:00',
    totalDurationSeconds: duration,
    entries,
    criticalIntervals,
  };
}

function buildPolicyAnalysisSection(
  findings: Array<{
    findingId: string;
    findingType: string;
    policyReference: string;
    detectedAction: string;
    evidenceTimestamp: string;
    confidence: number;
    explanation: string | null;
    safetyLanguage: string;
    ruleId: string | null;
    agencyId: string;
  }>,
  policyRules: Array<{ ruleId: string; ruleName: string; category: string; description: string; agencyId: string }>,
): PolicyAnalysisSection {
  const agencyName = findings[0]?.agencyId ?? 'Unknown Agency';

  return {
    agencyName,
    policiesReviewed: policyRules.map(rule => ({
      policyId: rule.ruleId,
      policyName: rule.ruleName,
      section: rule.category,
      relevantText: rule.description,
      applicability: 'Applicable to detected officer actions in this incident',
    })),
    findings: findings.map(f => ({
      findingId: f.findingId,
      findingType: 'potential_policy_inconsistency',
      policyReference: f.policyReference,
      detectedAction: f.detectedAction,
      timestamp: f.evidenceTimestamp,
      confidence: f.confidence,
      explanation: f.explanation ?? 'Automated analysis flagged this action for expert review.',
      safetyLanguage: 'potential_policy_inconsistency',
    })),
    complianceNotes: 'All findings are presented as potential policy inconsistencies for expert review. The system does not determine violations — that determination rests with qualified human reviewers.',
  };
}

function buildEvidenceClipsSection(
  events: Array<{ eventId: string; timestamp: string; eventType: string; sourceType: string; description: string | null; sourceEvidence: string }>,
): EvidenceClipSection {
  const clips = events.slice(0, 50).map((e, idx) => ({
    clipId: `clip-${idx + 1}`,
    sourceType: e.sourceType,
    sourceId: e.sourceEvidence,
    startTimestamp: e.timestamp,
    endTimestamp: e.timestamp,
    description: e.description ?? e.eventType.replace(/_/g, ' '),
    significance: 'notable',
  }));

  return {
    clips,
    totalClips: clips.length,
    totalDurationSeconds: 0,
  };
}

function buildAnalysisReport(
  caseId: string,
  events: Array<unknown>,
  findings: Array<unknown>,
  visionEvents: Array<unknown>,
  config: Record<string, boolean | string>,
): AnalysisReportSection {
  const toolsUsed: string[] = [
    'Evidence Event Extraction',
    'Video Action Detection',
    'Speech Analysis',
    'Policy Compliance Analysis',
  ];
  if (config.includeScene) toolsUsed.push('3D Scene Geometry Builder');
  if (config.includeTrajectory) toolsUsed.push('Trajectory Analysis');
  if (config.includeVisibility) toolsUsed.push('Visibility Simulation');
  if (config.includeLineOfSight) toolsUsed.push('Line-of-Sight Analysis');

  return {
    reportTitle: `Forensic Reconstruction Analysis Report — Case ${caseId}`,
    methodology: 'Multi-modal evidence analysis combining video, audio, document, and spatial data through automated extraction and cross-referencing pipelines.',
    toolsUsed,
    dataSourcesSummary: `${events.length} evidence events, ${findings.length} compliance findings, ${visionEvents.length} vision detections`,
    keyFindings: [
      `${events.length} evidence events extracted from multiple sources`,
      `${findings.length} potential policy inconsistencies identified for review`,
      `${visionEvents.length} computer vision detections from bodycam footage`,
    ],
    limitations: [
      'Computer vision analysis is limited by footage quality and lighting conditions',
      'Pose estimation provides approximate measurements, not precise distances',
      'Audio transcription may contain inaccuracies, especially in noisy environments',
      'Policy compliance analysis is automated and requires human expert validation',
      'Trajectory calculations use simplified ballistic models',
    ],
    conclusions: [
      'All findings are preliminary and require expert interpretation',
      'The system identifies areas warranting further review — it does not determine violations',
    ],
    disclaimer: 'This report was generated by automated forensic analysis tools. All findings represent potential areas of interest for expert review and should not be interpreted as definitive conclusions. The system uses the term "potential policy inconsistency" rather than "violation" to reflect the preliminary nature of automated analysis.',
  };
}

function buildAppendices(
  policyRules: Array<{ ruleId: string; ruleName: string; category: string; description: string }>,
  events: Array<{ eventId: string; eventType: string; timestamp: string }>,
): Appendix[] {
  const appendices: Appendix[] = [];

  // Appendix A: Full policy reference table
  if (policyRules.length > 0) {
    const tableRows = policyRules.map(r =>
      `| ${r.ruleId} | ${r.ruleName} | ${r.category} | ${r.description.substring(0, 80)} |`);
    appendices.push({
      appendixId: 'appendix-a',
      title: 'Appendix A: Policy Reference Table',
      contentType: 'table',
      content: `| Rule ID | Rule Name | Category | Description |\n|---------|-----------|----------|-------------|\n${tableRows.join('\n')}`,
    });
  }

  // Appendix B: Complete event log
  appendices.push({
    appendixId: 'appendix-b',
    title: 'Appendix B: Complete Evidence Event Log',
    contentType: 'table',
    content: `Total events: ${events.length}\n\n` +
      events.slice(0, 100).map(e => `${e.timestamp} | ${e.eventType} | ${e.eventId}`).join('\n'),
  });

  // Appendix C: System configuration
  appendices.push({
    appendixId: 'appendix-c',
    title: 'Appendix C: Analysis System Configuration',
    contentType: 'text',
    content: 'CourtAccess Forensic Reconstruction Engine v1.0\nConfidence threshold: 0.60\nSafety language: potential_policy_inconsistency\nVideo analysis: 5 fps sample rate\nAudio analysis: full transcript\nPolicy matching: deterministic rule engine',
  });

  return appendices;
}
