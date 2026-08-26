import { describe, it, expect } from "vitest";
import { validateSplitForm } from "../src/split/validation";

const VALID_RECIPIENT = "GA7QYNF7SOWQXGLAV2CYQ5VGVPTJHAFKD7LYLQEMNXOCE2ZNO4BCTLDZ";

describe("validateSplitForm", () => {
  it("accepts a fully valid form", () => {
    const issues = validateSplitForm("24", "4", VALID_RECIPIENT, "50");
    expect(Object.keys(issues)).toHaveLength(0);
  });

  it("requires a positive numeric total", () => {
    expect(validateSplitForm("", "4", VALID_RECIPIENT, null).total).toBeTruthy();
    expect(validateSplitForm("0", "4", VALID_RECIPIENT, null).total).toBeTruthy();
    expect(validateSplitForm("-1", "4", VALID_RECIPIENT, null).total).toBeTruthy();
    expect(validateSplitForm("ten", "4", VALID_RECIPIENT, null).total).toBeTruthy();
  });

  it("enforces participant range with an explanatory message", () => {
    const low = validateSplitForm("10", "1", VALID_RECIPIENT, null);
    expect(low.participants).toMatch(/between 2 and 100/);

    const high = validateSplitForm("10", "150", VALID_RECIPIENT, null);
    expect(high.participants).toMatch(/between 2 and 100/);
  });

  it("rejects malformed recipient addresses distinctly", () => {
    const issues = validateSplitForm("10", "4", "G123", null);
    expect(issues.recipient).toMatch(/starts with G/);
  });

  it("warns when the balance cannot cover the total", () => {
    const issues = validateSplitForm("30", "4", VALID_RECIPIENT, "25");
    expect(issues.total).toMatch(/balance cannot cover/);
  });
});
