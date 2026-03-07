// ============================================
// Court Access — Trial Outline Engine
// Phase 142: Generate structured trial outlines
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Generate a complete trial outline for a case.
 * @param {string} caseId
 * @param {string} [side='defense'] - 'defense' or 'prosecution'
 * @returns {object} TrialOutline record
 */
export async function generateTrialOutline(caseId, side = 'defense') {
  console.log(`[TrialOutline] Generating ${side} trial outline for case ${caseId}`);

  const [narrative, examOutlines, impacts, admissibility, witnesses, tasks] = await Promise.all([
    prisma.caseNarrative.findFirst({ where: { caseId, modelVersion: side }, orderBy: { createdAt: 'desc' } }),
    prisma.examinationOutline.findMany({ where: { caseId } }),
    prisma.evidenceImpactScore.findMany({ where: { caseId }, orderBy: { overallImpactScore: 'desc' } }),
    prisma.admissibilityIssue.findMany({ where: { caseId } }),
    prisma.witnessReliability.findMany({ where: { caseId }, orderBy: { credibilityScore: 'desc' } }),
    prisma.investigativeTask.findMany({ where: { caseId, status: { in: ['pending', 'assigned', 'in_progress'] } } }),
  ]);

  const phases = [];

  // Phase 1: Pretrial Motions
  const motionIssues = admissibility.filter(a => a.severity === 'critical' || a.severity === 'high');
  phases.push({
    name: 'Pretrial Motions',
    order: 1,
    items: motionIssues.map(m => ({
      type: 'motion',
      description: `Motion to suppress: ${m.issueType.replace(/_/g, ' ')} — ${m.legalBasis}`,
      priority: m.severity,
    })),
    notes: `${motionIssues.length} potential suppression motions identified`,
  });

  // Phase 2: Jury Selection Notes
  phases.push({
    name: 'Jury Selection',
    order: 2,
    items: [
      { type: 'note', description: 'Identify jurors with law enforcement bias', priority: 'high' },
      { type: 'note', description: 'Screen for eyewitness identification skepticism', priority: 'medium' },
    ],
    notes: 'Standard voir dire considerations',
  });

  // Phase 3: Opening Statement
  phases.push({
    name: 'Opening Statement',
    order: 3,
    items: [
      { type: 'theme', description: narrative ? `Theme from narrative: ${(narrative.metadata?.sections?.[0]?.content || narrative.keyEvents?.[0]?.content || 'TBD').substring(0, 100)}` : 'Develop case theme' },
      { type: 'preview', description: `Preview ${impacts.length} key evidence items` },
      { type: 'preview', description: `Preview ${witnesses.length} witness testimonies` },
    ],
    notes: 'Set the tone. Tell the story from client perspective.',
  });

  // Phase 4: Case in Chief — Witness Order
  const directExams = examOutlines.filter(e => e.examType === 'direct');
  const crossExams = examOutlines.filter(e => e.examType === 'cross');

  phases.push({
    name: side === 'defense' ? 'Defense Case in Chief' : 'Prosecution Case in Chief',
    order: 4,
    items: [
      ...directExams.map((e, i) => ({
        type: 'direct_exam',
        witness: e.witnessName,
        questions: e.totalQuestions,
        estimatedMinutes: e.estimatedMinutes,
        order: i + 1,
      })),
    ],
    notes: `${directExams.length} direct examinations prepared`,
  });

  // Phase 5: Cross-Examinations
  phases.push({
    name: 'Cross-Examinations',
    order: 5,
    items: crossExams.map((e, i) => ({
      type: 'cross_exam',
      witness: e.witnessName,
      questions: e.totalQuestions,
      estimatedMinutes: e.estimatedMinutes,
      order: i + 1,
    })),
    notes: `${crossExams.length} cross-examinations prepared`,
  });

  // Phase 6: Closing Argument
  phases.push({
    name: 'Closing Argument',
    order: 6,
    items: [
      { type: 'theme', description: 'Reinforce case theme' },
      { type: 'evidence_summary', description: `Summarize ${impacts.filter(i => i.impactLevel === 'critical' || i.impactLevel === 'high').length} high-impact evidence items` },
      { type: 'instruction_request', description: 'Propose jury instructions' },
    ],
    notes: 'Connect evidence to elements. Address weaknesses head-on.',
  });

  // Outstanding tasks warning
  if (tasks.length > 0) {
    phases.push({
      name: 'Outstanding Investigation Tasks',
      order: 0,
      items: tasks.map(t => ({
        type: 'warning',
        description: `[${t.priority.toUpperCase()}] ${t.metadata?.title || t.description.substring(0, 80)} — Status: ${t.status}`,
      })),
      notes: `${tasks.length} investigative tasks still incomplete before trial`,
    });
  }

  phases.sort((a, b) => a.order - b.order);

  const outline = await prisma.trialOutline.create({
    data: {
      caseId,
      side,
      phases,
      totalPhases: phases.length,
      estimatedTrialDays: Math.ceil(
        examOutlines.reduce((sum, e) => sum + (e.estimatedMinutes || 0), 0) / 360
      ) + 2,
      readinessScore: calculateReadiness(tasks, examOutlines, narrative, impacts),
      metadata: {
        generatedAt: new Date().toISOString(),
        witnessCount: witnesses.length,
        evidenceCount: impacts.length,
        outstandingTasks: tasks.length,
      },
    },
  });

  console.log(`[TrialOutline] Generated ${side} outline with ${phases.length} phases for case ${caseId}`);
  return outline;
}

function calculateReadiness(tasks, exams, narrative, impacts) {
  let score = 0.3;
  if (narrative) score += 0.2;
  if (exams.length > 0) score += 0.2;
  if (impacts.length > 0) score += 0.1;
  const taskPenalty = tasks.length * 0.05;
  return Math.round(Math.max(0.1, Math.min(1, score - taskPenalty)) * 100) / 100;
}

export async function getCaseTrialOutlines(caseId) {
  return prisma.trialOutline.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } });
}
