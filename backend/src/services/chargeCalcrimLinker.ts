// ============================================================================
// Phase D.2.5 — Charge → CALCRIM Linker
// Deterministic linkage: statute → CALCRIM instruction(s).
// Enforces charge entry before CALCRIM analysis.
// NO hallucination. NO LLM. NO generative reasoning.
// ============================================================================

import prisma from '../lib/prisma.js';
import {
  getCalcrimNumbersForStatute,
  getStatute,
  COMMON_CRIMINAL_STATUTES,
  CALIFORNIA_CODES,
} from './californiaCodeRegistry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChargeLinkageResult {
  chargeId: string;
  code: string;
  section: string;
  title: string | null;
  severity: string | null;
  linkedInstructionId: string | null;
  linkedInstructionNumber: number | null;
  linkedInstructionTitle: string | null;
  linkageMethod: 'statute_registry' | 'manual' | 'unlinked';
  confidence: number;
  alternativeInstructions: Array<{ instructionNumber: number; title: string }>;
}

export interface CaseChargeValidation {
  caseId: string;
  isValid: boolean;
  totalCharges: number;
  linkedCharges: number;
  unlinkedCharges: number;
  validationErrors: string[];
  charges: ChargeLinkageResult[];
}

// ---------------------------------------------------------------------------
// Validate Case Has Charges (prerequisite for CALCRIM analysis)
// ---------------------------------------------------------------------------

export async function validateCaseCharges(caseId: string): Promise<CaseChargeValidation> {
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: { calcrimInstruction: true },
  });

  const errors: string[] = [];
  const results: ChargeLinkageResult[] = [];
  let linkedCount = 0;

  if (charges.length === 0) {
    errors.push('No charges filed for this case. CALCRIM analysis requires at least one charge.');
  }

  for (const charge of charges) {
    if (!charge.code) errors.push(`Charge ${charge.id}: Missing California code.`);
    if (!charge.section) errors.push(`Charge ${charge.id}: Missing statute section.`);

    const calcrimNumbers = getCalcrimNumbersForStatute(charge.code, charge.section);

    let linkedInstructionId: string | null = charge.calcrimInstructionId;
    let linkedInstructionNumber: number | null = null;
    let linkedInstructionTitle: string | null = null;
    let linkageMethod: ChargeLinkageResult['linkageMethod'] = 'unlinked';
    let confidence = 0;

    if (charge.calcrimInstruction) {
      linkedInstructionNumber = charge.calcrimInstruction.instructionNumber;
      linkedInstructionTitle = charge.calcrimInstruction.title;
      linkageMethod = 'manual';
      confidence = 1.0;
      linkedCount++;
    } else if (calcrimNumbers.length > 0) {
      // Auto-link using statute registry
      const instruction = await prisma.calcrimInstruction.findFirst({
        where: { instructionNumber: calcrimNumbers[0] },
      });
      if (instruction) {
        linkedInstructionId = instruction.id;
        linkedInstructionNumber = instruction.instructionNumber;
        linkedInstructionTitle = instruction.title;
        linkageMethod = 'statute_registry';
        confidence = 0.9;
        linkedCount++;
      }
    }

    // Get alternative instructions
    const alternativeInstructions: Array<{ instructionNumber: number; title: string }> = [];
    if (calcrimNumbers.length > 1) {
      const altInstructions = await prisma.calcrimInstruction.findMany({
        where: { instructionNumber: { in: calcrimNumbers.slice(1) } },
        select: { instructionNumber: true, title: true },
      });
      alternativeInstructions.push(...altInstructions);
    }

    results.push({
      chargeId: charge.id,
      code: charge.code,
      section: charge.section,
      title: charge.title,
      severity: charge.severity,
      linkedInstructionId,
      linkedInstructionNumber,
      linkedInstructionTitle,
      linkageMethod,
      confidence,
      alternativeInstructions,
    });
  }

  return {
    caseId,
    isValid: charges.length > 0 && errors.length === 0,
    totalCharges: charges.length,
    linkedCharges: linkedCount,
    unlinkedCharges: charges.length - linkedCount,
    validationErrors: errors,
    charges: results,
  };
}

// ---------------------------------------------------------------------------
// Auto-Link All Charges for a Case
// ---------------------------------------------------------------------------

export async function autoLinkCharges(caseId: string): Promise<{
  caseId: string;
  linked: number;
  alreadyLinked: number;
  unresolved: number;
  results: Array<{
    chargeId: string;
    code: string;
    section: string;
    action: 'linked' | 'already_linked' | 'no_match';
    instructionNumber: number | null;
  }>;
}> {
  const charges = await prisma.charge.findMany({
    where: { caseId },
    include: { calcrimInstruction: true },
  });

  let linked = 0;
  let alreadyLinked = 0;
  let unresolved = 0;
  const results: Array<{
    chargeId: string;
    code: string;
    section: string;
    action: 'linked' | 'already_linked' | 'no_match';
    instructionNumber: number | null;
  }> = [];

  for (const charge of charges) {
    if (charge.calcrimInstructionId) {
      alreadyLinked++;
      results.push({
        chargeId: charge.id,
        code: charge.code,
        section: charge.section,
        action: 'already_linked',
        instructionNumber: charge.calcrimInstruction?.instructionNumber ?? null,
      });
      continue;
    }

    const calcrimNumbers = getCalcrimNumbersForStatute(charge.code, charge.section);
    if (calcrimNumbers.length === 0) {
      unresolved++;
      results.push({
        chargeId: charge.id,
        code: charge.code,
        section: charge.section,
        action: 'no_match',
        instructionNumber: null,
      });
      continue;
    }

    const instruction = await prisma.calcrimInstruction.findFirst({
      where: { instructionNumber: calcrimNumbers[0] },
    });

    if (instruction) {
      await prisma.charge.update({
        where: { id: charge.id },
        data: { calcrimInstructionId: instruction.id },
      });
      linked++;
      results.push({
        chargeId: charge.id,
        code: charge.code,
        section: charge.section,
        action: 'linked',
        instructionNumber: instruction.instructionNumber,
      });
    } else {
      unresolved++;
      results.push({
        chargeId: charge.id,
        code: charge.code,
        section: charge.section,
        action: 'no_match',
        instructionNumber: null,
      });
    }
  }

  return { caseId, linked, alreadyLinked, unresolved, results };
}

// ---------------------------------------------------------------------------
// Create Charge with Validation
// ---------------------------------------------------------------------------

export async function createCharge(data: {
  caseId: string;
  code: string;
  section: string;
  title?: string;
  dateOfOffense?: string;
  victim: string;
  severity?: string;
  countNumber?: number;
  autoLink?: boolean;
}): Promise<{
  charge: Record<string, unknown>;
  linkage: ChargeLinkageResult | null;
}> {
  // Validate code exists
  const codeExists = CALIFORNIA_CODES.some((c) => c.abbreviation === data.code.toUpperCase());
  if (!codeExists) {
    throw new Error(`Invalid California code: ${data.code}. Must be one of: ${CALIFORNIA_CODES.map((c) => c.abbreviation).join(', ')}`);
  }

  // Look up statute for auto-fill
  const statute = getStatute(data.code, data.section);
  const title = data.title ?? statute?.title ?? null;
  const severity = data.severity ?? statute?.severity ?? null;

  // Create charge
  const charge = await prisma.charge.create({
    data: {
      caseId: data.caseId,
      code: data.code.toUpperCase(),
      section: data.section,
      title,
      dateOfOffense: data.dateOfOffense ? new Date(data.dateOfOffense) : null,
      victim: data.victim,
      severity,
    },
  });

  // Auto-link if requested
  let linkage: ChargeLinkageResult | null = null;
  if (data.autoLink !== false) {
    const calcrimNumbers = getCalcrimNumbersForStatute(data.code, data.section);
    if (calcrimNumbers.length > 0) {
      const instruction = await prisma.calcrimInstruction.findFirst({
        where: { instructionNumber: calcrimNumbers[0] },
      });
      if (instruction) {
        await prisma.charge.update({
          where: { id: charge.id },
          data: { calcrimInstructionId: instruction.id },
        });

        const altInstructions = calcrimNumbers.length > 1
          ? await prisma.calcrimInstruction.findMany({
              where: { instructionNumber: { in: calcrimNumbers.slice(1) } },
              select: { instructionNumber: true, title: true },
            })
          : [];

        linkage = {
          chargeId: charge.id,
          code: charge.code,
          section: charge.section,
          title: charge.title,
          severity: charge.severity,
          linkedInstructionId: instruction.id,
          linkedInstructionNumber: instruction.instructionNumber,
          linkedInstructionTitle: instruction.title,
          linkageMethod: 'statute_registry',
          confidence: 0.9,
          alternativeInstructions: altInstructions,
        };
      }
    }
  }

  return { charge, linkage };
}

// ---------------------------------------------------------------------------
// Guard: Require Charges Before CALCRIM Analysis
// ---------------------------------------------------------------------------

export async function requireChargesForAnalysis(caseId: string): Promise<{
  allowed: boolean;
  reason: string | null;
  chargeCount: number;
  linkedCount: number;
}> {
  const charges = await prisma.charge.findMany({
    where: { caseId },
    select: { id: true, calcrimInstructionId: true },
  });

  if (charges.length === 0) {
    return {
      allowed: false,
      reason: 'No charges filed. Case must have at least one charge with a California code and statute section before CALCRIM analysis can proceed.',
      chargeCount: 0,
      linkedCount: 0,
    };
  }

  const linkedCount = charges.filter((c) => c.calcrimInstructionId).length;

  return {
    allowed: true,
    reason: null,
    chargeCount: charges.length,
    linkedCount,
  };
}

// ---------------------------------------------------------------------------
// Registry Statistics
// ---------------------------------------------------------------------------

export function getRegistryStats(): {
  totalCodes: number;
  criminalDefenseCodes: number;
  totalStatutes: number;
  statutesByCode: Record<string, number>;
  totalCalcrimLinks: number;
  unmappedStatutes: number;
} {
  const statutesByCode: Record<string, number> = {};
  let totalCalcrimLinks = 0;
  let unmapped = 0;

  for (const statute of COMMON_CRIMINAL_STATUTES) {
    statutesByCode[statute.code] = (statutesByCode[statute.code] || 0) + 1;
    if (statute.calcrimNumbers.length > 0) {
      totalCalcrimLinks += statute.calcrimNumbers.length;
    } else {
      unmapped++;
    }
  }

  return {
    totalCodes: CALIFORNIA_CODES.length,
    criminalDefenseCodes: CALIFORNIA_CODES.filter((c) => c.commonInCriminalDefense).length,
    totalStatutes: COMMON_CRIMINAL_STATUTES.length,
    statutesByCode,
    totalCalcrimLinks,
    unmappedStatutes: unmapped,
  };
}
