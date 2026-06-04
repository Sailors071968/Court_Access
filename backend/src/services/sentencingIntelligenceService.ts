// ============================================================================
// Phase E.3 — Judicial Analytics + Sentencing Intelligence Framework
// Organizes sentencing-related legal structures. NEVER functions as sentencing counsel.
// All analysis is deterministic + statute-linked.
// ============================================================================

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// California Penal Code sentencing reference tables (deterministic lookup)
// ---------------------------------------------------------------------------

const CALIFORNIA_SENTENCING_TABLE: Record<string, {
  category: string; baseLow: number; baseMid: number; baseHigh: number;
  lifePossible: boolean; lwopPossible: boolean; probationEligible: boolean;
  probationBar?: string; strikeOffense: boolean;
}> = {
  '187': { category: 'felony', baseLow: 300, baseMid: 300, baseHigh: 300, lifePossible: true, lwopPossible: true, probationEligible: false, probationBar: 'PC § 1203.06', strikeOffense: true },
  '211': { category: 'felony', baseLow: 24, baseMid: 36, baseHigh: 60, lifePossible: false, lwopPossible: false, probationEligible: false, probationBar: 'PC § 1203.06', strikeOffense: true },
  '459': { category: 'felony', baseLow: 24, baseMid: 48, baseHigh: 72, lifePossible: false, lwopPossible: false, probationEligible: true, strikeOffense: false },
  '245(a)(1)': { category: 'felony', baseLow: 24, baseMid: 36, baseHigh: 48, lifePossible: false, lwopPossible: false, probationEligible: true, strikeOffense: true },
  '261': { category: 'felony', baseLow: 36, baseMid: 72, baseHigh: 96, lifePossible: false, lwopPossible: false, probationEligible: false, probationBar: 'PC § 1203.065', strikeOffense: true },
  '288': { category: 'felony', baseLow: 36, baseMid: 72, baseHigh: 96, lifePossible: false, lwopPossible: false, probationEligible: false, probationBar: 'PC § 1203.066', strikeOffense: true },
  '460(a)': { category: 'felony', baseLow: 24, baseMid: 48, baseHigh: 72, lifePossible: false, lwopPossible: false, probationEligible: false, probationBar: 'PC § 1203(e)(4)', strikeOffense: true },
  '460(b)': { category: 'felony', baseLow: 16, baseMid: 24, baseHigh: 36, lifePossible: false, lwopPossible: false, probationEligible: true, strikeOffense: false },
  '496': { category: 'wobbler', baseLow: 16, baseMid: 24, baseHigh: 36, lifePossible: false, lwopPossible: false, probationEligible: true, strikeOffense: false },
  '484/488': { category: 'misdemeanor', baseLow: 0, baseMid: 3, baseHigh: 6, lifePossible: false, lwopPossible: false, probationEligible: true, strikeOffense: false },
};

const ENHANCEMENT_TABLE: Record<string, {
  type: string; months: number; years: number; mandatory: boolean; strikeable: boolean; section: string;
}> = {
  'firearm_use': { type: 'firearm', months: 0, years: 10, mandatory: true, strikeable: true, section: 'PC § 12022.53(b)' },
  'firearm_discharge': { type: 'firearm', months: 0, years: 20, mandatory: true, strikeable: true, section: 'PC § 12022.53(c)' },
  'firearm_gbi': { type: 'firearm', months: 0, years: 25, mandatory: true, strikeable: true, section: 'PC § 12022.53(d)' },
  'gbi': { type: 'great_bodily_injury', months: 0, years: 3, mandatory: false, strikeable: false, section: 'PC § 12022.7(a)' },
  'gang': { type: 'gang', months: 0, years: 10, mandatory: false, strikeable: true, section: 'PC § 186.22(b)(1)' },
  'prior_prison': { type: 'prior_prison', months: 0, years: 1, mandatory: false, strikeable: false, section: 'PC § 667.5(b)' },
  'prior_serious': { type: 'prior_serious', months: 0, years: 5, mandatory: true, strikeable: false, section: 'PC § 667(a)(1)' },
};

// ---------------------------------------------------------------------------
// 1. Sentencing Exposure Calculator (statute-linked)
// ---------------------------------------------------------------------------

export async function calculateSentencingExposure(caseId: string): Promise<{
  caseId: string; exposuresCalculated: number; exposures: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const chargePattern = /\b(?:PC|Penal\s+Code)\s*§?\s*(\d+(?:\([a-z]\)(?:\(\d+\))?)?)/gi;
  const processedSections = new Set<string>();

  for (const stmt of statements) {
    let match;
    while ((match = chargePattern.exec(stmt.rawText)) !== null) {
      const section = match[1];
      if (processedSections.has(section)) continue;
      processedSections.add(section);

      const sentData = CALIFORNIA_SENTENCING_TABLE[section];
      if (!sentData) continue;

      const enhancements = await prisma.enhancementStacking.findMany({ where: { caseId } });
      let enhancementMonths = 0;
      for (const e of enhancements) {
        enhancementMonths += e.additionalMonths + (e.additionalYears * 12);
      }

      const exposure = await prisma.sentencingExposure.create({
        data: {
          caseId,
          chargeDescription: stmt.rawText.slice(0, 200),
          penalCodeSection: `PC § ${section}`,
          offenseCategory: sentData.category,
          baseTerm: `${sentData.baseLow} / ${sentData.baseMid} / ${sentData.baseHigh} months`,
          baseTermMonthsLow: sentData.baseLow,
          baseTermMonthsHigh: sentData.baseHigh,
          presumptiveTerm: sentData.baseMid ? `${sentData.baseMid} months` : null,
          enhancementsApplied: JSON.stringify(enhancements.map(e => e.id)),
          totalExposureMonthsLow: sentData.baseLow + enhancementMonths,
          totalExposureMonthsHigh: sentData.baseHigh + enhancementMonths,
          lifePossible: sentData.lifePossible,
          lwopPossible: sentData.lwopPossible,
          citations: JSON.stringify([{
            text: stmt.rawText.slice(0, 200),
            page: stmt.page,
            line: stmt.lineStart,
            document: stmt.document?.fileName || null,
          }]),
        },
      });
      results.push({ id: exposure.id, penalCodeSection: `PC § ${section}`, totalExposureMonthsLow: exposure.totalExposureMonthsLow, totalExposureMonthsHigh: exposure.totalExposureMonthsHigh });
    }
  }

  return { caseId, exposuresCalculated: results.length, exposures: results };
}

// ---------------------------------------------------------------------------
// 2. Enhancement Stacking Analysis (deterministic)
// ---------------------------------------------------------------------------

export async function analyzeEnhancementStacking(caseId: string): Promise<{
  caseId: string; enhancementsFound: number; enhancements: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const ENHANCEMENT_PATTERNS: Record<string, { regex: RegExp; key: string }> = {
    firearm_use: { regex: /\b(used?\s+a?\s*(firearm|gun|weapon)|personally\s+(armed|discharged|used)\s+a\s+firearm)\b/i, key: 'firearm_use' },
    firearm_discharge: { regex: /\b(discharged?\s+a?\s*firearm|fired\s+(a\s+)?(gun|weapon|shot))\b/i, key: 'firearm_discharge' },
    gbi: { regex: /\b(great\s+bodily\s+injury|serious\s+bodily\s+injury|gbi)\b/i, key: 'gbi' },
    gang: { regex: /\b(gang\s+enhancement|criminal\s+street\s+gang|for\s+the\s+benefit\s+of\s+a\s+gang|186\.22)\b/i, key: 'gang' },
    prior_prison: { regex: /\b(prior\s+prison\s+term|served\s+a\s+prior\s+prison|667\.5)\b/i, key: 'prior_prison' },
    prior_serious: { regex: /\b(prior\s+serious\s+felony|five[\s-]year\s+enhancement|667\(a\))\b/i, key: 'prior_serious' },
  };

  const processedKeys = new Set<string>();
  let stackingOrder = 1;

  for (const stmt of statements) {
    for (const [_name, pattern] of Object.entries(ENHANCEMENT_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText) && !processedKeys.has(pattern.key)) {
        processedKeys.add(pattern.key);

        const enhData = ENHANCEMENT_TABLE[pattern.key];
        if (!enhData) continue;

        const enhancement = await prisma.enhancementStacking.create({
          data: {
            caseId,
            enhancementType: enhData.type,
            penalCodeSection: enhData.section,
            description: stmt.rawText.slice(0, 300),
            additionalMonths: enhData.months,
            additionalYears: enhData.years,
            mandatory: enhData.mandatory,
            strikeable: enhData.strikeable,
            stackingOrder: stackingOrder++,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: enhancement.id, enhancementType: enhData.type, additionalYears: enhData.years, section: enhData.section });
      }
    }
  }

  return { caseId, enhancementsFound: results.length, enhancements: results };
}

// ---------------------------------------------------------------------------
// 3. Consecutive/Concurrent Exposure Modeling (evidence-linked)
// ---------------------------------------------------------------------------

export async function modelConsecutiveConcurrentExposure(caseId: string): Promise<{
  caseId: string; modelsCreated: number; models: Array<Record<string, unknown>>;
}> {
  const exposures = await prisma.sentencingExposure.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  if (exposures.length < 2) return { caseId, modelsCreated: 0, models: [] };

  const principal = exposures.reduce((a, b) => a.totalExposureMonthsHigh >= b.totalExposureMonthsHigh ? a : b);

  for (const exp of exposures) {
    if (exp.id === principal.id) continue;

    const subordinateThird = Math.ceil(exp.baseTermMonthsHigh / 3);
    const isMandatoryConsecutive = exp.penalCodeSection.includes('667.6') || principal.penalCodeSection.includes('187');

    const model = await prisma.consecutiveConcurrentExposure.create({
      data: {
        caseId,
        chargeADescription: principal.chargeDescription,
        chargeBDescription: exp.chargeDescription,
        runType: isMandatoryConsecutive ? 'mandatory_consecutive' : 'discretionary',
        legalBasis: isMandatoryConsecutive ? 'PC § 667.6(d)' : 'PC § 1170.1(a)',
        subordinateTermRule: `One-third middle term: ${subordinateThird} months under PC § 1170.1(a)`,
        totalCombinedMonths: principal.totalExposureMonthsHigh + subordinateThird,
        citations: JSON.stringify([{ principal: principal.penalCodeSection, subordinate: exp.penalCodeSection }]),
      },
    });
    results.push({ id: model.id, runType: model.runType, totalCombinedMonths: model.totalCombinedMonths });
  }

  return { caseId, modelsCreated: results.length, models: results };
}

// ---------------------------------------------------------------------------
// 4. Probation Eligibility Analysis (statute-aware)
// ---------------------------------------------------------------------------

export async function analyzeProbationEligibility(caseId: string): Promise<{
  caseId: string; chargesAnalyzed: number; eligibilities: Array<Record<string, unknown>>;
}> {
  const exposures = await prisma.sentencingExposure.findMany({ where: { caseId } });
  const results: Array<Record<string, unknown>> = [];

  for (const exp of exposures) {
    const section = exp.penalCodeSection.replace('PC § ', '');
    const sentData = CALIFORNIA_SENTENCING_TABLE[section];

    const eligible = sentData ? sentData.probationEligible : exp.offenseCategory === 'misdemeanor' || exp.offenseCategory === 'wobbler';
    const bar = sentData?.probationBar || null;

    const eligibility = await prisma.probationEligibility.create({
      data: {
        caseId,
        chargeDescription: exp.chargeDescription,
        eligibleForProbation: eligible,
        presumptiveProbation: exp.offenseCategory === 'misdemeanor',
        statutoryBar: bar,
        unusualCircumstances: false,
        conditions: JSON.stringify(eligible ? ['reporting', 'community_service', 'restitution', 'drug_testing'] : []),
        maxProbationYears: eligible ? (exp.offenseCategory === 'felony' ? 2 : 1) : 0,
        citations: exp.citations,
      },
    });
    results.push({ id: eligibility.id, charge: exp.penalCodeSection, eligible, statutoryBar: bar });
  }

  return { caseId, chargesAnalyzed: results.length, eligibilities: results };
}

// ---------------------------------------------------------------------------
// 5. Mitigation Factor Organization (citation-backed)
// ---------------------------------------------------------------------------

const MITIGATION_PATTERNS: Record<string, { regex: RegExp; factorType: string; legalBasis: string }> = {
  age: { regex: /\b(young\s+age|youthful|minor\s+at\s+the\s+time|juvenile|under\s+\d+\s+years?\s+old)\b/i, factorType: 'age', legalBasis: 'PC § 1170(b)(6)(B) — youth as mitigating factor' },
  mental_health: { regex: /\b(mental\s+(health|illness|disorder|disability)|ptsd|depression|schizophreni|bipolar|anxiety\s+disorder)\b/i, factorType: 'mental_health', legalBasis: 'PC § 1170(b)(6)(A) — mental condition as mitigating factor' },
  substance_abuse: { regex: /\b(substance\s+abuse|drug\s+addict|alcohol\s+(abuse|dependence)|under\s+the\s+influence)\b/i, factorType: 'substance_abuse', legalBasis: 'CRC 4.423(b)(3) — defendant was under influence' },
  childhood_trauma: { regex: /\b(childhood\s+trauma|abused?\s+as\s+a\s+child|foster\s+care|neglect(ed)?|adverse\s+childhood)\b/i, factorType: 'childhood_trauma', legalBasis: 'PC § 1170(b)(6)(A) — childhood trauma' },
  military: { regex: /\b(military\s+service|veteran|combat|ptsd\s+from\s+(service|deployment)|served\s+in)\b/i, factorType: 'military_service', legalBasis: 'PC § 1170.91 — military service-related conditions' },
  cooperation: { regex: /\b(cooperat(ed|ion|ing)|assist(ed|ing)\s+(police|officers|law\s+enforcement)|helped\s+(police|investigators))\b/i, factorType: 'cooperation', legalBasis: 'CRC 4.423(b)(5) — cooperation with authorities' },
  remorse: { regex: /\b(remorse|sorry|regret|apologiz|took\s+responsibility|accept(ed|ing)\s+responsibility)\b/i, factorType: 'remorse', legalBasis: 'CRC 4.423(b)(6) — early acceptance of responsibility' },
  minor_role: { regex: /\b(minor\s+(role|participant|involvement)|passive\s+participant|minimal\s+role)\b/i, factorType: 'minor_role', legalBasis: 'CRC 4.423(a)(4) — minor role in offense' },
  provocation: { regex: /\b(provok(ed|ation)|victim\s+(started|initiated|provoked)|in\s+response\s+to)\b/i, factorType: 'provocation', legalBasis: 'CRC 4.423(a)(2) — victim provocation' },
};

export async function organizeMitigationFactors(caseId: string): Promise<{
  caseId: string; factorsFound: number; factors: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(MITIGATION_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText) && !processedTypes.has(pattern.factorType)) {
        processedTypes.add(pattern.factorType);

        const factor = await prisma.mitigationFactor.create({
          data: {
            caseId,
            factorType: pattern.factorType,
            description: stmt.rawText.slice(0, 500),
            legalBasis: pattern.legalBasis,
            strength: 'moderate',
            supportingEvidence: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
            sentencingImpact: `This factor supports imposition of the lower term or probation under ${pattern.legalBasis}.`,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: factor.id, factorType: pattern.factorType, strength: 'moderate' });
      }
    }
  }

  return { caseId, factorsFound: results.length, factors: results };
}

// ---------------------------------------------------------------------------
// 6. Aggravation Factor Tracking (deterministic)
// ---------------------------------------------------------------------------

const AGGRAVATION_PATTERNS: Record<string, { regex: RegExp; factorType: string; legalBasis: string }> = {
  vulnerability: { regex: /\b(vulnerable\s+victim|elderly|disabled|child\s+victim|minor\s+victim|dependent\s+adult)\b/i, factorType: 'vulnerability', legalBasis: 'CRC 4.421(a)(3) — vulnerable victim' },
  sophistication: { regex: /\b(sophisticated|planning|premeditat|elaborate\s+scheme|organized)\b/i, factorType: 'sophistication', legalBasis: 'CRC 4.421(a)(8) — planning/sophistication' },
  position_of_trust: { regex: /\b(position\s+of\s+trust|teacher|coach|counselor|caretaker|guardian|authority\s+figure)\b/i, factorType: 'position_of_trust', legalBasis: 'CRC 4.421(a)(11) — position of trust' },
  multiple_victims: { regex: /\b(multiple\s+victims|several\s+victims|numerous\s+victims)\b/i, factorType: 'multiple_victims', legalBasis: 'CRC 4.421(a)(4) — multiple victims' },
  excessive_cruelty: { regex: /\b(cruel(ty)?|tortur|sadistic|excessive\s+(force|violence)|particular\s+cruelty)\b/i, factorType: 'excessive_cruelty', legalBasis: 'CRC 4.421(a)(1) — great violence/cruelty' },
  weapon: { regex: /\b(weapon|armed|knife|gun|firearm)\s+(used?|brandish|threaten)\b/i, factorType: 'weapon_use', legalBasis: 'CRC 4.421(a)(2) — weapon use' },
  prior_record: { regex: /\b(prior\s+(conviction|record|offense|criminal\s+history)|recidivist|repeat\s+offender)\b/i, factorType: 'prior_record', legalBasis: 'CRC 4.421(b)(2) — prior convictions' },
  probation_status: { regex: /\b(on\s+probation|on\s+parole|while\s+on\s+(probation|parole|supervision))\b/i, factorType: 'probation_status', legalBasis: 'CRC 4.421(b)(4) — on probation/parole when committed' },
};

export async function trackAggravationFactors(caseId: string): Promise<{
  caseId: string; factorsFound: number; factors: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];
  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(AGGRAVATION_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText) && !processedTypes.has(pattern.factorType)) {
        processedTypes.add(pattern.factorType);

        const factor = await prisma.aggravationFactor.create({
          data: {
            caseId,
            factorType: pattern.factorType,
            description: stmt.rawText.slice(0, 500),
            legalBasis: pattern.legalBasis,
            strength: 'moderate',
            supportingEvidence: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
            sentencingImpact: `This factor supports imposition of the upper term under ${pattern.legalBasis}.`,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: factor.id, factorType: pattern.factorType, strength: 'moderate' });
      }
    }
  }

  return { caseId, factorsFound: results.length, factors: results };
}

// ---------------------------------------------------------------------------
// 7. Strike/Prior Analysis (California-specific)
// ---------------------------------------------------------------------------

export async function analyzeStrikesPriors(caseId: string): Promise<{
  caseId: string; priorsFound: number; priors: Array<Record<string, unknown>>;
}> {
  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  const results: Array<Record<string, unknown>> = [];

  const STRIKE_PATTERNS: Record<string, { regex: RegExp; priorType: string }> = {
    strike: { regex: /\b(strike\s+(prior|offense|conviction)|three\s+strikes|two\s+strikes|prior\s+strike)\b/i, priorType: 'strike' },
    serious_felony: { regex: /\b(serious\s+felony|prior\s+serious\s+felony|1192\.7)\b/i, priorType: 'serious_felony' },
    violent_felony: { regex: /\b(violent\s+felony|prior\s+violent\s+felony|667\.5\(c\))\b/i, priorType: 'violent_felony' },
    prison_prior: { regex: /\b(prior\s+prison\s+term|served\s+(a\s+)?prior\s+prison|667\.5\(b\))\b/i, priorType: 'prison_prior' },
  };

  const processedTypes = new Set<string>();

  for (const stmt of statements) {
    for (const [_key, pattern] of Object.entries(STRIKE_PATTERNS)) {
      if (pattern.regex.test(stmt.rawText) && !processedTypes.has(pattern.priorType)) {
        processedTypes.add(pattern.priorType);

        const isStrike = pattern.priorType === 'strike' || pattern.priorType === 'serious_felony' || pattern.priorType === 'violent_felony';
        const secondStrike = isStrike;
        const thirdStrike = processedTypes.size >= 2 && isStrike;

        const prior = await prisma.strikePriorAnalysis.create({
          data: {
            caseId,
            priorType: pattern.priorType,
            priorDescription: stmt.rawText.slice(0, 500),
            penalCodeSection: pattern.priorType === 'prison_prior' ? 'PC § 667.5(b)' : 'PC § 667(d), PC § 1170.12(b)',
            qualifiesAsStrike: isStrike,
            secondStrikeDoubling: secondStrike,
            thirdStrike25ToLife: thirdStrike,
            romeroMotionViable: isStrike,
            washoutPeriod: pattern.priorType === 'prison_prior' ? '5 years clean period — PC § 667.5(b) washout' : null,
            citations: JSON.stringify([{
              text: stmt.rawText.slice(0, 200),
              page: stmt.page,
              line: stmt.lineStart,
              document: stmt.document?.fileName || null,
            }]),
          },
        });
        results.push({ id: prior.id, priorType: pattern.priorType, qualifiesAsStrike: isStrike, thirdStrike: thirdStrike });
      }
    }
  }

  return { caseId, priorsFound: results.length, priors: results };
}

// ---------------------------------------------------------------------------
// 8. Custody Credit Framework (deterministic)
// ---------------------------------------------------------------------------

export async function calculateCustodyCredits(caseId: string): Promise<{
  caseId: string; creditAnalysis: Record<string, unknown>;
}> {
  const exposures = await prisma.sentencingExposure.findMany({ where: { caseId } });
  const strikes = await prisma.strikePriorAnalysis.findMany({ where: { caseId, qualifiesAsStrike: true } });

  const statements = await prisma.evidenceStatement.findMany({
    where: { caseId },
    include: { document: true },
  });

  // Estimate actual days from custody references
  let actualDays = 0;
  const custodyPattern = /\b(\d+)\s+days?\s+(?:in\s+)?custody\b/i;
  for (const stmt of statements) {
    const match = custodyPattern.exec(stmt.rawText);
    if (match) {
      actualDays = Math.max(actualDays, parseInt(match[1], 10));
    }
  }

  const isViolentFelony = strikes.length > 0 || exposures.some(e => e.lifePossible);
  let creditRate: string;
  let creditLimitation: string | null = null;
  let conductCredits: number;

  if (isViolentFelony) {
    creditRate = 'fifteen_percent';
    creditLimitation = 'PC § 2933.1 — violent felony limitation: 15% conduct credit';
    conductCredits = Math.floor(actualDays * 0.15);
  } else {
    creditRate = 'day_for_day';
    creditLimitation = null;
    conductCredits = actualDays;
  }

  const totalCredits = actualDays + conductCredits;

  const credit = await prisma.custodyCredit.create({
    data: {
      caseId,
      actualDays,
      conductCredits,
      creditRate,
      creditLimitation,
      totalCredits,
      applicableStatute: 'PC § 2900.5, PC § 4019',
      citations: JSON.stringify(actualDays > 0 ? [{ text: `${actualDays} days actual custody identified` }] : []),
    },
  });

  return {
    caseId,
    creditAnalysis: {
      id: credit.id, actualDays, conductCredits, creditRate, totalCredits,
      creditLimitation, applicableStatute: credit.applicableStatute,
    },
  };
}

// ---------------------------------------------------------------------------
// 9. Judicial Ruling Trend Indexing (anonymized + aggregate)
// ---------------------------------------------------------------------------

export async function indexJudicialRulingTrends(caseId: string): Promise<{
  caseId: string; trendsIndexed: number; trends: Array<Record<string, unknown>>;
}> {
  // Aggregate from objection history and motion rulings — anonymized patterns only
  const objections = await prisma.objectionHistoryEntry.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];
  const rulingCounts: Record<string, { granted: number; denied: number; total: number }> = {};

  for (const obj of objections) {
    const cat = obj.objectionType;
    if (!rulingCounts[cat]) rulingCounts[cat] = { granted: 0, denied: 0, total: 0 };
    rulingCounts[cat].total += 1;
    if (obj.ruling === 'sustained') rulingCounts[cat].granted += 1;
    else if (obj.ruling === 'overruled') rulingCounts[cat].denied += 1;
  }

  for (const [category, counts] of Object.entries(rulingCounts)) {
    if (counts.total < 2) continue;

    const grantRate = Math.round((counts.granted / counts.total) * 100);
    const trend = await prisma.judicialRulingTrend.create({
      data: {
        caseId,
        rulingCategory: 'evidentiary',
        rulingType: grantRate >= 60 ? 'granted' : grantRate <= 40 ? 'denied' : 'modified',
        legalIssue: `${category} objections`,
        aggregatePattern: `${category} objections: ${grantRate}% sustained rate (${counts.granted}/${counts.total}). Anonymized aggregate — no individual judge identification.`,
        sampleSize: counts.total,
        citations: JSON.stringify([{ category, sustained: counts.granted, overruled: counts.denied, total: counts.total }]),
      },
    });
    results.push({ id: trend.id, category, grantRate, sampleSize: counts.total });
  }

  return { caseId, trendsIndexed: results.length, trends: results };
}

// ---------------------------------------------------------------------------
// 10. Plea Consequence Modeling (statute-linked only)
// ---------------------------------------------------------------------------

export async function modelPleaConsequences(caseId: string): Promise<{
  caseId: string; consequencesModeled: number; consequences: Array<Record<string, unknown>>;
}> {
  const exposures = await prisma.sentencingExposure.findMany({ where: { caseId } });
  const probation = await prisma.probationEligibility.findMany({ where: { caseId } });

  const results: Array<Record<string, unknown>> = [];

  for (const exp of exposures) {
    const section = exp.penalCodeSection.replace('PC § ', '');
    const sentData = CALIFORNIA_SENTENCING_TABLE[section];
    const probElig = probation.find(p => p.chargeDescription === exp.chargeDescription);

    // Immigration analysis — deterministic based on offense category
    let immigrationConsequence: string | null = null;
    if (sentData?.strikeOffense) {
      immigrationConsequence = 'Aggravated felony — near-certain deportability under INA § 101(a)(43)';
    } else if (exp.offenseCategory === 'felony') {
      immigrationConsequence = 'Potential CIMT (crime involving moral turpitude) — requires individual analysis';
    }

    const consequence = await prisma.pleaConsequence.create({
      data: {
        caseId,
        chargeDescription: exp.chargeDescription,
        pleaType: 'guilty',
        sentencingExposure: `${exp.totalExposureMonthsLow}-${exp.totalExposureMonthsHigh} months${exp.lifePossible ? ' (life possible)' : ''}`,
        immigrationConsequence,
        firearmRestriction: exp.offenseCategory === 'felony',
        sexRegistration: section === '261' || section === '288',
        strikeConsequence: sentData?.strikeOffense || false,
        probationLikelihood: probElig?.eligibleForProbation ? 'possible' : 'unlikely',
        restitutionExposure: 'Amount to be determined at restitution hearing — PC § 1202.4',
        citations: exp.citations,
      },
    });
    results.push({
      id: consequence.id, charge: exp.penalCodeSection,
      immigrationConsequence, strikeConsequence: consequence.strikeConsequence,
      firearmRestriction: consequence.firearmRestriction,
    });
  }

  return { caseId, consequencesModeled: results.length, consequences: results };
}

// ---------------------------------------------------------------------------
// 11. Full Sentencing Intelligence Analysis (orchestrator)
// ---------------------------------------------------------------------------

export async function runFullSentencingIntelligence(caseId: string): Promise<Record<string, unknown>> {
  const enhancements = await analyzeEnhancementStacking(caseId);
  const exposure = await calculateSentencingExposure(caseId);
  const consecutive = await modelConsecutiveConcurrentExposure(caseId);
  const probation = await analyzeProbationEligibility(caseId);
  const mitigation = await organizeMitigationFactors(caseId);
  const aggravation = await trackAggravationFactors(caseId);
  const strikes = await analyzeStrikesPriors(caseId);
  const credits = await calculateCustodyCredits(caseId);
  const trends = await indexJudicialRulingTrends(caseId);
  const pleas = await modelPleaConsequences(caseId);

  return {
    caseId,
    summary: {
      sentencingExposures: exposure.exposuresCalculated,
      enhancements: enhancements.enhancementsFound,
      consecutiveConcurrentModels: consecutive.modelsCreated,
      probationEligibilities: probation.chargesAnalyzed,
      mitigationFactors: mitigation.factorsFound,
      aggravationFactors: aggravation.factorsFound,
      strikesPriors: strikes.priorsFound,
      custodyCredits: credits.creditAnalysis,
      judicialRulingTrends: trends.trendsIndexed,
      pleaConsequences: pleas.consequencesModeled,
    },
    principle: 'CourtAccess organizes sentencing-related legal structures. It does NOT function as sentencing counsel.',
  };
}
