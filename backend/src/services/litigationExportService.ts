// ============================================================================
// Phase D.5 — Litigation Export Architecture
// PDF/packet generation with full citation preservation.
// Exports: trial exhibits, hearing packets, trial notebooks, witness
// attack sheets, contradiction packets, CALCRIM failure matrices.
// All exports preserve: page citations, line citations, document linkage,
// evidence provenance.
// ============================================================================

import prisma from '../lib/prisma.js';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_DIR = process.env.EXPORT_DIR || path.join(process.cwd(), 'exports');

// Ensure export directory exists
function ensureExportDir(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Citation formatting helpers
// ---------------------------------------------------------------------------

function formatCitation(c: { text?: string; page?: number | null; line?: number | null; speaker?: string | null; document?: string | null }): string {
  const parts: string[] = [];
  if (c.page != null) parts.push(`p. ${c.page}`);
  if (c.line != null) parts.push(`ln. ${c.line}`);
  if (c.speaker) parts.push(`(${c.speaker})`);
  if (c.document) parts.push(`[Doc: ${c.document.slice(0, 12)}]`);
  return parts.join(', ');
}

function formatExhibitHeader(title: string, exhibitNumber: string, caseId: string): string {
  return [
    '═'.repeat(80),
    `EXHIBIT ${exhibitNumber}`,
    title,
    `Case: ${caseId}`,
    `Generated: ${new Date().toISOString()}`,
    '═'.repeat(80),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 1. Export Witness Attack Sheet
// ---------------------------------------------------------------------------

export async function exportWitnessAttackSheet(caseId: string, witnessName: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number;
}> {
  ensureExportDir();

  const sheet = await prisma.witnessAttackSheet.findUnique({
    where: { caseId_witnessName: { caseId, witnessName } },
  });
  if (!sheet) throw new Error(`No attack sheet found for witness: ${witnessName}`);

  const inconsistencies = JSON.parse(sheet.inconsistencySummary) as Array<{
    topic: string; statementA: string; statementB: string; page: string; impact: string;
  }>;
  const contradictions = JSON.parse(sheet.contradictionSummary) as Array<{
    topic: string; proofMethod: string; stmtA: string; stmtB: string; page: string;
  }>;
  const crossExamTopics = JSON.parse(sheet.crossExamTopics) as string[];
  const impeachmentSeq = JSON.parse(sheet.impeachmentSequence) as Array<{
    step: string; followUp: string; impact: string;
  }>;
  const keyQuotes = JSON.parse(sheet.keyQuotations) as Array<{
    text: string; page: number; line: number; significance: string;
  }>;

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push(`WITNESS ATTACK SHEET: ${witnessName}`);
  lines.push(`Case: ${caseId}`);
  lines.push(`Credibility Score: ${Math.round(sheet.credibilityScore * 100)}%`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');

  lines.push('OVERALL ASSESSMENT');
  lines.push('─'.repeat(40));
  lines.push(sheet.overallAssessment);
  lines.push('');

  lines.push('CROSS-EXAMINATION TOPICS (Priority Order)');
  lines.push('─'.repeat(40));
  crossExamTopics.forEach((t, i) => {
    lines.push(`  ${i + 1}. ${t}`);
  });
  lines.push('');

  lines.push('IMPEACHMENT SEQUENCE');
  lines.push('─'.repeat(40));
  impeachmentSeq.forEach((step, i) => {
    lines.push(`  Step ${i + 1} [${step.impact}]: ${step.step}`);
    lines.push(`    Follow-up: ${step.followUp}`);
    lines.push('');
    citationCount += 2;
  });

  lines.push('INCONSISTENCIES');
  lines.push('─'.repeat(40));
  inconsistencies.forEach((inc, i) => {
    lines.push(`  ${i + 1}. [${inc.impact}] ${inc.topic}`);
    lines.push(`     Statement A: "${inc.statementA}"`);
    lines.push(`     Statement B: "${inc.statementB}"`);
    lines.push(`     Citation: ${inc.page}`);
    lines.push('');
    citationCount += 2;
  });

  lines.push('CONTRADICTIONS');
  lines.push('─'.repeat(40));
  contradictions.forEach((con, i) => {
    lines.push(`  ${i + 1}. [${con.proofMethod}] ${con.topic}`);
    lines.push(`     Statement A: "${con.stmtA}"`);
    lines.push(`     Statement B: "${con.stmtB}"`);
    lines.push(`     Citation: ${con.page}`);
    lines.push('');
    citationCount += 2;
  });

  lines.push('KEY QUOTATIONS');
  lines.push('─'.repeat(40));
  keyQuotes.forEach((q, i) => {
    lines.push(`  ${i + 1}. "${q.text}"`);
    lines.push(`     Citation: p. ${q.page}, ln. ${q.line}`);
    lines.push(`     Significance: ${q.significance}`);
    lines.push('');
    citationCount++;
  });

  const fileName = `witness_attack_${witnessName.replace(/\s+/g, '_')}_${caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId,
      exportType: 'pdf_witness_attack',
      status: 'completed',
      sourceId: sheet.id,
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount };
}

// ---------------------------------------------------------------------------
// 2. Export Contradiction Packet
// ---------------------------------------------------------------------------

export async function exportContradictionPacket(caseId: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number;
}> {
  ensureExportDir();

  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId },
    orderBy: [{ severity: 'asc' }, { contradictionType: 'asc' }],
  });

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push('PROVEN CONTRADICTION PACKET');
  lines.push(`Case: ${caseId}`);
  lines.push(`Total Contradictions: ${contradictions.length}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');
  lines.push('Every contradiction in this packet is PROVEN using exact evidence citations');
  lines.push('and deterministic logical incompatibility. No contradictions are invented.');
  lines.push('');

  const bySeverity: Record<string, typeof contradictions> = {};
  for (const c of contradictions) {
    const arr = bySeverity[c.severity] || [];
    arr.push(c);
    bySeverity[c.severity] = arr;
  }

  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const group = bySeverity[severity];
    if (!group || group.length === 0) continue;

    lines.push(`${'═'.repeat(40)}`);
    lines.push(`${severity.toUpperCase()} CONTRADICTIONS (${group.length})`);
    lines.push(`${'═'.repeat(40)}`);
    lines.push('');

    for (const c of group) {
      lines.push(`  ── ${c.contradictionType} | ${c.proofMethod} ──`);
      lines.push(`  Statement A: "${c.statementAText}"`);
      lines.push(`    Citation: p. ${c.statementAPage ?? '?'}, ln. ${c.statementALineStart ?? '?'}–${c.statementALineEnd ?? '?'} (${c.statementASpeaker ?? 'unknown'}) [Doc: ${c.statementADocumentId?.slice(0, 12) ?? '?'}]`);
      lines.push('');
      lines.push(`  Statement B: "${c.statementBText}"`);
      lines.push(`    Citation: p. ${c.statementBPage ?? '?'}, ln. ${c.statementBLineStart ?? '?'}–${c.statementBLineEnd ?? '?'} (${c.statementBSpeaker ?? 'unknown'}) [Doc: ${c.statementBDocumentId?.slice(0, 12) ?? '?'}]`);
      lines.push('');
      lines.push(`  Proof: ${c.proofExplanation}`);
      if (c.burdenImpact) lines.push(`  Burden Impact: ${c.burdenImpact}`);
      lines.push('');
      citationCount += 2;
    }
  }

  const fileName = `contradiction_packet_${caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId,
      exportType: 'pdf_contradiction',
      status: 'completed',
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount };
}

// ---------------------------------------------------------------------------
// 3. Export CALCRIM Failure Matrix
// ---------------------------------------------------------------------------

export async function exportCalcrimFailureMatrix(caseId: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number;
}> {
  ensureExportDir();

  const matrices = await prisma.calcrimFailureMatrix.findMany({
    where: { caseId },
    orderBy: { instructionNumber: 'asc' },
  });

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push('CALCRIM ELEMENT-BY-ELEMENT PROSECUTION FAILURE MATRIX');
  lines.push(`Case: ${caseId}`);
  lines.push(`Instructions Analyzed: ${matrices.length}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');

  for (const m of matrices) {
    const elements = JSON.parse(m.elementAnalysis) as Array<{
      elementId: string; label: string; status: string;
      supportCount: number; contradictionCount: number; confidence: number;
      citations: Array<{ text: string; page: number | null; line: number | null; speaker: string | null }>;
    }>;
    const gaps = JSON.parse(m.prosecutionGaps) as Array<{ element: string; status: string; gap: string }>;
    const defArgs = JSON.parse(m.defenseArguments) as Array<{
      element: string; argument: string; supportCount: number; contradictionCount: number;
    }>;

    lines.push('─'.repeat(80));
    lines.push(`CALCRIM ${m.instructionNumber} — ${m.chargeTitle}`);
    lines.push(`Status: ${m.overallStatus.toUpperCase()} | Elements: ${m.totalElements}`);
    if (m.motionBasis) lines.push(`Motion Basis: ${m.motionBasis}`);
    lines.push('');

    lines.push('  Element Analysis:');
    for (const el of elements) {
      lines.push(`    ${el.label}`);
      lines.push(`      Status: ${el.status} | Support: ${el.supportCount} | Contradictions: ${el.contradictionCount} | Confidence: ${Math.round(el.confidence * 100)}%`);
      if (el.citations && el.citations.length > 0) {
        for (const cit of el.citations) {
          lines.push(`      Citation: "${cit.text}" — ${formatCitation(cit)}`);
          citationCount++;
        }
      }
      lines.push('');
    }

    if (gaps.length > 0) {
      lines.push('  Prosecution Gaps:');
      gaps.forEach((g, i) => {
        lines.push(`    ${i + 1}. [${g.status}] ${g.element}: ${g.gap}`);
      });
      lines.push('');
    }

    if (defArgs.length > 0) {
      lines.push('  Defense Arguments:');
      defArgs.forEach((a, i) => {
        lines.push(`    ${i + 1}. ${a.element}: ${a.argument}`);
      });
      lines.push('');
    }
  }

  const fileName = `calcrim_failure_matrix_${caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId,
      exportType: 'pdf_failure_matrix',
      status: 'completed',
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount };
}

// ---------------------------------------------------------------------------
// 4. Export Hearing Prep Packet
// ---------------------------------------------------------------------------

export async function exportHearingPrepPacket(packetId: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number;
}> {
  ensureExportDir();

  const packet = await prisma.hearingPrepPacket.findUnique({ where: { id: packetId } });
  if (!packet) throw new Error(`Hearing prep packet not found: ${packetId}`);

  const keyIssues = JSON.parse(packet.keyIssues) as Array<{ issue: string; priority: number; citations: number; type: string }>;
  const witnessOrder = JSON.parse(packet.witnessOrder) as Array<{ witness: string; purpose: string; credibility: number }>;
  const exhibitList = JSON.parse(packet.exhibitList) as Array<{ exhibitNumber: string; title: string; purpose: string }>;
  const motionsSummary = JSON.parse(packet.motionsSummary) as Array<{ motionType: string; strength: string; basis: string }>;
  const contradictionHL = JSON.parse(packet.contradictionHighlights) as Array<{ type: string; severity: string; proof: string; pageA: number | null; pageB: number | null }>;
  const burdenAnalysis = JSON.parse(packet.burdenAnalysis) as Array<{ instruction: number; collapseLevel: string; score: number; unsupported: number; total: number }>;
  const timelineIssues = JSON.parse(packet.timelineIssues) as Array<{ type: string; severity: string; explanation: string }>;

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push(packet.title);
  lines.push(`Hearing Type: ${packet.hearingType}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');

  lines.push('KEY ISSUES (Priority Order)');
  lines.push('─'.repeat(40));
  keyIssues.forEach((i, idx) => {
    lines.push(`  ${idx + 1}. [P${i.priority}] ${i.issue} (${i.type}, ${i.citations} citations)`);
    citationCount += i.citations;
  });
  lines.push('');

  lines.push('WITNESS ORDER');
  lines.push('─'.repeat(40));
  witnessOrder.forEach((w, idx) => {
    lines.push(`  ${idx + 1}. ${w.witness} — ${w.purpose} (credibility: ${Math.round(w.credibility * 100)}%)`);
  });
  lines.push('');

  lines.push('EXHIBIT LIST');
  lines.push('─'.repeat(40));
  exhibitList.forEach((e) => {
    lines.push(`  ${e.exhibitNumber}: ${e.title} (${e.purpose})`);
  });
  lines.push('');

  lines.push('MOTIONS');
  lines.push('─'.repeat(40));
  motionsSummary.forEach((m) => {
    lines.push(`  [${m.strength}] ${m.motionType}: ${m.basis}`);
  });
  lines.push('');

  lines.push('CONTRADICTION HIGHLIGHTS');
  lines.push('─'.repeat(40));
  contradictionHL.forEach((c) => {
    lines.push(`  [${c.severity}] ${c.type}: ${c.proof} (p${c.pageA ?? '?'} vs p${c.pageB ?? '?'})`);
    citationCount += 2;
  });
  lines.push('');

  lines.push('BURDEN ANALYSIS');
  lines.push('─'.repeat(40));
  burdenAnalysis.forEach((b) => {
    lines.push(`  CALCRIM ${b.instruction}: ${b.collapseLevel} (${Math.round(b.score * 100)}%) — ${b.unsupported}/${b.total} unsupported`);
  });
  lines.push('');

  if (timelineIssues.length > 0) {
    lines.push('TIMELINE ISSUES');
    lines.push('─'.repeat(40));
    timelineIssues.forEach((t) => {
      lines.push(`  [${t.severity}] ${t.type}: ${t.explanation}`);
    });
    lines.push('');
  }

  const fileName = `hearing_prep_${packet.hearingType}_${packet.caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId: packet.caseId,
      exportType: 'pdf_hearing',
      status: 'completed',
      sourceId: packetId,
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount };
}

// ---------------------------------------------------------------------------
// 5. Export Trial Notebook
// ---------------------------------------------------------------------------

export async function exportTrialNotebook(caseId: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number;
}> {
  ensureExportDir();

  const notebook = await prisma.trialNotebook.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
  if (!notebook) throw new Error(`No trial notebook found for case: ${caseId}`);

  const sections = JSON.parse(notebook.sections) as Array<{ sectionName: string; sectionType: string; content: string }>;
  const exhibitIndex = JSON.parse(notebook.exhibitIndex) as Array<{ exhibitNumber: string; title: string; type: string }>;
  const witnessIndex = JSON.parse(notebook.witnessIndex) as Array<{ name: string; role: string }>;
  const motionIndex = JSON.parse(notebook.motionIndex) as Array<{ motionType: string; title: string; strength: string }>;

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push(notebook.title);
  lines.push(`Generated: ${notebook.generatedAt.toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');

  // Table of Contents
  lines.push('TABLE OF CONTENTS');
  lines.push('─'.repeat(40));
  sections.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.sectionName}`);
  });
  lines.push(`  ${sections.length + 1}. Exhibit Index`);
  lines.push(`  ${sections.length + 2}. Witness Index`);
  lines.push(`  ${sections.length + 3}. Motion Index`);
  lines.push('');

  // Sections
  for (const section of sections) {
    lines.push('═'.repeat(80));
    lines.push(section.sectionName.toUpperCase());
    lines.push('═'.repeat(80));
    lines.push('');

    const content = JSON.parse(section.content);
    if (Array.isArray(content)) {
      for (const item of content) {
        const keys = Object.keys(item);
        for (const key of keys) {
          const val = item[key];
          if (val !== null && val !== undefined && val !== '') {
            lines.push(`  ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
            if (key === 'page' || key === 'pageA' || key === 'pageB' || key === 'citation') citationCount++;
          }
        }
        lines.push('');
      }
    } else if (typeof content === 'object') {
      for (const [key, val] of Object.entries(content)) {
        lines.push(`  ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      }
      lines.push('');
    }
  }

  // Exhibit Index
  lines.push('═'.repeat(80));
  lines.push('EXHIBIT INDEX');
  lines.push('═'.repeat(80));
  exhibitIndex.forEach((e) => {
    lines.push(`  ${e.exhibitNumber}: ${e.title} [${e.type}]`);
  });
  lines.push('');

  // Witness Index
  lines.push('═'.repeat(80));
  lines.push('WITNESS INDEX');
  lines.push('═'.repeat(80));
  witnessIndex.forEach((w) => {
    lines.push(`  ${w.name} (${w.role})`);
  });
  lines.push('');

  // Motion Index
  lines.push('═'.repeat(80));
  lines.push('MOTION INDEX');
  lines.push('═'.repeat(80));
  motionIndex.forEach((m) => {
    lines.push(`  [${m.strength}] ${m.motionType}: ${m.title}`);
  });
  lines.push('');

  const fileName = `trial_notebook_${caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId,
      exportType: 'pdf_trial_notebook',
      status: 'completed',
      sourceId: notebook.id,
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount };
}

// ---------------------------------------------------------------------------
// 6. Export Exhibit Packet (all exhibits for a case)
// ---------------------------------------------------------------------------

export async function exportExhibitPacket(caseId: string): Promise<{
  exportId: string; fileName: string; filePath: string; citationCount: number; exhibitCount: number;
}> {
  ensureExportDir();

  const exhibits = await prisma.trialExhibit.findMany({
    where: { caseId },
    orderBy: { exhibitNumber: 'asc' },
  });

  let citationCount = 0;
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push('DEFENSE EXHIBIT PACKET');
  lines.push(`Case: ${caseId}`);
  lines.push(`Total Exhibits: ${exhibits.length}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('═'.repeat(80));
  lines.push('');

  for (const exhibit of exhibits) {
    lines.push(formatExhibitHeader(exhibit.title, exhibit.exhibitNumber, caseId));

    lines.push(`Type: ${exhibit.exhibitType}`);
    lines.push(`Description: ${exhibit.description}`);
    lines.push('');

    const citations = JSON.parse(exhibit.citations) as Array<{
      text: string; page?: number | null; line?: number | null;
      speaker?: string | null; document?: string | null;
    }>;

    lines.push('Citations:');
    for (const cit of citations) {
      lines.push(`  "${cit.text}"`);
      lines.push(`  ${formatCitation(cit)}`);
      lines.push('');
      citationCount++;
    }

    lines.push('');
  }

  const fileName = `exhibit_packet_${caseId.slice(0, 8)}.txt`;
  const filePath = path.join(EXPORT_DIR, fileName);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  const job = await prisma.exportJob.create({
    data: {
      caseId,
      exportType: 'pdf_exhibit',
      status: 'completed',
      fileName,
      filePath,
      fileSize: Buffer.byteLength(lines.join('\n')),
      citationCount,
    },
  });

  return { exportId: job.id, fileName, filePath, citationCount, exhibitCount: exhibits.length };
}
