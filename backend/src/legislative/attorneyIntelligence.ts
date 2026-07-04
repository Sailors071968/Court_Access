// ============================================================================
// Attorney Intelligence — composes canonical repositories for attorney consumption
// Every conclusion drills into evidence, authorities, statutes, and audit history
// ============================================================================

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  AuthorityRecord,
  CalcrimLinkRecord,
  CrossReferenceRecord,
  ElementRecord,
  ExceptionRecord,
  DefenseRecord,
  MensReaRecord,
  OffenseRecord,
  StatuteRecord,
} from './knowledgeGraph/types.ts';
import type { StatuteClassificationRecord } from './liabilityDiscovery/types.ts';
import { PIPELINE_VERSION } from './pipelineStages.ts';

const DEFAULT_REPO_DIR = 'data/legislative/repositories';

export interface AttorneyIntelligenceAudit {
  sourceUrl: string;
  contentHash: string;
  retrievedAt: string;
  pipelineVersion: string;
  classificationVersion: string;
  extractorVersion: string;
}

export interface AttorneyStatuteIntelligence {
  code: string;
  section: string;
  title: string;
  statute: StatuteRecord | null;
  classification: StatuteClassificationRecord | null;
  offenses: OffenseRecord[];
  elements: ElementRecord[];
  mensRea: MensReaRecord[];
  exceptions: ExceptionRecord[];
  defenses: DefenseRecord[];
  crossReferences: CrossReferenceRecord[];
  calcrimLinks: CalcrimLinkRecord[];
  authorities: AuthorityRecord[];
  criminalLiabilityLikely: boolean;
  discoveryPriority: string | null;
  confirmedOffense: boolean;
  manualReviewRequired: boolean;
  unknowns: string[];
  audit: AttorneyIntelligenceAudit | null;
}

async function loadJsonlRecords<T extends { code?: string; section?: string; sourceStatuteId?: string }>(
  repoDir: string,
  repoName: string,
): Promise<T[]> {
  try {
    const raw = await readFile(join(repoDir, repoName, 'records.jsonl'), 'utf-8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function latestBySection<T extends { code: string; section: string }>(
  records: T[],
  code: string,
  section: string,
): T | null {
  let latest: T | null = null;
  for (const record of records) {
    if (record.code === code.toUpperCase() && record.section === section) {
      latest = record;
    }
  }
  return latest;
}

function filterByStatuteId<T extends { sourceStatuteId: string }>(
  records: T[],
  statuteId: string,
): T[] {
  return records.filter((r) => r.sourceStatuteId === statuteId);
}

function collectUnknowns(intel: Omit<AttorneyStatuteIntelligence, 'unknowns'>): string[] {
  const unknowns: string[] = [];
  if (!intel.statute) unknowns.push('Statute not found in repository');
  if (!intel.classification) unknowns.push('Classification not available');
  if (intel.classification?.classification.value === 'unknown') {
    unknowns.push('Statutory classification: UNKNOWN');
  }
  if (intel.criminalLiabilityLikely && !intel.confirmedOffense) {
    unknowns.push('Criminal liability likely but offense not confirmed — manual review required');
  }
  if (intel.offenses.length === 0 && intel.criminalLiabilityLikely) {
    unknowns.push('No offense records extracted');
  }
  if (intel.calcrimLinks.length === 0 && intel.confirmedOffense) {
    unknowns.push('No CALCRIM instruction linked');
  }
  return unknowns;
}

export async function getAttorneyStatuteIntelligence(
  code: string,
  section: string,
  options?: { repositoryDir?: string },
): Promise<AttorneyStatuteIntelligence | null> {
  const repoDir = resolve(options?.repositoryDir ?? DEFAULT_REPO_DIR);
  const normalizedSection = section.endsWith('.') ? section : `${section}.`;
  const upperCode = code.toUpperCase();

  const [statutes, classifications, offenses, elements, mensRea, exceptions, defenses, crossRefs, calcrim, authorities] =
    await Promise.all([
      loadJsonlRecords<StatuteRecord>(repoDir, 'statutes'),
      loadJsonlRecords<StatuteClassificationRecord>(repoDir, 'statute_classifications'),
      loadJsonlRecords<OffenseRecord>(repoDir, 'offenses'),
      loadJsonlRecords<ElementRecord>(repoDir, 'elements'),
      loadJsonlRecords<MensReaRecord>(repoDir, 'mens_rea'),
      loadJsonlRecords<ExceptionRecord>(repoDir, 'exceptions'),
      loadJsonlRecords<DefenseRecord>(repoDir, 'defenses'),
      loadJsonlRecords<CrossReferenceRecord>(repoDir, 'cross_references'),
      loadJsonlRecords<CalcrimLinkRecord>(repoDir, 'calcrim_links'),
      loadJsonlRecords<AuthorityRecord>(repoDir, 'authorities'),
    ]);

  const statute = latestBySection(statutes, upperCode, normalizedSection);
  if (!statute) return null;

  const classification = latestBySection(classifications, upperCode, normalizedSection);
  const offenseList = filterByStatuteId(offenses, statute.id);
  const elementList = filterByStatuteId(elements, statute.id);
  const mensReaList = filterByStatuteId(mensRea, statute.id);
  const exceptionList = filterByStatuteId(exceptions, statute.id);
  const defenseList = filterByStatuteId(defenses, statute.id);
  const crossRefList = filterByStatuteId(crossRefs, statute.id);
  const calcrimList = filterByStatuteId(calcrim, statute.id);
  const authorityList = filterByStatuteId(authorities, statute.id);

  const base: Omit<AttorneyStatuteIntelligence, 'unknowns'> = {
    code: upperCode,
    section: normalizedSection,
    title: statute.title,
    statute,
    classification,
    offenses: offenseList,
    elements: elementList,
    mensRea: mensReaList,
    exceptions: exceptionList,
    defenses: defenseList,
    crossReferences: crossRefList,
    calcrimLinks: calcrimList,
    authorities: authorityList,
    criminalLiabilityLikely: classification?.criminalLiabilityLikely ?? false,
    discoveryPriority: classification?.discoveryPriority ?? null,
    confirmedOffense: classification?.confirmedOffense ?? offenseList.length > 0,
    manualReviewRequired: classification?.manualReviewRequired ?? false,
    audit: statute
      ? {
          sourceUrl: statute.sourceUrl,
          contentHash: statute.contentHash,
          retrievedAt: statute.retrievedAt,
          pipelineVersion: PIPELINE_VERSION,
          classificationVersion: classification?.audit.extractorVersion ?? 'UNKNOWN',
          extractorVersion: statute.audit.extractorVersion,
        }
      : null,
  };

  return {
    ...base,
    unknowns: collectUnknowns(base),
  };
}
