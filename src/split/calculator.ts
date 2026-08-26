/**
 * Fixed-precision split arithmetic.
 * Everything is computed in integer "centimes" (1e7 per XLM, matching
 * Stellar's stroop scale) so results never drift into NaN or Infinity.
 */
export const STROOPS_PER_XLM = 10_000_000;
export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 100;

export interface SplitInput {
  totalXlm: string;
  participants: number;
  /** Round every share up to whole XLM before remainder handling. */
  roundUpToWhole: boolean;
}

export interface SplitResult {
  /** Exact per-person share in XLM string form. */
  shareXlm: string;
  /** Leftover after even division, in stroops (returned to the payer). */
  remainderStroops: number;
  totalStroops: number;
}

function parseTotal(totalXlm: string): number | null {
  const trimmed = totalXlm.trim();
  if (trimmed === "") return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return value;
}

/** Convert an XLM decimal string to integer stroops with rounding at 7 places. */
export function xlmToStroops(xlm: string): number | null {
  const value = parseTotal(xlm);
  if (value === null) return null;
  return Math.round(value * STROOPS_PER_XLM);
}

/** Convert integer stroops back to a canonical XLM decimal string. */
export function stroopsToXlm(stroops: number): string {
  const scaled = Math.round(stroops) / STROOPS_PER_XLM;
  return scaled.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Divide the total evenly across participants.
 * With rounding enabled each share is a whole number of XLM; the
 * remainder stays unassigned and is reported for transparency.
 */
export function computeSplit(input: SplitInput): SplitResult | null {
  const total = xlmToStroops(input.totalXlm);
  if (total === null) return null;

  const people = Math.trunc(input.participants);
  if (
    !Number.isFinite(people) ||
    people < MIN_PARTICIPANTS ||
    people > MAX_PARTICIPANTS
  ) {
    return null;
  }

  let perPerson: number;
  if (input.roundUpToWhole) {
    perPerson = Math.ceil(total / people / STROOPS_PER_XLM) * STROOPS_PER_XLM;
  } else {
    perPerson = Math.floor(total / people);
  }

  if (perPerson <= 0) {
    // Total too small to divide; fall back to one stroop each.
    perPerson = 1;
  }

  const assigned = perPerson * people;
  return {
    shareXlm: stroopsToXlm(perPerson),
    remainderStroops: total - assigned,
    totalStroops: total,
  };
}
