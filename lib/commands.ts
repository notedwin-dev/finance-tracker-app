// ponytail: one file for all CRUD, not 14.

import type { Account, Transaction, Category, Goal, Subscription, Pot, SavingPocket } from "@/types";
import type { FinanceState } from "./finance-context";
import * as Storage from "@/services/storage.services";

function now() {
  return new Date().toISOString();
}

export async function saveAccount(
  acc: Omit<Account, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const account: Account = { ...acc, id: acc.id || crypto.randomUUID(), userId: "local", updatedAt: now() };
  const exists = state.accounts.find((a) => a.id === account.id);
  const updated = exists
    ? state.accounts.map((a) => (a.id === account.id ? account : a))
    : [...state.accounts, account];
  await Storage.saveAccounts(updated);
  dispatch({ type: "SET_ACCOUNTS", accounts: updated });
}

export async function deleteAccount(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.accounts.filter((a) => a.id !== id);
  await Storage.saveAccounts(updated);
  dispatch({ type: "SET_ACCOUNTS", accounts: updated });
}

export async function submitTransaction(
  tx: Omit<Transaction, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const transaction: Transaction = {
    ...tx,
    id: tx.id || crypto.randomUUID(),
    userId: "local",
    createdAt: tx.createdAt || now(),
    updatedAt: now(),
  };
  const exists = state.transactions.find((t) => t.id === transaction.id);
  const updated = exists
    ? state.transactions.map((t) => (t.id === transaction.id ? transaction : t))
    : [...state.transactions, transaction];
  await Storage.saveTransactions(updated);
  dispatch({ type: "SET_TRANSACTIONS", transactions: updated });
}

export async function deleteTransaction(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.transactions.filter((t) => t.id !== id);
  await Storage.saveTransactions(updated);
  dispatch({ type: "SET_TRANSACTIONS", transactions: updated });
}

export async function saveCategory(
  cat: Omit<Category, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const category: Category = { ...cat, id: cat.id || crypto.randomUUID(), updatedAt: now() };
  const exists = state.categories.find((c) => c.id === category.id);
  const updated = exists
    ? state.categories.map((c) => (c.id === category.id ? category : c))
    : [...state.categories, category];
  await Storage.saveCategories(updated);
  dispatch({ type: "SET_CATEGORIES", categories: updated });
}

export async function deleteCategory(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.categories.filter((c) => c.id !== id);
  await Storage.saveCategories(updated);
  dispatch({ type: "SET_CATEGORIES", categories: updated });
}

export async function saveGoal(
  g: Omit<Goal, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const goal: Goal = { ...g, id: g.id || crypto.randomUUID(), userId: "local", updatedAt: now() };
  const exists = state.goals.find((x) => x.id === goal.id);
  const updated = exists
    ? state.goals.map((x) => (x.id === goal.id ? goal : x))
    : [...state.goals, goal];
  await Storage.saveGoals(updated);
  dispatch({ type: "SET_GOALS", goals: updated });
}

export async function deleteGoal(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.goals.filter((g) => g.id !== id);
  await Storage.saveGoals(updated);
  dispatch({ type: "SET_GOALS", goals: updated });
}

export async function savePot(
  p: Omit<Pot, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const pot: Pot = { ...p, id: p.id || crypto.randomUUID(), userId: "local", updatedAt: now() };
  const exists = state.pots.find((x) => x.id === pot.id);
  const updated = exists
    ? state.pots.map((x) => (x.id === pot.id ? pot : x))
    : [...state.pots, pot];
  await Storage.savePots(updated);
  dispatch({ type: "SET_POTS", pots: updated });
}

export async function deletePot(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.pots.filter((p) => p.id !== id);
  await Storage.savePots(updated);
  dispatch({ type: "SET_POTS", pots: updated });
}

export async function savePocket(
  p: Omit<SavingPocket, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const pocket: SavingPocket = { ...p, id: p.id || crypto.randomUUID(), userId: "local", updatedAt: now() };
  const exists = state.pockets.find((x) => x.id === pocket.id);
  const updated = exists
    ? state.pockets.map((x) => (x.id === pocket.id ? pocket : x))
    : [...state.pockets, pocket];
  await Storage.savePockets(updated);
  dispatch({ type: "SET_POCKETS", pockets: updated });
}

export async function deletePocket(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.pockets.filter((p) => p.id !== id);
  await Storage.savePockets(updated);
  dispatch({ type: "SET_POCKETS", pockets: updated });
}

export async function saveSubscription(
  s: Omit<Subscription, "userId">,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const sub: Subscription = { ...s, id: s.id || crypto.randomUUID(), userId: "local", updatedAt: now() };
  const exists = state.subscriptions.find((x) => x.id === sub.id);
  const updated = exists
    ? state.subscriptions.map((x) => (x.id === sub.id ? sub : x))
    : [...state.subscriptions, sub];
  await Storage.saveSubscriptions(updated);
  dispatch({ type: "SET_SUBSCRIPTIONS", subscriptions: updated });
}

export async function deleteSubscription(
  id: string,
  state: FinanceState,
  dispatch: React.Dispatch<any>,
) {
  const updated = state.subscriptions.filter((s) => s.id !== id);
  await Storage.saveSubscriptions(updated);
  dispatch({ type: "SET_SUBSCRIPTIONS", subscriptions: updated });
}
