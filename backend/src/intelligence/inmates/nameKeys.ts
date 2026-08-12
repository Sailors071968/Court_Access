// ============================================================================
// Deterministic name keys for candidate generation.
//
// Candidate generation maximises recall; ranking maximises precision. These keys
// exist only for the first stage: they are deliberately broad, and a candidate
// arriving through a phonetic key still has to earn a tier on the evidence.
//
// Everything here is a pure function of a string. No clock, no locale, no
// database, no external table. Same input, same output, forever — which matters
// because these keys are stored in columns and a change to any function here
// requires a backfill, not just a deploy.
//
// PostgreSQL `fuzzystrmatch` would supply soundex(). It is deliberately not used:
// it is an extension, therefore a migration and a database privilege, and its
// availability on the production database is unverified. Computing the keys in
// application code and storing them keeps the dependency at zero and makes every
// key testable without a database.
// ============================================================================

/** Bumped when any function here changes. Stored so a stale key is detectable. */
export const NAME_KEY_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Soundex
// ---------------------------------------------------------------------------

const SOUNDEX_CODES: Record<string, string> = {
  B: '1', F: '1', P: '1', V: '1',
  C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
  D: '3', T: '3',
  L: '4',
  M: '5', N: '5',
  R: '6',
};

/**
 * Standard Soundex, four characters.
 *
 * Catches the substitutions that clerks and OCR both make: SMITH/SMYTH,
 * JOHNSON/JOHNSEN, CATHERINE/KATHERINE. It is coarse — SMITH and SMYTHE and
 * SMOOT all share S530 — which is correct for a blocking key and useless as
 * evidence. Nothing merges because two names sound alike.
 *
 * Returns '' for input with no letters, so a numeric or empty name produces no
 * key rather than a misleading one.
 */
export function soundex(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return '';

  const first = letters[0];
  let previous = SOUNDEX_CODES[first] ?? '';
  let out = first;

  for (let i = 1; i < letters.length && out.length < 4; i++) {
    const ch = letters[i];
    const code = SOUNDEX_CODES[ch] ?? '';

    if (code === '') {
      // H and W are transparent: they do not break a repetition, so ASHCRAFT
      // codes the same as ASCRAFT. Vowels do break it.
      if (ch !== 'H' && ch !== 'W') previous = '';
      continue;
    }
    if (code !== previous) out += code;
    previous = code;
  }

  return out.padEnd(4, '0');
}

// ---------------------------------------------------------------------------
// OCR normalization
// ---------------------------------------------------------------------------

/**
 * Characters OCR confuses, folded to one representative each.
 *
 * Applied only when building a blocking key, never to a stored name. `A-1` and
 * `A-l` are the same cell to a blocking key and remain different strings in the
 * repository, because the repository records what the source said.
 */
const OCR_FOLD: Record<string, string> = {
  '0': 'O', Q: 'O', D: 'O',
  '1': 'I', L: 'I', '|': 'I',
  '5': 'S', $: 'S',
  '8': 'B',
  '2': 'Z',
  '6': 'G',
  '7': 'T',
  V: 'U',
  M: 'N',
};

/** Fold visually confusable characters. Deterministic and lossy by design. */
export function ocrFold(value: string): string {
  return value
    .toUpperCase()
    .split('')
    .map((c) => OCR_FOLD[c] ?? c)
    .join('');
}

// ---------------------------------------------------------------------------
// Collapsed key
// ---------------------------------------------------------------------------

/**
 * Initial sounds that are spelled more than one way.
 *
 * Soundex **preserves the first letter**, so it cannot match CATHERINE with
 * KATHERINE or PHILLIPS with FILLIPS — a real and common variation that would
 * otherwise be unreachable by any blocking key. Folding the initial sound is what
 * closes that gap, and it belongs in the collapsed key rather than in Soundex,
 * which is a published algorithm and should not be quietly modified.
 *
 * Ordered longest-first: `SCH` must be tested before `S`.
 */
const INITIAL_SOUND_FOLD: [string, string][] = [
  ['SCH', 'S'], ['PH', 'F'], ['KN', 'N'], ['GN', 'N'], ['WR', 'R'],
  ['CH', 'K'], ['TH', 'T'], ['PS', 'S'], ['CK', 'K'],
  ['C', 'K'], ['Q', 'K'], ['X', 'Z'], ['Y', 'I'], ['Z', 'S'],
];

function foldInitialSound(value: string): string {
  for (const [from, to] of INITIAL_SOUND_FOLD) {
    if (value.startsWith(from)) return to + value.slice(from.length);
  }
  return value;
}

/**
 * A key that survives spelling noise: OCR folding, initial-sound folding, vowels
 * dropped after the first character, doubled letters collapsed.
 *
 * Catches what Soundex cannot and vice versa, which is why both are stored.
 * Soundex matches GONZALEZ with GONZALES on the consonant codes; the collapsed
 * key matches CATHERINE with KATHERINE, and matches a surname whose first letter
 * OCR misread, because Soundex would key those to different letters entirely.
 */
export function collapsedKey(name: string): string {
  const folded = foldInitialSound(ocrFold(name).replace(/[^A-Z]/g, ''));
  if (!folded) return '';

  const first = folded[0];
  const rest = folded
    .slice(1)
    .replace(/[AEIOU]/g, '')
    .replace(/(.)\1+/g, '$1');

  return (first + rest).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Hyphenated and compound surnames
// ---------------------------------------------------------------------------

/**
 * The searchable parts of a surname.
 *
 * `SMITH-JONES` must be findable as `SMITH`, as `JONES`, and as `SMITHJONES`,
 * because rosters record all three and a marriage changes which one appears.
 * Spanish compound surnames behave the same way: `GARCIA LOPEZ` is recorded as
 * either part alone often enough to matter.
 *
 * Particles are dropped as standalone parts but kept in the joined form, so
 * `DE LA CRUZ` yields `CRUZ` and `DELACRUZ` and not `DE`.
 */
const PARTICLES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'VAN', 'VON', 'DER', 'DA', 'DI', 'MC', 'MAC', 'ST']);

export function surnameParts(raw: string): string[] {
  const upper = raw.toUpperCase().replace(/[^A-Z\s-]/g, ' ');
  const words = upper.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return [];

  const joined = words.join('');
  const parts = new Set<string>([joined]);

  for (const w of words) {
    if (w.length >= 2 && !PARTICLES.has(w)) parts.add(w);
  }

  // A trailing particle-led compound: keep the particle attached to what follows,
  // because "LA CRUZ" is how some rosters write it.
  for (let i = 0; i < words.length - 1; i++) {
    if (PARTICLES.has(words[i])) parts.add(words.slice(i).join(''));
  }

  return [...parts].sort();
}

// ---------------------------------------------------------------------------
// Suffixes
// ---------------------------------------------------------------------------

export const SUFFIXES = new Set(['JR', 'SR', 'I', 'II', 'III', 'IV', 'V', 'VI', '1ST', '2ND', '3RD']);

/**
 * Whether two suffixes are compatible.
 *
 * A suffix absent on one roster and present on the other is compatible: rosters
 * omit them constantly, so treating that as a mismatch would split every
 * junior from himself. Two *different* suffixes are not compatible — JR and SR
 * are frequently father and son with the same name and the same address, which
 * is exactly the false merge that matters most.
 */
export function suffixesCompatible(a: string | undefined | null, b: string | undefined | null): boolean {
  const x = (a ?? '').toUpperCase().replace(/\./g, '');
  const y = (b ?? '').toUpperCase().replace(/\./g, '');
  if (!x || !y) return true;
  if (x === y) return true;
  // Roman and ordinal forms of the same generation.
  const equivalent: Record<string, string> = { '1ST': 'I', '2ND': 'II', '3RD': 'III' };
  return (equivalent[x] ?? x) === (equivalent[y] ?? y);
}

// ---------------------------------------------------------------------------
// Nicknames
// ---------------------------------------------------------------------------

/**
 * Given-name equivalences.
 *
 * Used in **ranking**, never in blocking: a nickname is evidence that two given
 * names refer to the same person, not a reason to widen a candidate search. The
 * table is small and curated. It is deliberately not comprehensive — a guessed
 * entry makes matching non-uniform in a way nobody can predict, so an absent
 * name simply scores on edit distance instead.
 *
 * Each line is a group of mutually equivalent forms.
 */
const NICKNAME_GROUPS: string[][] = [
  ['ROBERT', 'BOB', 'BOBBY', 'ROB', 'ROBBIE', 'BERT'],
  ['WILLIAM', 'BILL', 'BILLY', 'WILL', 'WILLIE', 'LIAM'],
  ['RICHARD', 'RICK', 'RICKY', 'DICK', 'RICH', 'RICHIE'],
  ['JAMES', 'JIM', 'JIMMY', 'JAMIE'],
  ['JOHN', 'JACK', 'JOHNNY', 'JON'],
  ['JOSEPH', 'JOE', 'JOEY', 'JOSE'],
  ['MICHAEL', 'MIKE', 'MICKEY', 'MICK'],
  ['CHARLES', 'CHARLIE', 'CHUCK', 'CHAZ'],
  ['THOMAS', 'TOM', 'TOMMY'],
  ['DANIEL', 'DAN', 'DANNY'],
  ['CHRISTOPHER', 'CHRIS'],
  ['ANTHONY', 'TONY'],
  ['DAVID', 'DAVE', 'DAVEY'],
  ['EDWARD', 'ED', 'EDDIE', 'TED', 'TEDDY'],
  ['FRANCIS', 'FRANK', 'FRANKIE'],
  ['GREGORY', 'GREG'],
  ['JEFFREY', 'JEFF'],
  ['KENNETH', 'KEN', 'KENNY'],
  ['LAWRENCE', 'LARRY', 'LAURENCE'],
  ['MATTHEW', 'MATT'],
  ['NICHOLAS', 'NICK', 'NICKY'],
  ['PATRICK', 'PAT', 'PADDY'],
  ['PETER', 'PETE'],
  ['RONALD', 'RON', 'RONNIE'],
  ['STEPHEN', 'STEVEN', 'STEVE'],
  ['TIMOTHY', 'TIM', 'TIMMY'],
  ['ANDREW', 'ANDY', 'DREW', 'ANDRE'],
  ['ALEXANDER', 'ALEX', 'ALEC', 'XANDER'],
  ['BENJAMIN', 'BEN', 'BENNY'],
  ['SAMUEL', 'SAM', 'SAMMY'],
  ['ELIZABETH', 'LIZ', 'BETH', 'BETTY', 'LIZZIE', 'ELIZA'],
  ['KATHERINE', 'CATHERINE', 'KATE', 'KATHY', 'CATHY', 'KATIE', 'KAY'],
  ['MARGARET', 'MAGGIE', 'MEG', 'PEGGY', 'MARGE'],
  ['PATRICIA', 'PATTY', 'TRICIA', 'PAT'],
  ['JENNIFER', 'JEN', 'JENNY'],
  ['DEBORAH', 'DEBBIE', 'DEB'],
  ['SUSAN', 'SUE', 'SUZY', 'SUSIE'],
  ['BARBARA', 'BARB', 'BARBIE'],
  ['REBECCA', 'BECKY', 'BECCA'],
  ['CHRISTINE', 'CHRISTINA', 'CHRIS', 'TINA'],
  ['VICTORIA', 'VICKY', 'TORI'],
  ['THERESA', 'TERESA', 'TERRY', 'TESS'],
  ['DOROTHY', 'DOT', 'DOTTIE'],
  ['ANTONIO', 'TONY'],
  ['FRANCISCO', 'PACO', 'FRANK'],
  ['GUADALUPE', 'LUPE'],
  ['JESUS', 'CHUY'],
  ['MANUEL', 'MANNY'],
  ['ROBERTO', 'BETO'],
  ['EDUARDO', 'EDDIE', 'LALO'],
  ['ALEJANDRO', 'ALEX'],
];

const NICKNAME_INDEX: Map<string, number> = (() => {
  const index = new Map<string, number>();
  NICKNAME_GROUPS.forEach((group, i) => {
    for (const name of group) {
      // A name in two groups (PAT, CHRIS, TONY, ALEX) keeps its first group and
      // is handled by areNicknames checking membership rather than group equality.
      if (!index.has(name)) index.set(name, i);
    }
  });
  return index;
})();

/** Whether two given names are known forms of the same name. */
export function areNicknames(a: string, b: string): boolean {
  const x = a.toUpperCase().trim();
  const y = b.toUpperCase().trim();
  if (!x || !y || x === y) return false;

  // Membership rather than group-id equality, because a few short forms belong
  // to more than one full name (PAT → PATRICK and PATRICIA).
  return NICKNAME_GROUPS.some((group) => group.includes(x) && group.includes(y));
}

/** Every group a given name belongs to, for the ranking explanation. */
export function nicknameGroupsFor(name: string): string[][] {
  const upper = name.toUpperCase().trim();
  return NICKNAME_GROUPS.filter((g) => g.includes(upper));
}

// ---------------------------------------------------------------------------
// The stored key set
// ---------------------------------------------------------------------------

export interface NameKeys {
  /** Normalized surname exactly as compared. */
  canonical: string;
  /** Soundex of the joined surname. */
  phonetic: string;
  /** Vowel-dropped, OCR-folded, de-duplicated surname. */
  collapsed: string;
  /** Every searchable part of a hyphenated or compound surname. */
  parts: string[];
}

/**
 * All keys for one surname, computed together so the caller cannot store a
 * partially-derived set.
 */
export function deriveNameKeys(last: string): NameKeys {
  const canonical = last.toUpperCase().trim();
  const parts = surnameParts(canonical);
  const joined = parts.length > 0 ? parts.reduce((a, b) => (a.length >= b.length ? a : b)) : canonical;

  return {
    canonical,
    phonetic: soundex(joined || canonical),
    collapsed: collapsedKey(joined || canonical),
    parts,
  };
}

export { NICKNAME_INDEX as _nicknameIndex };
