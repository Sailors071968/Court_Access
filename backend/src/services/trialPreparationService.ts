// ============================================================================
// Phase D.5 — Trial Preparation + Litigation Packet Generation
// Transforms deterministic litigation intelligence into attorney-ready
// trial preparation structures. NEVER impersonates legal counsel.
// Organizes litigation materials with full citation preservation.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Witness Attack Sheet Generation
// ---------------------------------------------------------------------------

export async function generateWitnessAttackSheets(caseId: string): Promise<{
  caseId: string;
  sheetsGenerated: number;
  witnesses: string[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const witnesses: string[] = [];

  await prisma.witnessAttackSheet.deleteMany({ where: { caseId } });

  const packets = await prisma.impeachmentPacket.findMany({ where: { caseId } });
  const witnessIncon = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId, contradictionType: 'witness' } });
  const timelineIssues = await prisma.timelineIncompatibility.findMany({ where: { caseId } });

  const witInconMap = new Map<string, typeof witnessIncon>();
  for (const w of witnessIncon) {
    const arr = witInconMap.get(w.speaker) || [];
    arr.push(w);
    witInconMap.set(w.speaker, arr);
  }

  for (const packet of packets) {
    const incons = witInconMap.get(packet.witnessName) || [];
    const witContradictions = contradictions.filter(
      (c) => c.statementASpeaker?.toLowerCase() === packet.witnessName.toLowerCase() ||
             c.statementBSpeaker?.toLowerCase() === packet.witnessName.toLowerCase()
    );

    // Build inconsistency summary
    const inconsistencySummary = incons.map((i) => ({
      topic: i.inconsistencyType,
      statementA: i.statementAText.slice(0, 200),
      statementB: i.statementBText.slice(0, 200),
      page: `p${i.statementAPage ?? '?'} vs p${i.statementBPage ?? '?'}`,
      impact: i.credibilityImpact,
    }));

    // Build contradiction summary
    const contradictionSummary = witContradictions.map((c) => ({
      topic: c.contradictionType,
      proofMethod: c.proofMethod,
      stmtA: c.statementAText.slice(0, 200),
      stmtB: c.statementBText.slice(0, 200),
      page: `p${c.statementAPage ?? '?'} vs p${c.statementBPage ?? '?'}`,
    }));

    // Build cross-exam topics (ordered by impact)
    const topicSet = new Map<string, number>();
    for (const i of incons) {
      const topic = `${i.inconsistencyType}: ${i.explanation.slice(0, 80)}`;
      topicSet.set(topic, (topicSet.get(topic) || 0) + (i.credibilityImpact === 'high' ? 3 : i.credibilityImpact === 'medium' ? 2 : 1));
    }
    for (const c of witContradictions) {
      const topic = `${c.proofMethod}: ${c.proofExplanation.slice(0, 80)}`;
      topicSet.set(topic, (topicSet.get(topic) || 0) + (c.severity === 'critical' ? 4 : c.severity === 'high' ? 3 : 2));
    }
    const crossExamTopics = [...topicSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);

    // Build impeachment sequence
    const impeachmentSequence = [
      ...incons.filter((i) => i.credibilityImpact === 'high').map((i) => ({
        step: `Confront with prior statement: "${i.statementAText.slice(0, 100)}" (p${i.statementAPage ?? '?'})`,
        followUp: `Then present contradictory statement: "${i.statementBText.slice(0, 100)}" (p${i.statementBPage ?? '?'})`,
        impact: i.credibilityImpact,
      })),
      ...incons.filter((i) => i.credibilityImpact === 'medium').map((i) => ({
        step: `Raise inconsistency: "${i.statementAText.slice(0, 80)}" vs "${i.statementBText.slice(0, 80)}"`,
        followUp: `Challenge reliability of testimony on this point`,
        impact: i.credibilityImpact,
      })),
    ];

    // Collect prior statements (cross-document)
    const priorStatements = incons
      .filter((i) => i.statementADocumentId !== i.statementBDocumentId)
      .map((i) => ({
        document: i.statementADocumentId ?? 'unknown',
        page: i.statementAPage ?? 0,
        text: i.statementAText.slice(0, 300),
      }));

    // Key quotations
    const keyQuotations = [
      ...incons.map((i) => ({
        text: i.statementAText.slice(0, 200),
        page: i.statementAPage ?? 0,
        line: 0,
        significance: `Contradicted by: "${i.statementBText.slice(0, 100)}" (p${i.statementBPage ?? '?'})`,
      })),
    ];

    // Timeline conflicts involving this witness
    const witnessTimeline = timelineIssues.filter(
      (t) => t.statementASpeaker?.toLowerCase() === packet.witnessName.toLowerCase() ||
             t.statementBSpeaker?.toLowerCase() === packet.witnessName.toLowerCase()
    );
    const timelineConflicts = witnessTimeline.map((t) => ({
      timestampA: t.timestampA,
      timestampB: t.timestampB,
      explanation: t.explanation,
    }));

    // Overall assessment
    const totalIssues = incons.length + witContradictions.length + witnessTimeline.length;
    let overallAssessment: string;
    if (packet.credibilityScore < 0.3) {
      overallAssessment = `HIGHLY UNRELIABLE: ${packet.witnessName} has ${totalIssues} proven credibility issues. Credibility score: ${Math.round(packet.credibilityScore * 100)}%. Multiple internal contradictions and inconsistencies severely undermine testimony reliability.`;
    } else if (packet.credibilityScore < 0.6) {
      overallAssessment = `QUESTIONABLE: ${packet.witnessName} has ${totalIssues} credibility issues. Credibility score: ${Math.round(packet.credibilityScore * 100)}%. Significant inconsistencies create reasonable doubt about testimony accuracy.`;
    } else {
      overallAssessment = `LIMITED ISSUES: ${packet.witnessName} has ${totalIssues} minor credibility issues. Credibility score: ${Math.round(packet.credibilityScore * 100)}%. Some inconsistencies noted but testimony is largely consistent.`;
    }

    await prisma.witnessAttackSheet.create({
      data: {
        caseId,
        witnessName: packet.witnessName,
        credibilityScore: packet.credibilityScore,
        inconsistencySummary: JSON.stringify(inconsistencySummary),
        contradictionSummary: JSON.stringify(contradictionSummary),
        crossExamTopics: JSON.stringify(crossExamTopics),
        impeachmentSequence: JSON.stringify(impeachmentSequence),
        priorStatements: JSON.stringify(priorStatements),
        keyQuotations: JSON.stringify(keyQuotations),
        timelineConflicts: JSON.stringify(timelineConflicts),
        overallAssessment,
      },
    });
    witnesses.push(packet.witnessName);
  }

  return { caseId, sheetsGenerated: witnesses.length, witnesses, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 2. CALCRIM Failure Matrix Generation
// ---------------------------------------------------------------------------

export async function generateCalcrimFailureMatrices(caseId: string): Promise<{
  caseId: string;
  matricesGenerated: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  await prisma.calcrimFailureMatrix.deleteMany({ where: { caseId } });

  const collapseScores = await prisma.burdenCollapseScore.findMany({ where: { caseId } });
  let matricesGenerated = 0;

  for (const cs of collapseScores) {
    const elementDetails = JSON.parse(cs.elementDetails) as Array<{
      elementId: string; label: string; status: string;
      supportCount: number; contradictionCount: number; confidence: number;
    }>;

    // Get charge title
    const charge = await prisma.charge.findFirst({
      where: { caseId, calcrimInstructionId: cs.instructionId },
      select: { title: true, code: true, section: true },
    });

    const chargeTitle = charge ? `${charge.code} ${charge.section} — ${charge.title || 'Unknown'}` : `CALCRIM ${cs.instructionNumber}`;

    // Build element analysis with citations
    const elementAnalysis = await Promise.all(elementDetails.map(async (el) => {
      const mappings = await prisma.calcrimElementMapping.findMany({
        where: { elementId: el.elementId },
        take: 5,
        orderBy: { confidence: 'desc' },
      });

      const citations = await Promise.all(mappings.map(async (m) => {
        const stmt = await prisma.evidenceStatement.findUnique({
          where: { id: m.statementId },
          select: { rawText: true, page: true, lineStart: true, speaker: true, documentId: true },
        });
        return stmt ? {
          text: stmt.rawText.slice(0, 150),
          page: stmt.page,
          line: stmt.lineStart,
          speaker: stmt.speaker,
          document: stmt.documentId,
          confidence: m.confidence,
        } : null;
      }));

      return {
        ...el,
        citations: citations.filter(Boolean),
      };
    }));

    // Identify prosecution gaps
    const prosecutionGaps = elementDetails
      .filter((el) => el.status === 'unsupported' || el.status === 'contradicted')
      .map((el) => ({
        element: el.label,
        status: el.status,
        gap: el.status === 'unsupported'
          ? `Zero evidence supports "${el.label}". Prosecution cannot prove this element.`
          : `More contradictions (${el.contradictionCount}) than supporting statements (${el.supportCount}) for "${el.label}".`,
      }));

    // Build defense arguments (citation-backed)
    const defenseArguments = elementDetails
      .filter((el) => el.status !== 'strong')
      .map((el) => ({
        element: el.label,
        argument: el.status === 'unsupported'
          ? `Prosecution has presented zero evidence establishing "${el.label}". Under CALCRIM ${cs.instructionNumber}, the People must prove each element beyond reasonable doubt. This element fails.`
          : el.status === 'contradicted'
            ? `The evidence regarding "${el.label}" is contradictory. ${el.contradictionCount} contradiction(s) outweigh ${el.supportCount} supporting statement(s).`
            : `Evidence for "${el.label}" is weak (avg confidence: ${Math.round(el.confidence * 100)}%). Insufficient to meet beyond-reasonable-doubt standard.`,
        supportCount: el.supportCount,
        contradictionCount: el.contradictionCount,
      }));

    // Motion basis
    let motionBasis: string | null = null;
    if (cs.collapseLevel === 'collapsed') {
      motionBasis = `PC § 1118.1 — Motion for Judgment of Acquittal. Prosecution burden collapsed for CALCRIM ${cs.instructionNumber}: ${cs.unsupportedElements} unsupported, ${cs.contradictedElements} contradicted out of ${cs.totalElements} required elements.`;
    }

    await prisma.calcrimFailureMatrix.create({
      data: {
        caseId,
        instructionId: cs.instructionId,
        instructionNumber: cs.instructionNumber,
        chargeTitle,
        totalElements: cs.totalElements,
        elementAnalysis: JSON.stringify(elementAnalysis),
        overallStatus: cs.collapseLevel,
        prosecutionGaps: JSON.stringify(prosecutionGaps),
        defenseArguments: JSON.stringify(defenseArguments),
        motionBasis,
      },
    });
    matricesGenerated++;
  }

  return { caseId, matricesGenerated, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 3. Trial Exhibit Generation
// ---------------------------------------------------------------------------

export async function generateTrialExhibits(caseId: string): Promise<{
  caseId: string;
  exhibitsGenerated: number;
  byType: Record<string, number>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  let exhibitCounter = 0;
  const byType: Record<string, number> = {};

  await prisma.trialExhibit.deleteMany({ where: { caseId } });

  // Contradiction exhibits
  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId, severity: { in: ['critical', 'high'] } },
    orderBy: { severity: 'asc' },
  });

  for (const c of contradictions) {
    exhibitCounter++;
    const exhibitNum = `D-${String(exhibitCounter).padStart(3, '0')}`;
    await prisma.trialExhibit.create({
      data: {
        caseId,
        exhibitNumber: exhibitNum,
        exhibitType: 'contradiction',
        title: `Contradiction: ${c.proofMethod} — ${c.contradictionType}`,
        description: c.proofExplanation,
        content: JSON.stringify({
          statementA: { text: c.statementAText, page: c.statementAPage, lineStart: c.statementALineStart, speaker: c.statementASpeaker, document: c.statementADocumentId },
          statementB: { text: c.statementBText, page: c.statementBPage, lineStart: c.statementBLineStart, speaker: c.statementBSpeaker, document: c.statementBDocumentId },
          proofMethod: c.proofMethod,
          severity: c.severity,
        }),
        citations: JSON.stringify([
          { text: c.statementAText.slice(0, 150), page: c.statementAPage, line: c.statementALineStart, speaker: c.statementASpeaker, document: c.statementADocumentId },
          { text: c.statementBText.slice(0, 150), page: c.statementBPage, line: c.statementBLineStart, speaker: c.statementBSpeaker, document: c.statementBDocumentId },
        ]),
        relatedIds: JSON.stringify([{ contradictionPairId: c.id }]),
      },
    });
    byType['contradiction'] = (byType['contradiction'] || 0) + 1;
  }

  // Burden failure exhibits
  const fractures = await prisma.burdenFracture.findMany({
    where: { caseId, severity: { in: ['critical', 'high'] } },
  });

  for (const f of fractures) {
    exhibitCounter++;
    const exhibitNum = `D-${String(exhibitCounter).padStart(3, '0')}`;
    await prisma.trialExhibit.create({
      data: {
        caseId,
        exhibitNumber: exhibitNum,
        exhibitType: 'burden_failure',
        title: `Burden Failure: ${f.fractureType} — Element ${f.elementId.slice(0, 8)}`,
        description: f.explanation,
        content: JSON.stringify({
          fractureType: f.fractureType,
          supportingCount: f.supportingCount,
          contradictingCount: f.contradictingCount,
          averageConfidence: f.averageConfidence,
        }),
        citations: JSON.stringify([{ text: f.explanation, source: 'burden_analysis' }]),
        relatedIds: JSON.stringify([{ burdenFractureId: f.id }]),
      },
    });
    byType['burden_failure'] = (byType['burden_failure'] || 0) + 1;
  }

  // Timeline exhibits
  const timelineIssues = await prisma.timelineIncompatibility.findMany({ where: { caseId } });

  for (const t of timelineIssues) {
    exhibitCounter++;
    const exhibitNum = `D-${String(exhibitCounter).padStart(3, '0')}`;
    await prisma.trialExhibit.create({
      data: {
        caseId,
        exhibitNumber: exhibitNum,
        exhibitType: 'timeline',
        title: `Timeline Impossibility: ${t.incompatibilityType}`,
        description: t.explanation,
        content: JSON.stringify({
          timestampA: t.timestampA, timestampB: t.timestampB,
          locationA: t.locationA, locationB: t.locationB,
          speakerA: t.statementASpeaker, speakerB: t.statementBSpeaker,
        }),
        citations: JSON.stringify([
          { text: t.statementAText.slice(0, 150), page: t.statementAPage, speaker: t.statementASpeaker },
          { text: t.statementBText.slice(0, 150), page: t.statementBPage, speaker: t.statementBSpeaker },
        ]),
        relatedIds: JSON.stringify([{ timelineIncompatibilityId: t.id }]),
      },
    });
    byType['timeline'] = (byType['timeline'] || 0) + 1;
  }

  return { caseId, exhibitsGenerated: exhibitCounter, byType, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 4. Hearing Prep Packet Generation
// ---------------------------------------------------------------------------

export async function generateHearingPrepPacket(
  caseId: string,
  hearingType: string,
): Promise<{ caseId: string; packetId: string; processingTimeMs: number }> {
  const startTime = Date.now();

  // Gather all intelligence
  const [issues, motions, exhibits, attackSheets, collapseScores, contradictions, timelineIssues] = await Promise.all([
    prisma.defenseIssue.findMany({ where: { caseId }, orderBy: { priority: 'asc' }, take: 20 }),
    prisma.motionOpportunity.findMany({ where: { caseId }, orderBy: { priority: 'asc' } }),
    prisma.trialExhibit.findMany({ where: { caseId }, orderBy: { exhibitNumber: 'asc' } }),
    prisma.witnessAttackSheet.findMany({ where: { caseId } }),
    prisma.burdenCollapseScore.findMany({ where: { caseId }, orderBy: { collapseScore: 'desc' } }),
    prisma.contradictionPair.findMany({ where: { caseId, severity: { in: ['critical', 'high'] } }, take: 10 }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
  ]);

  const title = `${hearingType.charAt(0).toUpperCase() + hearingType.slice(1)} Hearing Preparation — Case ${caseId.slice(0, 12)}`;

  const packet = await prisma.hearingPrepPacket.create({
    data: {
      caseId,
      hearingType,
      title,
      keyIssues: JSON.stringify(issues.slice(0, 10).map((i) => ({
        issue: i.title,
        priority: i.priority,
        citations: i.citationCount,
        type: i.issueType,
      }))),
      witnessOrder: JSON.stringify(attackSheets.map((s) => ({
        witness: s.witnessName,
        purpose: s.credibilityScore < 0.5 ? 'impeachment' : 'cross-examination',
        attackSheetId: s.id,
        credibility: s.credibilityScore,
      }))),
      exhibitList: JSON.stringify(exhibits.map((e) => ({
        exhibitNumber: e.exhibitNumber,
        title: e.title,
        purpose: e.exhibitType,
      }))),
      motionsSummary: JSON.stringify(motions.map((m) => ({
        motionType: m.motionType,
        strength: m.strength,
        basis: m.legalBasis,
      }))),
      contradictionHighlights: JSON.stringify(contradictions.map((c) => ({
        type: c.contradictionType,
        severity: c.severity,
        proof: c.proofExplanation.slice(0, 200),
        pageA: c.statementAPage,
        pageB: c.statementBPage,
      }))),
      burdenAnalysis: JSON.stringify(collapseScores.map((cs) => ({
        instruction: cs.instructionNumber,
        collapseLevel: cs.collapseLevel,
        score: cs.collapseScore,
        unsupported: cs.unsupportedElements,
        total: cs.totalElements,
      }))),
      timelineIssues: JSON.stringify(timelineIssues.map((t) => ({
        type: t.incompatibilityType,
        severity: t.severity,
        explanation: t.explanation.slice(0, 200),
      }))),
    },
  });

  return { caseId, packetId: packet.id, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 5. Trial Notebook Assembly
// ---------------------------------------------------------------------------

export async function assembleTrialNotebook(caseId: string): Promise<{
  caseId: string;
  notebookId: string;
  sections: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  await prisma.trialNotebook.deleteMany({ where: { caseId } });

  const [exhibits, attackSheets, failureMatrices, motions, contradictions, collapseScores, timelineIssues, doubtStructures] = await Promise.all([
    prisma.trialExhibit.findMany({ where: { caseId }, orderBy: { exhibitNumber: 'asc' } }),
    prisma.witnessAttackSheet.findMany({ where: { caseId } }),
    prisma.calcrimFailureMatrix.findMany({ where: { caseId } }),
    prisma.motionOpportunity.findMany({ where: { caseId }, orderBy: { priority: 'asc' } }),
    prisma.contradictionPair.findMany({ where: { caseId }, orderBy: { severity: 'asc' }, take: 50 }),
    prisma.burdenCollapseScore.findMany({ where: { caseId }, orderBy: { collapseScore: 'desc' } }),
    prisma.timelineIncompatibility.findMany({ where: { caseId } }),
    prisma.juryReasonableDoubtStructure.findMany({ where: { caseId } }),
  ]);

  const sections = [
    {
      sectionName: 'Case Overview',
      sectionType: 'overview',
      content: JSON.stringify({
        totalExhibits: exhibits.length,
        totalWitnesses: attackSheets.length,
        totalContradictions: contradictions.length,
        totalMotions: motions.length,
        collapseScores: collapseScores.map((cs) => ({
          instruction: cs.instructionNumber,
          level: cs.collapseLevel,
          score: cs.collapseScore,
        })),
      }),
    },
    {
      sectionName: 'CALCRIM Failure Analysis',
      sectionType: 'failure_matrix',
      content: JSON.stringify(failureMatrices.map((m) => ({
        instruction: m.instructionNumber,
        charge: m.chargeTitle,
        status: m.overallStatus,
        elements: m.totalElements,
        motionBasis: m.motionBasis,
      }))),
    },
    {
      sectionName: 'Prosecution Burden Analysis',
      sectionType: 'burden_analysis',
      content: JSON.stringify(collapseScores.map((cs) => ({
        instruction: cs.instructionNumber,
        collapseLevel: cs.collapseLevel,
        score: cs.collapseScore,
        unsupported: cs.unsupportedElements,
        contradicted: cs.contradictedElements,
        explanation: cs.explanation,
      }))),
    },
    {
      sectionName: 'Contradiction Evidence',
      sectionType: 'contradictions',
      content: JSON.stringify(contradictions.map((c) => ({
        type: c.contradictionType,
        severity: c.severity,
        proof: c.proofExplanation,
        pageA: c.statementAPage,
        pageB: c.statementBPage,
      }))),
    },
    {
      sectionName: 'Witness Analysis',
      sectionType: 'witnesses',
      content: JSON.stringify(attackSheets.map((s) => ({
        name: s.witnessName,
        credibility: s.credibilityScore,
        assessment: s.overallAssessment,
      }))),
    },
    {
      sectionName: 'Timeline Analysis',
      sectionType: 'timeline',
      content: JSON.stringify(timelineIssues.map((t) => ({
        type: t.incompatibilityType,
        severity: t.severity,
        explanation: t.explanation,
      }))),
    },
    {
      sectionName: 'Motion Opportunities',
      sectionType: 'motions',
      content: JSON.stringify(motions.map((m) => ({
        type: m.motionType,
        title: m.title,
        strength: m.strength,
        basis: m.legalBasis,
      }))),
    },
    {
      sectionName: 'Reasonable Doubt Structures',
      sectionType: 'reasonable_doubt',
      content: JSON.stringify(doubtStructures.map((rd) => ({
        category: rd.doubtCategory,
        title: rd.title,
        strength: rd.strength,
        narrative: rd.narrative,
      }))),
    },
  ];

  const notebook = await prisma.trialNotebook.create({
    data: {
      caseId,
      title: `Trial Notebook — Case ${caseId.slice(0, 12)}`,
      sections: JSON.stringify(sections),
      exhibitIndex: JSON.stringify(exhibits.map((e) => ({
        exhibitNumber: e.exhibitNumber,
        title: e.title,
        type: e.exhibitType,
      }))),
      witnessIndex: JSON.stringify(attackSheets.map((s) => ({
        name: s.witnessName,
        role: 'prosecution_witness',
        attackSheetId: s.id,
      }))),
      motionIndex: JSON.stringify(motions.map((m) => ({
        motionType: m.motionType,
        title: m.title,
        strength: m.strength,
      }))),
      contradictionIndex: JSON.stringify(contradictions.map((c) => ({
        id: c.id,
        type: c.contradictionType,
        severity: c.severity,
      }))),
      burdenSummary: JSON.stringify(collapseScores.map((cs) => ({
        instruction: cs.instructionNumber,
        level: cs.collapseLevel,
        score: cs.collapseScore,
      }))),
      timelineSummary: JSON.stringify(timelineIssues.map((t) => ({
        type: t.incompatibilityType,
        severity: t.severity,
      }))),
    },
  });

  return { caseId, notebookId: notebook.id, sections: sections.length, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 6. Full Trial Preparation (runs all subsystems)
// ---------------------------------------------------------------------------

export async function runFullTrialPreparation(caseId: string): Promise<{
  caseId: string;
  witnessAttackSheets: Awaited<ReturnType<typeof generateWitnessAttackSheets>>;
  calcrimFailureMatrices: Awaited<ReturnType<typeof generateCalcrimFailureMatrices>>;
  trialExhibits: Awaited<ReturnType<typeof generateTrialExhibits>>;
  trialNotebook: Awaited<ReturnType<typeof assembleTrialNotebook>>;
  totalProcessingTimeMs: number;
}> {
  const startTime = Date.now();

  const witnessAttackSheets = await generateWitnessAttackSheets(caseId);
  const calcrimFailureMatrices = await generateCalcrimFailureMatrices(caseId);
  const trialExhibits = await generateTrialExhibits(caseId);
  const trialNotebook = await assembleTrialNotebook(caseId);

  return {
    caseId,
    witnessAttackSheets,
    calcrimFailureMatrices,
    trialExhibits,
    trialNotebook,
    totalProcessingTimeMs: Date.now() - startTime,
  };
}
