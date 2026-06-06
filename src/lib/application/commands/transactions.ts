import {
  Account, Transaction, Pot, SavingPocket, Subscription,
} from "../../../../types";
import {
  accumulateDeltas,
  materializeDeltas,
  mergeDeltas,
} from "../../domain/balance.engine";
import { isCrossCurrency, computeTransactionDeltas } from "../../domain/transaction";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { generateId } from "./helpers";
import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import {
  normalizeDate,
  parseDateSafe,
} from "../../../../helpers/transactions.helper";
import { logger } from "../logger";

export async function submitTransaction(
  tx: Omit<Transaction, "userId">,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  profileId: string,
  isCloudEnabled: boolean,
  existingTx?: Transaction,
  partnerTx?: Transaction | null,
  partnerIdToDelete?: string,
  newSubscription?: Omit<Subscription, "userId" | "id">,
  subscriptions?: Subscription[],
  isDestHistorical?: boolean,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();
  const userId = profileId || "local";
  const isEdit = !!existingTx;

  const txAccount = accounts.find((a) => a.id === tx.accountId);
  const toAccount = tx.toAccountId
    ? accounts.find((a) => a.id === tx.toAccountId)
    : undefined;

  if (usdRate <= 0 && (isCrossCurrency(tx, txAccount) || isCrossCurrency(tx, toAccount))) {
    showToast(
      "Exchange rate not loaded. Please wait a moment and try again.",
      "alert",
    );
    return;
  }

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  const applyDeltas = (t: Transaction, factor: 1 | -1) => {
    const { accountDeltas, potDeltas, pocketDeltas } = computeTransactionDeltas(
      t,
      factor,
      accounts,
      pots,
      pockets,
      usdRate,
    );
    for (const [id, delta] of accountDeltas) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of potDeltas) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of pocketDeltas) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
    }
  };

  if (existingTx) applyDeltas(existingTx, -1);
  if (partnerTx) applyDeltas(partnerTx, -1);

  const txWithUser: Transaction = {
    ...tx,
    userId,
    id: tx.id || generateId(),
    createdAt: tx.createdAt || new Date().toISOString(),
  };
  applyDeltas(txWithUser, 1);

  const partnerLeg: Transaction | null =
    tx.linkedTransactionId && tx.transferDirection === "OUT"
      ? {
          ...txWithUser,
          id: tx.linkedTransactionId,
          accountId: tx.toAccountId || tx.accountId,
          toAccountId: undefined,
          transferDirection: "IN" as const,
          linkedTransactionId: txWithUser.id,
          isHistorical: isDestHistorical || false,
        }
      : null;
  if (partnerLeg) applyDeltas(partnerLeg, 1);

  let updatedTransactions: Transaction[];
  if (isEdit) {
    updatedTransactions = store.transactions.map((t: Transaction) =>
      t.id === txWithUser.id ? txWithUser : t,
    );
    if (partnerLeg) {
      if (updatedTransactions.some((t: Transaction) => t.id === partnerLeg.id)) {
        updatedTransactions = updatedTransactions.map((t: Transaction) =>
          t.id === partnerLeg.id ? (partnerLeg as Transaction) : t,
        );
      } else {
        updatedTransactions.push(partnerLeg);
      }
    }
    if (partnerIdToDelete) {
      updatedTransactions = updatedTransactions.filter(
        (t: Transaction) => t.id !== partnerIdToDelete,
      );
    }
  } else {
    updatedTransactions = [...store.transactions, txWithUser];
    if (partnerLeg) updatedTransactions.push(partnerLeg);
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

  const snapshotTransactions = StorageService.getStoredTransactions();
  const snapshotAccounts = StorageService.getStoredAccounts();
  const snapshotPots = StorageService.getStoredPots();
  const snapshotPockets = StorageService.getStoredPockets();

  try {
    await StorageService.saveTransactions(updatedTransactions);
    if (accountUpdates.size > 0) await StorageService.saveAccounts(updatedAccounts);
    if (potUpdates.size > 0) await StorageService.savePots(updatedPots);
    if (pocketUpdates.size > 0) await StorageService.savePockets(updatedPockets);
  } catch (saveError) {
    logger.error("submitTransaction: save failed, rolling back localStorage", saveError);
    await StorageService.saveTransactions(snapshotTransactions);
    if (accountUpdates.size > 0) await StorageService.saveAccounts(snapshotAccounts);
    if (potUpdates.size > 0) await StorageService.savePots(snapshotPots);
    if (pocketUpdates.size > 0) await StorageService.savePockets(snapshotPockets);
    throw saveError;
  }

  store.setTransactions(updatedTransactions);
  if (accountUpdates.size > 0) store.setAccounts(updatedAccounts);
  if (potUpdates.size > 0) store.setPots(updatedPots);
  if (pocketUpdates.size > 0) store.setPockets(updatedPockets);

  if (isCloudEnabled) {
    if (isEdit) {
      await SheetService.updateOne("Transactions", txWithUser.id, txWithUser);
      if (partnerLeg) {
        if (store.transactions.some((t: Transaction) => t.id === partnerLeg.id)) {
          await SheetService.updateOne("Transactions", partnerLeg.id, partnerLeg);
        } else {
          await SheetService.insertOne("Transactions", partnerLeg);
        }
      }
      if (partnerIdToDelete) {
        await SheetService.deleteOne("Transactions", partnerIdToDelete);
      }
    } else {
      await SheetService.insertOne("Transactions", txWithUser);
      if (partnerLeg) await SheetService.insertOne("Transactions", partnerLeg);
    }
  }

  if (newSubscription && !isEdit) {
    const sub: Subscription = {
      ...newSubscription,
      id: crypto.randomUUID(),
      userId,
      updatedAt: now,
    };
    const d = parseDateSafe(sub.nextPaymentDate);
    if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
    else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
    else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
    else d.setDate(d.getDate() + 1);
    sub.nextPaymentDate = d.toLocaleDateString("en-CA");

    const updatedSubs = [...(subscriptions || []), sub];
    store.setSubscriptions(updatedSubs);
    StorageService.saveSubscriptions(updatedSubs);
    if (isCloudEnabled) await SheetService.insertOne("Subscriptions", sub);
  }

  if (txWithUser.subscriptionId && !newSubscription && subscriptions) {
    const sub = subscriptions.find((s: Subscription) => s.id === txWithUser.subscriptionId);
    if (sub) {
      let nextDateStr = normalizeDate(sub.nextPaymentDate);
      const txDate = normalizeDate(tx.date);
      if (txDate >= nextDateStr) {
        const d = parseDateSafe(txDate);
        if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
        else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
        else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + 1);
        nextDateStr = d.toLocaleDateString("en-CA");

        const updatedSub = { ...sub, nextPaymentDate: nextDateStr, updatedAt: now };
        const updatedSubsList = subscriptions.map((s: Subscription) =>
          s.id === sub.id ? updatedSub : s,
        );
        store.setSubscriptions(updatedSubsList);
        StorageService.saveSubscriptions(updatedSubsList);
        if (isCloudEnabled) await SheetService.updateOne("Subscriptions", sub.id, updatedSub);
      }
    }
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
  isCloudEnabled = false,
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

  const now = new Date().toISOString();
  const deltas = accumulateDeltas(txsToProcess, accounts, pots, pockets, -1, usdRate);
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    materializeDeltas(accounts, pots, pockets, deltas, now);

  if (updatedAccounts !== accounts) {
    store.setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);
  }
  if (updatedPots !== pots) {
    store.setPots(updatedPots);
    StorageService.savePots(updatedPots);
  }
  if (updatedPockets !== pockets) {
    store.setPockets(updatedPockets);
    StorageService.savePockets(updatedPockets);
  }

  store.removeTransactions(idsToDelete);
  const updatedTxs = store.transactions.filter((t: Transaction) => !idsToDelete.includes(t.id));
  StorageService.saveTransactions(updatedTxs);

  if (isCloudEnabled) {
    for (const delId of idsToDelete) {
      await SheetService.deleteOne("Transactions", delId);
    }
  }

  showToast("Transaction deleted", "success");
}

export async function batchDeleteTransaction(
  ids: string[],
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  transactions: Transaction[],
  isCloudEnabled = false,
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

  const now = new Date().toISOString();
  const deltas = accumulateDeltas(txsToProcess, accounts, pots, pockets, -1, usdRate);
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    materializeDeltas(accounts, pots, pockets, deltas, now);

  if (updatedAccounts !== accounts) {
    store.setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);
  }
  if (updatedPots !== pots) {
    store.setPots(updatedPots);
    StorageService.savePots(updatedPots);
  }
  if (updatedPockets !== pockets) {
    store.setPockets(updatedPockets);
    StorageService.savePockets(updatedPockets);
  }

  const idsToDelete = Array.from(idsToDeleteSet);
  store.removeTransactions(idsToDelete);
  const updatedTxs = store.transactions.filter((t: Transaction) => !idsToDelete.includes(t.id));
  StorageService.saveTransactions(updatedTxs);

  if (isCloudEnabled) {
    for (const delId of idsToDelete) {
      await SheetService.deleteOne("Transactions", delId);
    }
  }

  showToast("Transactions deleted", "success");
}

export async function bulkImportTransactions(
  newTxs: Partial<Transaction>[],
  accountId: string,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  profileId: string,
  isCloudEnabled: boolean,
  isHistorical?: boolean,
  adjustBalance?: boolean,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();
  const userId = profileId || "local";

  const transactionsToInsert: Transaction[] = [];

  newTxs.forEach((tx) => {
    const mainTx = {
      ...tx,
      id: crypto.randomUUID(),
      userId,
      accountId,
      isHistorical,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transferDirection: tx.type === "TRANSFER" ? "OUT" : undefined,
    } as Transaction;

    transactionsToInsert.push(mainTx);

    if (mainTx.type === "TRANSFER" && mainTx.toAccountId) {
      const partnerLeg: Transaction = {
        ...mainTx,
        id: crypto.randomUUID(),
        accountId: mainTx.toAccountId,
        toAccountId: undefined,
        transferDirection: "IN" as const,
        linkedTransactionId: mainTx.id,
      };
      mainTx.linkedTransactionId = partnerLeg.id;
      transactionsToInsert.push(partnerLeg);
    }
  });

  const updatedTransactionsList = [...store.transactions, ...transactionsToInsert];
  store.setTransactions(updatedTransactionsList);
  StorageService.saveTransactions(updatedTransactionsList);

  if (isCloudEnabled) {
    await SheetService.insertMany("Transactions", transactionsToInsert);
  }

  if (adjustBalance && !isHistorical) {
    const { accountDeltas } = accumulateDeltas(
      transactionsToInsert,
      accounts,
      pots,
      pockets,
      1,
      usdRate,
    );

    if (accountDeltas.size > 0) {
      const now = new Date().toISOString();
      const updatedAccounts = accounts.map((a) => {
        if (accountDeltas.has(a.id)) {
          return {
            ...a,
            balance: a.balance + (accountDeltas.get(a.id) || 0),
            updatedAt: now,
          };
        }
        return a;
      });
      store.setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }
  }

  showToast(`Imported ${transactionsToInsert.length} transactions`, "success");
}

export async function batchEditTransactions(
  ids: string[],
  updates: Partial<Transaction>,
  transactions: Transaction[],
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  isCloudEnabled: boolean,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const txMap = new Map<string, Transaction>();
  transactions.forEach((t) => txMap.set(t.id, t));

  const finalUpdatesMap = new Map<string, Partial<Transaction>>();
  const affectedTransactionIds = new Set<string>();

  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined),
  ) as Partial<Transaction>;

  const nullifiedFields = Object.keys(updates).filter(
    (k) => updates[k as keyof Transaction] === undefined,
  );

  const sharedTransferFields = ["amount", "currency", "date", "fee", "feeType", "note", "shopName"] as const;

  ids.forEach((id) => {
    const originalTx = txMap.get(id);
    if (!originalTx) return;

    const thisUpdates: any = { ...cleanUpdates };
    if (nullifiedFields.includes("potId")) thisUpdates.potId = undefined;
    if (nullifiedFields.includes("savingPocketId")) thisUpdates.savingPocketId = undefined;
    if (nullifiedFields.includes("toSavingPocketId")) thisUpdates.toSavingPocketId = undefined;
    if (nullifiedFields.includes("toAccountId")) thisUpdates.toAccountId = undefined;
    if (nullifiedFields.includes("subscriptionId")) thisUpdates.subscriptionId = undefined;

    thisUpdates.updatedAt = new Date().toISOString();
    finalUpdatesMap.set(id, thisUpdates);
    affectedTransactionIds.add(id);

    if (
      originalTx.linkedTransactionId &&
      (nullifiedFields.includes("potId") ||
        nullifiedFields.includes("savingPocketId") ||
        nullifiedFields.includes("toSavingPocketId") ||
        cleanUpdates.accountId !== undefined ||
        cleanUpdates.toAccountId !== undefined ||
        cleanUpdates.savingPocketId !== undefined ||
        cleanUpdates.toSavingPocketId !== undefined ||
        nullifiedFields.some((f) => (sharedTransferFields as readonly string[]).includes(f)) ||
        Object.keys(cleanUpdates).some((k) => (sharedTransferFields as readonly string[]).includes(k)))
    ) {
      const partner = transactions.find((t) => t.id === originalTx.linkedTransactionId);
      if (partner) {
        const partnerUpdates: any = { ...cleanUpdates };
        if (cleanUpdates.accountId !== undefined) {
          partnerUpdates.toAccountId = cleanUpdates.accountId;
        }
        if (cleanUpdates.toAccountId !== undefined) {
          partnerUpdates.accountId = cleanUpdates.toAccountId;
        }
        if (cleanUpdates.savingPocketId !== undefined) {
          partnerUpdates.toSavingPocketId = cleanUpdates.savingPocketId;
        }
        if (cleanUpdates.toSavingPocketId !== undefined) {
          partnerUpdates.savingPocketId = cleanUpdates.toSavingPocketId;
        }
        const sharedFields = sharedTransferFields;
        for (const field of sharedFields) {
          if (cleanUpdates[field as keyof typeof cleanUpdates] !== undefined) {
            partnerUpdates[field] = cleanUpdates[field as keyof typeof cleanUpdates];
          }
        }
        partnerUpdates.updatedAt = new Date().toISOString();
        finalUpdatesMap.set(partner.id, partnerUpdates);
        affectedTransactionIds.add(partner.id);
      }
    }
  });

  const updatedTransactionsList = transactions.map((t) => {
    const tu = finalUpdatesMap.get(t.id);
    return tu ? { ...t, ...tu } as Transaction : t;
  });

  store.setTransactions(updatedTransactionsList);
  StorageService.saveTransactions(updatedTransactionsList);

  if (isCloudEnabled) {
    const affectedTxs = Array.from(affectedTransactionIds)
      .map((id) => updatedTransactionsList.find((t) => t.id === id))
      .filter((tx) => tx !== undefined) as Transaction[];
    if (affectedTxs.length > 0) {
      await SheetService.updateMany("Transactions", affectedTxs);
    }
  }

  const oldTxsForDeltas: Transaction[] = [];
  const newTxsForDeltas: Transaction[] = [];
  affectedTransactionIds.forEach((txId) => {
    const newTx = updatedTransactionsList.find((t) => t.id === txId);
    const oldTx = transactions.find((t) => t.id === txId);
    if (oldTx && newTx) {
      oldTxsForDeltas.push(oldTx);
      newTxsForDeltas.push(newTx);
    }
  });

  const withdrawals = accumulateDeltas(oldTxsForDeltas, accounts, pots, pockets, -1, usdRate);
  const deposits = accumulateDeltas(newTxsForDeltas, accounts, pots, pockets, 1, usdRate);
  const deltas = mergeDeltas(withdrawals, deposits);

  const now = new Date().toISOString();
  const { accounts: updatedAccountList, pots: updatedPotList, pockets: updatedPocketList } =
    materializeDeltas(accounts, pots, pockets, deltas, now);

  if (deltas.potDeltas.size > 0) {
    store.setPots(updatedPotList);
    const affectedPots = updatedPotList.filter((p) => deltas.potDeltas.has(p.id));
    StorageService.savePots(updatedPotList);
    if (isCloudEnabled && affectedPots.length > 0) {
      await SheetService.updateMany("Pots", affectedPots);
    }
  }

  if (deltas.pocketDeltas.size > 0) {
    store.setPockets(updatedPocketList);
    const affectedPockets = updatedPocketList.filter((p) =>
      deltas.pocketDeltas.has(p.id),
    );
    StorageService.savePockets(updatedPocketList);
    if (isCloudEnabled && affectedPockets.length > 0) {
      await SheetService.updateMany("Pockets", affectedPockets);
    }
  }

  if (deltas.accountDeltas.size > 0) {
    store.setAccounts(updatedAccountList);
    StorageService.saveAccounts(updatedAccountList);
    if (isCloudEnabled) {
      const affectedAccounts = updatedAccountList.filter((a) =>
        deltas.accountDeltas.has(a.id),
      );
      if (affectedAccounts.length > 0) {
        await SheetService.updateMany("Accounts", affectedAccounts);
      }
    }
  }

  showToast(`Updated ${finalUpdatesMap.size} transactions`, "success");
}
