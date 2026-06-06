import { describe, it, expect } from "vitest";
import {
	getTrendStartLimit,
	convertValueToBaseCurrency,
	applyTransactionToBalance,
	sortTransactionsByDateDesc,
	TrendTimeframe,
} from "../dashboard-trend";
import { Transaction, TransactionType } from "../../../../types";

const NOW = new Date("2026-06-06T12:00:00.000Z");

describe("getTrendStartLimit", () => {
  const customRange = { start: "2026-01-01", end: "2026-12-31" };

  it("returns 24h ago for 1D", () => {
    const d = getTrendStartLimit("1D", customRange, [], NOW);
    expect(d.getTime()).toBe(NOW.getTime() - 24 * 60 * 60 * 1000);
  });

  it("returns 7d ago for 1W", () => {
    const d = getTrendStartLimit("1W", customRange, [], NOW);
    const expected = new Date(NOW);
    expected.setDate(NOW.getDate() - 7);
    expect(d.getTime()).toBe(expected.getTime());
  });

  it("returns 30d ago for 1M", () => {
    const d = getTrendStartLimit("1M", customRange, [], NOW);
    const expected = new Date(NOW);
    expected.setDate(NOW.getDate() - 30);
    expect(d.getTime()).toBe(expected.getTime());
  });

  it("returns Jan 1 of current year for YTD", () => {
    const d = getTrendStartLimit("YTD", customRange, [], NOW);
    expect(d.getFullYear()).toBe(NOW.getFullYear());
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("returns earliest tx date for ALL when transactions exist", () => {
    const txs = [
      { date: "2025-01-15" },
      { date: "2024-08-20" },
      { date: "2026-03-01" },
    ] as Transaction[];
    const d = getTrendStartLimit("ALL", customRange, txs, NOW);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(20);
  });

  it("returns 30d fallback for ALL when no transactions", () => {
    const d = getTrendStartLimit("ALL", customRange, [], NOW);
    const expected = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(d.getTime()).toBe(expected.getTime());
  });

  it("uses customRange.start for CUSTOM", () => {
    const d = getTrendStartLimit("CUSTOM", customRange, [], NOW);
    expect(d.toISOString().slice(0, 10)).toBe("2026-01-01");
  });
});

describe("convertValueToBaseCurrency", () => {
  const usdRate = 4.7;
  const crypto = { BTC: 50000, ETH: 3000 };

  it("returns amount unchanged for MYR→MYR", () => {
    expect(convertValueToBaseCurrency(100, "MYR", "MYR", usdRate, crypto)).toBe(100);
  });

  it("divides MYR by rate for MYR→USD", () => {
    expect(convertValueToBaseCurrency(470, "MYR", "USD", usdRate, crypto)).toBe(100);
  });

  it("multiplies BTC by BTC price for BTC→USD", () => {
    expect(convertValueToBaseCurrency(2, "BTC", "USD", usdRate, crypto)).toBe(100000);
  });

  it("multiplies BTC then by rate for BTC→MYR", () => {
    expect(convertValueToBaseCurrency(1, "BTC", "MYR", usdRate, crypto)).toBe(235000);
  });

  it("multiplies ETH by ETH price for ETH→USD", () => {
    expect(convertValueToBaseCurrency(2, "ETH", "USD", usdRate, crypto)).toBe(6000);
  });
});

const baseTx = (overrides: Partial<Transaction>): Transaction => ({
  id: "t1",
  accountId: "a1",
  amount: 100,
  currency: "MYR",
  type: TransactionType.EXPENSE,
  date: "2026-06-06",
  createdAt: "2026-06-06T00:00:00Z",
  ...overrides,
} as Transaction);

describe("applyTransactionToBalance", () => {
  it("ignores historical transactions", () => {
    const tx = baseTx({ isHistorical: true });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(1000);
  });

  it("subtracts income from balance (reversing adds back)", () => {
    const tx = baseTx({ type: TransactionType.INCOME });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(900);
  });

  it("adds expense to balance (reversing subtracts back)", () => {
    const tx = baseTx({ type: TransactionType.EXPENSE });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(1100);
  });

  it("subtracts ACCOUNT_OPENING", () => {
    const tx = baseTx({ type: TransactionType.ACCOUNT_OPENING });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(900);
  });

  it("adds ACCOUNT_DELETE", () => {
    const tx = baseTx({ type: TransactionType.ACCOUNT_DELETE });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(1100);
  });

  it("subtracts ADJUSTMENT", () => {
    const tx = baseTx({ type: TransactionType.ADJUSTMENT });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(900);
  });

  it("ignores transfer with no fee", () => {
    const tx = baseTx({ type: TransactionType.TRANSFER, fee: undefined });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(1000);
  });

  it("adds transfer fee back to balance", () => {
    const tx = baseTx({ type: TransactionType.TRANSFER, fee: 5 });
    expect(applyTransactionToBalance(1000, tx, "MYR", 4.7, { BTC: 0, ETH: 0 })).toBe(1005);
  });
});

describe("sortTransactionsByDateDesc", () => {
  it("sorts by date desc", () => {
    const sorted = sortTransactionsByDateDesc([
      baseTx({ id: "a", date: "2026-06-01" }),
      baseTx({ id: "b", date: "2026-06-10" }),
      baseTx({ id: "c", date: "2026-06-05" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("tie-breaks on createdAt", () => {
    const sorted = sortTransactionsByDateDesc([
      baseTx({ id: "a", date: "2026-06-06", createdAt: "2026-06-06T00:00:00Z" }),
      baseTx({ id: "b", date: "2026-06-06", createdAt: "2026-06-06T00:00:01Z" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
