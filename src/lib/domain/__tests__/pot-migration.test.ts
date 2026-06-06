import { describe, it, expect } from "vitest";
import { migrateLegacyPot } from "../pot-migration";

describe("migrateLegacyPot", () => {
  it("returns the input unchanged when all fields are present", () => {
    const input = {
      id: "p1",
      userId: "u1",
      accountId: "a1",
      name: "Groceries",
      limitAmount: 500,
      usedAmount: 100,
      amountLeft: 400,
      currency: "MYR",
      color: "#000",
      icon: "💰",
    };
    const result = migrateLegacyPot(input);
    expect(result).toEqual(input);
  });

  it("renames targetAmount to limitAmount when limitAmount is missing", () => {
    const result = migrateLegacyPot({
      id: "p1",
      targetAmount: 500,
      currentAmount: 200,
    });
    expect(result.limitAmount).toBe(500);
    expect(result.amountLeft).toBe(200);
  });

  it("preserves limitAmount when both targetAmount and limitAmount exist", () => {
    const result = migrateLegacyPot({
      limitAmount: 100,
      targetAmount: 999,
    });
    expect(result.limitAmount).toBe(100);
  });

  it("derives usedAmount from limitAmount - amountLeft when missing", () => {
    const result = migrateLegacyPot({
      limitAmount: 500,
      amountLeft: 200,
    });
    expect(result.usedAmount).toBe(300);
  });

  it("sets usedAmount to 0 when both limitAmount and amountLeft are missing", () => {
    const result = migrateLegacyPot({ id: "p1" });
    expect(result.usedAmount).toBe(0);
  });

  it("coerces string numerics to numbers", () => {
    const result = migrateLegacyPot({
      targetAmount: "500",
      currentAmount: "200",
    });
    expect(result.limitAmount).toBe(500);
    expect(typeof result.limitAmount).toBe("number");
  });
});
