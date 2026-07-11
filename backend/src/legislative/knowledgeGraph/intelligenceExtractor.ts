// ============================================================================
// Stage 4 — Criminal legal intelligence extraction (deterministic)
// ============================================================================

import { createHash } from 'node:crypto';
import { calcrimElements } from '../../data/calcrimElements.ts';
import { shouldExtractOffense } from '../liabilityDiscovery/classificationEngine.ts';
import type {
  AuditMetadata,
  CalcrimLinkRecord,
  CriminalKnowledgeBundle,
  CrossReferenceRecord,
  DefenseRecord,
  ElementRecord,
  ExceptionRecord,
  ExtractionConfidence,
  FieldValue,
  MensReaRecord,
  OffenseRecord,
  RegulatoryIncorporationRecord,
  StatuteRecord,
} from './types.ts';

export const EXTRACTOR_VERSION = '1.0.0';

const MENS_REA_TERMS = [
  'intent',
  'intentionally',
  'knowingly',
  'willfully',
  'malice',
  'maliciously',
  'recklessly',
  'negligently',
  'purpose',
];

const PENALTY_PATTERNS = [
  /punish(?:ed|able|ment)?\s+by\s+[^.]+\./i,
  /imprisonment\s+in\s+[^.]+\./i,
  /(?:a\s+)?(?:felony|misdemeanor|infraction)\b[^.]*\./i,
  /fine\s+not\s+(?:exceeding|to exceed)\s+[^.]+\./i,
];

function entityId(...parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
}

function field<T>(
  value: T | 'UNKNOWN',
  confidence: ExtractionConfidence,
  sourceText?: string,
): FieldValue<T> {
  return { value, confidence, sourceText };
}

function cloneAudit(statute: StatuteRecord): AuditMetadata {
  return {
    ...statute.audit,
    extractedAt: new Date().toISOString(),
    extractorVersion: EXTRACTOR_VERSION,
    parseStatus: statute.audit.parseStatus,
  };
}

function extractOffenseName(text: string): FieldValue<string> {
  const patterns = [
    /is\s+guilty\s+of\s+([a-z][a-z\s-]+?)(?:\.|,|\s+when|\s+if)/i,
    /commits\s+(?:a\s+)?([a-z][a-z\s-]+?)(?:\.|,)/i,
    /shall\s+be\s+punished[^.]*\bfor\s+([a-z][a-z\s-]+)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) {
      const name = m[1].trim();
      return field(name, 'HIGH', m[0]);
    }
  }
  return field('UNKNOWN', 'UNKNOWN');
}

function extractClassification(text: string): FieldValue<OffenseRecord['classification']['value']> {
  if (/\bfelony\b/i.test(text)) return field('felony', 'HIGH');
  if (/\bmisdemeanor\b/i.test(text)) return field('misdemeanor', 'HIGH');
  if (/\binfraction\b/i.test(text)) return field('infraction', 'MEDIUM');
  if (/\beither\s+a\s+misdemeanor\s+or\s+a\s+felony\b/i.test(text)) return field('wobble', 'HIGH');
  return field('UNKNOWN', 'UNKNOWN');
}

function extractActor(text: string): FieldValue<string> {
  const m = text.match(/(?:every|any)\s+person\s+who\s+([^.;]{10,120})/i);
  if (m) return field(m[0].trim(), 'HIGH', m[0]);
  return field('UNKNOWN', 'UNKNOWN');
}

function extractVictim(text: string): FieldValue<string> {
  if (/\bvictim\b/i.test(text)) return field('victim referenced in statute', 'MEDIUM');
  if (/\bof\s+another\b/i.test(text)) return field('property or person of another', 'MEDIUM');
  return field('UNKNOWN', 'UNKNOWN');
}

function extractConduct(text: string): FieldValue<string> {
  const m = text.match(/(?:who|person)\s+([^.;]{15,200})/i);
  if (m) return field(m[1].trim(), 'MEDIUM', m[0]);
  return field('UNKNOWN', 'UNKNOWN');
}

function extractPenalty(text: string): FieldValue<string> {
  for (const pattern of PENALTY_PATTERNS) {
    const m = text.match(pattern);
    if (m) return field(m[0].trim(), 'HIGH', m[0]);
  }
  return field('UNKNOWN', 'UNKNOWN');
}

function extractMensRea(text: string): { type: MensReaRecord['type']; terms: string[] } {
  const found = MENS_REA_TERMS.filter((t) => text.toLowerCase().includes(t));
  if (found.length === 0) return { type: field('UNKNOWN', 'UNKNOWN'), terms: [] };
  const hasIntent = found.some((t) => t.includes('intent') || t === 'purpose');
  return {
    type: field(hasIntent ? 'specific' : 'general', found.includes('knowingly') ? 'HIGH' : 'MEDIUM'),
    terms: found,
  };
}

function abbreviateCodeName(name: string): string {
  const skip = new Set(['and', 'of', 'the']);
  return name
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()))
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function extractCrossReferences(statute: StatuteRecord): CrossReferenceRecord[] {
  const refs: CrossReferenceRecord[] = [];
  const patterns = [
    /Section\s+(\d+(?:\.\d+)?[a-z]?)\s+of\s+the\s+([A-Za-z ]+?)\s+Code/gi,
    /Section\s+(\d+(?:\.\d+)?[a-z]?)/gi,
    /(?:PEN|EVID|HSC|VEH|BPC)\s+(\d+(?:\.\d+)?[a-z]?)/gi,
  ];

  const seen = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(statute.fullText)) !== null) {
      const targetSection = `${match[1]}.`;
      const targetCode = match[2]
        ? abbreviateCodeName(match[2].trim())
        : statute.code;
      const key = `${targetCode}:${targetSection}`;
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        id: entityId(statute.id, 'xref', key),
        sourceStatuteId: statute.id,
        targetCode,
        targetSection,
        referenceType: match[2] ? 'code' : 'section',
        context: field(match[0], 'HIGH', match[0]),
        audit: cloneAudit(statute),
      });
    }
  }

  return refs;
}

function extractExceptions(statute: StatuteRecord, offenseId?: string): ExceptionRecord[] {
  const results: ExceptionRecord[] = [];
  const matches = statute.fullText.match(/(?:except|does not apply|unless)[^.]+\./gi) ?? [];
  for (const text of matches) {
    results.push({
      id: entityId(statute.id, 'exception', text.slice(0, 40)),
      sourceStatuteId: statute.id,
      offenseId,
      text: field(text.trim(), 'MEDIUM', text),
      audit: cloneAudit(statute),
    });
  }
  return results;
}

function extractDefenses(statute: StatuteRecord, offenseId?: string): DefenseRecord[] {
  const results: DefenseRecord[] = [];
  const matches =
    statute.fullText.match(/(?:it is a defense|affirmative defense|defense to)[^.]+\./gi) ?? [];
  for (const text of matches) {
    results.push({
      id: entityId(statute.id, 'defense', text.slice(0, 40)),
      sourceStatuteId: statute.id,
      offenseId,
      text: field(text.trim(), 'MEDIUM', text),
      audit: cloneAudit(statute),
    });
  }
  return results;
}

function extractRegulatoryIncorporations(statute: StatuteRecord): RegulatoryIncorporationRecord[] {
  const results: RegulatoryIncorporationRecord[] = [];
  const matches =
    statute.fullText.match(/(?:as defined in|pursuant to|in accordance with)[^.]+\./gi) ?? [];
  for (const text of matches) {
    results.push({
      id: entityId(statute.id, 'reginc', text.slice(0, 40)),
      sourceStatuteId: statute.id,
      incorporatedAuthority: field(text.trim(), 'MEDIUM', text),
      context: field(text.trim(), 'MEDIUM', text),
      audit: cloneAudit(statute),
    });
  }
  return results;
}

function linkCalcrim(statute: StatuteRecord, offense: OffenseRecord): CalcrimLinkRecord[] {
  const links: CalcrimLinkRecord[] = [];
  const sectionNum = statute.section.replace(/\.$/, '');

  for (const [key, crime] of Object.entries(calcrimElements)) {
    const crimeSection = crime.code.replace(/^PC\s+/i, '').trim();
    if (crimeSection !== sectionNum && !crime.code.includes(sectionNum)) continue;

    links.push({
      id: entityId(statute.id, 'calcrim', key),
      sourceStatuteId: statute.id,
      offenseId: offense.id,
      instructionNumber: field('UNKNOWN', 'UNKNOWN'),
      instructionTitle: field(key, 'MEDIUM'),
      confidence: 'MEDIUM',
      audit: cloneAudit(statute),
    });
  }

  if (links.length === 0 && offense.name.value !== 'UNKNOWN') {
    // No static CALCRIM mapping found — leave for manual linker stage
  }

  return links;
}

function buildElements(
  statute: StatuteRecord,
  offense: OffenseRecord,
  calcrimKey?: string,
): ElementRecord[] {
  const elements: ElementRecord[] = [];
  const crime = calcrimKey ? calcrimElements[calcrimKey] : undefined;

  if (crime) {
    for (const el of crime.elements) {
      elements.push({
        id: entityId(statute.id, offense.id, 'element', el.id),
        sourceStatuteId: statute.id,
        offenseId: offense.id,
        label: field(el.label, 'HIGH'),
        description: field(el.label, 'HIGH'),
        required: true,
        audit: cloneAudit(statute),
      });
    }
    return elements;
  }

  for (const sub of statute.subdivisions) {
    if (sub.label === '(text)') continue;
    elements.push({
      id: entityId(statute.id, offense.id, 'element', sub.label),
      sourceStatuteId: statute.id,
      offenseId: offense.id,
      label: field(sub.label, 'MEDIUM'),
      description: field(sub.text, 'MEDIUM', sub.text),
      required: true,
      audit: cloneAudit(statute),
    });
  }

  return elements;
}

function isCriminalStatute(text: string): boolean {
  return shouldExtractOffense(text);
}

export function extractCriminalKnowledge(statute: StatuteRecord): CriminalKnowledgeBundle {
  const audit = cloneAudit(statute);
  const bundle: CriminalKnowledgeBundle = {
    statute,
    offenses: [],
    elements: [],
    mensRea: [],
    exceptions: extractExceptions(statute),
    defenses: extractDefenses(statute),
    crossReferences: extractCrossReferences(statute),
    regulatoryIncorporations: extractRegulatoryIncorporations(statute),
    calcrimLinks: [],
    authorities: [],
  };

  if (!isCriminalStatute(statute.fullText)) {
    return bundle;
  }

  const offenseName = extractOffenseName(statute.fullText);
  const offense: OffenseRecord = {
    id: entityId(statute.id, 'offense', String(offenseName.value)),
    sourceStatuteId: statute.id,
    code: statute.code,
    section: statute.section,
    name: offenseName,
    classification: extractClassification(statute.fullText),
    actor: extractActor(statute.fullText),
    conduct: extractConduct(statute.fullText),
    object: field('UNKNOWN', 'UNKNOWN'),
    result: field('UNKNOWN', 'UNKNOWN'),
    victim: extractVictim(statute.fullText),
    penalty: extractPenalty(statute.fullText),
    audit,
  };

  bundle.offenses.push(offense);

  const mensRea = extractMensRea(statute.fullText);
  bundle.mensRea.push({
    id: entityId(statute.id, offense.id, 'mensrea'),
    sourceStatuteId: statute.id,
    offenseId: offense.id,
    type: mensRea.type,
    terms: field(mensRea.terms.length ? mensRea.terms : 'UNKNOWN', mensRea.terms.length ? 'HIGH' : 'UNKNOWN'),
    description: field(
      mensRea.terms.length ? mensRea.terms.join(', ') : 'UNKNOWN',
      mensRea.terms.length ? 'HIGH' : 'UNKNOWN',
    ),
    audit,
  });

  const calcrimKey = Object.keys(calcrimElements).find((k) => {
    const c = calcrimElements[k];
    return c.code.replace(/^PC\s+/i, '').trim() === statute.section.replace(/\.$/, '');
  });

  bundle.elements = buildElements(statute, offense, calcrimKey);
  bundle.calcrimLinks = linkCalcrim(statute, offense);

  for (const xref of bundle.crossReferences) {
    bundle.authorities.push({
      id: entityId(statute.id, 'authority', xref.id),
      sourceStatuteId: statute.id,
      authorityType: 'statute',
      citation: field(`${xref.targetCode} ${xref.targetSection}`, 'HIGH'),
      context: xref.context,
      audit,
    });
  }

  bundle.exceptions = extractExceptions(statute, offense.id);
  bundle.defenses = extractDefenses(statute, offense.id);

  return bundle;
}
