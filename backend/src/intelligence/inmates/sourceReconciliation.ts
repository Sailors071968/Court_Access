// ============================================================================
// Cross-source reconciliation.
//
// Both the CSV export and the PDF roster are authoritative, and neither replaces
// the other. So when they describe the same booking on the same roster date and
// disagree, the disagreement is the finding — not something to be resolved by
// whichever file was ingested second.
//
// The resolution of a conflict starts as UNKNOWN and stays UNKNOWN until either
// a rule genuinely applies or a person decides. That is deliberate: silently
// preferring the CSV because it is easier to parse would produce a repository
// that looks consistent and is wrong, with nothing recorded to show it.
//
// Pure. Given two sets of observations it returns the conflicts; persistence is
// the caller's job.
// ============================================================================

/** The fields worth comparing between sources. */
export type ConflictField =
  | 'housing'
  | 'bail'
  | 'release_date'
  | 'court_date'
  | 'charges'
  | 'custody_status';

export type ConflictResolution = 'unknown' | 'source_a' | 'source_b' | 'resolved_manually';

export interface ObservationForComparison {
  observationId: string;
  bookingId: string;
  /** csv | pdf_text | pdf_ocr */
  sourceType: string;
  rosterDate?: Date | null;
  housingLocation?: string | null;
  bailAmountCents?: bigint | null;
  releasedAt?: Date | null;
  courtDate?: Date | null;
  custodyStatus?: string | null;
  chargeSetHash?: string | null;
  chargeCount?: number | null;
}

export interface ConflictDraft {
  bookingId: string;
  field: ConflictField;
  valueA?: string;
  sourceA: string;
  observationAId: string;
  valueB?: string;
  sourceB: string;
  observationBId: string;
  rosterDate?: Date | null;
  resolution: ConflictResolution;
  /** Why the resolution is what it is, including why it is UNKNOWN. */
  resolutionNote: string;
}

const money = (cents: bigint | null | undefined): string | undefined =>
  cents === null || cents === undefined ? undefined : (Number(cents) / 100).toFixed(2);

const day = (d: Date | null | undefined): string | undefined =>
  d === null || d === undefined ? undefined : d.toISOString().slice(0, 10);

/**
 * The one rule that genuinely applies.
 *
 * A PDF read by OCR is a transcription of an image and its fields can contain
 * character-level errors; a CSV export is machine-written. Where OCR disagrees
 * with a CSV about a value, the CSV is preferred and the conflict still recorded.
 * Everything else — text-layer PDF against CSV, CSV against CSV — has no basis
 * for a preference and stays UNKNOWN.
 */
function preferBetween(sourceA: string, sourceB: string): { resolution: ConflictResolution; note: string } {
  const aIsOcr = sourceA === 'pdf_ocr';
  const bIsOcr = sourceB === 'pdf_ocr';

  if (aIsOcr && !bIsOcr) {
    return {
      resolution: 'source_b',
      note: `${sourceB} is preferred over ${sourceA}: OCR transcribes an image and can misread characters, so a machine-written export is the better witness. The disagreement is recorded either way.`,
    };
  }
  if (bIsOcr && !aIsOcr) {
    return {
      resolution: 'source_a',
      note: `${sourceA} is preferred over ${sourceB}: OCR transcribes an image and can misread characters, so a machine-written export is the better witness. The disagreement is recorded either way.`,
    };
  }
  return {
    resolution: 'unknown',
    note: `${sourceA} and ${sourceB} are both authoritative and there is no basis for preferring either. Left UNKNOWN for a person to decide rather than resolved by ingestion order.`,
  };
}

/**
 * Compare every pair of observations that describe the same booking on the same
 * roster date from different sources.
 *
 * Two observations from the *same* source are not a conflict: that is the same
 * witness saying something twice, which change detection handles as a change over
 * time rather than a disagreement.
 */
export function reconcileObservations(observations: ObservationForComparison[]): ConflictDraft[] {
  const conflicts: ConflictDraft[] = [];

  // Group by booking and roster date, so yesterday's housing is not compared
  // against today's.
  const groups = new Map<string, ObservationForComparison[]>();
  for (const o of observations) {
    const key = `${o.bookingId}\u0000${day(o.rosterDate) ?? 'no-date'}`;
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.sourceType === b.sourceType) continue;   // same witness, not a conflict

        pushIfDifferent(conflicts, a, b, 'housing',
          a.housingLocation ?? undefined, b.housingLocation ?? undefined);
        pushIfDifferent(conflicts, a, b, 'bail',
          money(a.bailAmountCents), money(b.bailAmountCents));
        pushIfDifferent(conflicts, a, b, 'release_date',
          day(a.releasedAt), day(b.releasedAt));
        pushIfDifferent(conflicts, a, b, 'court_date',
          day(a.courtDate), day(b.courtDate));
        pushIfDifferent(conflicts, a, b, 'custody_status',
          a.custodyStatus ?? undefined, b.custodyStatus ?? undefined);

        // Charges are compared by hash but reported by count, because "the two
        // sources list different charges" is the finding and the charges
        // themselves are on the booking.
        if (a.chargeSetHash && b.chargeSetHash && a.chargeSetHash !== b.chargeSetHash) {
          const decision = preferBetween(a.sourceType, b.sourceType);
          conflicts.push({
            bookingId: a.bookingId,
            field: 'charges',
            valueA: `${a.chargeCount ?? '?'} charge(s)`,
            sourceA: a.sourceType,
            observationAId: a.observationId,
            valueB: `${b.chargeCount ?? '?'} charge(s)`,
            sourceB: b.sourceType,
            observationBId: b.observationId,
            rosterDate: a.rosterDate ?? b.rosterDate,
            ...decision,
            resolutionNote: decision.note,
          });
        }
      }
    }
  }

  return conflicts;
}

function pushIfDifferent(
  out: ConflictDraft[],
  a: ObservationForComparison,
  b: ObservationForComparison,
  field: ConflictField,
  valueA: string | undefined,
  valueB: string | undefined,
): void {
  // A field one source does not mention is not a disagreement. Only comparable
  // values can conflict.
  if (valueA === undefined || valueB === undefined) return;
  if (valueA === valueB) return;

  const decision = preferBetween(a.sourceType, b.sourceType);
  out.push({
    bookingId: a.bookingId,
    field,
    valueA,
    sourceA: a.sourceType,
    observationAId: a.observationId,
    valueB,
    sourceB: b.sourceType,
    observationBId: b.observationId,
    rosterDate: a.rosterDate ?? b.rosterDate,
    resolution: decision.resolution,
    resolutionNote: decision.note,
  });
}

/**
 * Which value the repository should hold, given a set of observations.
 *
 * Returns UNKNOWN rather than a value whenever authoritative sources disagree
 * and no rule applies, so the booking row does not quietly acquire one source's
 * opinion as fact.
 */
export function bestKnownValue<T>(
  candidates: { value: T | null | undefined; sourceType: string }[],
): { value: T | null; certain: boolean; note: string } {
  const known = candidates.filter((c) => c.value !== null && c.value !== undefined);
  if (known.length === 0) {
    return { value: null, certain: false, note: 'No source supplied this field.' };
  }

  const distinct = [...new Set(known.map((c) => String(c.value)))];
  if (distinct.length === 1) {
    return { value: known[0].value as T, certain: true, note: 'All sources that supplied this field agree.' };
  }

  const nonOcr = known.filter((c) => c.sourceType !== 'pdf_ocr');
  const distinctNonOcr = [...new Set(nonOcr.map((c) => String(c.value)))];
  if (nonOcr.length > 0 && distinctNonOcr.length === 1) {
    return {
      value: nonOcr[0].value as T,
      certain: true,
      note: 'Sources disagree, but every non-OCR source agrees, and OCR can misread characters.',
    };
  }

  return {
    value: null,
    certain: false,
    note: `Authoritative sources disagree (${distinct.join(' vs ')}) and no rule applies. Left UNKNOWN.`,
  };
}
