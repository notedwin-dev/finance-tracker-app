import { describe, it, expect } from "vitest";
import { formatCalculatorAmount } from "../../../../helpers/amount-calculator";

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
