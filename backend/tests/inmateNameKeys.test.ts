// ============================================================================
// Tests for the name keys used by candidate generation.
//
// These functions produce values that are stored in indexed columns, so a change
// to any of them requires a backfill rather than a deploy. That makes them worth
// pinning down exhaustively — including the cases where a key is deliberately
// coarse, since a blocking key that is too narrow loses people silently.
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  areNicknames, collapsedKey, deriveNameKeys, NAME_KEY_VERSION, ocrFold,
  soundex, suffixesCompatible, surnameParts,
} from '../src/intelligence/inmates/nameKeys.js';

// ---------------------------------------------------------------------------
// Soundex
// ---------------------------------------------------------------------------

test('soundex matches the published algorithm on its canonical examples', () => {
  assert.equal(soundex('Robert'), 'R163');
  assert.equal(soundex('Rupert'), 'R163');
  assert.equal(soundex('Ashcraft'), 'A261', 'H is transparent and does not break a repetition');
  assert.equal(soundex('Ashcroft'), 'A261');
  assert.equal(soundex('Tymczak'), 'T522');
  assert.equal(soundex('Pfister'), 'P236');
  assert.equal(soundex('Honeyman'), 'H555');
});

test('soundex catches the substitutions clerks and OCR both make', () => {
  assert.equal(soundex('SMITH'), soundex('SMYTH'));
  assert.equal(soundex('JOHNSON'), soundex('JOHNSEN'));
  assert.equal(soundex('GONZALEZ'), soundex('GONZALES'));
  assert.equal(soundex('MCDONALD'), soundex('MACDONALD'));
});

test('soundex CANNOT match a differing initial letter — it preserves the first character', () => {
  assert.notEqual(soundex('CATHERINE'), soundex('KATHERINE'), 'C365 vs K365');
  assert.notEqual(soundex('PHILLIPS'), soundex('FILLIPS'));
  // Which is precisely why the collapsed key folds the initial sound.
  assert.equal(collapsedKey('CATHERINE'), collapsedKey('KATHERINE'));
  assert.equal(collapsedKey('PHILLIPS'), collapsedKey('FILLIPS'));
});

test('soundex is padded to four characters and is empty for a nameless input', () => {
  assert.equal(soundex('Li'), 'L000');
  assert.equal(soundex(''), '');
  assert.equal(soundex('12345'), '');
});

test('soundex is deliberately coarse — that is a blocking key, not evidence', () => {
  assert.equal(soundex('SMITH'), soundex('SMOOT'), 'a broad key is correct here; ranking decides');
});

// ---------------------------------------------------------------------------
// OCR folding
// ---------------------------------------------------------------------------

test('OCR folding merges visually confusable characters', () => {
  assert.equal(ocrFold('A-1'), ocrFold('A-I'));
  assert.equal(ocrFold('0BRIEN'), ocrFold('OBRIEN'));
  assert.equal(ocrFold('5MITH'), ocrFold('SMITH'));
  assert.equal(ocrFold('8ROWN'), ocrFold('BROWN'));
});

// ---------------------------------------------------------------------------
// Collapsed key
// ---------------------------------------------------------------------------

test('the collapsed key survives vowel and doubling noise', () => {
  assert.equal(collapsedKey('MCDONALD'), collapsedKey('MACDONALD'));
  assert.equal(collapsedKey('OBRIEN'), collapsedKey("O'BRIEN"));
  assert.equal(collapsedKey('PHILLIPS'), collapsedKey('PHILIPS'));
});

test('the collapsed key keeps the first character whatever it is', () => {
  assert.notEqual(collapsedKey('SMITH'), collapsedKey('AMITH'), 'a wrong initial is a different failure');
});

test('the two keys cover different failures — neither alone is enough', () => {
  // Soundex catches a vowel change mid-name; the collapsed key also does here.
  assert.equal(soundex('SMITH'), soundex('SMYTH'));

  // A misread FIRST character defeats soundex entirely, because soundex keeps
  // the initial letter. The collapsed key folds it and still matches.
  assert.notEqual(soundex('0BRIEN'), soundex('OBRIEN'));
  assert.equal(collapsedKey('0BRIEN'), collapsedKey('OBRIEN'));

  // And an initial spelled two ways is unreachable by soundex.
  assert.notEqual(soundex('CATHERINE'), soundex('KATHERINE'));
  assert.equal(collapsedKey('CATHERINE'), collapsedKey('KATHERINE'));
});

test('the collapsed key is empty for input with no letters', () => {
  assert.equal(collapsedKey('---'), '');
});

// ---------------------------------------------------------------------------
// Compound and hyphenated surnames
// ---------------------------------------------------------------------------

test('a hyphenated surname is searchable by each part and as a whole', () => {
  const parts = surnameParts('SMITH-JONES');
  assert.ok(parts.includes('SMITH'));
  assert.ok(parts.includes('JONES'));
  assert.ok(parts.includes('SMITHJONES'));
});

test('a Spanish compound surname is searchable by either part', () => {
  const parts = surnameParts('GARCIA LOPEZ');
  assert.ok(parts.includes('GARCIA'));
  assert.ok(parts.includes('LOPEZ'));
  assert.ok(parts.includes('GARCIALOPEZ'));
});

test('particles are not standalone parts but are kept in the joined form', () => {
  const parts = surnameParts('DE LA CRUZ');
  assert.ok(!parts.includes('DE'), 'blocking on DE would return the whole county');
  assert.ok(!parts.includes('LA'));
  assert.ok(parts.includes('CRUZ'));
  assert.ok(parts.includes('DELACRUZ'));
  assert.ok(parts.includes('LACRUZ'), 'some rosters write it this way');
});

test('a single-word surname yields itself', () => {
  assert.deepEqual(surnameParts('SMITH'), ['SMITH']);
});

// ---------------------------------------------------------------------------
// Suffixes
// ---------------------------------------------------------------------------

test('an absent suffix is compatible with any suffix', () => {
  assert.equal(suffixesCompatible(undefined, 'JR'), true, 'rosters omit suffixes constantly');
  assert.equal(suffixesCompatible('JR', null), true);
  assert.equal(suffixesCompatible('', 'SR'), true);
});

test('JR and SR are NOT compatible — that is the father-and-son false merge', () => {
  assert.equal(suffixesCompatible('JR', 'SR'), false);
  assert.equal(suffixesCompatible('II', 'III'), false);
});

test('roman and ordinal forms of the same generation are compatible', () => {
  assert.equal(suffixesCompatible('2ND', 'II'), true);
  assert.equal(suffixesCompatible('JR.', 'JR'), true);
});

// ---------------------------------------------------------------------------
// Nicknames
// ---------------------------------------------------------------------------

test('known nickname forms are recognised in both directions', () => {
  assert.equal(areNicknames('ROBERT', 'BOB'), true);
  assert.equal(areNicknames('BOB', 'ROBERT'), true);
  assert.equal(areNicknames('WILLIAM', 'BILL'), true);
  assert.equal(areNicknames('MARGARET', 'PEGGY'), true);
});

test('a short form belonging to two full names matches both', () => {
  assert.equal(areNicknames('PAT', 'PATRICK'), true);
  assert.equal(areNicknames('PAT', 'PATRICIA'), true);
});

test('unrelated names are not nicknames, and a name is not its own nickname', () => {
  assert.equal(areNicknames('ROBERT', 'RICHARD'), false);
  assert.equal(areNicknames('JOHN', 'JOHN'), false);
  assert.equal(areNicknames('NGUYEN', 'BOB'), false);
});

test('an unknown name simply has no nickname — it does not throw or guess', () => {
  assert.equal(areNicknames('XIULAN', 'ANYTHING'), false);
});

// ---------------------------------------------------------------------------
// The stored key set
// ---------------------------------------------------------------------------

test('deriveNameKeys produces every key together', () => {
  const keys = deriveNameKeys('Smith-Jones');
  assert.equal(keys.canonical, 'SMITH-JONES');
  assert.ok(keys.phonetic.length === 4);
  assert.ok(keys.collapsed.length > 0);
  assert.ok(keys.parts.includes('SMITH'));
  assert.ok(keys.parts.includes('JONES'));
});

test('deriveNameKeys is deterministic', () => {
  const a = deriveNameKeys('DE LA CRUZ');
  const b = deriveNameKeys('DE LA CRUZ');
  assert.deepEqual(a, b);
});

test('the key version is pinned, because a change requires a backfill', () => {
  assert.equal(NAME_KEY_VERSION, '1.0.0');
});
