// ============================================================================
// Phase F.1 — Unified Criminal Defense Intelligence Graph + Cross-Case Pattern Engine
// Organizes lawful litigation intelligence relationships.
// NEVER becomes a surveillance or predictive-enforcement system.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Helper: get or create graph node
// ---------------------------------------------------------------------------

async function getOrCreateNode(
  caseId: string, nodeType: string, sourceTable: string, sourceId: string, label: string, metadata: Record<string, unknown>
): Promise<string> {
  const existing = await prisma.intelligenceGraphNode.findUnique({ where: { sourceTable_sourceId: { sourceTable, sourceId } } });
  if (existing) return existing.id;

  const node = await prisma.intelligenceGraphNode.create({
    data: { caseId, nodeType, sourceTable, sourceId, label, metadata: JSON.stringify(metadata) },
  });
  return node.id;
}

async function createEdge(
  caseId: string, sourceNodeId: string, targetNodeId: string, edgeType: string, weight: number, metadata: Record<string, unknown>
): Promise<void> {
  await prisma.intelligenceGraphEdge.create({
    data: { caseId, sourceNodeId, targetNodeId, edgeType, weight, metadata: JSON.stringify(metadata) },
  });
}

// ---------------------------------------------------------------------------
// 1. Unified Intelligence Graph (deterministic)
// ---------------------------------------------------------------------------

export async function buildUnifiedIntelligenceGraph(caseId: string): Promise<{
  caseId: string; nodesCreated: number; edgesCreated: number;
}> {
  let nodesCreated = 0;
  let edgesCreated = 0;

  // Create nodes from evidence statements
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId }, take: 200 });
  const speakerNodes = new Map<string, string>();

  for (const stmt of statements) {
    const nodeId = await getOrCreateNode(caseId, 'evidence', 'EvidenceStatement', stmt.id,
      `${stmt.speaker || 'Unknown'}: ${stmt.rawText.slice(0, 80)}`,
      { speaker: stmt.speaker, page: stmt.page, lineStart: stmt.lineStart }
    );
    nodesCreated++;

    if (stmt.speaker && !speakerNodes.has(stmt.speaker)) {
      const witnessNodeId = await getOrCreateNode(caseId, 'witness', 'Witness', `${caseId}-${stmt.speaker}`,
        stmt.speaker, { caseId, role: 'witness' }
      );
      speakerNodes.set(stmt.speaker, witnessNodeId);
      nodesCreated++;
    }

    if (stmt.speaker && speakerNodes.has(stmt.speaker)) {
      await createEdge(caseId, speakerNodes.get(stmt.speaker)!, nodeId, 'cites', 1.0, { relationship: 'witness_statement' });
      edgesCreated++;
    }
  }

  // Create contradiction edges
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId }, take: 100 });
  for (const c of contradictions) {
    const nodeA = await getOrCreateNode(caseId, 'contradiction', 'ContradictionPair', c.id,
      `Contradiction: ${c.statementAText.slice(0, 40)} vs ${c.statementBText.slice(0, 40)}`,
      { severity: c.severity }
    );
    nodesCreated++;

    // Link to statement nodes if they exist
    const stmtANode = await prisma.intelligenceGraphNode.findUnique({ where: { sourceTable_sourceId: { sourceTable: 'EvidenceStatement', sourceId: c.statementAId } } });
    const stmtBNode = await prisma.intelligenceGraphNode.findUnique({ where: { sourceTable_sourceId: { sourceTable: 'EvidenceStatement', sourceId: c.statementBId } } });

    if (stmtANode) {
      await createEdge(caseId, nodeA, stmtANode.id, 'contradicts', c.severity === 'critical' ? 1.0 : 0.7, { contradictionId: c.id });
      edgesCreated++;
    }
    if (stmtBNode) {
      await createEdge(caseId, nodeA, stmtBNode.id, 'contradicts', c.severity === 'critical' ? 1.0 : 0.7, { contradictionId: c.id });
      edgesCreated++;
    }
  }

  // Create Brady/Giglio nodes + edges
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  for (const bi of bradyIssues) {
    await getOrCreateNode(caseId, 'brady', 'BradyGiglioIssue', bi.id,
      `Brady: ${bi.issueType} — ${bi.materialityAnalysis.slice(0, 60)}`,
      { issueType: bi.issueType, strength: bi.strength }
    );
    nodesCreated++;
  }

  // Create error preservation nodes
  const errors = await prisma.errorPreservationRecord.findMany({ where: { caseId } });
  for (const err of errors) {
    await getOrCreateNode(caseId, 'error', 'ErrorPreservationRecord', err.id,
      `Error: ${err.errorType} — ${err.errorDescription.slice(0, 60)}`,
      { errorType: err.errorType, preservationStatus: err.preservationStatus }
    );
    nodesCreated++;
  }

  return { caseId, nodesCreated, edgesCreated };
}

// ---------------------------------------------------------------------------
// 2. Cross-Case Witness Indexing (citation-backed)
// ---------------------------------------------------------------------------

export async function indexCrossCaseWitnesses(caseId: string): Promise<{
  caseId: string; witnessesIndexed: number; witnesses: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const inconsistencies = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  const recantations = await prisma.witnessRecantation.findMany({ where: { caseId } });

  const speakerMap = new Map<string, { appearances: number; roles: Set<string> }>();
  for (const stmt of statements) {
    if (!stmt.speaker) continue;
    const entry = speakerMap.get(stmt.speaker) || { appearances: 0, roles: new Set<string>() };
    entry.appearances++;
    entry.roles.add(stmt.statementType || 'unknown');
    speakerMap.set(stmt.speaker, entry);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const [speaker, data] of speakerMap) {
    const normalized = speaker.toLowerCase().trim();
    const inconsistencyCount = inconsistencies.filter(i => i.speaker === speaker).length;
    const recantationCount = recantations.filter(r => r.witnessName === speaker).length;

    const existing = await prisma.crossCaseWitnessIndex.findUnique({ where: { normalizedName: normalized } });

    if (existing) {
      const existingCaseIds: string[] = JSON.parse(existing.caseIds);
      if (!existingCaseIds.includes(caseId)) {
        existingCaseIds.push(caseId);
        await prisma.crossCaseWitnessIndex.update({
          where: { id: existing.id },
          data: {
            caseIds: JSON.stringify(existingCaseIds),
            totalAppearances: existing.totalAppearances + data.appearances,
            inconsistencyCount: existing.inconsistencyCount + inconsistencyCount,
            recantationCount: existing.recantationCount + recantationCount,
          },
        });
        results.push({ id: existing.id, witnessName: speaker, updated: true, totalAppearances: existing.totalAppearances + data.appearances });
      }
    } else {
      const witness = await prisma.crossCaseWitnessIndex.create({
        data: {
          witnessName: speaker,
          normalizedName: normalized,
          caseIds: JSON.stringify([caseId]),
          totalAppearances: data.appearances,
          roles: JSON.stringify(Array.from(data.roles)),
          credibilityHistory: JSON.stringify([{ caseId, inconsistencies: inconsistencyCount, recantations: recantationCount }]),
          inconsistencyCount,
          recantationCount,
          citations: JSON.stringify([{ caseId, statementCount: data.appearances }]),
        },
      });
      results.push({ id: witness.id, witnessName: speaker, totalAppearances: data.appearances });
    }
  }

  return { caseId, witnessesIndexed: results.length, witnesses: results };
}

// ---------------------------------------------------------------------------
// 3. Cross-Case Forensic Pattern Detection (evidence-linked)
// ---------------------------------------------------------------------------

export async function detectCrossCaseForensicPatterns(caseId: string): Promise<{
  caseId: string; patternsDetected: number; patterns: Array<Record<string, unknown>>;
}> {
  const forensicReassessments = await prisma.forensicReliabilityReassessment.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const fr of forensicReassessments) {
    const existing = await prisma.crossCaseForensicPattern.findFirst({ where: { forensicType: fr.forensicType } });

    if (existing) {
      const existingCaseIds: string[] = JSON.parse(existing.caseIds);
      if (!existingCaseIds.includes(caseId)) {
        existingCaseIds.push(caseId);
        await prisma.crossCaseForensicPattern.update({
          where: { id: existing.id },
          data: {
            caseIds: JSON.stringify(existingCaseIds),
            totalOccurrences: existing.totalOccurrences + 1,
            challengedCount: existing.challengedCount + (fr.retestingRecommended ? 1 : 0),
          },
        });
        results.push({ id: existing.id, forensicType: fr.forensicType, updated: true });
      }
    } else {
      const pattern = await prisma.crossCaseForensicPattern.create({
        data: {
          forensicType: fr.forensicType,
          methodologyUsed: fr.originalConclusion.slice(0, 200),
          caseIds: JSON.stringify([caseId]),
          totalOccurrences: 1,
          reliabilityRange: `${fr.reliabilityScore}`,
          challengedCount: fr.retestingRecommended ? 1 : 0,
          currentScientificStatus: fr.currentScientificStatus,
          citations: fr.citations,
        },
      });
      results.push({ id: pattern.id, forensicType: fr.forensicType });
    }
  }

  return { caseId, patternsDetected: results.length, patterns: results };
}

// ---------------------------------------------------------------------------
// 4. Global Contradiction Graph (deterministic)
// ---------------------------------------------------------------------------

export async function buildGlobalContradictionGraph(caseId: string): Promise<{
  caseId: string; networkNodesCreated: number; networks: Array<Record<string, unknown>>;
}> {
  const contradictions = await prisma.contradictionPair.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // Group contradictions by speaker
  const speakerContradictions = new Map<string, typeof contradictions>();
  for (const c of contradictions) {
    const speaker = c.statementAText.slice(0, 30);
    const list = speakerContradictions.get(speaker) || [];
    list.push(c);
    speakerContradictions.set(speaker, list);
  }

  for (const [speaker, contras] of speakerContradictions) {
    for (const c of contras) {
      const connectedIds = contras.filter(cc => cc.id !== c.id).map(cc => cc.id);

      const network = await prisma.globalContradictionNetwork.create({
        data: {
          caseId,
          contradictionId: c.id,
          witnessName: speaker,
          contradictionType: c.contradictionType || 'factual_change',
          severity: c.severity,
          connectedContradictionIds: JSON.stringify(connectedIds),
          networkSize: connectedIds.length + 1,
          citations: JSON.stringify([{
            text: `${c.statementAText.slice(0, 100)} vs ${c.statementBText.slice(0, 100)}`,
          }]),
        },
      });
      results.push({ id: network.id, witnessName: speaker, severity: c.severity, networkSize: network.networkSize });
    }
  }

  return { caseId, networkNodesCreated: results.length, networks: results };
}

// ---------------------------------------------------------------------------
// 5. Prosecutor Theory Recurrence Indexing (aggregate only)
// ---------------------------------------------------------------------------

export async function indexProsecutorTheoryRecurrence(caseId: string): Promise<{
  caseId: string; theoriesIndexed: number; theories: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const THEORY_PATTERNS: Record<string, { regex: RegExp; description: string }> = {
    consciousness_of_guilt: { regex: /\b(consciousness\s+of\s+guilt|fl(ed|ight)|ran\s+from|evad(ed|ing)|destroy(ed|ing)\s+evidence)\b/i, description: 'Flight/concealment as consciousness of guilt' },
    motive_opportunity: { regex: /\b(motive|opportunity|had\s+reason|stood\s+to\s+gain|financial\s+motive)\b/i, description: 'Motive and opportunity theory' },
    forensic_match: { regex: /\b(dna\s+match|fingerprint\s+match|ballistic\s+match|forensic\s+(link|match|evidence))\b/i, description: 'Forensic evidence match theory' },
    eyewitness_id: { regex: /\b(identif(ied|ication)|picked\s+(him|her|them)\s+out|lineup|photo\s+array|recognized)\b/i, description: 'Eyewitness identification theory' },
    confession: { regex: /\b(confess(ed|ion)|admit(ted|ting)|told\s+(police|officers|detective)|stated?\s+that\s+(he|she|they)\s+(did|killed|took))\b/i, description: 'Confession/admission theory' },
  };

  const processedPatterns = new Set<string>();

  for (const stmt of statements) {
    for (const [patternName, pattern] of Object.entries(THEORY_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText) && !processedPatterns.has(patternName)) {
        processedPatterns.add(patternName);

        const existing = await prisma.prosecutorTheoryRecurrence.findFirst({ where: { theoryPattern: patternName } });

        if (existing) {
          const existingCaseIds: string[] = JSON.parse(existing.caseIds);
          if (!existingCaseIds.includes(caseId)) {
            existingCaseIds.push(caseId);
            await prisma.prosecutorTheoryRecurrence.update({
              where: { id: existing.id },
              data: { caseIds: JSON.stringify(existingCaseIds), totalOccurrences: existing.totalOccurrences + 1 },
            });
            results.push({ id: existing.id, theoryPattern: patternName, updated: true });
          }
        } else {
          const theory = await prisma.prosecutorTheoryRecurrence.create({
            data: {
              theoryPattern: patternName,
              description: pattern.description,
              caseIds: JSON.stringify([caseId]),
              totalOccurrences: 1,
              successRate: 0.0,
              commonWeaknesses: JSON.stringify([]),
              citations: JSON.stringify([{ caseId, text: stmt.rawText.slice(0, 200) }]),
            },
          });
          results.push({ id: theory.id, theoryPattern: patternName });
        }
      }
    }
  }

  return { caseId, theoriesIndexed: results.length, theories: results };
}

// ---------------------------------------------------------------------------
// 6. Recurring Brady/Giglio Pattern Tracking (citation-required)
// ---------------------------------------------------------------------------

export async function trackRecurringBradyPatterns(caseId: string): Promise<{
  caseId: string; patternsTracked: number; patterns: Array<Record<string, unknown>>;
}> {
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const bradyReassessments = await prisma.bradyGiglioReassessment.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const allBradyItems = [
    ...bradyIssues.map(bi => ({ type: bi.issueType, description: bi.description, citations: bi.citations, materiality: bi.materialityAnalysis })),
    ...bradyReassessments.map(br => ({ type: br.reassessmentType, description: br.description, citations: br.citations, materiality: br.materialityAnalysis })),
  ];

  // Group by type
  const typeGroups = new Map<string, typeof allBradyItems>();
  for (const item of allBradyItems) {
    const list = typeGroups.get(item.type) || [];
    list.push(item);
    typeGroups.set(item.type, list);
  }

  for (const [patternType, items] of typeGroups) {
    const existing = await prisma.recurringBradyPattern.findFirst({ where: { patternType } });

    if (existing) {
      const existingCaseIds: string[] = JSON.parse(existing.caseIds);
      if (!existingCaseIds.includes(caseId)) {
        existingCaseIds.push(caseId);
        await prisma.recurringBradyPattern.update({
          where: { id: existing.id },
          data: { caseIds: JSON.stringify(existingCaseIds), totalOccurrences: existing.totalOccurrences + items.length },
        });
        results.push({ id: existing.id, patternType, updated: true });
      }
    } else {
      const pattern = await prisma.recurringBradyPattern.create({
        data: {
          patternType,
          description: items[0].description.slice(0, 300),
          caseIds: JSON.stringify([caseId]),
          totalOccurrences: items.length,
          materialityAssessments: JSON.stringify(items.map(i => ({ materiality: i.materiality }))),
          citations: JSON.stringify(items.map(i => ({ description: i.description.slice(0, 100) }))),
        },
      });
      results.push({ id: pattern.id, patternType, occurrences: items.length });
    }
  }

  return { caseId, patternsTracked: results.length, patterns: results };
}

// ---------------------------------------------------------------------------
// 7. Law Enforcement Credibility Indexing (aggregate only)
// ---------------------------------------------------------------------------

export async function indexLawEnforcementCredibility(caseId: string): Promise<{
  caseId: string; officersIndexed: number; officers: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const inconsistencies = await prisma.witnessInconsistency.findMany({ where: { caseId } });
  // Identify law enforcement speakers
  const officerPattern = /\b(officer|detective|sergeant|deputy|agent|corporal|lieutenant|captain|inspector)\b/i;
  const officers = new Map<string, { inconsistencies: number; bradyIssues: number }>();

  for (const stmt of statements) {
    if (stmt.speaker && officerPattern.test(stmt.speaker)) {
      if (!officers.has(stmt.speaker)) {
        officers.set(stmt.speaker, { inconsistencies: 0, bradyIssues: 0 });
      }
    }
  }

  for (const inc of inconsistencies) {
    if (officers.has(inc.speaker)) {
      const data = officers.get(inc.speaker)!;
      data.inconsistencies++;
    }
  }

  const results: Array<Record<string, unknown>> = [];

  for (const [officer, data] of officers) {
    const identifier = officer.toLowerCase().trim();
    const existing = await prisma.lawEnforcementCredibilityIndex.findUnique({ where: { officerIdentifier: identifier } });

    let aggregateCredibility: string;
    if (data.inconsistencies >= 3 || data.bradyIssues >= 1) aggregateCredibility = 'aggregate_concern';
    else if (data.inconsistencies >= 1) aggregateCredibility = 'no_pattern';
    else aggregateCredibility = 'insufficient_data';

    if (existing) {
      const existingCaseIds: string[] = JSON.parse(existing.caseIds);
      if (!existingCaseIds.includes(caseId)) {
        existingCaseIds.push(caseId);
        await prisma.lawEnforcementCredibilityIndex.update({
          where: { id: existing.id },
          data: {
            caseIds: JSON.stringify(existingCaseIds),
            totalCaseAppearances: existing.totalCaseAppearances + 1,
            inconsistencyCount: existing.inconsistencyCount + data.inconsistencies,
            bradyIssueCount: existing.bradyIssueCount + data.bradyIssues,
            aggregateCredibility,
          },
        });
        results.push({ id: existing.id, officer, updated: true });
      }
    } else {
      const entry = await prisma.lawEnforcementCredibilityIndex.create({
        data: {
          officerIdentifier: identifier,
          caseIds: JSON.stringify([caseId]),
          totalCaseAppearances: 1,
          inconsistencyCount: data.inconsistencies,
          bradyIssueCount: data.bradyIssues,
          pitchessRelevant: data.inconsistencies >= 3,
          aggregateCredibility,
          citations: JSON.stringify([{ caseId, inconsistencies: data.inconsistencies }]),
        },
      });
      results.push({ id: entry.id, officer, aggregateCredibility });
    }
  }

  return { caseId, officersIndexed: results.length, officers: results };
}

// ---------------------------------------------------------------------------
// 8. Forensic Methodology Recurrence (deterministic)
// ---------------------------------------------------------------------------

// Covered by subsystem 3 (Cross-Case Forensic Pattern Detection) — this is the per-case
// forensic methodology analysis that feeds into the cross-case system.
export async function analyzeForensicMethodologyRecurrence(caseId: string): Promise<{
  caseId: string; patternsDetected: number; patterns: Array<Record<string, unknown>>;
}> {
  return detectCrossCaseForensicPatterns(caseId);
}

// ---------------------------------------------------------------------------
// 9. Evidence Provenance Graph (immutable linkage)
// ---------------------------------------------------------------------------

export async function buildEvidenceProvenanceGraph(caseId: string): Promise<{
  caseId: string; provenanceChainsBuilt: number; chains: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const custodyIssues = await prisma.chainOfCustodyIssue.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // Group by document
  const documentGroups = new Map<string, typeof statements>();
  for (const stmt of statements) {
    const docId = stmt.documentId || 'unknown';
    const list = documentGroups.get(docId) || [];
    list.push(stmt);
    documentGroups.set(docId, list);
  }

  for (const [docId, stmts] of documentGroups) {
    if (docId === 'unknown') continue;

    const doc = stmts[0]?.document;
    const custodyIssuesForDoc = custodyIssues.filter(ci =>
      ci.explanation.includes(doc?.fileName || '')
    );

    const provenanceChain = [
      { stage: 'collection', source: doc?.documentType || 'unknown', timestamp: doc?.createdAt?.toISOString() || 'unknown' },
      { stage: 'processing', status: doc?.processingStatus || 'unknown' },
      { stage: 'analysis', statements: stmts.length },
    ];

    const hasGaps = custodyIssuesForDoc.length > 0;
    const integrityStatus = hasGaps ? 'questioned' : 'intact';

    const provenance = await prisma.evidenceProvenanceGraph.create({
      data: {
        caseId,
        evidenceId: docId,
        provenanceChain: JSON.stringify(provenanceChain),
        chainLength: provenanceChain.length,
        integrityStatus,
        gapLocations: JSON.stringify(custodyIssuesForDoc.map(ci => ({ issue: ci.issueType, description: ci.explanation.slice(0, 100) }))),

        custodyTransfers: provenanceChain.length - 1,
        citations: JSON.stringify([{ documentId: docId, fileName: doc?.fileName }]),
      },
    });
    results.push({ id: provenance.id, evidenceId: docId, integrityStatus, chainLength: provenanceChain.length });
  }

  return { caseId, provenanceChainsBuilt: results.length, chains: results };
}

// ---------------------------------------------------------------------------
// 10. Multi-Case Timeline Correlation (evidence-linked)
// ---------------------------------------------------------------------------

export async function correlateMultiCaseTimelines(caseId: string): Promise<{
  caseId: string; correlationsFound: number; correlations: Array<Record<string, unknown>>;
}> {
  // Find other cases with shared witnesses
  const crossWitnesses = await prisma.crossCaseWitnessIndex.findMany({
    where: { totalAppearances: { gte: 2 } },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const cw of crossWitnesses) {
    const caseIds: string[] = JSON.parse(cw.caseIds);
    if (!caseIds.includes(caseId)) continue;

    for (const otherCaseId of caseIds) {
      if (otherCaseId === caseId) continue;

      // Check if correlation already exists
      const existing = await prisma.multiCaseTimelineCorrelation.findFirst({
        where: { caseIdA: caseId, caseIdB: otherCaseId, correlationType: 'witness_reuse' },
      });
      if (existing) continue;

      const correlation = await prisma.multiCaseTimelineCorrelation.create({
        data: {
          correlationType: 'witness_reuse',
          caseIdA: caseId,
          caseIdB: otherCaseId,
          description: `Witness "${cw.witnessName}" appears in both cases. ${cw.inconsistencyCount} total inconsistencies across cases.`,
          correlationStrength: Math.min(1.0, cw.totalAppearances * 0.2),
          sharedElements: JSON.stringify([{ witnessName: cw.witnessName, appearances: cw.totalAppearances }]),
          legalSignificance: cw.inconsistencyCount > 0
            ? 'Shared witness with inconsistencies across cases — potential impeachment value and Pitchess relevance.'
            : 'Shared witness across cases — may indicate recurring involvement.',
          citations: cw.citations,
        },
      });
      results.push({ id: correlation.id, otherCaseId, witness: cw.witnessName });
    }
  }

  // Forensic method reuse correlations
  const crossForensic = await prisma.crossCaseForensicPattern.findMany({
    where: { totalOccurrences: { gte: 2 } },
  });

  for (const cf of crossForensic) {
    const fCaseIds: string[] = JSON.parse(cf.caseIds);
    if (!fCaseIds.includes(caseId)) continue;

    for (const otherCaseId of fCaseIds) {
      if (otherCaseId === caseId) continue;

      const existing = await prisma.multiCaseTimelineCorrelation.findFirst({
        where: { caseIdA: caseId, caseIdB: otherCaseId, correlationType: 'forensic_reuse' },
      });
      if (existing) continue;

      const correlation = await prisma.multiCaseTimelineCorrelation.create({
        data: {
          correlationType: 'forensic_reuse',
          caseIdA: caseId,
          caseIdB: otherCaseId,
          description: `Same forensic methodology "${cf.forensicType}" used in both cases. Scientific status: ${cf.currentScientificStatus}.`,
          correlationStrength: cf.currentScientificStatus === 'debunked' ? 0.9 : cf.currentScientificStatus === 'questioned' ? 0.6 : 0.3,
          sharedElements: JSON.stringify([{ forensicType: cf.forensicType, status: cf.currentScientificStatus }]),
          legalSignificance: cf.currentScientificStatus === 'debunked' || cf.currentScientificStatus === 'questioned'
            ? 'Shared questionable forensic methodology — may support challenge to forensic evidence in both cases.'
            : 'Shared forensic methodology across cases.',
          citations: cf.citations,
        },
      });
      results.push({ id: correlation.id, otherCaseId, forensicType: cf.forensicType });
    }
  }

  return { caseId, correlationsFound: results.length, correlations: results };
}

// ---------------------------------------------------------------------------
// 11. Full Unified Intelligence Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullUnifiedIntelligenceAnalysis(caseId: string): Promise<Record<string, unknown>> {
  const graph = await buildUnifiedIntelligenceGraph(caseId);
  const witnesses = await indexCrossCaseWitnesses(caseId);
  const forensicPatterns = await detectCrossCaseForensicPatterns(caseId);
  const contradictionNetwork = await buildGlobalContradictionGraph(caseId);
  const theoryRecurrence = await indexProsecutorTheoryRecurrence(caseId);
  const bradyPatterns = await trackRecurringBradyPatterns(caseId);
  const leCredibility = await indexLawEnforcementCredibility(caseId);
  const provenance = await buildEvidenceProvenanceGraph(caseId);
  const correlations = await correlateMultiCaseTimelines(caseId);

  return {
    caseId,
    summary: {
      graphNodes: graph.nodesCreated,
      graphEdges: graph.edgesCreated,
      crossCaseWitnesses: witnesses.witnessesIndexed,
      forensicPatterns: forensicPatterns.patternsDetected,
      contradictionNetworkNodes: contradictionNetwork.networkNodesCreated,
      prosecutorTheories: theoryRecurrence.theoriesIndexed,
      bradyPatterns: bradyPatterns.patternsTracked,
      lawEnforcementOfficers: leCredibility.officersIndexed,
      provenanceChains: provenance.provenanceChainsBuilt,
      timelineCorrelations: correlations.correlationsFound,
    },
    principle: 'CourtAccess organizes lawful litigation intelligence relationships. It does NOT become a surveillance or predictive-enforcement system.',
  };
}
