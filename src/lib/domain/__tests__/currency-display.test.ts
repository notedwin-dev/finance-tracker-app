import { describe, it, expect } from "vitest";
import { convertToDisplayCurrency } from "../currency";

describe("convertToDisplayCurrency", () => {
  const rate = 4.45;
  const crypto = { BTC: 60000, ETH: 3000 };

  it("returns the amount unchanged for MYR → MYR", () => {
    expect(convertToDisplayCurrency(100, "MYR", "MYR", rate, crypto)).toBe(100);
  });

  it("divides MYR by usdRate for MYR → USD", () => {
    expect(convertToDisplayCurrency(445, "MYR", "USD", rate, crypto)).toBe(100);
  });

  it("multiplies USD by usdRate for USD → MYR", () => {
    expect(convertToDisplayCurrency(100, "USD", "MYR", rate, crypto)).toBe(445);
  });

  it("returns the USD amount unchanged for USD → USD", () => {
    expect(convertToDisplayCurrency(100, "USD", "USD", rate, crypto)).toBe(100);
  });

  it("converts BTC to USD via cryptoPrices", () => {
    expect(convertToDisplayCurrency(1, "BTC", "USD", rate, crypto)).toBe(60000);
  });

  it("converts BTC to MYR via cryptoPrices and usdRate", () => {
    expect(convertToDisplayCurrency(1, "BTC", "MYR", rate, crypto)).toBe(60000 * rate);
  });

  it("converts ETH to USD via cryptoPrices", () => {
    expect(convertToDisplayCurrency(2, "ETH", "USD", rate, crypto)).toBe(6000);
  });

  it("treats unknown currency as USD", () => {
    expect(convertToDisplayCurrency(100, "XYZ", "USD", rate, crypto)).toBe(100);
  });
});
