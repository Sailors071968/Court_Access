// ============================================
// Court Access — Examination Builder Engine
// Phase 141: Build structured direct/cross examination outlines
// ============================================

import prisma from '../services/prismaClient.js';

/**
 * Build an examination outline for a witness.
 * @param {string} caseId
 * @param {string} witnessName
 * @param {string} examType - 'direct' or 'cross'
 * @returns {object} ExaminationOutline record
 */
export async function buildExamOutline(caseId, witnessName, examType = 'direct') {
  console.log(`[ExamBuilder] Building ${examType} exam for "${witnessName}" in case ${caseId}`);

  const [statements, facts, reliability, crossQuestions] = await Promise.all([
    prisma.transcriptStatement.findMany({
      where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } },
      orderBy: { extractedAt: 'asc' },
    }),
    prisma.extractedFact.findMany({
      where: { caseId, speaker: { contains: witnessName, mode: 'insensitive' } },
    }),
    prisma.witnessReliability.findFirst({
      where: { caseId, witnessName },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crossExamQuestion.findMany({
      where: { caseId, witnessName },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const sections = [];

  if (examType === 'direct') {
    // Direct examination: establish credibility, elicit testimony
    sections.push({
      title: 'Foundation / Background',
      purpose: 'Establish witness credentials and relationship to case',
      questions: [
        { text: `Please state your full name for the record.`, type: 'foundation' },
        { text: `How do you know the defendant?`, type: 'foundation' },
        { text: `Where were you on the date in question?`, type: 'foundation' },
      ],
      notes: 'Use open-ended questions. Let the witness tell their story.',
    });

    // Group facts into topical sections
    const eventFacts = facts.filter(f => f.factType === 'EVENT');
    if (eventFacts.length > 0) {
      sections.push({
        title: 'Key Events',
        purpose: 'Elicit testimony about critical events',
        questions: eventFacts.slice(0, 10).map(f => ({
          text: `Can you describe what happened regarding "${f.statementText.substring(0, 80)}"?`,
          type: 'substantive',
          factId: f.id,
        })),
        notes: 'Chronological order recommended. Reference specific times when possible.',
      });
    }

    sections.push({
      title: 'Conclusion',
      purpose: 'Wrap up and reinforce key points',
      questions: [
        { text: `Is there anything else you observed that you haven't mentioned?`, type: 'closing' },
      ],
      notes: 'End on strongest point. No further questions.',
    });
  } else {
    // Cross examination: challenge, impeach, extract concessions
    sections.push({
      title: 'Preliminary / Control Questions',
      purpose: 'Establish control and set up key points',
      questions: [
        { text: `You gave a statement to police on [date], correct?`, type: 'control' },
        { text: `And you signed that statement under oath?`, type: 'control' },
      ],
      notes: 'Use leading questions only. One fact per question.',
    });

    // Use cross-exam questions from Phase 139
    const categories = ['consistency', 'perception', 'identification', 'timeline', 'stress'];
    for (const cat of categories) {
      const catQuestions = crossQuestions.filter(q => (q.metadata?.category || '') === cat);
      if (catQuestions.length > 0) {
        sections.push({
          title: `Challenge: ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
          purpose: `Impeach witness on ${cat}`,
          questions: catQuestions.map(q => ({
            text: q.questionText,
            type: q.tactic,
            priority: q.priority,
            crossExamId: q.id,
          })),
          notes: `Based on ${cat} analysis. Credibility score: ${reliability?.credibilityScore || 'N/A'}`,
        });
      }
    }

    sections.push({
      title: 'Final Questions',
      purpose: 'Lock in testimony and end strongly',
      questions: [
        { text: `So to summarize, you cannot be certain about [key point], correct?`, type: 'closing' },
      ],
      notes: 'End on strongest impeachment point. Sit down.',
    });
  }

  const outline = await prisma.examinationOutline.create({
    data: {
      caseId,
      witnessName,
      examType,
      sections,
      totalQuestions: sections.reduce((sum, s) => sum + s.questions.length, 0),
      estimatedMinutes: sections.reduce((sum, s) => sum + s.questions.length * 2, 0),
      metadata: {
        statementCount: statements.length,
        factCount: facts.length,
        credibilityScore: reliability?.credibilityScore || null,
        crossExamQuestionsAvailable: crossQuestions.length,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`[ExamBuilder] Built ${examType} exam with ${outline.totalQuestions} questions for "${witnessName}"`);
  return outline;
}

export async function getCaseExamOutlines(caseId) {
  return prisma.examinationOutline.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });
}
