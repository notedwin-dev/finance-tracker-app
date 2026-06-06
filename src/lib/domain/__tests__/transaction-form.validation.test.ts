import { describe, it, expect } from "vitest";
import {
	validateTransactionForm,
	serializeBreakdownItems,
	TransactionFormState,
} from "../transaction-form.validation";
import { TransactionType } from "../../../../types";

const base: TransactionFormState = {
	type: TransactionType.EXPENSE,
	amount: "10.00",
	marketValue: "",
	accountId: "a1",
	toAccountId: "",
	categoryId: "c1",
	date: "2026-06-06",
	isSubsidized: false,
	breakdownEnabled: false,
	breakdownItems: [],
};

describe("validateTransactionForm", () => {
	it("returns null for a valid expense", () => {
		expect(validateTransactionForm(base)).toBeNull();
	});

	it("flags missing amount", () => {
		expect(validateTransactionForm({ ...base, amount: "" })).toContain("Amount");
	});

	it("flags zero amount", () => {
		expect(validateTransactionForm({ ...base, amount: "0" })).toContain("Amount");
	});

	it("flags missing account", () => {
		expect(validateTransactionForm({ ...base, accountId: "" })).toContain("Account");
	});

	it("flags missing category for expense", () => {
		expect(validateTransactionForm({ ...base, categoryId: "" })).toContain("Category");
	});

	it("does not require category for transfer", () => {
		expect(
			validateTransactionForm({
				...base,
				type: TransactionType.TRANSFER,
				toAccountId: "a2",
			}),
		).toBeNull();
	});

	it("flags missing toAccount for transfer", () => {
		expect(
			validateTransactionForm({ ...base, type: TransactionType.TRANSFER }),
		).toContain("To Account");
	});

	it("flags same source and destination", () => {
		expect(
			validateTransactionForm({
				...base,
				type: TransactionType.TRANSFER,
				accountId: "a1",
				toAccountId: "a1",
			}),
		).toContain("Source and Destination");
	});

	it("flags missing market value when subsidized", () => {
		expect(
			validateTransactionForm({ ...base, isSubsidized: true, marketValue: "" }),
		).toContain("Market Value");
	});

	it("flags missing date", () => {
		expect(validateTransactionForm({ ...base, date: "" })).toContain("Date");
	});

	it("flags breakdown total exceeding amount", () => {
		expect(
			validateTransactionForm({
				...base,
				amount: "5.00",
				breakdownEnabled: true,
				breakdownItems: [{ amount: "3.00" }, { amount: "3.00" }],
			}),
		).toContain("exceeds");
	});

	it("allows breakdown equal to amount", () => {
		expect(
			validateTransactionForm({
				...base,
				breakdownEnabled: true,
				breakdownItems: [{ amount: "5.00" }, { amount: "5.00" }],
			}),
		).toBeNull();
	});
});

describe("serializeBreakdownItems", () => {
	it("returns undefined when disabled", () => {
		expect(serializeBreakdownItems(false, [{ amount: "5" }])).toBeUndefined();
	});

	it("returns undefined when items empty", () => {
		expect(serializeBreakdownItems(true, [])).toBeUndefined();
	});

	it("returns coerced amounts", () => {
		expect(serializeBreakdownItems(true, [{ amount: "5.50" }, { amount: "4.50" }])).toEqual([
			{ amount: 5.5 },
			{ amount: 4.5 },
		]);
	});

	it("coerces invalid amounts to 0", () => {
		expect(serializeBreakdownItems(true, [{ amount: "abc" }])).toEqual([
			{ amount: 0 },
		]);
	});
});
