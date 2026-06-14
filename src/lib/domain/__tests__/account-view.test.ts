import { describe, it, expect } from "vitest";
import { Transaction, TransactionType } from "../../../../types";
import {
	filterTransactionsForAccount,
	sortTransactionsByDateDesc,
} from "../account-view";

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
	id: "t1",
	date: "2024-01-15",
	time: "10:00:00",
	amount: 100,
	type: TransactionType.EXPENSE,
	accountId: "a1",
	currency: "MYR",
	...overrides,
} as Transaction);

const linkedTransfer = (overrides: Partial<Transaction> = {}): Transaction =>
	tx({
		id: "1",
		type: TransactionType.TRANSFER,
		transferDirection: "OUT",
		linkedTransactionId: "linked",
		...overrides,
	});

const expectFilteredIds = (
	transactions: Transaction[],
	accountId: string,
	expectedIds: string[],
): Transaction[] => {
	const result = filterTransactionsForAccount(transactions, accountId);
	expect(result.map((t) => t.id)).toEqual(expectedIds);
	return result;
};

describe("filterTransactionsForAccount", () => {
	it("includes transactions where accountId matches", () => {
		const txs = [tx({ id: "1", accountId: "a1" }), tx({ id: "2", accountId: "a2" })];
		expectFilteredIds(txs, "a1", ["1"]);
	});

	it("includes transfers where toAccountId matches", () => {
		const txs = [
			linkedTransfer({
				accountId: "a2",
				toAccountId: "a1",
			}),
		];
		expectFilteredIds(txs, "a1", ["1"]);
	});

	it("synthesizes IN record for legacy single-record transfer where toAccountId matches", () => {
		const txs = [
			tx({
				id: "1",
				accountId: "a1",
				toAccountId: "a2",
				type: TransactionType.TRANSFER,
				amount: 50,
			}),
		];
		const result = filterTransactionsForAccount(txs, "a2");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1_in");
		expect(result[0].accountId).toBe("a2");
		expect(result[0].toAccountId).toBe("a1");
		expect(result[0].transferDirection).toBe("IN");
	});

	it("adds OUT direction to legacy single-record transfer where accountId matches", () => {
		const txs = [
			tx({
				id: "1",
				accountId: "a1",
				toAccountId: "a2",
				type: TransactionType.TRANSFER,
				amount: 50,
			}),
		];
		const result = filterTransactionsForAccount(txs, "a1");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("1");
		expect(result[0].transferDirection).toBe("OUT");
	});

	it("does not synthesize IN record if IN record id already seen", () => {
		const txs = [
			tx({
				id: "1",
				accountId: "a1",
				toAccountId: "a2",
				type: TransactionType.TRANSFER,
			}),
		];
		const result = filterTransactionsForAccount(txs, "a2");
		const second = filterTransactionsForAccount([...result, ...result], "a2");
		expect(second.filter((t) => t.id === "1_in")).toHaveLength(1);
	});

	it("ignores non-legacy transfers with direction and linkedTransactionId", () => {
		const txs = [
			linkedTransfer({
				accountId: "a1",
				toAccountId: "a2",
			}),
		];
		expectFilteredIds(txs, "a1", ["1"]);
	});

	it("excludes transactions for unrelated accounts", () => {
		const txs = [
			tx({ id: "1", accountId: "a3" }),
			tx({ id: "2", accountId: "a4", toAccountId: "a5", type: TransactionType.TRANSFER }),
		];
		const result = filterTransactionsForAccount(txs, "a1");
		expect(result).toHaveLength(0);
	});
});

describe("sortTransactionsByDateDesc", () => {
	it("sorts transactions by date descending", () => {
		const txs = [
			tx({ id: "1", date: "2024-01-10" }),
			tx({ id: "2", date: "2024-01-20" }),
			tx({ id: "3", date: "2024-01-15" }),
		];
		const result = sortTransactionsByDateDesc(txs);
		expect(result.map((t) => t.id)).toEqual(["2", "3", "1"]);
	});

	it("does not mutate the input array", () => {
		const txs = [tx({ id: "1", date: "2024-01-10" }), tx({ id: "2", date: "2024-01-20" })];
		const original = [...txs];
		sortTransactionsByDateDesc(txs);
		expect(txs).toEqual(original);
	});
});
