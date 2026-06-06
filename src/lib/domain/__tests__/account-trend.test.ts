import { describe, it, expect } from "vitest";
import { reconstructAccountHistory } from "../account-trend";
import { Account, Transaction, TransactionType } from "../../../../types";

const acc = (overrides: Partial<Account> = {}): Account => ({
	id: "a1",
	name: "Test",
	type: "BANK",
	balance: 1000,
	currency: "MYR",
	...overrides,
} as Account);

const tx = (overrides: Partial<Transaction>): Transaction => ({
	id: "t1",
	accountId: "a1",
	amount: 100,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	date: "2026-06-06",
	...overrides,
} as Transaction);

describe("reconstructAccountHistory", () => {
	it("returns just the current balance when there are no transactions", () => {
		expect(reconstructAccountHistory([], acc({ balance: 500 }), 12)).toEqual([500]);
	});

	it("returns reversed list (oldest first) with current balance last", () => {
		const t1 = tx({ id: "1", date: "2026-06-01", amount: 100, type: TransactionType.EXPENSE });
		const t2 = tx({ id: "2", date: "2026-06-05", amount: 50, type: TransactionType.EXPENSE });
		const result = reconstructAccountHistory([t1, t2], acc({ balance: 800 }), 12);
		// After t2 (newest): 800 + 50 = 850. After t1: 850 + 100 = 950. Reversed: [950, 850, 800]
		expect(result).toEqual([950, 850, 800]);
	});

	it("skips historical transactions", () => {
		const t1 = tx({ id: "1", date: "2026-06-05", amount: 50, type: TransactionType.EXPENSE, isHistorical: true });
		const result = reconstructAccountHistory([t1], acc({ balance: 800 }), 12);
		expect(result).toEqual([800]);
	});

	it("reverses an income: subtract to go back in time", () => {
		const t = tx({ id: "1", amount: 200, type: TransactionType.INCOME });
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		expect(result).toEqual([600, 800]);
	});

	it("reverses an expense: add to go back in time", () => {
		const t = tx({ id: "1", amount: 200, type: TransactionType.EXPENSE });
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		expect(result).toEqual([1000, 800]);
	});

	it("reverses an adjustment by subtracting amount", () => {
		const t = tx({ id: "1", amount: 50, type: TransactionType.ADJUSTMENT });
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		expect(result).toEqual([750, 800]);
	});

	it("reverses a transfer outflow (this account is source) inclusive fee", () => {
		const t = tx({
			id: "1",
			amount: 100,
			type: TransactionType.TRANSFER,
			toAccountId: "a2",
			fee: 5,
			feeType: "INCLUSIVE",
		});
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		// Balance went down by 100 (the source). Reverse: add 100 + 5 (fee) = 905
		expect(result).toEqual([905, 800]);
	});

	it("reverses a transfer outflow exclusive fee", () => {
		const t = tx({
			id: "1",
			amount: 100,
			type: TransactionType.TRANSFER,
			toAccountId: "a2",
			fee: 5,
			feeType: "EXCLUSIVE",
		});
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		// Balance went down by 100 (no fee added to amount). Reverse: add 100.
		expect(result).toEqual([900, 800]);
	});

	it("reverses a transfer inflow (this account is destination) exclusive fee", () => {
		const t = tx({
			id: "1",
			accountId: "a2",
			amount: 100,
			type: TransactionType.TRANSFER,
			toAccountId: "a1",
			fee: 5,
			feeType: "EXCLUSIVE",
		});
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		// Inflow = 100 - 5 = 95. Reverse: subtract 95.
		expect(result).toEqual([705, 800]);
	});

	it("reverses a transfer inflow inclusive fee", () => {
		const t = tx({
			id: "1",
			accountId: "a2",
			amount: 100,
			type: TransactionType.TRANSFER,
			toAccountId: "a1",
			fee: 5,
			feeType: "INCLUSIVE",
		});
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		// Inflow = 100. Reverse: subtract 100.
		expect(result).toEqual([700, 800]);
	});

	it("ignores transactions unrelated to this account", () => {
		const t = tx({ id: "1", accountId: "a2", amount: 100, type: TransactionType.EXPENSE });
		const result = reconstructAccountHistory([t], acc({ id: "a1", balance: 800 }), 12);
		expect(result).toEqual([800]);
	});

	it("respects the limit", () => {
		const txs = Array.from({ length: 20 }, (_, i) =>
			tx({ id: String(i), date: `2026-06-${String(i + 1).padStart(2, "0")}`, amount: 10, type: TransactionType.EXPENSE }),
		);
		const result = reconstructAccountHistory(txs, acc({ balance: 0 }), 5);
		expect(result.length).toBe(5);
	});

	it("handles ACCOUNT_OPENING as inflow", () => {
		const t = tx({ id: "1", amount: 500, type: TransactionType.ACCOUNT_OPENING });
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		expect(result).toEqual([300, 800]);
	});

	it("handles ACCOUNT_DELETE as outflow", () => {
		const t = tx({ id: "1", amount: 500, type: TransactionType.ACCOUNT_DELETE });
		const result = reconstructAccountHistory([t], acc({ balance: 800 }), 12);
		expect(result).toEqual([1300, 800]);
	});

	it("sorts by date+createdAt when dates are equal", () => {
		const t1 = tx({ id: "1", amount: 100, type: TransactionType.EXPENSE, createdAt: "1000" });
		const t2 = tx({ id: "2", amount: 50, type: TransactionType.EXPENSE, createdAt: "2000" });
		const result = reconstructAccountHistory([t1, t2], acc({ balance: 800 }), 12);
		expect(result).toEqual([950, 850, 800]);
	});
});
