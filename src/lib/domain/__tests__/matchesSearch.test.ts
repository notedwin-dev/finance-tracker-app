import { describe, it, expect } from "vitest";
import { matchesSearch } from "../search";
import { TransactionType } from "../../../../types";
import type { Transaction } from "../../../../types";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "1",
    userId: "u1",
    accountId: "a1",
    amount: 100,
    currency: "MYR",
    type: TransactionType.EXPENSE,
    shopName: "Test Shop",
    date: "2026-01-15",
    time: "14:30",
    note: "test note",
    categoryId: "c1",
    createdAt: "2026-01-15T14:30:00Z",
    ...overrides,
  };
}

const categories = [
  { id: "c1", name: "Food" },
  { id: "c2", name: "Transport" },
];

const accounts = [
  { id: "a1", name: "Main Account" },
  { id: "a2", name: "Savings" },
];

describe("matchesSearch", () => {
  it("matches all transactions when query is empty", () => {
    expect(matchesSearch(makeTx(), "", categories, accounts)).toBe(true);
  });

  it("matches by shop name", () => {
    expect(matchesSearch(makeTx(), "test", categories, accounts)).toBe(true);
  });

  it("matches shop name case-insensitively", () => {
    expect(matchesSearch(makeTx(), "TEST", categories, accounts)).toBe(true);
  });

  it("matches by note", () => {
    expect(matchesSearch(makeTx(), "note", categories, accounts)).toBe(true);
  });

  it("matches by transaction type", () => {
    expect(matchesSearch(makeTx(), "expense", categories, accounts)).toBe(true);
  });

  it("matches by category name", () => {
    expect(matchesSearch(makeTx(), "food", categories, accounts)).toBe(true);
  });

  it("matches by currency", () => {
    expect(matchesSearch(makeTx(), "myr", categories, accounts)).toBe(true);
  });

  it("matches by time", () => {
    expect(matchesSearch(makeTx(), "14:30", categories, accounts)).toBe(true);
  });

  it("matches exact date with startsWith", () => {
    expect(matchesSearch(makeTx(), "2026-01-15", categories, accounts)).toBe(true);
  });

  it("matches partial date prefix", () => {
    expect(matchesSearch(makeTx(), "2026-01", categories, accounts)).toBe(true);
  });

  it("does not match a different date", () => {
    expect(matchesSearch(makeTx(), "2026-01-16", categories, accounts)).toBe(false);
  });

  it("does not match arbitrary text", () => {
    expect(matchesSearch(makeTx(), "zzzzzz", categories, accounts)).toBe(false);
  });

  it("matches destination account name for transfers", () => {
    const tx = makeTx({
      toAccountId: "a2",
      type: TransactionType.TRANSFER,
      transferDirection: "OUT",
    });
    expect(matchesSearch(tx, "savings", categories, accounts)).toBe(true);
  });

	it("does not match destination when accounts list is empty", () => {
		const tx = makeTx({
			toAccountId: "a2",
			type: TransactionType.TRANSFER,
			transferDirection: "OUT",
		});
		expect(matchesSearch(tx, "savings", categories, [])).toBe(false);
	});

  it("uses includes (not startsWith) for non-date queries", () => {
    const tx = makeTx({ shopName: "SuperTest" });
    expect(matchesSearch(tx, "test", categories, accounts)).toBe(true);
  });
});
