// ============================================================================
// Defence strategy workspace.
//
// Organises what is actually in the record into the themes a defence lawyer
// thinks in: identity, alibi, self defence, lack of intent, the Fourth
// Amendment, credibility, and so on.
//
// It organises. It does not conclude. A theme appears because something in the
// record touches it, and what appears under it is the evidence itself with a
// citation, together with what is missing and what remains unanswered. Nothing
// here says a defence is available, or good, or should be run. That is the
// lawyer's judgement and this platform is not entitled to it.
//
// A theme with no support in the record is reported as unsupported rather than
// omitted, because "we found nothing on alibi" and "we never looked" are
// different answers and counsel needs to know which one this is.
// ============================================================================

import prisma from '../lib/prisma.js';

export interface ThemeDefinition {
  id: string;
  label: string;
  group: 'factual' | 'mental_state' | 'constitutional' | 'reliability' | 'procedural' | 'burden';
  /** What would put material under this theme, in the record's own words. */
  signals: RegExp[];
  /** What counsel usually needs and often does not have. */
  commonlyMissing: string[];
}

/**
 * The themes. Each carries the language that would make it relevant, so a
 * theme surfaces because a document said something, not because the platform
 * decided the case looks like one.
 */
export const DEFENSE_THEMES: ThemeDefinition[] = [
  { id: 'identity', label: 'Identity', group: 'factual',
    signals: [/\bidentif(?:y|ied|ication)\b/i, /\bsuspect descri/i, /\bshow-?up\b/i, /\blineup\b/i, /\bsix-?pack\b/i, /\bphoto array\b/i],
    commonlyMissing: ['The admonition given before any identification procedure', 'The photographs shown to the witness', 'The witness\u2019s stated level of certainty at the time'] },
  { id: 'mistaken_identification', label: 'Mistaken identification', group: 'reliability',
    signals: [/\bcross-?racial\b/i, /\bbriefly (?:saw|observed)\b/i, /\bpoor lighting\b/i, /\bfrom a distance\b/i, /\bresembl/i, /\blooked like\b/i],
    commonlyMissing: ['Lighting and distance measurements at the scene', 'Whether the witness had seen a photograph before the procedure'] },
  { id: 'alibi', label: 'Alibi', group: 'factual',
    signals: [/\balibi\b/i, /\bwas (?:at|with)\b.{0,40}\bat the time\b/i, /\bnot present\b/i, /\belsewhere\b/i],
    commonlyMissing: ['Cell site records for the relevant window', 'Receipts, transit records or door access logs', 'Statements from anyone present'] },
  { id: 'self_defense', label: 'Self defence', group: 'factual',
    signals: [/\bself[- ]defen[cs]e\b/i, /\bdefend(?:ing|ed) (?:himself|herself|themselves)\b/i, /\bwas attacked\b/i, /\bfeared for\b/i, /\baggressor\b/i],
    commonlyMissing: ['Any injury photographs of the accused', 'Prior threats or history between the parties', 'Medical records for both parties'] },
  { id: 'defense_of_others', label: 'Defence of others', group: 'factual',
    signals: [/\bdefen[cs]e of (?:another|others)\b/i, /\bprotect(?:ing|ed)\b.{0,30}\bfrom\b/i],
    commonlyMissing: ['Statements from the person said to have been protected'] },
  { id: 'lack_of_intent', label: 'Lack of intent', group: 'mental_state',
    signals: [/\bdid not intend\b/i, /\bno intent\b/i, /\baccident(?:al|ally)?\b/i, /\bunintentional/i, /\binadvertent/i],
    commonlyMissing: ['Anything showing the accused\u2019s state of mind at the time', 'Statements made immediately after the event'] },
  { id: 'lack_of_knowledge', label: 'Lack of knowledge', group: 'mental_state',
    signals: [/\bdid not know\b/i, /\bunaware\b/i, /\bno knowledge\b/i, /\bnot aware that\b/i],
    commonlyMissing: ['Evidence of who else had access', 'Anything showing what the accused was told'] },
  { id: 'mistake_of_fact', label: 'Mistake of fact', group: 'mental_state',
    signals: [/\bmistaken(?:ly)? believ/i, /\bthought (?:it|that|he|she|they) w(?:as|ere)\b/i, /\bmistake of fact\b/i],
    commonlyMissing: ['What the accused was told before acting'] },
  { id: 'duress', label: 'Duress', group: 'factual',
    signals: [/\bduress\b/i, /\bthreatened\b.{0,40}\bif (?:he|she|they)\b/i, /\bcoerc/i, /\bforced to\b/i],
    commonlyMissing: ['Any record of the threat', 'Whether an escape or report was possible'] },
  { id: 'necessity', label: 'Necessity', group: 'factual',
    signals: [/\bnecessity\b/i, /\bemergency\b/i, /\bno other (?:choice|option)\b/i],
    commonlyMissing: ['Evidence about the alternatives available'] },
  { id: 'entrapment', label: 'Entrapment', group: 'factual',
    signals: [/\bentrap/i, /\bconfidential informant\b/i, /\bundercover\b/i, /\bsting\b/i, /\bdecoy\b/i],
    commonlyMissing: ['The informant\u2019s agreement and payments', 'Every recorded contact before the offence'] },
  { id: 'false_accusation', label: 'False accusation', group: 'reliability',
    signals: [/\bfalse (?:accusation|report|allegation)\b/i, /\bfabricat/i, /\bmotive to lie\b/i, /\bcustody dispute\b/i, /\brecant/i],
    commonlyMissing: ['The complaining witness\u2019s prior statements', 'Anything showing a reason to accuse'] },
  { id: 'consent', label: 'Consent', group: 'factual',
    signals: [/\bconsent(?:ed|ing)?\b/i, /\bpermission\b/i, /\ballowed (?:him|her|them) to\b/i, /\binvited\b/i],
    commonlyMissing: ['Communications between the parties before the event'] },
  { id: 'possession', label: 'Possession and constructive possession', group: 'factual',
    signals: [/\bconstructive possession\b/i, /\bdominion and control\b/i, /\bin the (?:vehicle|room|residence)\b/i, /\baccess to\b/i, /\bwho else\b/i],
    commonlyMissing: ['Fingerprint or DNA testing of the item', 'Who else had access to the place it was found', 'Registration or ownership records'] },
  { id: 'insufficient_evidence', label: 'Insufficient evidence', group: 'burden',
    signals: [/\bunable to (?:determine|identify|establish)\b/i, /\binconclusive\b/i, /\bno evidence (?:of|that)\b/i, /\bnot located\b/i, /\bnegative results?\b/i],
    commonlyMissing: [] },
  { id: 'fourth_amendment', label: 'Fourth Amendment', group: 'constitutional',
    signals: [/\bsearch(?:ed)?\b/i, /\bwarrant(?:less)?\b/i, /\bconsent to search\b/i, /\bpat-?down\b/i, /\bdetain(?:ed|ment)\b/i, /\btraffic stop\b/i, /\bprobable cause\b/i, /\bplain view\b/i],
    commonlyMissing: ['The search warrant and its supporting affidavit', 'The warrant return', 'Body-worn camera covering the stop and the search'] },
  { id: 'miranda', label: 'Miranda', group: 'constitutional',
    signals: [/\bmiranda\b/i, /\bright to remain silent\b/i, /\badmonish(?:ed|ment)\b/i, /\binvoke[d]?\b.{0,25}\b(?:right|counsel|attorney)\b/i, /\bcustodial interrogation\b/i],
    commonlyMissing: ['A recording of the advisement itself', 'The time the advisement was given relative to questioning'] },
  { id: 'voluntariness', label: 'Voluntariness of statements', group: 'constitutional',
    signals: [/\bvoluntar/i, /\bcoerced (?:statement|confession)\b/i, /\bpromis(?:e|ed) of leniency\b/i, /\blength of (?:the )?interrogation\b/i],
    commonlyMissing: ['The complete recording of the interview, not an excerpt', 'How long the accused had been in custody'] },
  { id: 'fifth_amendment', label: 'Fifth Amendment', group: 'constitutional',
    signals: [/\bfifth amendment\b/i, /\bself-?incriminat/i, /\brefused to (?:answer|speak)\b/i],
    commonlyMissing: [] },
  { id: 'sixth_amendment', label: 'Sixth Amendment', group: 'constitutional',
    signals: [/\bright to counsel\b/i, /\bconfront(?:ation)?\b/i, /\bspeedy trial\b/i, /\bcross-?examin/i],
    commonlyMissing: [] },
  { id: 'pitchess', label: 'Pitchess', group: 'procedural',
    signals: [/\bpitchess\b/i, /\bofficer misconduct\b/i, /\bpersonnel (?:file|record)\b/i, /\bexcessive force\b/i, /\bdishonest/i],
    commonlyMissing: ['The officer\u2019s personnel record, which requires a motion to reach'] },
  { id: 'brady', label: 'Brady', group: 'procedural',
    signals: [/\bbrady\b/i, /\bexculpatory\b/i, /\bfavorable to the (?:defen[cs]e|accused)\b/i, /\bimpeach/i, /\bbenefit(?:s)? (?:given|offered)\b/i],
    commonlyMissing: ['Any agreement with a cooperating witness', 'The complaining witness\u2019s record'] },
  { id: 'discovery', label: 'Discovery', group: 'procedural',
    signals: [/\bnot (?:yet )?(?:produced|provided|disclosed)\b/i, /\boutstanding discovery\b/i, /\brequest(?:ed)? (?:but )?not received\b/i, /\bpending\b.{0,20}\breport\b/i],
    commonlyMissing: [] },
  { id: 'chain_of_custody', label: 'Chain of custody', group: 'reliability',
    signals: [/\bchain of custody\b/i, /\bbooked into evidence\b/i, /\bevidence (?:tag|log|locker)\b/i, /\bseal(?:ed)?\b/i, /\btransferred to\b/i],
    commonlyMissing: ['The complete property and evidence log', 'Every transfer signature between seizure and testing'] },
  { id: 'forensic_reliability', label: 'Forensic reliability', group: 'reliability',
    signals: [/\bDNA\b/, /\blaborator(?:y|ies)\b/i, /\bcriminalist\b/i, /\bpresumptive test\b/i, /\bconfirmator/i, /\bcalibrat/i, /\bcontaminat/i],
    commonlyMissing: ['The laboratory\u2019s bench notes and raw data', 'Instrument calibration and maintenance records', 'The analyst\u2019s proficiency testing history'] },
  { id: 'expert_reliability', label: 'Expert reliability', group: 'reliability',
    signals: [/\bexpert (?:opinion|witness)\b/i, /\bin my (?:expert )?opinion\b/i, /\bmethodolog/i, /\bpeer[- ]review/i],
    commonlyMissing: ['The expert\u2019s curriculum vitae and prior testimony', 'The material the opinion was based on'] },
  { id: 'witness_credibility', label: 'Witness credibility', group: 'reliability',
    signals: [/\binconsistent\b/i, /\bcontradict/i, /\bchanged (?:his|her|their) (?:story|statement)\b/i, /\bprior conviction\b/i, /\bunder the influence\b/i, /\bdid not recall\b/i],
    commonlyMissing: ['Every prior statement the witness gave', 'Any benefit the witness received'] },
  { id: 'officer_credibility', label: 'Officer credibility', group: 'reliability',
    signals: [/\bofficer(?:\u2019s|'s)? report\b/i, /\bdiffer(?:s|ent) from (?:the )?(?:report|video)\b/i, /\bnot (?:activated|recorded)\b/i, /\bcamera (?:off|malfunction)\b/i],
    commonlyMissing: ['Body-worn camera for the whole contact, not an excerpt', 'The officer\u2019s prior reports in related matters'] },
  { id: 'timeline_conflicts', label: 'Timeline conflicts', group: 'reliability',
    signals: [/\bapproximately \d{1,2}:\d{2}\b/i, /\btime of (?:the )?(?:call|incident|arrest)\b/i, /\bCAD\b/, /\bdispatch(?:ed)? at\b/i, /\btimestamp\b/i],
    commonlyMissing: ['The CAD log with its own timestamps', 'Device clock offsets for any recording'] },
  { id: 'mens_rea', label: 'Mens rea', group: 'mental_state',
    signals: [/\bwith intent\b/i, /\bknowingly\b/i, /\bwillfully\b/i, /\bmalice\b/i, /\brecklessly\b/i, /\bnegligen/i],
    commonlyMissing: [] },
  { id: 'prosecution_burden', label: 'Prosecution burden and reasonable doubt', group: 'burden',
    signals: [/\bbeyond a reasonable doubt\b/i, /\bburden of proof\b/i, /\bpresumption of innocence\b/i],
    commonlyMissing: [] },
];

export interface ThemeCitation {
  evidenceId: string;
  fileName: string;
  /** The passage that put this document under the theme. */
  excerpt: string;
  page: number | null;
  matchedOn: string;
}

export interface ThemeResult {
  id: string;
  label: string;
  group: string;
  /** supported | unsupported — whether anything in the record touches it. */
  status: 'supported' | 'unsupported';
  /** Documents whose text touches this theme, each with the passage. */
  citations: ThemeCitation[];
  documentCount: number;
  /** What is commonly needed for this theme and is not in the record. */
  missing: string[];
  /** Questions this theme raises that the record does not answer. */
  openQuestions: string[];
  /** Statutes and instructions bearing on it, when they are known. */
  authorities: Array<{ kind: string; citation: string; officialUrl: string | null }>;
  /** Why this theme is or is not supported, in a sentence. */
  basis: string;
}

const MAX_CITATIONS_PER_THEME = 8;

/**
 * Organise the record into themes.
 *
 * Every citation is a passage that exists in a document in this case. Nothing
 * is inferred about whether a defence is available: a theme is "supported"
 * only in the sense that the record contains material touching it.
 */
export async function buildDefenseThemes(caseId: string, tenantId: string): Promise<{
  caseId: string;
  themes: ThemeResult[];
  documentsExamined: number;
  charges: Array<{ citation: string; officialUrl: string | null }>;
  caveat: string;
}> {
  const evidence = await prisma.evidence.findMany({
    where: { caseId, tenantId },
    select: { evidenceId: true, fileName: true, pageMap: true },
  });

  const chunks = await prisma.evidenceChunk.findMany({
    where: { evidenceId: { in: evidence.map((e) => e.evidenceId) } },
    select: { evidenceId: true, text: true, chunkIndex: true },
    orderBy: { chunkIndex: 'asc' },
  });

  const fileNameOf = new Map(evidence.map((e) => [e.evidenceId, e.fileName]));

  // Charges bring their own authorities.
  const operative = await prisma.chargingDocument.findFirst({
    where: { caseId, status: 'filed' },
    orderBy: { filingSequence: 'desc' },
    include: { charges: true },
  });
  const chargeAuthorities: Array<{ kind: string; citation: string; officialUrl: string | null }> = [];
  for (const c of operative?.charges ?? []) {
    const statute = c.officialStatuteId
      ? await prisma.officialStatute.findUnique({ where: { officialStatuteId: c.officialStatuteId } })
      : null;
    chargeAuthorities.push({
      kind: 'charged statute',
      citation: c.normalizedCitation,
      officialUrl: statute?.officialUrl ?? null,
    });
  }

  const themes: ThemeResult[] = [];

  for (const theme of DEFENSE_THEMES) {
    const citations: ThemeCitation[] = [];
    const seenDocuments = new Set<string>();

    for (const chunk of chunks) {
      if (citations.length >= MAX_CITATIONS_PER_THEME) break;
      for (const signal of theme.signals) {
        const m = signal.exec(chunk.text);
        if (!m) continue;

        // Quote enough for the passage to be recognisable in the document.
        const at = m.index;
        const from = Math.max(0, at - 130);
        const to = Math.min(chunk.text.length, at + m[0].length + 200);
        const excerpt =
          (from > 0 ? '…' : '') +
          chunk.text.slice(from, to).replace(/\s+/g, ' ').trim() +
          (to < chunk.text.length ? '…' : '');

        citations.push({
          evidenceId: chunk.evidenceId,
          fileName: fileNameOf.get(chunk.evidenceId) ?? 'Unknown document',
          excerpt,
          page: null,
          matchedOn: m[0],
        });
        seenDocuments.add(chunk.evidenceId);
        break;
      }
    }

    const supported = citations.length > 0;

    themes.push({
      id: theme.id,
      label: theme.label,
      group: theme.group,
      status: supported ? 'supported' : 'unsupported',
      citations,
      documentCount: seenDocuments.size,
      // Only worth naming what is missing where the theme is live in the record.
      missing: supported ? theme.commonlyMissing : [],
      openQuestions: supported
        ? [
            `Does anything in the record contradict the passages above on ${theme.label.toLowerCase()}?`,
            `Has every document bearing on ${theme.label.toLowerCase()} been produced?`,
          ]
        : [],
      authorities: theme.group === 'mental_state' || theme.id === 'mens_rea' ? chargeAuthorities : [],
      basis: supported
        ? `${seenDocuments.size} document(s) in this case contain language bearing on ${theme.label.toLowerCase()}. ` +
          'The passages are quoted so each can be checked against the document.'
        : `Nothing in the ${evidence.length} document(s) examined uses language bearing on ${theme.label.toLowerCase()}. ` +
          'That is what the record shows, not a conclusion that the theme is unavailable — material may exist that ' +
          'has not been produced, or that this search does not recognise.',
    });
  }

  return {
    caseId,
    themes,
    documentsExamined: evidence.length,
    charges: chargeAuthorities,
    caveat:
      'These themes organise what is in the record. Nothing here says a defence is available, sound or worth ' +
      'running: that is a judgement for counsel, on material counsel has read. Every passage is quoted so it can ' +
      'be checked against the document it came from.',
  };
}
