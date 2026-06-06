import { describe, it, expect } from "vitest";
import {
	formatCalculatorAmount,
	formatAccountBalance,
	isValidCryptoAmount,
} from "../../../../helpers/amount-calculator";

describe("formatAccountBalance", () => {
	it("returns empty for empty input regardless of currency", () => {
		expect(formatAccountBalance("", "100.00", "MYR")).toBe("");
		expect(formatAccountBalance("", "1.5", "BTC")).toBe("");
	});

	it("accepts a free-form decimal for BTC", () => {
		expect(formatAccountBalance("0.00012", "0.00011", "BTC")).toBe("0.00012");
		expect(formatAccountBalance("1.5", "1.0", "ETH")).toBe("1.5");
	});

	it("rejects non-decimal input for crypto and keeps the current value", () => {
		expect(formatAccountBalance("abc", "1.5", "BTC")).toBe("1.5");
		expect(formatAccountBalance("1.2.3", "1.0", "ETH")).toBe("1.0");
	});

	it("delegates fiat currencies to formatCalculatorAmount", () => {
		expect(formatAccountBalance(".", "0.00", "MYR")).toBe("0.");
		expect(formatAccountBalance("123", "", "USD")).toBe("1.23");
	});
});

describe("isValidCryptoAmount", () => {
	it("accepts empty, digits with optional single dot", () => {
		expect(isValidCryptoAmount("")).toBe(true);
		expect(isValidCryptoAmount("0.5")).toBe(true);
		expect(isValidCryptoAmount("123")).toBe(true);
	});

	it("rejects non-numeric, multiple dots, or trailing chars", () => {
		expect(isValidCryptoAmount("abc")).toBe(false);
		expect(isValidCryptoAmount("1.2.3")).toBe(false);
		expect(isValidCryptoAmount("1.5x")).toBe(false);
	});
});

describe("formatCalculatorAmount", () => {
	it("returns empty string for empty input", () => {
		expect(formatCalculatorAmount("", "")).toBe("");
	});

	it("promotes a trailing dot to digits + dot", () => {
		expect(formatCalculatorAmount(".", "0.00")).toBe("0.");
	});

	it("appends digit when current ends with dot", () => {
		expect(formatCalculatorAmount("0.2", "0.")).toBe("0.2");
	});

	it("extends to two decimals", () => {
		expect(formatCalculatorAmount("0.25", "0.2")).toBe("0.25");
	});

	it("shifts digits like a calculator: 1 → 0.01", () => {
		expect(formatCalculatorAmount("1", "0.00")).toBe("0.01");
	});

	it("shifts: 12 → 0.12", () => {
		expect(formatCalculatorAmount("12", "0.01")).toBe("0.12");
	});

	it("strips non-digit input", () => {
		expect(formatCalculatorAmount("abc", "0.00")).toBe("");
	});

	it("shifts: 1234 → 12.34", () => {
		expect(formatCalculatorAmount("1234", "0.12")).toBe("12.34");
	});
});
