import { describe, it, expect } from "vitest";
import { TransactionType } from "../../../../types";
import type { Transaction, Account, Pot, SavingPocket } from "../../../../types";
import {
  computeAccountChange,
  computePotChange,
  computePocketChange,
} from "../balance.engine";

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx1",
  userId: "user1",
  accountId: "acc1",
  amount: 100,
  currency: "MYR",
  type: TransactionType.EXPENSE,
  shopName: "Test Shop",
  date: "2026-06-01",
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

const makeAcc = (overrides: Partial<Account> = {}): Account => ({
  id: "acc1",
  name: "Test Account",
  balance: 1000,
  currency: "MYR",
  type: "BANK",
  color: "#000",
  iconType: "EMOJI",
  iconValue: "💰",
  userId: "user1",
  ...overrides,
});

const makePot = (overrides: Partial<Pot> = {}): Pot => ({
  id: "pot1",
  userId: "user1",
  accountId: "acc1",
  name: "Food Budget",
  limitAmount: 500,
  usedAmount: 100,
  amountLeft: 400,
  currency: "MYR",
  color: "#f00",
  icon: "🍕",
  ...overrides,
});

const makePocket = (overrides: Partial<SavingPocket> = {}): SavingPocket => ({
  id: "pocket1",
  userId: "user1",
  name: "Emergency Fund",
  currentAmount: 1000,
  currency: "MYR",
  color: "#0f0",
  icon: "🛟",
  ...overrides,
});

describe("computeAccountChange", () => {
  it("returns empty map for historical transactions", () => {
    const result = computeAccountChange(
      makeTx({ isHistorical: true }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.size).toBe(0);
  });

  it("decreases account balance for expense", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.EXPENSE }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(-100);
  });

  it("increases account balance for income", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.INCOME }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(100);
  });

  it("reverses with factor -1", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.EXPENSE }),
      -1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(100);
  });

  it("converts USD amount to MYR account", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.EXPENSE, amount: 100, currency: "USD" }),
      1,
      [makeAcc({ currency: "MYR" })],
      4.45,
    );
    expect(result.get("acc1")).toBe(-445);
  });

  it("handles transfer IN direction as inflow", () => {
    const result = computeAccountChange(
      makeTx({
        type: TransactionType.TRANSFER,
        transferDirection: "IN",
        toAccountId: "acc2",
      }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(100);
  });

  it("handles transfer OUT direction as outflow", () => {
    const result = computeAccountChange(
      makeTx({
        type: TransactionType.TRANSFER,
        transferDirection: "OUT",
        toAccountId: "acc2",
      }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(-100);
  });

  it("includes fee INCLUSIVE as additional outflow", () => {
    const result = computeAccountChange(
      makeTx({
        type: TransactionType.TRANSFER,
        transferDirection: "OUT",
        toAccountId: "acc2",
        fee: 5,
        feeType: "INCLUSIVE",
      }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(-105);
  });

  it("deducts fee EXCLUSIVE from target amount on transfer OUT", () => {
    const result = computeAccountChange(
      makeTx({
        type: TransactionType.TRANSFER,
        transferDirection: "OUT",
        toAccountId: "acc2",
        fee: 5,
        feeType: "EXCLUSIVE",
      }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(-100);
  });

  it("applies legacy single-record transfer to both accounts", () => {
    const result = computeAccountChange(
      makeTx({
        type: TransactionType.TRANSFER,
        toAccountId: "acc2",
        transferDirection: undefined,
        linkedTransactionId: undefined,
      }),
      1,
      [makeAcc(), makeAcc({ id: "acc2", currency: "MYR" })],
      4.45,
    );
    expect(result.get("acc1")).toBe(-100);
    expect(result.get("acc2")).toBe(100);
  });

  it("handles ACCOUNT_OPENING as inflow", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.ACCOUNT_OPENING }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(100);
  });

  it("handles ADJUSTMENT with positive amount as inflow", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.ADJUSTMENT, amount: 50 }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(50);
  });

  it("handles ADJUSTMENT with negative amount as inflow (reversal)", () => {
    const result = computeAccountChange(
      makeTx({ type: TransactionType.ADJUSTMENT, amount: -30 }),
      1,
      [makeAcc()],
      4.45,
    );
    expect(result.get("acc1")).toBe(30);
  });
});

describe("computePotChange", () => {
  it("adds to pot usage for expense", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.EXPENSE, potId: "pot1" }),
      1,
      [makePot()],
    );
    expect(result.get("pot1")).toBe(100);
  });

  it("reverses pot usage for income", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.INCOME, potId: "pot1" }),
      1,
      [makePot()],
    );
    expect(result.get("pot1")).toBe(-100);
  });

  it("returns empty map when no potId", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.EXPENSE }),
      1,
      [makePot()],
    );
    expect(result.size).toBe(0);
  });

  it("reverses with factor -1", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.EXPENSE, potId: "pot1" }),
      -1,
      [makePot()],
    );
    expect(result.get("pot1")).toBe(-100);
  });

  it("skips pot usage when transaction is before pot reset date", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.EXPENSE, potId: "pot1", date: "2025-01-01" }),
      1,
      [makePot({ resetDate: "2026-01-01" })],
    );
    expect(result.get("pot1")).toBeUndefined();
  });

  it("returns empty map for historical transactions", () => {
    const result = computePotChange(
      makeTx({ type: TransactionType.EXPENSE, potId: "pot1", isHistorical: true }),
      1,
      [makePot()],
    );
    expect(result.size).toBe(0);
  });
});

describe("computePocketChange", () => {
  it("adds savings for income", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.INCOME, savingPocketId: "pocket1" }),
      1,
      [makePocket()],
    );
    expect(result.get("pocket1")).toBe(100);
  });

  it("consumes savings for expense", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.EXPENSE, savingPocketId: "pocket1" }),
      1,
      [makePocket()],
    );
    expect(result.get("pocket1")).toBe(-100);
  });

  it("returns empty map when no savingPocketId", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.EXPENSE }),
      1,
      [makePocket()],
    );
    expect(result.size).toBe(0);
  });

  it("reverses with factor -1", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.EXPENSE, savingPocketId: "pocket1" }),
      -1,
      [makePocket()],
    );
    expect(result.get("pocket1")).toBe(100);
  });

  it("skips savings when transaction is before pocket reset date", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.INCOME, savingPocketId: "pocket1", date: "2025-01-01" }),
      1,
      [makePocket({ resetDate: "2026-01-01" })],
    );
    expect(result.get("pocket1")).toBeUndefined();
  });

  it("returns empty map for historical transactions", () => {
    const result = computePocketChange(
      makeTx({ type: TransactionType.INCOME, savingPocketId: "pocket1", isHistorical: true }),
      1,
      [makePocket()],
    );
    expect(result.size).toBe(0);
  });
});
