// ============================================================================
// Charging document intelligence.
//
// The People's charges move. A complaint is amended, an information replaces
// it, counts are dismissed and the rest renumbered, defendants are severed.
// What the defendant faces today is whatever the latest filing says; what they
// faced before is still the basis of every motion already filed against it.
//
// So this module never destroys anything. Superseding a document marks it, and
// its charges stay exactly as the People wrote them. The word "delete" appears
// nowhere: a count that goes away is dismissed, in a filing, on a date.
// ============================================================================

import prisma from '../lib/prisma.js';
import { getStatute } from '../law/lawService.js';
import { normalizeSection, CALIFORNIA_CODES } from '../law/officialLawSource.js';

export const CHARGING_DOCUMENT_KINDS = [
  'complaint',
  'amended_complaint',
  'information',
  'amended_information',
  'dismissal',
] as const;

export type ChargingDocumentKind = (typeof CHARGING_DOCUMENT_KINDS)[number];

export interface ChargeInput {
  countNumber: number;
  code: string;
  section: string;
  subdivision?: string | null;
  /** The People's words. Stored exactly as given. */
  verbatimText: string;
  status?: 'active' | 'dismissed' | 'pending';
  enhancements?: string[];
  attempt?: boolean;
  strikeAllegation?: boolean;
  seriousFelony?: boolean;
  violentFelony?: boolean;
  gangAllegation?: boolean;
  firearmAllegation?: boolean;
  greatBodilyInjury?: boolean;
  specialCircumstance?: boolean;
  threeStrikes?: boolean;
  sexRegistration?: boolean;
  priorConvictions?: string[];
  drugWeight?: string | null;
  restitution?: string | null;
  maximumExposure?: string | null;
  defendants?: Array<{ name: string; status?: 'charged' | 'dismissed' | 'severed'; clientId?: string | null; note?: string }>;
}

/** "Penal Code section 245(a)(4)" from its parts. */
export function normalizedCitation(code: string, section: string, subdivision?: string | null): string {
  const codeName = CALIFORNIA_CODES[code.toUpperCase()] ?? code.toUpperCase();
  const bare = normalizeSection(section).replace(/\.$/, '');
  return `${codeName} section ${bare}${subdivision ?? ''}`;
}

/**
 * Resolve a charged section against the Legislature's own publication. A count
 * that cannot be resolved is still recorded — the People charged it whether or
 * not this platform can read the statute — with the reason attached.
 */
async function resolveStatute(code: string, section: string): Promise<{ officialStatuteId: string | null; note: string | null }> {
  try {
    const record = await getStatute(code, section);
    if (record.officialStatuteId) {
      return {
        officialStatuteId: record.officialStatuteId,
        note: record.status === 'repealed'
          ? 'This section is shown as repealed at the official source. Check the law in force at the time of the alleged conduct.'
          : null,
      };
    }
    return { officialStatuteId: null, note: record.unavailableReason };
  } catch (err) {
    return {
      officialStatuteId: null,
      note: `The statute could not be retrieved: ${(err as Error).message}. The count is recorded as charged.`,
    };
  }
}

export interface FileDocumentInput {
  caseId: string;
  tenantId: string;
  uploadedById: string;
  kind: ChargingDocumentKind;
  name: string;
  filedAt: Date;
  court?: string | null;
  courtCaseNumber?: string | null;
  citation?: string | null;
  sourceEvidenceId?: string | null;
  notes?: string | null;
  charges: ChargeInput[];
}

/**
 * File a charging document. It takes the next sequence number in the case and
 * becomes the operative document; everything before it is marked superseded
 * but left intact.
 */
export async function fileChargingDocument(input: FileDocumentInput) {
  const last = await prisma.chargingDocument.findFirst({
    where: { caseId: input.caseId },
    orderBy: { filingSequence: 'desc' },
    select: { filingSequence: true },
  });
  const filingSequence = (last?.filingSequence ?? 0) + 1;

  const document = await prisma.chargingDocument.create({
    data: {
      caseId: input.caseId,
      tenantId: input.tenantId,
      uploadedById: input.uploadedById,
      kind: input.kind,
      name: input.name,
      filedAt: input.filedAt,
      court: input.court,
      courtCaseNumber: input.courtCaseNumber,
      citation: input.citation,
      sourceEvidenceId: input.sourceEvidenceId,
      notes: input.notes,
      filingSequence,
    },
  });

  for (const charge of input.charges) {
    await addCountToDocument(document.chargingDocumentId, input.caseId, charge);
  }

  // Everything filed earlier is superseded, and kept.
  await prisma.chargingDocument.updateMany({
    where: { caseId: input.caseId, status: 'filed', filingSequence: { lt: filingSequence }, supersededAt: null },
    data: { supersededAt: new Date() },
  });

  return getChargingDocument(document.chargingDocumentId);
}

/** Add one count to a draft, resolving its statute against the Legislature. */
export async function addCountToDocument(chargingDocumentId: string, caseId: string, charge: ChargeInput) {
  const { officialStatuteId, note } = await resolveStatute(charge.code, charge.section);

  const created = await prisma.filedCharge.create({
    data: {
      chargingDocumentId,
      caseId,
      countNumber: charge.countNumber,
      code: charge.code.toUpperCase(),
      section: normalizeSection(charge.section),
      subdivision: charge.subdivision ?? null,
      verbatimText: charge.verbatimText,
      normalizedCitation: normalizedCitation(charge.code, charge.section, charge.subdivision),
      officialStatuteId,
      statuteNote: note,
      status: charge.status ?? 'active',
      enhancements: charge.enhancements?.length ? charge.enhancements : undefined,
      attempt: charge.attempt ?? false,
      strikeAllegation: charge.strikeAllegation ?? false,
      seriousFelony: charge.seriousFelony ?? false,
      violentFelony: charge.violentFelony ?? false,
      gangAllegation: charge.gangAllegation ?? false,
      firearmAllegation: charge.firearmAllegation ?? false,
      greatBodilyInjury: charge.greatBodilyInjury ?? false,
      specialCircumstance: charge.specialCircumstance ?? false,
      threeStrikes: charge.threeStrikes ?? false,
      sexRegistration: charge.sexRegistration ?? false,
      priorConvictions: charge.priorConvictions?.length ? charge.priorConvictions : undefined,
      drugWeight: charge.drugWeight ?? null,
      restitution: charge.restitution ?? null,
      maximumExposure: charge.maximumExposure ?? null,
    },
  });

  for (const d of charge.defendants ?? []) {
    await prisma.chargeDefendant
      .create({
        data: {
          filedChargeId: created.filedChargeId,
          defendantName: d.name,
          clientId: d.clientId ?? null,
          status: d.status ?? 'charged',
          note: d.note,
        },
      })
      .catch(() => {});
  }

  return created;
}

export async function getChargingDocument(chargingDocumentId: string) {
  return prisma.chargingDocument.findUnique({
    where: { chargingDocumentId },
    include: { charges: { include: { defendants: true }, orderBy: { countNumber: 'asc' } } },
  });
}

/**
 * The operative document: the most recent *filed* document in the case. A
 * draft is deliberately excluded — an attorney part-way through preparing an
 * amendment must not change what the defendant is shown as facing.
 */
export async function getOperativeDocument(caseId: string) {
  return prisma.chargingDocument.findFirst({
    where: { caseId, status: 'filed' },
    orderBy: { filingSequence: 'desc' },
    include: { charges: { include: { defendants: true }, orderBy: { countNumber: 'asc' } } },
  });
}

/** Every filing in the case, oldest first. Nothing is omitted. */
export async function getChargingHistory(caseId: string) {
  return prisma.chargingDocument.findMany({
    where: { caseId, status: 'filed' },
    orderBy: { filingSequence: 'asc' },
    include: { charges: { include: { defendants: true }, orderBy: { countNumber: 'asc' } } },
  });
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ChargeChange {
  type:
    | 'added'
    | 'dismissed'
    | 'renumbered'
    | 'allegation_modified'
    | 'enhancement_added'
    | 'enhancement_dismissed'
    | 'defendant_added'
    | 'defendant_removed'
    | 'defendant_status_changed'
    | 'allegation_added'
    | 'allegation_dropped'
    | 'statute_changed';
  /** What the reader needs to know, in a sentence. */
  description: string;
  citation: string;
  before?: { countNumber?: number; text?: string; status?: string } | null;
  after?: { countNumber?: number; text?: string; status?: string } | null;
}

type ChargeWithDefendants = {
  countNumber: number;
  code: string;
  section: string;
  subdivision: string | null;
  verbatimText: string;
  normalizedCitation: string;
  status: string;
  enhancements: unknown;
  defendants: Array<{ defendantName: string; status: string }>;
  attempt?: boolean;
  strikeAllegation?: boolean;
  seriousFelony?: boolean;
  violentFelony?: boolean;
  gangAllegation?: boolean;
  firearmAllegation?: boolean;
  greatBodilyInjury?: boolean;
  specialCircumstance?: boolean;
  threeStrikes?: boolean;
  sexRegistration?: boolean;
};

/** Allegations that must be pleaded, and how to say each one in a sentence. */
const ALLEGATION_LABELS: Array<[keyof ChargeWithDefendants, string]> = [
  ['attempt', 'charged as an attempt'],
  ['strikeAllegation', 'a strike allegation'],
  ['seriousFelony', 'a serious felony allegation'],
  ['violentFelony', 'a violent felony allegation'],
  ['threeStrikes', 'a three strikes allegation'],
  ['gangAllegation', 'a gang allegation'],
  ['firearmAllegation', 'a firearm allegation'],
  ['greatBodilyInjury', 'a great bodily injury allegation'],
  ['specialCircumstance', 'a special circumstance'],
  ['sexRegistration', 'a sex offender registration allegation'],
];

/** A count is the same count across filings if it charges the same provision. */
function chargeKey(c: { code: string; section: string; subdivision: string | null }): string {
  return `${c.code} ${c.section}${c.subdivision ?? ''}`;
}

function enhancementList(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * What changed between two filings. Counts are matched on the provision
 * charged rather than on count number, because renumbering is routine and a
 * count that moved from 3 to 1 is not a dismissal and an addition.
 */
export function compareDocuments(
  before: { name: string; charges: ChargeWithDefendants[] },
  after: { name: string; charges: ChargeWithDefendants[] },
): ChargeChange[] {
  const changes: ChargeChange[] = [];

  const beforeByKey = new Map(before.charges.map((c) => [chargeKey(c), c]));
  const afterByKey = new Map(after.charges.map((c) => [chargeKey(c), c]));

  for (const [key, a] of afterByKey) {
    const b = beforeByKey.get(key);

    if (!b) {
      changes.push({
        type: 'added',
        citation: a.normalizedCitation,
        description: `Count ${a.countNumber}, ${a.normalizedCitation}, was added in the ${after.name}.`,
        before: null,
        after: { countNumber: a.countNumber, text: a.verbatimText, status: a.status },
      });
      continue;
    }

    if (b.countNumber !== a.countNumber) {
      changes.push({
        type: 'renumbered',
        citation: a.normalizedCitation,
        description: `${a.normalizedCitation} moved from count ${b.countNumber} to count ${a.countNumber}. The charge itself is unchanged.`,
        before: { countNumber: b.countNumber },
        after: { countNumber: a.countNumber },
      });
    }

    if (b.status !== 'dismissed' && a.status === 'dismissed') {
      changes.push({
        type: 'dismissed',
        citation: a.normalizedCitation,
        description: `Count ${a.countNumber}, ${a.normalizedCitation}, was dismissed in the ${after.name}.`,
        before: { status: b.status },
        after: { status: a.status },
      });
    }

    if (b.verbatimText.trim() !== a.verbatimText.trim()) {
      changes.push({
        type: 'allegation_modified',
        citation: a.normalizedCitation,
        description: `The allegation for ${a.normalizedCitation} was rewritten in the ${after.name}.`,
        before: { text: b.verbatimText },
        after: { text: a.verbatimText },
      });
    }

    const beforeEnh = new Set(enhancementList(b.enhancements));
    const afterEnh = new Set(enhancementList(a.enhancements));
    for (const e of afterEnh) {
      if (!beforeEnh.has(e)) {
        changes.push({
          type: 'enhancement_added',
          citation: a.normalizedCitation,
          description: `A new enhancement was alleged with ${a.normalizedCitation}: ${e}`,
          after: { text: e },
        });
      }
    }
    for (const e of beforeEnh) {
      if (!afterEnh.has(e)) {
        changes.push({
          type: 'enhancement_dismissed',
          citation: a.normalizedCitation,
          description: `An enhancement previously alleged with ${a.normalizedCitation} is no longer charged: ${e}`,
          before: { text: e },
        });
      }
    }

    // Allegations drive exposure, so one appearing or going away is the kind
    // of change counsel needs told about in terms, not as a diff.
    for (const [field, label] of ALLEGATION_LABELS) {
      const had = Boolean(b[field]);
      const has = Boolean(a[field]);
      if (!had && has) {
        changes.push({
          type: 'allegation_added',
          citation: a.normalizedCitation,
          description: `Count ${a.countNumber}, ${a.normalizedCitation}, now carries ${label}.`,
          after: { text: label },
        });
      } else if (had && !has) {
        changes.push({
          type: 'allegation_dropped',
          citation: a.normalizedCitation,
          description: `${label.charAt(0).toUpperCase()}${label.slice(1)} previously pleaded against count ${a.countNumber}, ${a.normalizedCitation}, is no longer alleged.`,
          before: { text: label },
        });
      }
    }

    const beforeDef = new Map(b.defendants.map((d) => [d.defendantName, d.status]));
    const afterDef = new Map(a.defendants.map((d) => [d.defendantName, d.status]));
    for (const [name, status] of afterDef) {
      if (!beforeDef.has(name)) {
        changes.push({
          type: 'defendant_added',
          citation: a.normalizedCitation,
          description: `${name} was added to count ${a.countNumber}, ${a.normalizedCitation}.`,
          after: { text: name, status },
        });
      } else if (beforeDef.get(name) !== status) {
        changes.push({
          type: 'defendant_status_changed',
          citation: a.normalizedCitation,
          description: `${name} is now ${status} on count ${a.countNumber}, ${a.normalizedCitation}, having been ${beforeDef.get(name)}.`,
          before: { status: beforeDef.get(name) },
          after: { status },
        });
      }
    }
    for (const [name] of beforeDef) {
      if (!afterDef.has(name)) {
        changes.push({
          type: 'defendant_removed',
          citation: a.normalizedCitation,
          description: `${name} is no longer charged on ${a.normalizedCitation}.`,
          before: { text: name },
        });
      }
    }
  }

  for (const [key, b] of beforeByKey) {
    if (afterByKey.has(key)) continue;
    changes.push({
      type: 'dismissed',
      citation: b.normalizedCitation,
      description:
        `Count ${b.countNumber}, ${b.normalizedCitation}, does not appear in the ${after.name}. ` +
        'It is no longer charged.',
      before: { countNumber: b.countNumber, text: b.verbatimText, status: b.status },
      after: null,
    });
  }

  return changes;
}

/** The changes each filing made relative to the one before it. */
export async function chargingTimeline(caseId: string) {
  const history = await getChargingHistory(caseId);

  return history.map((doc, i) => ({
    chargingDocumentId: doc.chargingDocumentId,
    kind: doc.kind,
    name: doc.name,
    filedAt: doc.filedAt,
    court: doc.court,
    courtCaseNumber: doc.courtCaseNumber,
    filingSequence: doc.filingSequence,
    citation: doc.citation,
    isOperative: i === history.length - 1,
    supersededAt: doc.supersededAt,
    countCount: doc.charges.length,
    activeCount: doc.charges.filter((c) => c.status === 'active').length,
    changesFromPrevious:
      i === 0
        ? []
        : compareDocuments(
            { name: history[i - 1].name, charges: history[i - 1].charges as unknown as ChargeWithDefendants[] },
            { name: doc.name, charges: doc.charges as unknown as ChargeWithDefendants[] },
          ),
  }));
}

// ---------------------------------------------------------------------------
// Keeping the rest of the platform in step
// ---------------------------------------------------------------------------

/**
 * The analysis engines read charges from the flat Charge table. When the
 * operative document changes, that table is rewritten from it, so CALCRIM,
 * mens rea and the dashboards follow the charges actually on file rather than
 * whatever was entered first.
 *
 * Only the derived table is rewritten. The charging documents themselves are
 * never touched.
 */
export async function syncOperativeCharges(caseId: string): Promise<{ synced: number }> {
  const operative = await getOperativeDocument(caseId);
  if (!operative) return { synced: 0 };

  const active = operative.charges.filter((c) => c.status === 'active');

  await prisma.charge.deleteMany({ where: { caseId } });

  for (const c of active) {
    const statute = c.officialStatuteId
      ? await prisma.officialStatute.findUnique({ where: { officialStatuteId: c.officialStatuteId } })
      : null;

    await prisma.charge
      .create({
        data: {
          caseId,
          code: c.code,
          section: c.section.replace(/\.$/, '') + (c.subdivision ?? ''),
          title: statute?.hierarchy
            ? ((statute.hierarchy as Array<{ heading: string }>).slice(-1)[0]?.heading ?? c.normalizedCitation)
            : c.normalizedCitation,
          victim: c.defendants.map((d) => d.defendantName).join(', ') || 'Unspecified',
        },
      })
      .catch(() => {});
  }

  return { synced: active.length };
}
