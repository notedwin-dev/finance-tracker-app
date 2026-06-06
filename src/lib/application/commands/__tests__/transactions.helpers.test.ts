import { describe, it, expect } from "vitest";
import {
  buildLinkedTransferRecord,
  advanceSubscriptionNextDate,
  syncTransactionToCloud,
} from "../transactions.helpers";
import { Subscription, SubscriptionFrequency, Transaction, TransactionType } from "../../../../../types";

const baseTx: Omit<Transaction, "userId"> = {
  id: "t1",
  type: TransactionType.TRANSFER,
  amount: 100,
  currency: "MYR",
  accountId: "a1",
  toAccountId: "a2",
  shopName: "X",
  date: "2026-06-15",
  transferDirection: "OUT",
  linkedTransactionId: "t2",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
};

const baseTxWithUser: Transaction = {
  ...baseTx,
  userId: "u1",
};

describe("buildLinkedTransferRecord", () => {
  it("returns null when no linkedTransactionId", () => {
    const tx = { ...baseTx, linkedTransactionId: undefined };
    expect(buildLinkedTransferRecord(tx, baseTxWithUser, false)).toBeNull();
  });

  it("returns null when transferDirection is not OUT", () => {
    const tx = { ...baseTx, transferDirection: "IN" as const };
    expect(buildLinkedTransferRecord(tx, baseTxWithUser, false)).toBeNull();
  });

  it("returns the linked record for a transfer with linkedTransactionId and direction OUT", () => {
    const linked = buildLinkedTransferRecord(baseTx, baseTxWithUser, true);
    expect(linked).not.toBeNull();
    expect(linked!.id).toBe("t2");
    expect(linked!.accountId).toBe("a2");
    expect(linked!.toAccountId).toBeUndefined();
    expect(linked!.transferDirection).toBe("IN");
    expect(linked!.linkedTransactionId).toBe("t1");
    expect(linked!.isHistorical).toBe(true);
  });

  it("preserves isHistorical=false", () => {
    const linked = buildLinkedTransferRecord(baseTx, baseTxWithUser, false);
    expect(linked!.isHistorical).toBe(false);
  });
});

describe("advanceSubscriptionNextDate", () => {
  const baseSub: Subscription = {
    id: "s1",
    userId: "u1",
    name: "Netflix",
    amount: 50,
    currency: "MYR",
    accountId: "a1",
    categoryId: "c1",
    frequency: "MONTHLY" as SubscriptionFrequency,
    nextPaymentDate: "2026-07-15",
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };

  it("returns the original date when txDate is before the next payment date", () => {
    expect(advanceSubscriptionNextDate(baseSub, "2026-06-20")).toBe("2026-07-15");
  });

  it("advances MONTHLY to the same day next month", () => {
    expect(advanceSubscriptionNextDate(baseSub, "2026-07-20")).toBe("2026-08-20");
  });

  it("advances WEEKLY by 7 days", () => {
    const sub = { ...baseSub, frequency: "WEEKLY" as SubscriptionFrequency };
    expect(advanceSubscriptionNextDate(sub, "2026-07-20")).toBe("2026-07-27");
  });

  it("advances YEARLY by 1 year", () => {
    const sub = { ...baseSub, frequency: "YEARLY" as SubscriptionFrequency };
    expect(advanceSubscriptionNextDate(sub, "2026-07-20")).toBe("2027-07-20");
  });

  it("advances DAILY by 1 day", () => {
    const sub = { ...baseSub, frequency: "DAILY" as SubscriptionFrequency };
    expect(advanceSubscriptionNextDate(sub, "2026-07-20")).toBe("2026-07-21");
  });
});

describe("syncTransactionToCloud", () => {
  it("is a placeholder for the cloud sync helper", () => {
    expect(typeof syncTransactionToCloud).toBe("function");
  });
});
