import { describe, it, expect, beforeEach } from "vitest";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import {
  submitTransaction,
  deleteTransaction,
  recalculateBalancesCommand,
} from "../commands";
import { TransactionType } from "../../../../types";
import type { Transaction, Account, Pot, SavingPocket } from "../../../../types";

function tx(overrides: Partial<Omit<Transaction, "userId">> = {}): Omit<Transaction, "userId"> {
  return {
    id: "tx1",
    accountId: "a1",
    amount: 100,
    currency: "MYR",
    type: TransactionType.EXPENSE,
    shopName: "",
    date: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function acc(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    name: "Test Account",
    balance: 1000,
    currency: "MYR",
    type: "BANK",
    color: "#000",
    iconType: "EMOJI",
    iconValue: "💰",
    userId: "u1",
    ...overrides,
  };
}

describe("submitTransaction", () => {
  beforeEach(() => {
    useFinanceStore.getState().reset();
    useSyncStore.getState().reset();
  });

  it("adds an expense transaction and deducts account balance", async () => {
    await submitTransaction(
      tx({ type: TransactionType.EXPENSE, amount: 50 }),
      [acc({ balance: 1000 })], [], [], 4.45,
    );
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
    expect(useFinanceStore.getState().accounts[0].balance).toBe(950);
  });

  it("adds an income transaction and credits account balance", async () => {
    await submitTransaction(
      tx({ type: TransactionType.INCOME, amount: 200 }),
      [acc({ balance: 500 })], [], [], 4.45,
    );
    expect(useFinanceStore.getState().accounts[0].balance).toBe(700);
  });

  it("assigns an id when none is provided", async () => {
    await submitTransaction(
      tx(),
      [acc()], [], [], 4.45,
    );
    expect(useFinanceStore.getState().transactions[0].id).toBeTruthy();
  });
});

describe("deleteTransaction", () => {
  beforeEach(() => {
    useFinanceStore.getState().reset();
    useSyncStore.getState().reset();
  });

  it("removes a transaction and reverses its balance impact", async () => {
    await submitTransaction(
      tx({ id: "tx1", type: TransactionType.EXPENSE, amount: 50 }),
      [acc({ balance: 950 })], [], [], 4.45,
    );
    expect(useFinanceStore.getState().transactions).toHaveLength(1);

    await deleteTransaction(
      "tx1",
      [acc({ balance: 950 })], [], [], 4.45,
      useFinanceStore.getState().transactions,
    );
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
    expect(useFinanceStore.getState().accounts[0].balance).toBe(1000);
  });

  it("does nothing when the transaction does not exist", async () => {
    await deleteTransaction(
      "nonexistent",
      [acc()], [], [], 4.45,
      [],
    );
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
    expect(useFinanceStore.getState().accounts).toHaveLength(0);
  });
});

describe("recalculateBalancesCommand", () => {
  beforeEach(() => {
    useFinanceStore.getState().reset();
    useSyncStore.getState().reset();
  });

  it("resets all account balances to zero when there are no transactions", async () => {
    await recalculateBalancesCommand(
      [acc({ balance: 999 })], [], [], [], 4.45,
    );
    expect(useFinanceStore.getState().accounts[0].balance).toBe(0);
  });

  it("computes balance from all transactions when recalculating", async () => {
    useFinanceStore.getState().setAccounts([acc({ id: "a1", balance: 0 })]);
    useFinanceStore.getState().addTransaction({
      ...tx({ id: "tx1", type: TransactionType.INCOME, amount: 200 }),
      userId: "u1",
    } as Transaction);
    useFinanceStore.getState().addTransaction({
      ...tx({ id: "tx2", type: TransactionType.EXPENSE, amount: 50 }),
      userId: "u1",
    } as Transaction);

    await recalculateBalancesCommand(
      [acc({ id: "a1", balance: 0 })],
      [], [],
      useFinanceStore.getState().transactions,
      4.45,
    );

    const balance = useFinanceStore.getState().accounts[0].balance;
    expect(balance).toBe(150);
  });
});
