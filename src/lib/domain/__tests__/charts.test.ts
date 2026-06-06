import { describe, it, expect } from "vitest";
import { aggregateMonthly } from "../charts";
import { Transaction, TransactionType } from "../../../../types";

const baseTx = (
  overrides: Partial<Transaction>,
): Transaction => ({
  id: "t",
  userId: "u1",
  type: TransactionType.EXPENSE,
  amount: 100,
  currency: "MYR",
  accountId: "a1",
  categoryId: "c1",
  shopName: "Test",
  date: "2026-06-15",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
  ...overrides,
});

describe("aggregateMonthly", () => {
  const rate = 4.45;

  it("sums INCOME transactions in the given month", () => {
    const txs: Transaction[] = [
      baseTx({ id: "1", type: TransactionType.INCOME, amount: 5000, currency: "MYR", date: "2026-06-01" }),
      baseTx({ id: "2", type: TransactionType.INCOME, amount: 200, currency: "USD", date: "2026-06-20" }),
      baseTx({ id: "3", type: TransactionType.INCOME, amount: 999, currency: "MYR", date: "2026-05-30" }),
    ];
    const { income, expense } = aggregateMonthly(txs, "2026-06", rate, "MYR");
    expect(income).toBeCloseTo(5000 + 200 * rate, 5);
    expect(expense).toBe(0);
  });

  it("sums EXPENSE transactions and TRANSFER fees in the given month", () => {
    const txs: Transaction[] = [
      baseTx({ id: "1", type: TransactionType.EXPENSE, amount: 100, currency: "MYR", date: "2026-06-10" }),
      baseTx({ id: "2", type: TransactionType.TRANSFER, amount: 0, fee: 5, currency: "MYR", date: "2026-06-12" }),
      baseTx({ id: "3", type: TransactionType.TRANSFER, amount: 0, fee: 1, currency: "MYR", date: "2026-07-01" }),
    ];
    const { income, expense } = aggregateMonthly(txs, "2026-06", rate, "MYR");
    expect(expense).toBe(105);
    expect(income).toBe(0);
  });

  it("excludes TRANSFER without a fee from expense", () => {
    const txs: Transaction[] = [
      baseTx({ id: "1", type: TransactionType.TRANSFER, amount: 100, currency: "MYR", date: "2026-06-10" }),
    ];
    const { expense } = aggregateMonthly(txs, "2026-06", rate, "MYR");
    expect(expense).toBe(0);
  });

  it("converts currencies to the display currency", () => {
    const txs: Transaction[] = [
      baseTx({ id: "1", type: TransactionType.INCOME, amount: 100, currency: "USD", date: "2026-06-10" }),
    ];
    const { income } = aggregateMonthly(txs, "2026-06", rate, "MYR");
    expect(income).toBeCloseTo(100 * rate, 5);
  });

  it("returns zeros for an empty transaction list", () => {
    const { income, expense } = aggregateMonthly([], "2026-06", rate, "MYR");
    expect(income).toBe(0);
    expect(expense).toBe(0);
  });

  it("ignores transactions in other months", () => {
    const txs: Transaction[] = [
      baseTx({ id: "1", type: TransactionType.INCOME, amount: 100, currency: "MYR", date: "2026-05-31" }),
      baseTx({ id: "2", type: TransactionType.INCOME, amount: 200, currency: "MYR", date: "2026-07-01" }),
    ];
    const { income } = aggregateMonthly(txs, "2026-06", rate, "MYR");
    expect(income).toBe(0);
  });
});
