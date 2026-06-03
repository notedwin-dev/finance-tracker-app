import {
  Account, Transaction, Pot, SavingPocket, Subscription,
} from "../../../../types";
import {
  computeAccountTransactionAmount,
  computeBudgetConsumption,
  computeSavingsMovement,
} from "../../domain/balance.engine";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { generateId } from "./helpers";

export async function submitTransaction(
  tx: Omit<Transaction, "userId">,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  newSubscription?: Omit<Subscription, "userId" | "id">,
  isDestHistorical?: boolean,
  existingTx?: Transaction,
  partnerTx?: Transaction | null,
  partnerIdToDelete?: string,
  userId?: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  const applyDeltas = (t: Transaction, factor: 1 | -1) => {
    for (const [id, delta] of computeAccountTransactionAmount(t, factor, accounts, usdRate)) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeBudgetConsumption(t, factor, pots)) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeSavingsMovement(t, factor, pockets)) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
    }
  };

  if (existingTx) applyDeltas(existingTx, -1);
  if (partnerTx) applyDeltas(partnerTx, -1);

  const txWithUser: Transaction = {
    ...tx,
    userId: userId || "offline_user",
    id: tx.id || generateId(),
    createdAt: tx.createdAt || new Date().toISOString(),
  };
  applyDeltas(txWithUser, 1);

  if (tx.linkedTransactionId && tx.transferDirection === "OUT") {
    const partnerLeg: Transaction = {
      ...txWithUser,
      id: tx.linkedTransactionId,
      accountId: tx.toAccountId || tx.accountId,
      toAccountId: undefined,
      transferDirection: "IN" as const,
      linkedTransactionId: txWithUser.id,
      isHistorical: isDestHistorical || false,
    };
    applyDeltas(partnerLeg, 1);
  }

  if (partnerIdToDelete) {
    store.removeTransactions([partnerIdToDelete]);
  }

  const now = new Date().toISOString();
  const updatedAccounts = accounts.map((a) => {
    const delta = accountUpdates.get(a.id);
    return delta !== undefined ? { ...a, balance: a.balance + delta, updatedAt: now } : a;
  });
  const updatedPots = pots.map((p) => {
    const delta = potUpdates.get(p.id);
    if (delta !== undefined) {
      const newUsedAmount = Math.max(0, p.usedAmount + delta);
      return { ...p, usedAmount: newUsedAmount, amountLeft: p.limitAmount - newUsedAmount, updatedAt: now };
    }
    return p;
  });
  const updatedPockets = pockets.map((p) => {
    const delta = pocketUpdates.get(p.id);
    if (delta !== undefined) {
      const newCurrentAmount = Math.max(0, p.currentAmount + delta);
      return { ...p, currentAmount: newCurrentAmount, updatedAt: now };
    }
    return p;
  });

  if (existingTx) {
    store.updateTransaction(existingTx.id, txWithUser);
  } else {
    store.addTransaction(txWithUser);
  }

  if (accountUpdates.size > 0) store.setAccounts(updatedAccounts);
  if (potUpdates.size > 0) store.setPots(updatedPots);
  if (pocketUpdates.size > 0) store.setPockets(updatedPockets);

  if (newSubscription) {
    const sub: Subscription = {
      ...newSubscription,
      id: `sub_${generateId()}`,
      userId: userId || "offline_user",
    };
    store.addSubscription(sub);
  }

  showToast("Transaction saved", "success");
}

export async function deleteTransaction(
  id: string,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  transactions: Transaction[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const tx = transactions.find((t) => t.id === id);
  if (!tx) return;

  const idsToDelete = [id];
  const txsToProcess = [tx];

  if (tx.linkedTransactionId) {
    const partner = transactions.find((t) => t.id === tx.linkedTransactionId);
    if (partner) {
      idsToDelete.push(partner.id);
      txsToProcess.push(partner);
    }
  }

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  const applyDeltas = (t: Transaction, factor: 1 | -1) => {
    for (const [id, delta] of computeAccountTransactionAmount(t, factor, accounts, usdRate)) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeBudgetConsumption(t, factor, pots)) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeSavingsMovement(t, factor, pockets)) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
    }
  };

  txsToProcess.forEach((t) => applyDeltas(t, -1));

  const now = new Date().toISOString();
  if (accountUpdates.size > 0) {
    store.setAccounts(accounts.map((a) => {
      const delta = accountUpdates.get(a.id);
      return delta !== undefined ? { ...a, balance: a.balance + delta, updatedAt: now } : a;
    }));
  }
  if (potUpdates.size > 0) {
    store.setPots(pots.map((p) => {
      const delta = potUpdates.get(p.id);
      if (delta !== undefined) {
        const newUsedAmount = Math.max(0, p.usedAmount + delta);
        return { ...p, usedAmount: newUsedAmount, amountLeft: p.limitAmount - newUsedAmount, updatedAt: now };
      }
      return p;
    }));
  }
  if (pocketUpdates.size > 0) {
    store.setPockets(pockets.map((p) => {
      const delta = pocketUpdates.get(p.id);
      if (delta !== undefined) {
        const newCurrentAmount = Math.max(0, p.currentAmount + delta);
        return { ...p, currentAmount: newCurrentAmount, updatedAt: now };
      }
      return p;
    }));
  }

  store.removeTransactions(idsToDelete);
  showToast("Transaction deleted", "success");
}

export async function batchDeleteTransaction(
  ids: string[],
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  transactions: Transaction[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const idsToDeleteSet = new Set<string>(ids);
  const txsToProcess: Transaction[] = [];

  ids.forEach((id) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      txsToProcess.push(tx);
      if (tx.linkedTransactionId && !idsToDeleteSet.has(tx.linkedTransactionId)) {
        const partner = transactions.find((t) => t.id === tx.linkedTransactionId);
        if (partner) {
          idsToDeleteSet.add(partner.id);
          txsToProcess.push(partner);
        }
      }
    }
  });

  if (txsToProcess.length === 0) return;

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  const applyDeltas = (t: Transaction, factor: 1 | -1) => {
    for (const [id, delta] of computeAccountTransactionAmount(t, factor, accounts, usdRate)) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeBudgetConsumption(t, factor, pots)) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeSavingsMovement(t, factor, pockets)) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
    }
  };

  txsToProcess.forEach((tx) => applyDeltas(tx, -1));

  const now = new Date().toISOString();
  if (accountUpdates.size > 0) {
    store.setAccounts(accounts.map((a) => {
      const delta = accountUpdates.get(a.id);
      return delta !== undefined ? { ...a, balance: a.balance + delta, updatedAt: now } : a;
    }));
  }
  if (potUpdates.size > 0) {
    store.setPots(pots.map((p) => {
      const delta = potUpdates.get(p.id);
      if (delta !== undefined) {
        const newUsedAmount = Math.max(0, p.usedAmount + delta);
        return { ...p, usedAmount: newUsedAmount, amountLeft: p.limitAmount - newUsedAmount, updatedAt: now };
      }
      return p;
    }));
  }
  if (pocketUpdates.size > 0) {
    store.setPockets(pockets.map((p) => {
      const delta = pocketUpdates.get(p.id);
      if (delta !== undefined) {
        const newCurrentAmount = Math.max(0, p.currentAmount + delta);
        return { ...p, currentAmount: newCurrentAmount, updatedAt: now };
      }
      return p;
    }));
  }

  const idsToDelete = Array.from(idsToDeleteSet);
  store.removeTransactions(idsToDelete);
  showToast("Transactions deleted", "success");
}
