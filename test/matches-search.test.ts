import { describe, it, expect } from "vitest";
import { matchesSearch } from "../components/history/useFilteredTransactions";

describe("matchesSearch with malformed field types", () => {
  const categories = [{ id: "c1", name: "Food" }];
  const accounts = [{ id: "a1", name: "Wallet" }];

  // Raw shape as it can arrive from a sheet cell, CSV import or legacy
  // storage: numbers/booleans/nulls in string fields.
  const malformedTx: any = {
    id: "tx1",
    accountId: "a1",
    amount: 25.5,
    currency: 7,
    type: true,
    shopName: 46214,
    note: null,
    date: undefined,
    time: 5,
    categoryId: "c1",
  };

  it("does not throw for any letter query", () => {
    "abcdefxyz789".split("").forEach((ch) => {
      expect(() => matchesSearch(malformedTx, ch, categories, accounts)).not.toThrow();
    });
  });

  it("still finds matches in malformed fields", () => {
    expect(matchesSearch(malformedTx, "46214", categories, accounts)).toBe(true);
    expect(matchesSearch(malformedTx, "true", categories, accounts)).toBe(true);
    expect(matchesSearch(malformedTx, "nomatch", categories, accounts)).toBe(false);
  });

  it("keeps normal transactions working", () => {
    const tx: any = {
      id: "tx2",
      accountId: "a1",
      amount: 10,
      currency: "USD",
      type: "EXPENSE",
      shopName: "Coffee bean",
      date: "2026-01-15",
      categoryId: "c1",
    };
    expect(matchesSearch(tx, "coffee", categories, accounts)).toBe(true);
    expect(matchesSearch(tx, "2026-01", categories, accounts)).toBe(true);
    expect(matchesSearch(tx, "groceries", categories, accounts)).toBe(false);
  });

  it(" tolerates missing categories/accounts pages", () => {
    expect(() => matchesSearch(malformedTx, "a", [], [])).not.toThrow();
  });
});
