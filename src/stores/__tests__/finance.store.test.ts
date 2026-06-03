import { describe, it, expect, beforeEach } from "vitest";
import { useFinanceStore } from "../finance.store";
import { TransactionType } from "../../../types";
import type { Transaction, Account, Category, Pot, SavingPocket, Goal, Subscription, ChatSession } from "../../../types";

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx1",
    userId: "u1",
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
    name: "Test",
    balance: 0,
    currency: "MYR",
    type: "BANK",
    color: "#000",
    iconType: "EMOJI",
    iconValue: "💰",
    userId: "u1",
    ...overrides,
  };
}

describe("finance.store", () => {
  beforeEach(() => {
    useFinanceStore.getState().reset();
  });

  it("starts with empty collections", () => {
    const state = useFinanceStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.goals).toEqual([]);
    expect(state.subscriptions).toEqual([]);
    expect(state.pots).toEqual([]);
    expect(state.pockets).toEqual([]);
    expect(state.chatSessions).toEqual([]);
  });

  it("adds a transaction", () => {
    useFinanceStore.getState().addTransaction(tx());
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });

  it("removes a transaction by id", () => {
    useFinanceStore.getState().addTransaction(tx({ id: "tx1" }));
    useFinanceStore.getState().removeTransactions(["tx1"]);
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });

  it("removes multiple transactions at once", () => {
    useFinanceStore.getState().addTransaction(tx({ id: "tx1" }));
    useFinanceStore.getState().addTransaction(tx({ id: "tx2" }));
    useFinanceStore.getState().removeTransactions(["tx1", "tx2"]);
    expect(useFinanceStore.getState().transactions).toHaveLength(0);
  });

  it("updates specific fields on a transaction", () => {
    useFinanceStore.getState().addTransaction(tx({ shopName: "Old Name" }));
    useFinanceStore.getState().updateTransaction("tx1", { shopName: "New Name" });
    expect(useFinanceStore.getState().transactions[0].shopName).toBe("New Name");
    expect(useFinanceStore.getState().transactions[0].amount).toBe(100);
  });

  it("adds an account", () => {
    useFinanceStore.getState().addAccount(acc());
    expect(useFinanceStore.getState().accounts).toHaveLength(1);
  });

  it("removes an account", () => {
    useFinanceStore.getState().addAccount(acc({ id: "a1" }));
    useFinanceStore.getState().removeAccount("a1");
    expect(useFinanceStore.getState().accounts).toHaveLength(0);
  });

  it("updates specific fields on an account", () => {
    useFinanceStore.getState().addAccount(acc({ balance: 100 }));
    useFinanceStore.getState().updateAccount("a1", { balance: 200 });
    expect(useFinanceStore.getState().accounts[0].balance).toBe(200);
  });

  it("replaces all store data via replaceAll", () => {
    useFinanceStore.getState().replaceAll({ transactions: [tx()] });
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
  });

  it("resets to initial state", () => {
    useFinanceStore.getState().addTransaction(tx());
    useFinanceStore.getState().addAccount(acc());
    useFinanceStore.getState().reset();
    expect(useFinanceStore.getState().transactions).toEqual([]);
    expect(useFinanceStore.getState().accounts).toEqual([]);
  });
});
