import { describe, expect, it } from "vitest";
import { canStartTransaction, hasEnoughFeeBalance, validatePoolInput } from "../src/contract/transactionGuard";

describe("contract input validation", () => {
  it("converts XLM to exact stroops", () => {
    const result = validatePoolInput({ title: "Team dinner", total: "12.3456789", participants: "3" });
    expect(result.ok && result.value.totalStroops).toBe(123_456_789n);
  });
  it.each([
    [{ title: "", total: "1", participants: "2" }, "title"],
    [{ title: "Trip", total: "0", participants: "2" }, "positive"],
    [{ title: "Trip", total: "1.00000001", participants: "2" }, "7 decimals"],
    [{ title: "Trip", total: "1", participants: "1" }, "2 to 100"],
    [{ title: "Trip", total: "1", participants: "2.5" }, "whole number"],
  ])("rejects invalid input %#", (input, fragment) => {
    const result = validatePoolInput(input);
    expect(!result.ok && result.message).toContain(fragment);
  });
});

describe("transaction concurrency and fee guards", () => {
  it.each(["signing", "submitting", "pending"] as const)("blocks a second transaction while %s", (status) => expect(canStartTransaction(status)).toBe(false));
  it.each(["idle", "success", "failure"] as const)("allows a new transaction after %s", (status) => expect(canStartTransaction(status)).toBe(true));
  it("detects an unfunded account", () => {
    expect(hasEnoughFeeBalance("0")).toBe(false);
    expect(hasEnoughFeeBalance("0.009")).toBe(false);
    expect(hasEnoughFeeBalance("1.5")).toBe(true);
  });
});
