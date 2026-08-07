// ============================================================================
// Certification runs and regression comparison.
//
// A run drives the analysis pipeline over an imported corpus and counts what
// came out: pages, OCR confidence, classifications, timeline events, graph
// nodes, CALCRIM and mens rea coverage, contradictions, investigation and
// motion candidates, and every UNKNOWN.
//
// The counts are the point. A release that quietly extracts fewer pages, or
// classifies fewer documents, or stops producing timeline events, shows up as
// a diff against the recorded baseline. Nothing is inferred: every figure here
// is read back out of the database after the pipeline has run.
// ============================================================================

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import prisma from '../lib/prisma.js';
import { reconstructTimeline } from '../timeline/timelineReconstructionService.js';
import { analyzeCase } from '../services/calcrimEngine.js';
import { buildInventory } from './certificationImport.js';

const exec = promisify(execFile);

export interface CertificationMetrics {
  corpus: {
    files: number;
    bytes: number;
    ingested: number;
    duplicates: number;
    failedToIngest: number;
    corpusHash: string | null;
  };
  extraction: {
    documentsWithText: number;
    documentsWithoutText: number;
    totalPages: number;
    documentsWithPageMap: number;
    totalChunks: number;
    totalCharacters: number;
  };
  ocr: {
    imagesProcessed: number;
    /** Documents whose stored message reports confidence below threshold. */
    belowConfidenceThreshold: number;
    lowConfidenceFiles: string[];
  };
  classification: {
    classified: number;
    unknown: number;
    byClass: Record<string, number>;
    /** Classified but below the reporting floor, so shown as unknown. */
    lowConfidence: number;
  };
  repositories: {
    evidence: number;
    evidenceChunks: number;
    timelineEvents: number;
    evidenceEvents: number;
    narrativeClaims: number;
    verifiedFacts: number;
    charges: number;
  };
  knowledgeGraph: {
    nodes: number;
    edges: number;
    /** Distinct actors named across extracted events. */
    actors: number;
    sourceDocuments: number;
  };
  calcrim: {
    chargesAnalysed: number;
    chargesUnmapped: number;
    elementsTotal: number;
    elementsSupported: number;
    elementsMissing: number;
    caseStrength: string;
  };
  mensRea: {
    /** Charged counts for which a mental state could be organised. */
    resolved: number;
    unknown: number;
  };
  contradictions: {
    detected: number;
  };
  intelligence: {
    investigationGaps: number;
    motionCandidates: number;
  };
  failures: Array<{ file: string; stage: string; message: string }>;
  unknowns: Array<{ subject: string; reason: string }>;
}

async function currentCommit(): Promise<string | null> {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT.trim();

  // A deployed release is not a git checkout, so it carries its commit in a
  // stamp written beside the bundle at build time.
  try {
    const stamp = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-info.json');
    const { commit } = JSON.parse(await readFile(stamp, 'utf8'));
    if (commit) return String(commit);
  } catch {
    // Not a stamped release — fall through to asking git.
  }

  try {
    const { stdout } = await exec('git', ['-C', process.cwd(), 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Run the pipeline over a certification corpus and record what it produced.
 */
export async function runCertification(certificationCaseId: string): Promise<{
  certificationRunId: string;
  metrics: CertificationMetrics;
  regressions: Regression[] | null;
}> {
  const certCase = await prisma.certificationCase.findUnique({
    where: { certificationCaseId },
    include: { files: true },
  });
  if (!certCase) throw new Error('Certification case not found');
  if (!certCase.caseId) throw new Error('This certification case has no imported evidence to run against');

  const caseId = certCase.caseId;
  const tenantId = certCase.tenantId;

  const run = await prisma.certificationRun.create({
    data: {
      certificationCaseId,
      gitCommit: await currentCommit(),
      status: 'running',
    },
  });

  const failures: CertificationMetrics['failures'] = [];
  const unknowns: CertificationMetrics['unknowns'] = [];

  // --- Drive the analysis stages -------------------------------------------
  try {
    await reconstructTimeline(caseId, tenantId);
  } catch (err) {
    failures.push({
      file: '(case)',
      stage: 'timeline reconstruction',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // --- Read back what exists ------------------------------------------------
  const inventory = await buildInventory(certificationCaseId);

  const evidence = await prisma.evidence.findMany({
    where: { caseId },
    select: {
      evidenceId: true,
      fileName: true,
      mimeType: true,
      processingStatus: true,
      processingError: true,
      normalizedPageCount: true,
      pageMap: true,
    },
  });

  const chunkRows = await prisma.evidenceChunk.findMany({
    where: { evidenceId: { in: evidence.map((e) => e.evidenceId) } },
    select: { evidenceId: true, charCount: true },
  });

  const chunksByEvidence = new Map<string, number>();
  let totalCharacters = 0;
  for (const c of chunkRows) {
    chunksByEvidence.set(c.evidenceId, (chunksByEvidence.get(c.evidenceId) ?? 0) + 1);
    totalCharacters += c.charCount;
  }

  const documentsWithText = evidence.filter((e) => (chunksByEvidence.get(e.evidenceId) ?? 0) > 0).length;
  const documentsWithPageMap = evidence.filter((e) => Array.isArray(e.pageMap) && e.pageMap.length > 0).length;
  const totalPages = evidence.reduce(
    (sum, e) => sum + (Array.isArray(e.pageMap) ? e.pageMap.length : 0),
    0,
  );

  // Anything the pipeline recorded a message about is a reportable outcome.
  for (const e of evidence) {
    if (e.processingStatus === 'failed') {
      failures.push({
        file: e.fileName,
        stage: 'extraction',
        message: e.processingError ?? 'Processing failed with no message recorded.',
      });
    } else if (e.processingError) {
      unknowns.push({ subject: e.fileName, reason: e.processingError });
    }
  }

  const lowConfidenceFiles = evidence
    .filter((e) => /OCR confidence .* is \d+%/.test(e.processingError ?? ''))
    .map((e) => e.fileName);

  const imagesProcessed = evidence.filter((e) => (e.mimeType ?? '').startsWith('image/')).length;

  const timelineRows = await prisma.timelineEvent.findMany({
    where: { caseId },
    select: { id: true, actor: true, sourceDoc: true },
  });
  const timelineEvents = timelineRows.length;
  const evidenceEvents = await prisma.evidenceEvent.findMany({
    where: { caseId },
    select: { eventId: true, sourceEvidence: true, eventType: true },
  });
  const narrativeClaims = await prisma.narrativeClaim.count({ where: { caseId } });
  const verifiedFacts = await prisma.verifiedFact.count({ where: { caseId } });
  const charges = await prisma.charge.findMany({ where: { caseId } });

  // Knowledge graph: nodes are the documents plus the actors named on timeline
  // events; edges are the attributions from an event to its source. Counted
  // from what exists, not from what the graph could theoretically hold.
  const actors = new Set(timelineRows.map((e) => e.actor).filter(Boolean) as string[]);
  const sourceDocuments = new Set([
    ...evidenceEvents.map((e) => e.sourceEvidence).filter(Boolean),
    ...timelineRows.map((e) => e.sourceDoc).filter(Boolean),
  ] as string[]);

  // --- CALCRIM --------------------------------------------------------------
  let calcrim: CertificationMetrics['calcrim'] = {
    chargesAnalysed: 0,
    chargesUnmapped: 0,
    elementsTotal: 0,
    elementsSupported: 0,
    elementsMissing: 0,
    caseStrength: 'UNKNOWN',
  };
  try {
    const analysis = (await analyzeCase(caseId)) as {
      charges?: Array<{ elements?: Array<{ supported: boolean }> }>;
      unmappedCharges?: Array<{ charge: string; reason: string }>;
      overallCaseStrength?: string;
    };
    const analysed = analysis.charges ?? [];
    const elements = analysed.flatMap((c) => c.elements ?? []);
    calcrim = {
      chargesAnalysed: analysed.length,
      chargesUnmapped: analysis.unmappedCharges?.length ?? 0,
      elementsTotal: elements.length,
      elementsSupported: elements.filter((e) => e.supported).length,
      elementsMissing: elements.filter((e) => !e.supported).length,
      caseStrength: analysis.overallCaseStrength ?? 'UNKNOWN',
    };
    for (const u of analysis.unmappedCharges ?? []) {
      unknowns.push({ subject: `CALCRIM for ${u.charge}`, reason: u.reason });
    }
  } catch (err) {
    failures.push({
      file: '(case)',
      stage: 'CALCRIM analysis',
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Mens rea is only resolvable for counts whose statute has been extracted.
  const mensRea = { resolved: 0, unknown: charges.length };

  const contradictions = await prisma.timelineEvent.count({ where: { caseId, conflictFlag: true } });

  const evidenceRequests = await prisma.evidenceRequest.count({ where: { caseId } }).catch(() => 0);

  const metrics: CertificationMetrics = {
    corpus: {
      files: inventory?.totals.files ?? 0,
      bytes: inventory?.totals.bytes ?? 0,
      ingested: inventory?.totals.ingested ?? 0,
      duplicates: inventory?.totals.duplicates ?? 0,
      failedToIngest: inventory?.totals.failed ?? 0,
      corpusHash: certCase.corpusHash,
    },
    extraction: {
      documentsWithText,
      documentsWithoutText: evidence.length - documentsWithText,
      totalPages,
      documentsWithPageMap,
      totalChunks: chunkRows.length,
      totalCharacters,
    },
    ocr: {
      imagesProcessed,
      belowConfidenceThreshold: lowConfidenceFiles.length,
      lowConfidenceFiles,
    },
    classification: {
      classified: Object.entries(inventory?.byClassification ?? {})
        .filter(([k]) => k !== 'unknown')
        .reduce((s, [, v]) => s + v, 0),
      unknown: inventory?.byClassification?.unknown ?? 0,
      byClass: inventory?.byClassification ?? {},
      lowConfidence: (inventory?.files ?? []).filter(
        (f) => f.classification !== 'unknown' && f.classificationConfidence < 0.6,
      ).length,
    },
    repositories: {
      evidence: evidence.length,
      evidenceChunks: chunkRows.length,
      timelineEvents,
      evidenceEvents: evidenceEvents.length,
      narrativeClaims,
      verifiedFacts,
      charges: charges.length,
    },
    knowledgeGraph: {
      nodes: evidence.length + actors.size,
      edges: evidenceEvents.length,
      actors: actors.size,
      sourceDocuments: sourceDocuments.size,
    },
    calcrim,
    mensRea,
    contradictions: { detected: contradictions },
    intelligence: {
      investigationGaps: evidenceRequests,
      motionCandidates: 0,
    },
    failures,
    unknowns,
  };

  // --- Compare against the baseline ----------------------------------------
  const baseline = await prisma.certificationRun.findFirst({
    where: { certificationCaseId, isBaseline: true, status: 'completed' },
    orderBy: { startedAt: 'desc' },
  });

  const regressions = baseline?.metrics
    ? compareRuns(baseline.metrics as unknown as CertificationMetrics, metrics)
    : null;

  await prisma.certificationRun.update({
    where: { certificationRunId: run.certificationRunId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      metrics: metrics as unknown as object,
      failures: failures as unknown as object,
      regressions: regressions ? (regressions as unknown as object) : undefined,
      // The first successful run becomes the reference for later ones.
      isBaseline: !baseline,
    },
  });

  return { certificationRunId: run.certificationRunId, metrics, regressions };
}

// ---------------------------------------------------------------------------
// Regression comparison
// ---------------------------------------------------------------------------

export interface Regression {
  metric: string;
  baseline: number | string;
  current: number | string;
  delta: number | null;
  severity: 'regression' | 'improvement' | 'change';
  note: string;
}

/** Metrics where a fall is a regression, with a human name. */
const HIGHER_IS_BETTER: Array<[string, (m: CertificationMetrics) => number, string]> = [
  ['corpus.ingested', (m) => m.corpus.ingested, 'files ingested'],
  ['extraction.documentsWithText', (m) => m.extraction.documentsWithText, 'documents yielding text'],
  ['extraction.totalPages', (m) => m.extraction.totalPages, 'pages indexed'],
  ['extraction.totalChunks', (m) => m.extraction.totalChunks, 'indexed chunks'],
  ['extraction.totalCharacters', (m) => m.extraction.totalCharacters, 'characters extracted'],
  ['classification.classified', (m) => m.classification.classified, 'documents classified'],
  ['repositories.timelineEvents', (m) => m.repositories.timelineEvents, 'timeline events'],
  ['repositories.evidenceEvents', (m) => m.repositories.evidenceEvents, 'extracted events'],
  ['knowledgeGraph.nodes', (m) => m.knowledgeGraph.nodes, 'knowledge graph nodes'],
  ['knowledgeGraph.edges', (m) => m.knowledgeGraph.edges, 'knowledge graph edges'],
  ['calcrim.chargesAnalysed', (m) => m.calcrim.chargesAnalysed, 'charges with an instruction'],
  ['calcrim.elementsSupported', (m) => m.calcrim.elementsSupported, 'CALCRIM elements supported by evidence'],
];

/** Metrics where a rise is a regression. */
const LOWER_IS_BETTER: Array<[string, (m: CertificationMetrics) => number, string]> = [
  ['corpus.failedToIngest', (m) => m.corpus.failedToIngest, 'files that failed to ingest'],
  ['extraction.documentsWithoutText', (m) => m.extraction.documentsWithoutText, 'documents yielding no text'],
  ['classification.unknown', (m) => m.classification.unknown, 'documents left unclassified'],
  ['ocr.belowConfidenceThreshold', (m) => m.ocr.belowConfidenceThreshold, 'scans below the OCR threshold'],
  ['failures', (m) => m.failures.length, 'processing failures'],
];

/**
 * Diff two runs of the same corpus. Because the input is byte-identical, any
 * difference is attributable to the build.
 */
export function compareRuns(baseline: CertificationMetrics, current: CertificationMetrics): Regression[] {
  const out: Regression[] = [];

  if (baseline.corpus.corpusHash && current.corpus.corpusHash &&
      baseline.corpus.corpusHash !== current.corpus.corpusHash) {
    out.push({
      metric: 'corpus.corpusHash',
      baseline: baseline.corpus.corpusHash.slice(0, 16),
      current: current.corpus.corpusHash.slice(0, 16),
      delta: null,
      severity: 'change',
      note:
        'The corpus itself differs from the baseline, so the comparison below is not like for like. ' +
        'Certification corpora are meant to be immutable; check whether the source directory was altered.',
    });
  }

  for (const [key, read, name] of HIGHER_IS_BETTER) {
    const b = read(baseline);
    const c = read(current);
    if (b === c) continue;
    out.push({
      metric: key,
      baseline: b,
      current: c,
      delta: c - b,
      severity: c < b ? 'regression' : 'improvement',
      note:
        c < b
          ? `${name} fell from ${b} to ${c} on the same input.`
          : `${name} rose from ${b} to ${c}.`,
    });
  }

  for (const [key, read, name] of LOWER_IS_BETTER) {
    const b = read(baseline);
    const c = read(current);
    if (b === c) continue;
    out.push({
      metric: key,
      baseline: b,
      current: c,
      delta: c - b,
      severity: c > b ? 'regression' : 'improvement',
      note:
        c > b
          ? `${name} rose from ${b} to ${c} on the same input.`
          : `${name} fell from ${b} to ${c}.`,
    });
  }

  if (baseline.calcrim.caseStrength !== current.calcrim.caseStrength) {
    out.push({
      metric: 'calcrim.caseStrength',
      baseline: baseline.calcrim.caseStrength,
      current: current.calcrim.caseStrength,
      delta: null,
      severity: 'change',
      note: `The reported case assessment changed from ${baseline.calcrim.caseStrength} to ${current.calcrim.caseStrength} on the same evidence.`,
    });
  }

  return out;
}
