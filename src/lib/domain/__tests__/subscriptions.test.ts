import { describe, it, expect } from "vitest";
import {
  computeNextOccurrences,
  buildSubscriptionTransaction,
  convertTransactionAmountForAccount,
  dedupeTransactions,
} from "../subscriptions";
import { TransactionType } from "../../../../types";

const makeSub = (overrides: any = {}) => ({
  id: "sub1",
  userId: "u1",
  name: "Netflix",
  amount: 55.0,
  currency: "MYR" as const,
  accountId: "acc1",
  categoryId: "cat1",
  nextPaymentDate: "2026-01-01",
  frequency: "MONTHLY" as const,
  active: true,
  ...overrides,
});

describe("computeNextOccurrences", () => {
  it("returns empty list when nextPaymentDate is after today", () => {
    const result = computeNextOccurrences(
      makeSub({ nextPaymentDate: "2099-01-01" }),
      "2026-01-01",
    );
    expect(result.generatedTxDates).toEqual([]);
    expect(result.bailed).toBe(false);
    expect(result.nextDateStr).toBe("2099-01-01");
  });

  it("advances a MONTHLY subscription from 2026-01-15 to 2026-01-01 (no occurrences)", () => {
    const result = computeNextOccurrences(
      makeSub({ nextPaymentDate: "2026-01-15" }),
      "2026-01-01",
    );
    expect(result.generatedTxDates).toEqual([]);
  });

  it("generates 3 monthly occurrences when sub is 3 months behind", () => {
    const result = computeNextOccurrences(
      makeSub({ nextPaymentDate: "2025-10-15" }),
      "2026-01-01",
    );
    expect(result.generatedTxDates).toEqual(["2025-10-15", "2025-11-15", "2025-12-15"]);
    expect(result.nextDateStr).toBe("2026-01-15");
    expect(result.bailed).toBe(false);
  });

  it("generates 1 weekly occurrence", () => {
    const result = computeNextOccurrences(
      makeSub({ frequency: "WEEKLY", nextPaymentDate: "2025-12-25" }),
      "2025-12-25",
    );
    expect(result.generatedTxDates).toEqual(["2025-12-25"]);
    expect(result.nextDateStr).toBe("2026-01-01");
  });

  it("treats unparseable nextPaymentDate as today (normalizeDate fallback)", () => {
    const result = computeNextOccurrences(
      makeSub({ nextPaymentDate: "not-a-date" }),
      "2099-12-31",
    );
    expect(result.nextDateStr).not.toBeNull();
    expect(result.generatedTxDates.length).toBeGreaterThan(0);
  });

  it("bails out at maxIterations for runaway loop", () => {
    const result = computeNextOccurrences(
      makeSub({ frequency: "DAILY", nextPaymentDate: "2020-01-01" }),
      "2026-01-01",
      5,
    );
    expect(result.generatedTxDates).toHaveLength(5);
    expect(result.bailed).toBe(true);
  });

  it("handles DAILY frequency", () => {
    const result = computeNextOccurrences(
      makeSub({ frequency: "DAILY", nextPaymentDate: "2025-12-30" }),
      "2025-12-31",
    );
    expect(result.generatedTxDates).toEqual(["2025-12-30", "2025-12-31"]);
    expect(result.nextDateStr).toBe("2026-01-01");
  });

  it("handles YEARLY frequency", () => {
    const result = computeNextOccurrences(
      makeSub({ frequency: "YEARLY", nextPaymentDate: "2023-06-15" }),
      "2026-01-01",
    );
    expect(result.generatedTxDates).toEqual(["2023-06-15", "2024-06-15", "2025-06-15"]);
    expect(result.nextDateStr).toBe("2026-06-15");
  });
});

describe("buildSubscriptionTransaction", () => {
  it("builds a Transaction with subscriptionId and deterministic id", () => {
    const sub = makeSub();
    const tx = buildSubscriptionTransaction(sub, "2026-01-15", "u1", "2026-01-15T08:00:00.000Z");
    expect(tx.id).toBe("sub-sub1-2026-01-15");
    expect(tx.userId).toBe("u1");
    expect(tx.accountId).toBe("acc1");
    expect(tx.amount).toBe(55.0);
    expect(tx.currency).toBe("MYR");
    expect(tx.type).toBe(TransactionType.EXPENSE);
    expect(tx.categoryId).toBe("cat1");
    expect(tx.shopName).toBe("Netflix (Subscription)");
    expect(tx.date).toBe("2026-01-15");
    expect(tx.subscriptionId).toBe("sub1");
    expect(tx.createdAt).toBe("2026-01-15T08:00:00.000Z");
    expect(tx.updatedAt).toBe("2026-01-15T08:00:00.000Z");
  });

  it("uses provided date verbatim", () => {
    const tx = buildSubscriptionTransaction(makeSub(), "2027-03-01", "u1", "2027-03-01T08:00:00.000Z");
    expect(tx.date).toBe("2027-03-01");
    expect(tx.id).toBe("sub-sub1-2027-03-01");
  });
});

describe("convertTransactionAmountForAccount", () => {
  it("returns raw amount when currencies match", () => {
    expect(
      convertTransactionAmountForAccount(
        { amount: 100, currency: "MYR" },
        { currency: "MYR" },
        4.5,
        true,
      ),
    ).toBe(100);
  });

  it("converts USD to MYR when rate is valid", () => {
    expect(
      convertTransactionAmountForAccount(
        { amount: 10, currency: "USD" },
        { currency: "MYR" },
        4.5,
        true,
      ),
    ).toBe(45);
  });

  it("converts MYR to USD when rate is valid", () => {
    expect(
      convertTransactionAmountForAccount(
        { amount: 90, currency: "MYR" },
        { currency: "USD" },
        4.5,
        true,
      ),
    ).toBe(20);
  });

  it("returns 0 when rate is invalid and currencies differ", () => {
    expect(
      convertTransactionAmountForAccount(
        { amount: 10, currency: "USD" },
        { currency: "MYR" },
        0,
        false,
      ),
    ).toBe(0);
  });

  it("returns raw amount for same currency even with invalid rate", () => {
    expect(
      convertTransactionAmountForAccount(
        { amount: 10, currency: "MYR" },
        { currency: "MYR" },
        0,
        false,
      ),
    ).toBe(10);
  });
});

describe("dedupeTransactions", () => {
  const make = (id: string) => ({ id });

  it("returns empty when all candidates already exist", () => {
    expect(
      dedupeTransactions([make("a"), make("b")], [make("a"), make("b")]),
    ).toEqual([]);
  });

  it("returns all candidates when none exist", () => {
    expect(
      dedupeTransactions([make("a")], [make("b"), make("c")]),
    ).toEqual([make("b"), make("c")]);
  });

  it("returns only the non-duplicate candidates", () => {
    expect(
      dedupeTransactions([make("a"), make("b")], [make("a"), make("b"), make("c")]),
    ).toEqual([make("c")]);
  });

  it("handles empty inputs", () => {
    expect(dedupeTransactions([], [make("a")])).toEqual([make("a")]);
    expect(dedupeTransactions([make("a")], [])).toEqual([]);
    expect(dedupeTransactions([], [])).toEqual([]);
  });
});
