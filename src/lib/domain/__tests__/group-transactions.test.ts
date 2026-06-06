import { describe, it, expect } from "vitest";
import { groupTransactions } from "../group-transactions";
import { Transaction, TransactionType } from "../../../../types";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "t1",
  accountId: "a1",
  amount: 100,
  currency: "MYR",
  type: TransactionType.EXPENSE,
  date: "2026-06-06",
  ...overrides,
} as Transaction);

describe("groupTransactions", () => {
  it("passes through a non-transfer transaction", () => {
    const result = groupTransactions([tx({ id: "1" })]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].linkedTransaction).toBeUndefined();
  });

  it("sorts newest first", () => {
    const result = groupTransactions([
      tx({ id: "1", date: "2026-06-01" }),
      tx({ id: "2", date: "2026-06-10" }),
    ]);
    expect(result.map((t) => t.id)).toEqual(["2", "1"]);
  });

  it("groups an explicit linked pair", () => {
    const out = tx({ id: "out", type: TransactionType.TRANSFER, transferDirection: "OUT", toAccountId: "a2", linkedTransactionId: "in" });
    const inn = tx({ id: "in", type: TransactionType.TRANSFER, transferDirection: "IN", accountId: "a2", toAccountId: "a1", linkedTransactionId: "out" });
    const result = groupTransactions([out, inn]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("out");
    expect(result[0].linkedTransaction?.id).toBe("in");
  });

  it("fuzzy-merges symmetric transfers on the same date with same amount", () => {
    const t1 = tx({ id: "1", type: TransactionType.TRANSFER, accountId: "a1", toAccountId: "a2", date: "2026-06-06", amount: 50 });
    const t2 = tx({ id: "2", type: TransactionType.TRANSFER, accountId: "a2", toAccountId: "a1", date: "2026-06-06", amount: 50 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    expect(result[0].linkedTransaction).toBeDefined();
  });

  it("creates a virtual IN record for a single-record transfer", () => {
    const t = tx({ id: "1", type: TransactionType.TRANSFER, accountId: "a1", toAccountId: "a2", amount: 50 });
    const result = groupTransactions([t]);
    expect(result).toHaveLength(1);
    expect(result[0].transferDirection).toBe("OUT");
    expect(result[0].linkedTransaction?.id).toBe("1_virtual_in");
    expect(result[0].linkedTransaction?.transferDirection).toBe("IN");
  });

  it("does not group transfers with different amounts", () => {
    const t1 = tx({ id: "1", type: TransactionType.TRANSFER, accountId: "a1", toAccountId: "a2", amount: 50 });
    const t2 = tx({ id: "2", type: TransactionType.TRANSFER, accountId: "a2", toAccountId: "a1", amount: 75 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(2);
  });

  it("skips already-processed ids (linked pair is grouped once)", () => {
    const out = tx({ id: "out", type: TransactionType.TRANSFER, transferDirection: "OUT", toAccountId: "a2", linkedTransactionId: "in" });
    const inn = tx({ id: "in", type: TransactionType.TRANSFER, transferDirection: "IN", accountId: "a2", toAccountId: "a1", linkedTransactionId: "out" });
    const result = groupTransactions([out, inn, out, inn]);
    expect(result).toHaveLength(1);
  });
});
