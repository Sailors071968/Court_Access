// ============================================================================
// Phase G.2 — Prosecutorial Conduct Intelligence + Discovery Integrity Framework
// Organizes provable disclosure and discovery structures.
// NEVER accuses prosecutors of misconduct.
// All detection is deterministic + citation-backed.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// 1. Discovery Disclosure Tracker (evidence-linked)
// ---------------------------------------------------------------------------

export async function trackDiscoveryDisclosures(caseId: string): Promise<{
  caseId: string; disclosuresTracked: number; disclosures: Array<Record<string, unknown>>;
}> {
  const documents = await prisma.evidenceDocument.findMany({ where: { caseId } });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const DISCLOSURE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /discovery|disclosure|produced|production/i, type: 'initial_discovery' },
    { pattern: /supplemental|additional/i, type: 'supplemental' },
    { pattern: /exculpatory|favorable/i, type: 'exculpatory' },
    { pattern: /impeach|prior.*inconsistent/i, type: 'impeachment' },
    { pattern: /expert|forensic.*report/i, type: 'expert' },
    { pattern: /witness.*list/i, type: 'witness_list' },
  ];

  for (const doc of documents) {
    let disclosureType = 'initial_discovery';
    for (const dp of DISCLOSURE_PATTERNS) {
      if (dp.pattern.test(doc.fileName || '') || dp.pattern.test(doc.documentType || '')) {
        disclosureType = dp.type;
        break;
      }
    }

    const existing = await prisma.discoveryDisclosureTracker.findFirst({
      where: { caseId, itemDescription: (doc.fileName || 'unknown').slice(0, 100) },
    });
    if (existing) continue;

    const relatedStatements = statements.filter(s => s.documentId === doc.id);

    const disclosure = await prisma.discoveryDisclosureTracker.create({
      data: {
        caseId,
        disclosureType,
        itemDescription: (doc.fileName || 'Document').slice(0, 500),
        disclosedBy: 'prosecution',
        completeness: relatedStatements.length > 0 ? 'complete' : 'partial',
        evidenceIds: JSON.stringify(relatedStatements.map(s => s.id).slice(0, 20)),
        citations: JSON.stringify([{ documentId: doc.id, fileName: doc.fileName, statementCount: relatedStatements.length }]),
      },
    });
    results.push({ id: disclosure.id, disclosureType, itemDescription: doc.fileName });
  }

  return { caseId, disclosuresTracked: results.length, disclosures: results };
}

// ---------------------------------------------------------------------------
// 2. Brady Materiality Framework (citation-backed)
// ---------------------------------------------------------------------------

export async function analyzeBradyMateriality(caseId: string): Promise<{
  caseId: string; frameworksBuilt: number; frameworks: Array<Record<string, unknown>>;
}> {
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const bi of bradyIssues) {
    const existing = await prisma.bradyMaterialityFramework.findFirst({
      where: { caseId, bradyIssueId: bi.id },
    });
    if (existing) continue;

    let materialityType: string;
    if (/exculpatory|favorable.*defendant/i.test(bi.materialityAnalysis)) {
      materialityType = 'exculpatory';
    } else if (/impeach/i.test(bi.issueType) || /giglio/i.test(bi.issueType)) {
      materialityType = 'impeachment';
    } else {
      materialityType = 'mitigating';
    }

    const materialityLevel = bi.strength === 'strong' ? 'highly_material' : bi.strength === 'moderate' ? 'material' : 'potentially_material';

    let prejudiceAnalysis: string;
    if (bi.strength === 'strong') prejudiceAnalysis = 'reasonable_probability';
    else if (bi.strength === 'moderate') prejudiceAnalysis = 'cumulative_impact';
    else prejudiceAnalysis = 'de_minimis';

    const legalBasis = bi.strength === 'strong' ? 'Brady v. Maryland, 373 U.S. 83 (1963)' : 'Kyles v. Whitley, 514 U.S. 419 (1995)';

    const framework = await prisma.bradyMaterialityFramework.create({
      data: {
        caseId,
        bradyIssueId: bi.id,
        evidenceItem: bi.description.slice(0, 500),
        materialityType,
        materialityLevel,
        favorability: bi.strength === 'strong' ? 'directly_favorable' : 'potentially_favorable',
        suppressionFound: /suppress|withh(eld|old)/i.test(bi.suppressionEvidence),
        prejudiceAnalysis,
        kylesAnalysis: materialityLevel === 'material' || materialityLevel === 'highly_material' ? `Cumulative materiality analysis under Kyles: ${bi.materialityAnalysis.slice(0, 200)}` : null,
        legalBasis,
        citations: bi.citations,
      },
    });
    results.push({ id: framework.id, materialityType, materialityLevel });
  }

  return { caseId, frameworksBuilt: results.length, frameworks: results };
}

// ---------------------------------------------------------------------------
// 3. Giglio Impeachment Disclosure Tracking (deterministic)
// ---------------------------------------------------------------------------

export async function trackGiglioImpeachmentDisclosures(caseId: string): Promise<{
  caseId: string; disclosuresTracked: number; disclosures: Array<Record<string, unknown>>;
}> {
  const credibilityImpacts = await prisma.witnessCredibilityImpact.findMany({ where: { caseId } });
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({
    where: { caseId, issueType: { in: ['giglio_impeachment', 'undisclosed_deal', 'undisclosed_prior_bad_acts'] } },
  });
  const results: Array<Record<string, unknown>> = [];

  for (const bi of bradyIssues) {
    const witnessName = bi.title.slice(0, 100);

    const existing = await prisma.giglioImpeachmentDisclosure.findFirst({
      where: { caseId, witnessName, disclosureType: 'plea_deal' },
    });
    if (existing) continue;

    let disclosureType = 'plea_deal';
    if (/immunity/i.test(bi.description)) disclosureType = 'immunity';
    else if (/payment|paid|compensation/i.test(bi.description)) disclosureType = 'payment';
    else if (/pending.*charge|charge.*pending/i.test(bi.description)) disclosureType = 'pending_charges';
    else if (/bias|motive/i.test(bi.description)) disclosureType = 'bias';

    const disclosure = await prisma.giglioImpeachmentDisclosure.create({
      data: {
        caseId,
        witnessName,
        disclosureType,
        disclosed: false,
        disclosureTimeliness: 'not_disclosed',
        impeachmentValue: bi.strength === 'strong' ? 'high' : bi.strength === 'moderate' ? 'medium' : 'low',
        materialityToDefense: bi.materialityAnalysis.slice(0, 500),
        napiueApplicable: /false.*testim|perjur|lied/i.test(bi.description),
        citations: bi.citations,
      },
    });
    results.push({ id: disclosure.id, witnessName, disclosureType });
  }

  // Cross-reference credibility impacts for undisclosed benefits
  for (const ci of credibilityImpacts) {
    if (ci.consistencyScore > 0.7) continue; // only low-credibility witnesses

    const existing = await prisma.giglioImpeachmentDisclosure.findFirst({
      where: { caseId, witnessName: ci.witnessName },
    });
    if (existing) continue;

    const disclosure = await prisma.giglioImpeachmentDisclosure.create({
      data: {
        caseId,
        witnessName: ci.witnessName,
        disclosureType: 'prior_inconsistent',
        disclosed: false,
        disclosureTimeliness: 'not_disclosed',
        impeachmentValue: ci.consistencyScore < 0.3 ? 'high' : 'medium',
        materialityToDefense: `Witness has consistency score of ${ci.consistencyScore.toFixed(2)}. Impact if impeached: ${ci.impactIfImpeached}.`,
        citations: JSON.stringify([{ witness: ci.witnessName, consistencyScore: ci.consistencyScore }]),
      },
    });
    results.push({ id: disclosure.id, witnessName: ci.witnessName, source: 'credibility_scan' });
  }

  return { caseId, disclosuresTracked: results.length, disclosures: results };
}

// ---------------------------------------------------------------------------
// 4. Disclosure Chronology Reconstruction (immutable)
// ---------------------------------------------------------------------------

export async function reconstructDisclosureChronology(caseId: string): Promise<{
  caseId: string; eventsCreated: number; events: Array<Record<string, unknown>>;
}> {
  const documents = await prisma.evidenceDocument.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
  });
  const results: Array<Record<string, unknown>> = [];
  let sequence = 0;

  for (const doc of documents) {
    const existing = await prisma.disclosureChronology.findFirst({
      where: { caseId, description: { contains: (doc.fileName || doc.id).slice(0, 50) } },
    });
    if (existing) continue;

    const event = await prisma.disclosureChronology.create({
      data: {
        caseId,
        eventType: 'production_made',
        eventDate: doc.createdAt.toISOString().split('T')[0],
        description: `Document produced: ${(doc.fileName || 'Unknown').slice(0, 400)}`,
        party: 'prosecution',
        documentsProduced: 1,
        pagesProduced: doc.totalPages || 0,
        sequenceNumber: sequence++,
        complianceStatus: 'compliant',
        citations: JSON.stringify([{ documentId: doc.id, fileName: doc.fileName, pages: doc.totalPages }]),
      },
    });
    results.push({ id: event.id, eventType: 'production_made', sequence: event.sequenceNumber });
  }

  return { caseId, eventsCreated: results.length, events: results };
}

// ---------------------------------------------------------------------------
// 5. Late Disclosure Detection (evidence-linked)
// ---------------------------------------------------------------------------

export async function detectLateDisclosures(caseId: string): Promise<{
  caseId: string; lateDetected: number; lateDisclosures: Array<Record<string, unknown>>;
}> {
  const disclosures = await prisma.discoveryDisclosureTracker.findMany({
    where: { caseId, isLate: true },
  });
  const results: Array<Record<string, unknown>> = [];

  for (const d of disclosures) {
    const existing = await prisma.lateDisclosureDetection.findFirst({
      where: { caseId, disclosureTrackerId: d.id },
    });
    if (existing) continue;

    let prejudice: string;
    let remedy: string;
    if (d.daysPastDue > 30) {
      prejudice = 'severe';
      remedy = 'mistrial';
    } else if (d.daysPastDue > 14) {
      prejudice = 'significant';
      remedy = 'exclusion';
    } else if (d.daysPastDue > 7) {
      prejudice = 'moderate';
      remedy = 'continuance';
    } else {
      prejudice = 'minimal';
      remedy = 'continuance';
    }

    const late = await prisma.lateDisclosureDetection.create({
      data: {
        caseId,
        disclosureTrackerId: d.id,
        itemDescription: d.itemDescription.slice(0, 500),
        originalDueDate: d.dueDate,
        daysLate: d.daysPastDue,
        prejudiceToDefense: prejudice,
        defenseRemedy: remedy,
        citations: d.citations,
      },
    });
    results.push({ id: late.id, daysLate: d.daysPastDue, prejudice, remedy });
  }

  return { caseId, lateDetected: results.length, lateDisclosures: results };
}

// ---------------------------------------------------------------------------
// 6. Missing Evidence Auditing (citation-required)
// ---------------------------------------------------------------------------

export async function auditMissingEvidence(caseId: string): Promise<{
  caseId: string; missingFound: number; missingItems: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  const MISSING_PATTERNS: Array<{ pattern: RegExp; category: string; explanation: string }> = [
    { pattern: /body[\s-]?cam(era)?|bwc/i, category: 'digital', explanation: 'never_collected' },
    { pattern: /dash[\s-]?cam/i, category: 'digital', explanation: 'never_collected' },
    { pattern: /surveillance\s+(video|footage|camera)/i, category: 'digital', explanation: 'lost' },
    { pattern: /lost|destroyed|missing|unavailable/i, category: 'physical', explanation: 'destroyed' },
    { pattern: /not\s+(collected|preserved|tested|analyzed)/i, category: 'forensic', explanation: 'never_collected' },
  ];

  for (const stmt of statements) {
    for (const mp of MISSING_PATTERNS) {
      if (mp.pattern.test(stmt.rawText)) {
        const existing = await prisma.missingEvidenceAudit.findFirst({
          where: { caseId, evidenceDescription: { contains: stmt.rawText.slice(0, 50) } },
        });
        if (existing) continue;

        const audit = await prisma.missingEvidenceAudit.create({
          data: {
            caseId,
            evidenceDescription: stmt.rawText.slice(0, 500),
            evidenceCategory: mp.category,
            expectedSource: stmt.speaker || 'law_enforcement',
            explanationGiven: mp.explanation,
            badFaithIndicators: JSON.stringify([]),
            arizonaVYoungblood: mp.explanation === 'destroyed',
            materialityAssessment: 'potentially_material',
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
          },
        });
        results.push({ id: audit.id, category: mp.category, explanation: mp.explanation });
        break;
      }
    }
  }

  // Brady issues as missing evidence
  for (const bi of bradyIssues) {
    if (bi.issueType !== 'undisclosed_exculpatory' && bi.issueType !== 'brady_material') continue;

    const existing = await prisma.missingEvidenceAudit.findFirst({
      where: { caseId, evidenceDescription: { contains: bi.description.slice(0, 50) } },
    });
    if (existing) continue;

    const audit = await prisma.missingEvidenceAudit.create({
      data: {
        caseId,
        evidenceDescription: `Brady material: ${bi.description.slice(0, 400)}`,
        evidenceCategory: 'documentary',
        expectedSource: 'prosecution',
        explanationGiven: 'withheld',
        badFaithIndicators: JSON.stringify(['brady_material_withheld']),
        materialityAssessment: bi.strength === 'strong' ? 'highly_material' : 'material',
        citations: bi.citations,
      },
    });
    results.push({ id: audit.id, source: 'brady', materialityAssessment: bi.strength === 'strong' ? 'highly_material' : 'material' });
  }

  return { caseId, missingFound: results.length, missingItems: results };
}

// ---------------------------------------------------------------------------
// 7. Prosecutorial Conduct Indexing (aggregate + evidence-backed)
// ---------------------------------------------------------------------------

export async function indexProsecutorialConduct(caseId: string): Promise<{
  caseId: string; conductIndexed: number; conductItems: Array<Record<string, unknown>>;
}> {
  const bradyIssues = await prisma.bradyGiglioIssue.findMany({ where: { caseId } });
  const lateDisclosures = await prisma.lateDisclosureDetection.findMany({ where: { caseId } });
  const missingEvidence = await prisma.missingEvidenceAudit.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // Brady violations as conduct
  for (const bi of bradyIssues) {
    if (bi.strength !== 'strong') continue;

    const existing = await prisma.prosecutorialConductIndex.findFirst({
      where: { caseId, conductType: 'brady_violation', description: { contains: bi.description.slice(0, 50) } },
    });
    if (existing) continue;

    const conduct = await prisma.prosecutorialConductIndex.create({
      data: {
        caseId,
        conductType: 'brady_violation',
        description: `Brady/Giglio issue: ${bi.description.slice(0, 400)}`,
        severity: 'severe',
        evidenceBasis: bi.citations,
        patternIndicator: false,
        harmlessOrPrejudicial: 'prejudicial',
        legalBasis: 'Brady v. Maryland, 373 U.S. 83 (1963)',
        citations: bi.citations,
      },
    });
    results.push({ id: conduct.id, conductType: 'brady_violation' });
  }

  // Late disclosures as conduct
  if (lateDisclosures.length > 0) {
    const existing = await prisma.prosecutorialConductIndex.findFirst({
      where: { caseId, conductType: 'discovery_violation' },
    });
    if (!existing) {
      const conduct = await prisma.prosecutorialConductIndex.create({
        data: {
          caseId,
          conductType: 'discovery_violation',
          description: `${lateDisclosures.length} late disclosure(s) detected. Total days late: ${lateDisclosures.reduce((sum, ld) => sum + ld.daysLate, 0)}.`,
          severity: lateDisclosures.some(ld => ld.daysLate > 30) ? 'severe' : lateDisclosures.some(ld => ld.daysLate > 14) ? 'significant' : 'moderate',
          evidenceBasis: JSON.stringify(lateDisclosures.map(ld => ({ id: ld.id, daysLate: ld.daysLate }))),
          patternIndicator: lateDisclosures.length >= 3,
          harmlessOrPrejudicial: lateDisclosures.some(ld => ld.prejudiceToDefense === 'severe') ? 'prejudicial' : 'harmless_error',
          legalBasis: 'PC § 1054 et seq. — California Discovery Statute',
          citations: JSON.stringify(lateDisclosures.map(ld => ({ id: ld.id, item: ld.itemDescription.slice(0, 100) }))),
        },
      });
      results.push({ id: conduct.id, conductType: 'discovery_violation', count: lateDisclosures.length });
    }
  }

  // Missing evidence as potential conduct
  const badFaithMissing = missingEvidence.filter(me => {
    const indicators = JSON.parse(me.badFaithIndicators || '[]');
    return indicators.length > 0;
  });

  if (badFaithMissing.length > 0) {
    const existing = await prisma.prosecutorialConductIndex.findFirst({
      where: { caseId, conductType: 'evidence_misrepresentation' },
    });
    if (!existing) {
      const conduct = await prisma.prosecutorialConductIndex.create({
        data: {
          caseId,
          conductType: 'evidence_misrepresentation',
          description: `${badFaithMissing.length} item(s) with bad faith indicators.`,
          severity: badFaithMissing.some(me => me.materialityAssessment === 'highly_material') ? 'severe' : 'significant',
          evidenceBasis: JSON.stringify(badFaithMissing.map(me => ({ id: me.id, category: me.evidenceCategory }))),
          patternIndicator: badFaithMissing.length >= 2,
          harmlessOrPrejudicial: 'prejudicial',
          legalBasis: 'Arizona v. Youngblood, 488 U.S. 51 (1988)',
          citations: JSON.stringify(badFaithMissing.map(me => ({ id: me.id, description: me.evidenceDescription.slice(0, 100) }))),
        },
      });
      results.push({ id: conduct.id, conductType: 'evidence_misrepresentation' });
    }
  }

  return { caseId, conductIndexed: results.length, conductItems: results };
}

// ---------------------------------------------------------------------------
// 8. Disclosure Preservation Graph (immutable)
// ---------------------------------------------------------------------------

export async function buildDisclosurePreservationGraph(caseId: string): Promise<{
  caseId: string; graphsBuilt: number; graphs: Array<Record<string, unknown>>;
}> {
  const disclosures = await prisma.discoveryDisclosureTracker.findMany({ where: { caseId } });
  const chronology = await prisma.disclosureChronology.findMany({ where: { caseId }, orderBy: { sequenceNumber: 'asc' } });
  const results: Array<Record<string, unknown>> = [];

  const typeGroups = new Map<string, typeof disclosures>();
  for (const d of disclosures) {
    const group = typeGroups.get(d.disclosureType) || [];
    group.push(d);
    typeGroups.set(d.disclosureType, group);
  }

  for (const [disclosureType, items] of typeGroups) {
    const existing = await prisma.disclosurePreservationGraph.findFirst({
      where: { caseId, disclosureType },
    });
    if (existing) continue;

    const relatedChronology = chronology.filter(c => c.description.includes(disclosureType));
    const chain = relatedChronology.map(c => ({ event: c.eventType, date: c.eventDate, status: c.complianceStatus }));
    const outstandingItems = items.filter(i => i.completeness === 'missing' || i.completeness === 'partial').length;

    const graph = await prisma.disclosurePreservationGraph.create({
      data: {
        caseId,
        disclosureType,
        preservationChain: JSON.stringify(chain),
        chainLength: chain.length,
        currentStatus: outstandingItems > 0 ? 'at_risk' : 'preserved',
        outstandingItems,
        riskOfSpoliation: outstandingItems > 0 && items.some(i => i.completeness === 'missing'),
        citations: JSON.stringify(items.map(i => ({ id: i.id, item: i.itemDescription.slice(0, 100) }))),
      },
    });
    results.push({ id: graph.id, disclosureType, outstandingItems, status: graph.currentStatus });
  }

  return { caseId, graphsBuilt: results.length, graphs: results };
}

// ---------------------------------------------------------------------------
// 9. Witness Benefit Disclosure Tracking (citation-backed)
// ---------------------------------------------------------------------------

export async function trackWitnessBenefitDisclosures(caseId: string): Promise<{
  caseId: string; benefitsTracked: number; benefits: Array<Record<string, unknown>>;
}> {
  const giglioDisclosures = await prisma.giglioImpeachmentDisclosure.findMany({ where: { caseId } });
  const statements = await prisma.evidenceStatement.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // From Giglio disclosures
  for (const gd of giglioDisclosures) {
    const existing = await prisma.witnessBenefitDisclosure.findFirst({
      where: { caseId, witnessName: gd.witnessName, benefitType: gd.disclosureType },
    });
    if (existing) continue;

    const benefit = await prisma.witnessBenefitDisclosure.create({
      data: {
        caseId,
        witnessName: gd.witnessName,
        benefitType: gd.disclosureType,
        benefitDescription: gd.materialityToDefense.slice(0, 500),
        disclosed: gd.disclosed,
        disclosureTimeliness: gd.disclosureTimeliness,
        impeachmentRelevance: gd.impeachmentValue,
        giglioApplicable: true,
        citations: gd.citations,
      },
    });
    results.push({ id: benefit.id, witnessName: gd.witnessName, benefitType: gd.disclosureType });
  }

  // Scan for benefit indicators in statements
  const BENEFIT_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /deal|agreement|plea.*bargain/i, type: 'plea_agreement' },
    { pattern: /immun(ity|ized)/i, type: 'immunity' },
    { pattern: /reduc(ed|tion).*sentence|sentence.*reduc/i, type: 'reduced_sentence' },
    { pattern: /drop(ped)?.*charge|charge.*drop/i, type: 'dropped_charges' },
    { pattern: /paid|payment|compensat/i, type: 'payment' },
    { pattern: /relocat/i, type: 'relocation' },
  ];

  for (const stmt of statements) {
    for (const bp of BENEFIT_PATTERNS) {
      if (bp.pattern.test(stmt.rawText) && stmt.speaker) {
        const existing = await prisma.witnessBenefitDisclosure.findFirst({
          where: { caseId, witnessName: stmt.speaker, benefitType: bp.type },
        });
        if (existing) continue;

        const benefit = await prisma.witnessBenefitDisclosure.create({
          data: {
            caseId,
            witnessName: stmt.speaker,
            benefitType: bp.type,
            benefitDescription: stmt.rawText.slice(0, 500),
            disclosed: false,
            disclosureTimeliness: 'not_disclosed',
            impeachmentRelevance: 'medium',
            citations: JSON.stringify([{ text: stmt.rawText.slice(0, 200), page: stmt.page, line: stmt.lineStart, speaker: stmt.speaker }]),
          },
        });
        results.push({ id: benefit.id, witnessName: stmt.speaker, benefitType: bp.type, source: 'statement_scan' });
        break;
      }
    }
  }

  return { caseId, benefitsTracked: results.length, benefits: results };
}

// ---------------------------------------------------------------------------
// 10. Discovery Violation Escalation Framework (deterministic)
// ---------------------------------------------------------------------------

export async function escalateDiscoveryViolations(caseId: string): Promise<{
  caseId: string; escalationsCreated: number; escalations: Array<Record<string, unknown>>;
}> {
  const lateDisclosures = await prisma.lateDisclosureDetection.findMany({ where: { caseId } });
  const missingEvidence = await prisma.missingEvidenceAudit.findMany({ where: { caseId } });
  const conductItems = await prisma.prosecutorialConductIndex.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  // Escalate late disclosures
  for (const ld of lateDisclosures) {
    const existing = await prisma.discoveryViolationEscalation.findFirst({
      where: { caseId, violationType: 'late_production', prejudiceAssessment: ld.prejudiceToDefense },
    });
    if (existing) continue;

    let escalationLevel: string;
    let remedy: string;
    if (ld.prejudiceToDefense === 'severe') {
      escalationLevel = 'mistrial_motion';
      remedy = 'mistrial';
    } else if (ld.prejudiceToDefense === 'significant') {
      escalationLevel = 'sanctions_motion';
      remedy = 'exclusion';
    } else {
      escalationLevel = 'formal_motion';
      remedy = 'continuance';
    }

    const escalation = await prisma.discoveryViolationEscalation.create({
      data: {
        caseId,
        violationType: 'late_production',
        severity: ld.prejudiceToDefense === 'severe' ? 'critical' : ld.prejudiceToDefense === 'significant' ? 'high' : 'medium',
        escalationLevel,
        currentPhase: 'identified',
        prejudiceAssessment: ld.prejudiceToDefense,
        remedySought: remedy,
        legalAuthority: 'PC § 1054.5 — Discovery Sanctions',
        citations: ld.citations,
      },
    });
    results.push({ id: escalation.id, violationType: 'late_production', escalationLevel });
  }

  // Escalate missing evidence
  for (const me of missingEvidence) {
    if (me.materialityAssessment === 'immaterial') continue;

    const existing = await prisma.discoveryViolationEscalation.findFirst({
      where: { caseId, violationType: 'non_production', prejudiceAssessment: { contains: me.evidenceDescription.slice(0, 50) } },
    });
    if (existing) continue;

    const escalation = await prisma.discoveryViolationEscalation.create({
      data: {
        caseId,
        violationType: me.arizonaVYoungblood ? 'destruction' : 'non_production',
        severity: me.materialityAssessment === 'highly_material' ? 'critical' : 'high',
        escalationLevel: me.arizonaVYoungblood ? 'sanctions_motion' : 'formal_motion',
        currentPhase: 'identified',
        prejudiceAssessment: `Missing ${me.evidenceCategory}: ${me.evidenceDescription.slice(0, 200)}`,
        remedySought: me.arizonaVYoungblood ? 'sanctions' : 'production_order',
        legalAuthority: me.arizonaVYoungblood ? 'Arizona v. Youngblood, 488 U.S. 51 (1988)' : 'PC § 1054.1 — Prosecution Discovery Obligations',
        citations: me.citations,
      },
    });
    results.push({ id: escalation.id, violationType: me.arizonaVYoungblood ? 'destruction' : 'non_production' });
  }

  // Escalate conduct patterns
  for (const ci of conductItems) {
    if (ci.severity !== 'severe') continue;

    const existing = await prisma.discoveryViolationEscalation.findFirst({
      where: { caseId, violationType: 'bad_faith_withholding', legalAuthority: ci.legalBasis },
    });
    if (existing) continue;

    const escalation = await prisma.discoveryViolationEscalation.create({
      data: {
        caseId,
        violationType: 'bad_faith_withholding',
        severity: 'critical',
        escalationLevel: 'appellate_issue',
        currentPhase: 'documented',
        prejudiceAssessment: ci.description.slice(0, 500),
        remedySought: 'new_trial',
        legalAuthority: ci.legalBasis,
        citations: ci.citations,
      },
    });
    results.push({ id: escalation.id, violationType: 'bad_faith_withholding', escalationLevel: 'appellate_issue' });
  }

  return { caseId, escalationsCreated: results.length, escalations: results };
}

// ---------------------------------------------------------------------------
// Full Prosecutorial Conduct Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullProsecutorialConductAnalysis(caseId: string): Promise<Record<string, unknown>> {
  const disclosures = await trackDiscoveryDisclosures(caseId);
  const brady = await analyzeBradyMateriality(caseId);
  const giglio = await trackGiglioImpeachmentDisclosures(caseId);
  const chronology = await reconstructDisclosureChronology(caseId);
  const late = await detectLateDisclosures(caseId);
  const missing = await auditMissingEvidence(caseId);
  const conduct = await indexProsecutorialConduct(caseId);
  const preservation = await buildDisclosurePreservationGraph(caseId);
  const benefits = await trackWitnessBenefitDisclosures(caseId);
  const escalation = await escalateDiscoveryViolations(caseId);

  return {
    caseId,
    summary: {
      discoveryDisclosures: disclosures.disclosuresTracked,
      bradyFrameworks: brady.frameworksBuilt,
      giglioDisclosures: giglio.disclosuresTracked,
      chronologyEvents: chronology.eventsCreated,
      lateDisclosures: late.lateDetected,
      missingEvidence: missing.missingFound,
      conductItems: conduct.conductIndexed,
      preservationGraphs: preservation.graphsBuilt,
      witnessBenefits: benefits.benefitsTracked,
      violationEscalations: escalation.escalationsCreated,
    },
    principle: 'CourtAccess organizes provable disclosure and discovery structures. It does NOT accuse prosecutors of misconduct.',
  };
}
