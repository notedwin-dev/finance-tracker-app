import { describe, it, expect } from "vitest";
import { convertAmount } from "../currency";

describe("convertAmount", () => {
  const rate = 4.45;

  it("returns the same amount for same currency", () => {
    expect(convertAmount(100, "MYR", "MYR", rate)).toBe(100);
    expect(convertAmount(100, "USD", "USD", rate)).toBe(100);
  });

  it("converts USD to MYR", () => {
    expect(convertAmount(100, "USD", "MYR", rate)).toBe(445);
  });

  it("converts MYR to USD", () => {
    expect(convertAmount(445, "MYR", "USD", rate)).toBe(100);
  });

  it("throws for unknown currencies", () => {
    expect(() => convertAmount(100, "BTC", "ETH", rate)).toThrow("Unsupported conversion");
  });

  it("throws for non-positive usdRate", () => {
    expect(() => convertAmount(100, "USD", "MYR", 0)).toThrow("Invalid USD rate");
    expect(() => convertAmount(100, "MYR", "USD", -1)).toThrow("Invalid USD rate");
  });

  it("handles zero amount", () => {
    expect(convertAmount(0, "USD", "MYR", rate)).toBe(0);
  });
});
