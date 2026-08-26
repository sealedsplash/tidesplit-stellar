import { describe, it, expect } from "vitest";
import {
  computeSplit,
  xlmToStroops,
  stroopsToXlm,
} from "../src/split/calculator";

describe("stroop conversion", () => {
  it("converts decimal XLM to integer stroops", () => {
    expect(xlmToStroops("10.5")).toBe(105_000_000);
    expect(xlmToStroops("0.0000001")).toBe(1);
  });

  it("rounds sub-stroop dust deterministically", () => {
    // 0.00000005 sits exactly at the half-stroop boundary; the result must
    // be stable across calls rather than drifting.
    const first = xlmToStroops("0.00000005");
    expect(first).toBe(xlmToStroops("0.00000005"));
    expect(first).toBeLessThanOrEqual(1);
  });

  it("rejects invalid totals", () => {
    expect(xlmToStroops("")).toBeNull();
    expect(xlmToStroops("abc")).toBeNull();
    expect(xlmToStroops("-5")).toBeNull();
  });

  it("formats stroops back without trailing zeros", () => {
    expect(stroopsToXlm(105_000_000)).toBe("10.5");
    expect(stroopsToXlm(7_000_000)).toBe("0.7");
  });
});

describe("computeSplit", () => {
  it("divides evenly and reports no remainder", () => {
    const result = computeSplit({ totalXlm: "10", participants: 4, roundUpToWhole: false });
    expect(result).not.toBeNull();
    expect(result!.shareXlm).toBe("2.5");
    expect(result!.remainderStroops).toBe(0);
  });

  it("keeps an exact remainder for uneven splits", () => {
    const result = computeSplit({ totalXlm: "10", participants: 3, roundUpToWhole: false });
    expect(result).not.toBeNull();
    // 10/3 = 3.3333333... floored to 3.3333333
    expect(result!.shareXlm).toBe("3.3333333");
    expect(result!.remainderStroops).toBe(1);
  });

  it("never produces NaN or Infinity", () => {
    for (const people of [2, 3, 7, 13, 50]) {
      const result = computeSplit({
        totalXlm: "123.4567891",
        participants: people,
        roundUpToWhole: false,
      });
      expect(result).not.toBeNull();
      const numeric = Number.parseFloat(result!.shareXlm);
      expect(Number.isFinite(numeric)).toBe(true);
    }
  });

  it("rounds shares up to whole XLM when requested", () => {
    const result = computeSplit({ totalXlm: "11", participants: 4, roundUpToWhole: true });
    expect(result).not.toBeNull();
    expect(result!.shareXlm).toBe("3");
    // 3 * 4 = 12 assigned vs 11 total -> remainder reported as negative surplus
    expect(result!.remainderStroops).toBeLessThan(0);
  });

  it("returns null for out-of-range participant counts", () => {
    expect(computeSplit({ totalXlm: "10", participants: 1, roundUpToWhole: false })).toBeNull();
    expect(computeSplit({ totalXlm: "10", participants: 101, roundUpToWhole: false })).toBeNull();
  });

  it("handles tiny totals by assigning one stroop", () => {
    const result = computeSplit({ totalXlm: "0.0000002", participants: 4, roundUpToWhole: false });
    expect(result).not.toBeNull();
    expect(result!.shareXlm).toBe("0.0000001");
  });
});
