import { describe, it, expect } from "vitest";
import { isCrossCurrency, computeTransactionDeltas } from "../transaction";
import { TransactionType, Account, Pot, SavingPocket, Transaction } from "../../../../types";

const makeAcc = (overrides: Partial<Account> = {}): Account => ({
  id: "acc1",
  userId: "u1",
  name: "Test Account",
  balance: 0,
  currency: "MYR",
  type: "BANK",
  color: "red",
  iconType: "EMOJI",
  iconValue: "💰",
  ...overrides,
});

const makePot = (overrides: Partial<Pot> = {}): Pot => ({
  id: "pot1",
  userId: "u1",
  accountId: "acc1",
  name: "Test Pot",
  limitAmount: 100,
  usedAmount: 0,
  amountLeft: 100,
  currency: "MYR",
  color: "red",
  icon: "star",
  ...overrides,
});

const makePocket = (overrides: Partial<SavingPocket> = {}): SavingPocket => ({
  id: "pocket1",
  userId: "u1",
  name: "Test Pocket",
  currentAmount: 0,
  currency: "MYR",
  color: "red",
  icon: "star",
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx1",
  userId: "u1",
  accountId: "acc1",
  amount: 100,
  currency: "MYR",
  type: TransactionType.EXPENSE,
  shopName: "Test",
  date: "2026-01-01",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("isCrossCurrency", () => {
  it("returns false when account is undefined", () => {
    expect(isCrossCurrency({ currency: "USD" }, undefined)).toBe(false);
  });

  it("returns false when currencies match", () => {
    expect(isCrossCurrency({ currency: "MYR" }, makeAcc({ currency: "MYR" }))).toBe(false);
    expect(isCrossCurrency({ currency: "USD" }, makeAcc({ currency: "USD" }))).toBe(false);
  });

  it("returns true for USD→MYR", () => {
    expect(isCrossCurrency({ currency: "USD" }, makeAcc({ currency: "MYR" }))).toBe(true);
  });

  it("returns true for MYR→USD", () => {
    expect(isCrossCurrency({ currency: "MYR" }, makeAcc({ currency: "USD" }))).toBe(true);
  });

  it("returns false for non-USD/MYR base currencies", () => {
    expect(isCrossCurrency({ currency: "SGD" }, makeAcc({ currency: "MYR" }))).toBe(false);
    expect(isCrossCurrency({ currency: "USD" }, makeAcc({ currency: "SGD" }))).toBe(false);
  });
});

describe("computeTransactionDeltas", () => {
  it("account-only expense produces one account delta, zero pot/pocket", () => {
    const result = computeTransactionDeltas(
      makeTx({ type: TransactionType.EXPENSE, amount: 50 }),
      1,
      [makeAcc({ id: "acc1" })],
      [makePot()],
      [makePocket()],
      4.45,
    );
    expect(result.accountDeltas.get("acc1")).toBe(-50);
    expect(result.potDeltas.size).toBe(0);
    expect(result.pocketDeltas.size).toBe(0);
  });

  it("pot expense produces a pot delta", () => {
    const result = computeTransactionDeltas(
      makeTx({ type: TransactionType.EXPENSE, potId: "pot1", amount: 30 }),
      1,
      [makeAcc({ id: "acc1" })],
      [makePot({ id: "pot1" })],
      [makePocket()],
      4.45,
    );
    expect(result.potDeltas.get("pot1")).toBe(30);
  });

  it("pocket income produces a pocket delta", () => {
    const result = computeTransactionDeltas(
      makeTx({ type: TransactionType.INCOME, savingPocketId: "pocket1", amount: 75 }),
      1,
      [makeAcc({ id: "acc1" })],
      [makePot()],
      [makePocket({ id: "pocket1" })],
      4.45,
    );
    expect(result.pocketDeltas.get("pocket1")).toBe(75);
  });

  it("factor -1 flips the signs of all deltas", () => {
    const result = computeTransactionDeltas(
      makeTx({ type: TransactionType.EXPENSE, amount: 50 }),
      -1,
      [makeAcc({ id: "acc1" })],
      [makePot()],
      [makePocket()],
      4.45,
    );
    expect(result.accountDeltas.get("acc1")).toBe(50);
  });

  it("historical transactions produce empty deltas", () => {
    const result = computeTransactionDeltas(
      makeTx({ type: TransactionType.EXPENSE, amount: 50, isHistorical: true }),
      1,
      [makeAcc({ id: "acc1" })],
      [makePot()],
      [makePocket()],
      4.45,
    );
    expect(result.accountDeltas.size).toBe(0);
    expect(result.potDeltas.size).toBe(0);
    expect(result.pocketDeltas.size).toBe(0);
  });
});
