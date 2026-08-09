// How a person's name is shown.
//
// The canonical columns are the matching form — uppercase, punctuation removed, so
// O'BRIEN and OBRIEN are one surname. That form must never be what a person reads: a
// report handed to a deputy saying GARCIALOPEZ is wrong about someone's name.
//
// One function, used everywhere a name reaches a screen or a printed page, so the two
// forms cannot drift apart across a dozen call sites.

export interface NameColumns {
  canonicalFirst: string;
  canonicalLast: string;
  canonicalMiddle?: string | null;
  displayFirst?: string | null;
  displayLast?: string | null;
  displayMiddle?: string | null;
}

/** "LAST, FIRST", with punctuation where the roster had it. */
export function displayName(person: NameColumns, options: { includeMiddle?: boolean } = {}): string {
  const last = person.displayLast ?? person.canonicalLast;
  const first = person.displayFirst ?? person.canonicalFirst;
  const middle = person.displayMiddle ?? person.canonicalMiddle;
  const given = options.includeMiddle && middle ? `${first} ${middle}` : first;
  return `${last}, ${given}`;
}
