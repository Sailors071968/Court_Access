// ============================================================================
// Phase D.4 — Defense Strategy Synthesis + Attorney Intelligence
// Transforms proven attack surfaces into attorney-reviewable litigation
// intelligence. Deterministic only. Citation-backed only.
// NEVER acts like a lawyer. Organizes provable litigation intelligence.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Severity → Priority mapping (deterministic)
// ---------------------------------------------------------------------------

const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// ---------------------------------------------------------------------------
// 1. Defense Issue Prioritization
// ---------------------------------------------------------------------------

export async function synthesizeDefenseIssues(caseId: string): Promise<{
  caseId: string;
  issuesCreated: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  let issuesCreated = 0;
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  // Clear existing issues for re-synthesis
  await prisma.defenseIssue.deleteMany({ where: { caseId } });

  // Source 1: Burden fractures → defense issues
  const fractures = await prisma.burdenFracture.findMany({ where: { caseId } });
  for (const f of fractures) {
    const issue = await prisma.defenseIssue.create({
      data: {
        caseId,
        instructionId: f.instructionId,
        elementId: f.elementId,
        issueType: 'burden_failure',
        priority: SEVERITY_PRIORITY[f.severity] ?? 4,
        severity: f.severity,
        title: `Burden Fracture: ${f.fractureType} — Element ${f.elementId.slice(0, 8)}`,
        description: f.explanation,
        legalBasis: `CALCRIM instruction (element burden of proof)`,
        supportingIds: JSON.stringify([{ burdenFractureId: f.id }]),
        citationCount: f.supportingCount + f.contradictingCount,
        prosecutionImpact: f.prosecutionImpact,
        defenseAction: f.fractureType === 'unsupported'
          ? 'File motion for directed verdict on this element — zero prosecution evidence'
          : f.fractureType === 'contradicted'
            ? 'Highlight contradictions during cross-examination — net negative evidence'
            : f.fractureType === 'single_source'
              ? 'Focus impeachment on the single supporting witness'
              : 'Challenge evidentiary weight — insufficient corroboration',
      },
    });
    if (issue) {
      issuesCreated++;
      byType['burden_failure'] = (byType['burden_failure'] || 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    }
  }

  // Source 2: Contradiction pairs → defense issues (grouped by element)
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId } });
  const contByElement = new Map<string, typeof contradictions>();
  const unlinkedCont: typeof contradictions = [];
  for (const c of contradictions) {
    if (c.elementId) {
      const arr = contByElement.get(c.elementId) || [];
      arr.push(c);
      contByElement.set(c.elementId, arr);
    } else {
      unlinkedCont.push(c);
    }
  }

  for (const [elementId, elCont] of contByElement.entries()) {
    const maxSeverity = elCont.reduce((max, c) => {
      const p = SEVERITY_PRIORITY[c.severity] ?? 4;
      return p < max ? p : max;
    }, 4);
    const severity = Object.entries(SEVERITY_PRIORITY).find(([, v]) => v === maxSeverity)?.[0] ?? 'low';

    await prisma.defenseIssue.create({
      data: {
        caseId,
        elementId,
        instructionId: elCont[0].instructionId,
        issueType: 'contradiction',
        priority: maxSeverity,
        severity,
        title: `${elCont.length} Contradiction(s) on Element ${elementId.slice(0, 8)}`,
        description: `${elCont.length} proven contradictions affect this CALCRIM element. Evidence statements are mutually incompatible.`,
        legalBasis: `CALCRIM element — contradictory prosecution evidence`,
        supportingIds: JSON.stringify(elCont.map((c) => ({ contradictionPairId: c.id }))),
        citationCount: elCont.length * 2,
        prosecutionImpact: 'Prosecution evidence is internally contradictory for this element',
        defenseAction: 'Present contradictions to jury — demonstrate prosecution evidence conflicts with itself',
      },
    });
    issuesCreated++;
    byType['contradiction'] = (byType['contradiction'] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  // Source 3: Witness inconsistencies → defense issues
  const witnessIssues = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  const witBySpeaker = new Map<string, typeof witnessIssues>();
  for (const w of witnessIssues) {
    const arr = witBySpeaker.get(w.speaker) || [];
    arr.push(w);
    witBySpeaker.set(w.speaker, arr);
  }

  for (const [speaker, issues] of witBySpeaker.entries()) {
    const severity = issues.some((i) => i.credibilityImpact === 'high') ? 'high' : 'medium';
    await prisma.defenseIssue.create({
      data: {
        caseId,
        issueType: 'witness_credibility',
        priority: SEVERITY_PRIORITY[severity] ?? 3,
        severity,
        title: `Witness Credibility Issue: ${speaker}`,
        description: `${speaker} has ${issues.length} internal inconsistency/inconsistencies across their statements.`,
        legalBasis: 'CALCRIM 226 (Credibility of Witnesses)',
        supportingIds: JSON.stringify(issues.map((i) => ({ witnessInconsistencyId: i.id }))),
        citationCount: issues.length * 2,
        prosecutionImpact: `Key prosecution witness "${speaker}" is internally inconsistent`,
        defenseAction: `Cross-examine ${speaker} using their own contradictory statements — challenge credibility per CALCRIM 226`,
      },
    });
    issuesCreated++;
    byType['witness_credibility'] = (byType['witness_credibility'] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  // Source 4: Timeline impossibilities → defense issues
  const timelineIssues = await prisma.timelineIncompatibility.findMany({ where: { caseId } });
  for (const tl of timelineIssues) {
    await prisma.defenseIssue.create({
      data: {
        caseId,
        issueType: 'timeline_impossibility',
        priority: SEVERITY_PRIORITY[tl.severity] ?? 2,
        severity: tl.severity,
        title: `Timeline Impossibility: ${tl.incompatibilityType}`,
        description: tl.explanation,
        legalBasis: 'Physical impossibility — factual basis for reasonable doubt',
        supportingIds: JSON.stringify([{ timelineIncompatibilityId: tl.id }]),
        citationCount: 2,
        prosecutionImpact: 'Prosecution timeline contains physical impossibility',
        defenseAction: 'Present timeline impossibility to jury — prosecution version of events is physically impossible',
      },
    });
    issuesCreated++;
    byType['timeline_impossibility'] = (byType['timeline_impossibility'] || 0) + 1;
    bySeverity[tl.severity] = (bySeverity[tl.severity] || 0) + 1;
  }

  // Source 5: Unlinked contradictions → general issues
  for (const c of unlinkedCont) {
    if (c.severity === 'critical' || c.severity === 'high') {
      await prisma.defenseIssue.create({
        data: {
          caseId,
          issueType: 'contradiction',
          priority: SEVERITY_PRIORITY[c.severity] ?? 3,
          severity: c.severity,
          title: `Contradiction: ${c.proofMethod}`,
          description: c.proofExplanation,
          legalBasis: 'Contradictory prosecution evidence',
          supportingIds: JSON.stringify([{ contradictionPairId: c.id }]),
          citationCount: 2,
          prosecutionImpact: 'Prosecution evidence contains internal contradictions',
          defenseAction: 'Present contradiction to jury during closing arguments',
        },
      });
      issuesCreated++;
      byType['contradiction'] = (byType['contradiction'] || 0) + 1;
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
    }
  }

  return { caseId, issuesCreated, byType, bySeverity, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 2. Motion Opportunity Detection
// ---------------------------------------------------------------------------

export async function detectMotionOpportunities(caseId: string): Promise<{
  caseId: string;
  motionsDetected: number;
  byType: Record<string, number>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  let motionsDetected = 0;
  const byType: Record<string, number> = {};

  // Clear existing for re-detection
  await prisma.motionOpportunity.deleteMany({ where: { caseId } });

  // Check for directed verdict opportunities (unsupported elements)
  const unsupportedFractures = await prisma.burdenFracture.findMany({
    where: { caseId, fractureType: 'unsupported' },
  });

  for (const f of unsupportedFractures) {
    await prisma.motionOpportunity.create({
      data: {
        caseId,
        motionType: 'directed_verdict',
        title: `Motion for Directed Verdict — Unsupported Element`,
        legalBasis: `Penal Code § 1118.1 — Judgment of Acquittal. CALCRIM element has zero supporting evidence.`,
        factualBasis: f.explanation,
        supportingIds: JSON.stringify([{ burdenFractureId: f.id }]),
        citationSummary: `Burden fracture: ${f.fractureType}, supporting: ${f.supportingCount}, contradicting: ${f.contradictingCount}`,
        strength: 'strong',
        priority: 1,
      },
    });
    motionsDetected++;
    byType['directed_verdict'] = (byType['directed_verdict'] || 0) + 1;
  }

  // Check for count dismissal (all elements of an instruction unsupported)
  const collapseScores = await prisma.burdenCollapseScore.findMany({
    where: { caseId, collapseLevel: 'collapsed' },
  });

  for (const cs of collapseScores) {
    await prisma.motionOpportunity.create({
      data: {
        caseId,
        motionType: 'dismiss_count',
        title: `Motion to Dismiss — CALCRIM ${cs.instructionNumber} Burden Collapsed`,
        legalBasis: `Penal Code § 1118.1 — Insufficient evidence on all required elements for this charge.`,
        factualBasis: cs.explanation,
        supportingIds: JSON.stringify([{ burdenCollapseScoreId: cs.id }]),
        citationSummary: `Collapse score: ${cs.collapseScore}, unsupported: ${cs.unsupportedElements}/${cs.totalElements}, contradicted: ${cs.contradictedElements}/${cs.totalElements}`,
        strength: cs.collapseScore >= 0.8 ? 'strong' : 'moderate',
        priority: 1,
      },
    });
    motionsDetected++;
    byType['dismiss_count'] = (byType['dismiss_count'] || 0) + 1;
  }

  // Check for witness impeachment motions (high-impact inconsistencies)
  const highImpactWitness = await prisma.witnessInconsistency.findMany({
    where: { caseId, credibilityImpact: 'high' },
  });

  const witnessesSeen = new Set<string>();
  for (const w of highImpactWitness) {
    if (witnessesSeen.has(w.speaker)) continue;
    witnessesSeen.add(w.speaker);

    const allIssues = await prisma.witnessInconsistency.findMany({
      where: { caseId, speaker: w.speaker },
    });

    await prisma.motionOpportunity.create({
      data: {
        caseId,
        motionType: 'impeach_witness',
        title: `Witness Impeachment: ${w.speaker}`,
        legalBasis: `Evidence Code § 780 (Credibility of Witness), CALCRIM 226`,
        factualBasis: `${w.speaker} has ${allIssues.length} proven internal inconsistencies across their statements.`,
        supportingIds: JSON.stringify(allIssues.map((i) => ({ witnessInconsistencyId: i.id }))),
        citationSummary: allIssues.map((i) => `p${i.statementAPage ?? '?'} vs p${i.statementBPage ?? '?'}`).join('; '),
        strength: allIssues.length >= 3 ? 'strong' : 'moderate',
        priority: 2,
      },
    });
    motionsDetected++;
    byType['impeach_witness'] = (byType['impeach_witness'] || 0) + 1;
  }

  // Check for timeline-based motions
  const criticalTimeline = await prisma.timelineIncompatibility.findMany({
    where: { caseId, severity: 'critical' },
  });

  if (criticalTimeline.length > 0) {
    await prisma.motionOpportunity.create({
      data: {
        caseId,
        motionType: 'exclude_testimony',
        title: `Motion to Exclude — Physically Impossible Timeline`,
        legalBasis: `Evidence Code § 352 — Probative value vs prejudicial effect. Testimony asserts physical impossibility.`,
        factualBasis: criticalTimeline.map((t) => t.explanation).join(' | '),
        supportingIds: JSON.stringify(criticalTimeline.map((t) => ({ timelineIncompatibilityId: t.id }))),
        citationSummary: criticalTimeline.map((t) => `${t.timestampA ?? '?'} at ${t.locationA ?? '?'} vs ${t.timestampB ?? '?'} at ${t.locationB ?? '?'}`).join('; '),
        strength: 'strong',
        priority: 1,
      },
    });
    motionsDetected++;
    byType['exclude_testimony'] = (byType['exclude_testimony'] || 0) + 1;
  }

  return { caseId, motionsDetected, byType, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 3. Witness Impeachment Packets
// ---------------------------------------------------------------------------

export async function buildImpeachmentPackets(caseId: string): Promise<{
  caseId: string;
  packetsBuilt: number;
  witnesses: string[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  const witnesses: string[] = [];

  // Clear existing
  await prisma.impeachmentPacket.deleteMany({ where: { caseId } });

  // Get all witness inconsistencies
  const inconsistencies = await prisma.witnessInconsistency.findMany({ where: { caseId } });

  // Get contradiction pairs where same speaker appears
  const contradictions = await prisma.contradictionPair.findMany({
    where: { caseId, contradictionType: 'witness' },
  });

  // Build per-witness maps
  const witMap = new Map<string, { inconsistencies: typeof inconsistencies; contradictions: typeof contradictions }>();

  for (const i of inconsistencies) {
    const entry = witMap.get(i.speaker) || { inconsistencies: [], contradictions: [] };
    entry.inconsistencies.push(i);
    witMap.set(i.speaker, entry);
  }

  for (const c of contradictions) {
    const speaker = c.statementASpeaker || c.statementBSpeaker;
    if (!speaker) continue;
    const entry = witMap.get(speaker) || { inconsistencies: [], contradictions: [] };
    entry.contradictions.push(c);
    witMap.set(speaker, entry);
  }

  for (const [witness, data] of witMap.entries()) {
    const totalIncon = data.inconsistencies.length;
    const totalContra = data.contradictions.length;
    const totalItems = totalIncon + totalContra;

    // Credibility score: starts at 1.0, reduces by 0.15 per inconsistency, 0.2 per contradiction
    const credibility = Math.max(0, 1.0 - (totalIncon * 0.15) - (totalContra * 0.2));

    const impeachmentItems = [
      ...data.inconsistencies.map((i) => ({
        type: 'inconsistency',
        statementAId: i.statementAId,
        statementBId: i.statementBId,
        statementAText: i.statementAText.slice(0, 200),
        statementBText: i.statementBText.slice(0, 200),
        page: `p${i.statementAPage ?? '?'} vs p${i.statementBPage ?? '?'}`,
        explanation: i.explanation,
      })),
      ...data.contradictions.map((c) => ({
        type: 'contradiction',
        statementAId: c.statementAId,
        statementBId: c.statementBId,
        statementAText: c.statementAText.slice(0, 200),
        statementBText: c.statementBText.slice(0, 200),
        page: `p${c.statementAPage ?? '?'} vs p${c.statementBPage ?? '?'}`,
        explanation: c.proofExplanation,
      })),
    ];

    // Determine cross-exam topics from the types of inconsistencies
    const topicSet = new Set<string>();
    for (const i of data.inconsistencies) {
      if (i.inconsistencyType === 'factual_change') topicSet.add('Factual contradictions in testimony');
      if (i.inconsistencyType === 'detail_shift') topicSet.add('Inconsistent details across statements');
      if (i.inconsistencyType === 'chronology_change') topicSet.add('Changed chronology between statements');
    }
    for (const c of data.contradictions) {
      if (c.proofMethod === 'temporal_impossibility') topicSet.add('Timeline inconsistencies');
      if (c.proofMethod === 'location_conflict') topicSet.add('Location contradictions');
      if (c.proofMethod === 'factual_exclusion') topicSet.add('Mutually exclusive factual claims');
    }
    if (totalItems >= 3) topicSet.add('Pattern of unreliability');

    await prisma.impeachmentPacket.create({
      data: {
        caseId,
        witnessName: witness,
        totalInconsistencies: totalIncon,
        totalContradictions: totalContra,
        credibilityScore: Math.round(credibility * 100) / 100,
        impeachmentItems: JSON.stringify(impeachmentItems),
        crossExamTopics: JSON.stringify([...topicSet]),
        priorStatementConflicts: JSON.stringify(
          data.inconsistencies
            .filter((i) => i.statementADocumentId !== i.statementBDocumentId)
            .map((i) => ({
              priorText: i.statementAText.slice(0, 150),
              trialText: i.statementBText.slice(0, 150),
              page: `p${i.statementAPage ?? '?'}`,
              line: `L${(i as unknown as Record<string, number>).statementALineStart ?? '?'}`,
            })),
        ),
      },
    });
    witnesses.push(witness);
  }

  return { caseId, packetsBuilt: witnesses.length, witnesses, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 4. Burden Collapse Scoring (per-instruction)
// ---------------------------------------------------------------------------

export async function computeBurdenCollapseScores(caseId: string): Promise<{
  caseId: string;
  scoresComputed: number;
  collapsed: number;
  fractured: number;
  weakened: number;
  supported: number;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  let collapsed = 0, fractured = 0, weakened = 0, supported = 0;

  // Clear existing
  await prisma.burdenCollapseScore.deleteMany({ where: { caseId } });

  // Get charges → instructions → elements
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: {
      calcrimInstruction: {
        include: {
          elements: { orderBy: { elementNumber: 'asc' } },
        },
      },
    },
  });

  for (const charge of charges) {
    if (!charge.calcrimInstruction) continue;
    const instruction = charge.calcrimInstruction;
    const elements = instruction.elements;
    if (elements.length === 0) continue;

    let unsupportedCount = 0;
    let contradictedCount = 0;
    let weakCount = 0;
    let strongCount = 0;

    const elementDetails: Array<{
      elementId: string;
      label: string;
      status: string;
      supportCount: number;
      contradictionCount: number;
      confidence: number;
    }> = [];

    for (const el of elements) {
      const supportCount = await prisma.calcrimElementMapping.count({ where: { elementId: el.id } });
      const contradictionCount = await prisma.contradictionPair.count({ where: { caseId, elementId: el.id } });
      const avgConf = await prisma.calcrimElementMapping.aggregate({
        where: { elementId: el.id },
        _avg: { confidence: true },
      });

      let status: string;
      if (supportCount === 0) {
        status = 'unsupported';
        unsupportedCount++;
      } else if (contradictionCount > supportCount) {
        status = 'contradicted';
        contradictedCount++;
      } else if ((avgConf._avg?.confidence ?? 0) < 0.4) {
        status = 'weak';
        weakCount++;
      } else {
        status = 'strong';
        strongCount++;
      }

      elementDetails.push({
        elementId: el.id,
        label: el.label,
        status,
        supportCount,
        contradictionCount,
        confidence: Math.round((avgConf._avg?.confidence ?? 0) * 100) / 100,
      });
    }

    // Collapse score: weighted formula
    const totalElements = elements.length;
    const collapseScore = Math.min(1.0,
      (unsupportedCount * 0.4 + contradictedCount * 0.35 + weakCount * 0.15) / totalElements,
    );

    let collapseLevel: string;
    if (collapseScore >= 0.7) {
      collapseLevel = 'collapsed';
      collapsed++;
    } else if (collapseScore >= 0.4) {
      collapseLevel = 'fractured';
      fractured++;
    } else if (collapseScore >= 0.2) {
      collapseLevel = 'weakened';
      weakened++;
    } else {
      collapseLevel = 'supported';
      supported++;
    }

    const explanation = `CALCRIM ${instruction.instructionNumber}: ${totalElements} elements. ${unsupportedCount} unsupported, ${contradictedCount} contradicted, ${weakCount} weak, ${strongCount} strong. Collapse score: ${Math.round(collapseScore * 100)}%.`;

    await prisma.burdenCollapseScore.create({
      data: {
        caseId,
        instructionId: instruction.id,
        instructionNumber: instruction.instructionNumber,
        totalElements,
        unsupportedElements: unsupportedCount,
        contradictedElements: contradictedCount,
        weakElements: weakCount,
        strongElements: strongCount,
        collapseScore: Math.round(collapseScore * 100) / 100,
        collapseLevel,
        explanation,
        elementDetails: JSON.stringify(elementDetails),
      },
    });
  }

  return {
    caseId,
    scoresComputed: collapsed + fractured + weakened + supported,
    collapsed,
    fractured,
    weakened,
    supported,
    processingTimeMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// 5. Jury Reasonable Doubt Structures
// ---------------------------------------------------------------------------

export async function buildReasonableDoubtStructures(caseId: string): Promise<{
  caseId: string;
  structuresBuilt: number;
  byCategory: Record<string, number>;
  processingTimeMs: number;
}> {
  const startTime = Date.now();
  let structuresBuilt = 0;
  const byCategory: Record<string, number> = {};

  // Clear existing
  await prisma.juryReasonableDoubtStructure.deleteMany({ where: { caseId } });

  // Source 1: Burden gaps → reasonable doubt
  const unsupported = await prisma.burdenFracture.findMany({
    where: { caseId, fractureType: { in: ['unsupported', 'contradicted'] } },
  });

  for (const f of unsupported) {
    await prisma.juryReasonableDoubtStructure.create({
      data: {
        caseId,
        instructionId: f.instructionId,
        doubtCategory: 'burden_gap',
        title: `Prosecution failed to prove element — ${f.fractureType}`,
        narrative: `The prosecution has the burden to prove every element beyond a reasonable doubt. ${f.explanation} This creates reasonable doubt because the prosecution has not met its burden for this element.`,
        supportingCitations: JSON.stringify([{
          text: f.explanation,
          source: 'Burden fracture analysis',
          supportCount: f.supportingCount,
          contradictionCount: f.contradictingCount,
        }]),
        strength: f.fractureType === 'unsupported' ? 'compelling' : 'significant',
        juryInstruction: 'CALCRIM 220: Reasonable Doubt — "Proof beyond a reasonable doubt is proof that leaves you with an abiding conviction that the charge is true."',
      },
    });
    structuresBuilt++;
    byCategory['burden_gap'] = (byCategory['burden_gap'] || 0) + 1;
  }

  // Source 2: Witness contradictions → reasonable doubt
  const witnessIssues = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  const speakerGroups = new Map<string, typeof witnessIssues>();
  for (const w of witnessIssues) {
    const arr = speakerGroups.get(w.speaker) || [];
    arr.push(w);
    speakerGroups.set(w.speaker, arr);
  }

  for (const [speaker, issues] of speakerGroups.entries()) {
    const citations = issues.map((i) => ({
      text: `"${i.statementAText.slice(0, 100)}" vs "${i.statementBText.slice(0, 100)}"`,
      page: `p${i.statementAPage ?? '?'} vs p${i.statementBPage ?? '?'}`,
      speaker,
    }));

    await prisma.juryReasonableDoubtStructure.create({
      data: {
        caseId,
        doubtCategory: 'witness_contradiction',
        title: `Witness ${speaker} gave contradictory statements`,
        narrative: `${speaker} made ${issues.length} contradictory statement(s). Under CALCRIM 226, the jury may consider whether a witness's testimony was consistent or inconsistent. These inconsistencies, proven by the witness's own words, create reasonable doubt about the reliability of ${speaker}'s testimony.`,
        supportingCitations: JSON.stringify(citations),
        strength: issues.length >= 3 ? 'compelling' : issues.some((i) => i.credibilityImpact === 'high') ? 'significant' : 'moderate',
        juryInstruction: 'CALCRIM 226: Witnesses — "In evaluating a witness\'s testimony, you may consider... whether the witness\'s statements were consistent or inconsistent."',
      },
    });
    structuresBuilt++;
    byCategory['witness_contradiction'] = (byCategory['witness_contradiction'] || 0) + 1;
  }

  // Source 3: Timeline impossibilities → reasonable doubt
  const timelineIssues = await prisma.timelineIncompatibility.findMany({ where: { caseId } });
  for (const tl of timelineIssues) {
    await prisma.juryReasonableDoubtStructure.create({
      data: {
        caseId,
        doubtCategory: 'timeline_impossibility',
        title: `Prosecution timeline is physically impossible`,
        narrative: `${tl.explanation} The prosecution's version of events requires physical impossibility. This creates reasonable doubt because the prosecution's theory cannot be true as presented.`,
        supportingCitations: JSON.stringify([{
          text: `Statement A (p${tl.statementAPage ?? '?'}): "${tl.statementAText.slice(0, 100)}"`,
          textB: `Statement B (p${tl.statementBPage ?? '?'}): "${tl.statementBText.slice(0, 100)}"`,
          timestampA: tl.timestampA,
          timestampB: tl.timestampB,
          locationA: tl.locationA,
          locationB: tl.locationB,
        }]),
        strength: tl.severity === 'critical' ? 'compelling' : 'significant',
        juryInstruction: 'CALCRIM 220: Reasonable Doubt',
      },
    });
    structuresBuilt++;
    byCategory['timeline_impossibility'] = (byCategory['timeline_impossibility'] || 0) + 1;
  }

  // Source 4: Collapsed burden scores → reasonable doubt
  const collapsedScores = await prisma.burdenCollapseScore.findMany({
    where: { caseId, collapseLevel: { in: ['collapsed', 'fractured'] } },
  });

  for (const cs of collapsedScores) {
    await prisma.juryReasonableDoubtStructure.create({
      data: {
        caseId,
        instructionId: cs.instructionId,
        doubtCategory: 'burden_gap',
        title: `CALCRIM ${cs.instructionNumber} — prosecution burden ${cs.collapseLevel}`,
        narrative: `${cs.explanation} The prosecution must prove every element of this charge beyond a reasonable doubt. With ${cs.unsupportedElements} unsupported and ${cs.contradictedElements} contradicted elements out of ${cs.totalElements}, the prosecution has not met this burden.`,
        supportingCitations: JSON.stringify([{
          collapseScore: cs.collapseScore,
          unsupported: cs.unsupportedElements,
          contradicted: cs.contradictedElements,
          total: cs.totalElements,
        }]),
        strength: cs.collapseLevel === 'collapsed' ? 'compelling' : 'significant',
        juryInstruction: `CALCRIM 220 + CALCRIM ${cs.instructionNumber}`,
      },
    });
    structuresBuilt++;
    byCategory['burden_gap'] = (byCategory['burden_gap'] || 0) + 1;
  }

  return { caseId, structuresBuilt, byCategory, processingTimeMs: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// 6. Full Defense Synthesis (runs all subsystems)
// ---------------------------------------------------------------------------

export async function runFullDefenseSynthesis(caseId: string): Promise<{
  caseId: string;
  burdenCollapse: Awaited<ReturnType<typeof computeBurdenCollapseScores>>;
  defenseIssues: Awaited<ReturnType<typeof synthesizeDefenseIssues>>;
  motionOpportunities: Awaited<ReturnType<typeof detectMotionOpportunities>>;
  impeachmentPackets: Awaited<ReturnType<typeof buildImpeachmentPackets>>;
  reasonableDoubtStructures: Awaited<ReturnType<typeof buildReasonableDoubtStructures>>;
  totalProcessingTimeMs: number;
}> {
  const startTime = Date.now();

  // Run sequentially — burden collapse first (motions depend on it)
  const burdenCollapse = await computeBurdenCollapseScores(caseId);
  const defenseIssues = await synthesizeDefenseIssues(caseId);
  const motionOpportunities = await detectMotionOpportunities(caseId);
  const impeachmentPackets = await buildImpeachmentPackets(caseId);
  const reasonableDoubtStructures = await buildReasonableDoubtStructures(caseId);

  return {
    caseId,
    burdenCollapse,
    defenseIssues,
    motionOpportunities,
    impeachmentPackets,
    reasonableDoubtStructures,
    totalProcessingTimeMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// 7. Attorney Workspace Data (aggregated pane data)
// ---------------------------------------------------------------------------

export async function getAttorneyWorkspaceData(caseId: string): Promise<{
  caseId: string;
  evidencePane: { totalStatements: number; totalDocuments: number };
  calcrimPane: { charges: number; instructions: number; elements: number };
  contradictionPane: { totalContradictions: number; bySeverity: Record<string, number> };
  prosecutorTheoryPane: { totalAttacks: number; byType: Record<string, number> };
  burdenFracturePane: { totalFractures: number; collapseScores: unknown[] };
  timelinePane: { totalIncompatibilities: number };
  defensePane: {
    issues: unknown[];
    motions: unknown[];
    impeachmentPackets: unknown[];
    reasonableDoubt: unknown[];
  };
}> {
  // Evidence pane
  const totalStatements = await prisma.evidenceStatement.count({ where: { caseId } });
  const totalDocuments = await prisma.evidenceDocument.count({ where: { caseId } });

  // CALCRIM pane
  const charges = await prisma.charge.count({ where: { caseId } });
  const chargeData = await prisma.charge.findMany({
    where: { caseId },
    select: { calcrimInstructionId: true },
  });
  const instructionIds = [...new Set(chargeData.map((c) => c.calcrimInstructionId).filter(Boolean))];
  const elements = instructionIds.length > 0
    ? await prisma.calcrimElement.count({ where: { instructionId: { in: instructionIds as string[] } } })
    : 0;

  // Contradiction pane
  const contBySev = await prisma.contradictionPair.groupBy({
    by: ['severity'],
    where: { caseId },
    _count: true,
  });
  const totalContradictions = contBySev.reduce((s, x) => s + x._count, 0);

  // Prosecutor theory pane
  const atkByType = await prisma.prosecutorTheoryAttack.groupBy({
    by: ['attackType'],
    where: { caseId },
    _count: true,
  });
  const totalAttacks = atkByType.reduce((s, x) => s + x._count, 0);

  // Burden fracture pane
  const totalFractures = await prisma.burdenFracture.count({ where: { caseId } });
  const collapseScores = await prisma.burdenCollapseScore.findMany({
    where: { caseId },
    orderBy: { collapseScore: 'desc' },
  });

  // Timeline pane
  const totalIncompatibilities = await prisma.timelineIncompatibility.count({ where: { caseId } });

  // Defense pane
  const issues = await prisma.defenseIssue.findMany({
    where: { caseId },
    orderBy: { priority: 'asc' },
    take: 50,
  });
  const motions = await prisma.motionOpportunity.findMany({
    where: { caseId },
    orderBy: { priority: 'asc' },
  });
  const impeachmentPackets = await prisma.impeachmentPacket.findMany({
    where: { caseId },
    orderBy: { credibilityScore: 'asc' },
  });
  const reasonableDoubt = await prisma.juryReasonableDoubtStructure.findMany({
    where: { caseId },
    orderBy: { strength: 'asc' },
  });

  return {
    caseId,
    evidencePane: { totalStatements, totalDocuments },
    calcrimPane: { charges, instructions: instructionIds.length, elements },
    contradictionPane: {
      totalContradictions,
      bySeverity: Object.fromEntries(contBySev.map((x) => [x.severity, x._count])),
    },
    prosecutorTheoryPane: {
      totalAttacks,
      byType: Object.fromEntries(atkByType.map((x) => [x.attackType, x._count])),
    },
    burdenFracturePane: { totalFractures, collapseScores },
    timelinePane: { totalIncompatibilities },
    defensePane: { issues, motions, impeachmentPackets, reasonableDoubt },
  };
}
