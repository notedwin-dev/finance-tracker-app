import { describe, it, expect } from "vitest";
import {
  matchesAccountFilter,
  matchesSearch,
} from "../components/history/useFilteredTransactions";
import { groupTransactions } from "../helpers/transactions.helper";

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

describe("matchesAccountFilter", () => {
  const transfer: any = {
    id: "transfer-1",
    accountId: "maybank",
    toAccountId: "cimb",
    type: "TRANSFER",
    amount: 50,
    currency: "MYR",
    date: "2026-11-18",
  };

  it("matches a transfer when the selected account is the destination", () => {
    expect(matchesAccountFilter(transfer, ["cimb"])).toBe(true);
  });

  it("matches a transfer when the selected account is the source", () => {
    expect(matchesAccountFilter(transfer, ["maybank"])).toBe(true);
  });

  it("rejects transactions unrelated to the selection", () => {
    expect(matchesAccountFilter(transfer, ["other"])).toBe(false);
  });

  it("keeps everything when no account is selected", () => {
    expect(matchesAccountFilter(transfer, [])).toBe(true);
  });

  it("still groups both filtered legs of a linked transfer into one row", () => {
    const outLeg: any = {
      ...transfer,
      id: "out",
      transferDirection: "OUT",
      linkedTransactionId: "in",
    };
    const inLeg: any = {
      ...transfer,
      id: "in",
      accountId: "cimb",
      toAccountId: "maybank",
      transferDirection: "IN",
      linkedTransactionId: "out",
    };

    const selected = [outLeg, inLeg].filter((t) =>
      matchesAccountFilter(t, ["cimb"]),
    );

    expect(selected).toHaveLength(2);
    expect(groupTransactions(selected)).toHaveLength(1);
  });
});
