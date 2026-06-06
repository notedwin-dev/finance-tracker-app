import {
  Account, Transaction, Pot, SavingPocket, Subscription,
} from "../../../../types";
import {
  sumChanges,
  applyChanges,
  addChanges,
} from "../../domain/balance.engine";
import { isCrossCurrency } from "../../domain/transaction";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { generateId } from "./helpers";
import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import {
  normalizeDate,
  parseDateSafe,
} from "../../../../helpers/transactions.helper";
import { logger } from "../../infrastructure/logger";
import { buildLinkedTransferRecord, buildNewSubscription, advanceSubscriptionNextDate, syncTransactionToCloud, persistTransactionChanges, rollbackTransactionChanges, applyTransactionUpdatesToStore, PersistSnapshots } from "./transactions.helpers";

const mergeLinkedTransferForEdit = (
  storeTransactions: Transaction[],
  txWithUser: Transaction,
  linkedRecord: Transaction | null,
  linkedIdToDelete: string | undefined,
): Transaction[] => {
  let next = storeTransactions.map((t) => (t.id === txWithUser.id ? txWithUser : t));
  if (linkedRecord) {
    if (next.some((t) => t.id === linkedRecord.id)) {
      next = next.map((t) => (t.id === linkedRecord.id ? linkedRecord : t));
    } else {
      next = [...next, linkedRecord];
    }
  }
  if (linkedIdToDelete) {
    next = next.filter((t) => t.id !== linkedIdToDelete);
  }
  return next;
};

const checkExchangeRateLoaded = (
  tx: Omit<Transaction, "userId">,
  accounts: Account[],
  usdRate: number,
  showToast: (msg: string, type: "alert" | "success") => void,
): boolean => {
  if (usdRate > 0) return true;
  const txAccount = accounts.find((a) => a.id === tx.accountId);
  const toAccount = tx.toAccountId
    ? accounts.find((a) => a.id === tx.toAccountId)
    : undefined;
  if (isCrossCurrency(tx, txAccount) || isCrossCurrency(tx, toAccount)) {
    showToast(
      "Exchange rate not loaded. Please wait a moment and try again.",
      "alert",
    );
    return false;
  }
  return true;
};

const buildTransactionWithUser = (
  tx: Omit<Transaction, "userId">,
  userId: string,
): Transaction => ({
  ...tx,
  userId,
  id: tx.id || generateId(),
  createdAt: tx.createdAt || new Date().toISOString(),
});

const partitionForwardAndReversal = (
  txWithUser: Transaction,
  existingTx: Transaction | undefined,
  linkedRecord: Transaction | null | undefined,
  linkedTransfer: Transaction | null,
): { reversalTxs: Transaction[]; forwardTxs: Transaction[] } => {
  const reversalTxs: Transaction[] = [];
  if (existingTx) reversalTxs.push(existingTx);
  if (linkedRecord) reversalTxs.push(linkedRecord);
  const forwardTxs: Transaction[] = [txWithUser];
  if (linkedTransfer) forwardTxs.push(linkedTransfer);
  return { reversalTxs, forwardTxs };
};

const buildUpdatedTransactionList = (
  storeTransactions: Transaction[],
  txWithUser: Transaction,
  linkedTransfer: Transaction | null,
  isEdit: boolean,
  linkedIdToDelete: string | undefined,
): Transaction[] => {
  if (isEdit) {
    return mergeLinkedTransferForEdit(
      storeTransactions,
      txWithUser,
      linkedTransfer,
      linkedIdToDelete,
    );
  }
  const list = [...storeTransactions, txWithUser];
  if (linkedTransfer) list.push(linkedTransfer);
  return list;
};

const persistAndApplyOrRollback = async (
  updatedTransactions: Transaction[],
  updatedAccounts: Account[],
  updatedPots: Pot[],
  updatedPockets: SavingPocket[],
  changes: { accountChanges: Map<string, number>; potChanges: Map<string, number>; pocketChanges: Map<string, number> },
): Promise<void> => {
  let snapshots: PersistSnapshots | null = null;
  try {
    snapshots = await persistTransactionChanges(
      updatedTransactions,
      updatedAccounts,
      updatedPots,
      updatedPockets,
      changes.accountChanges,
      changes.potChanges,
      changes.pocketChanges,
    );
    applyTransactionUpdatesToStore(
      updatedTransactions,
      updatedAccounts,
      updatedPots,
      updatedPockets,
      changes.accountChanges,
      changes.potChanges,
      changes.pocketChanges,
    );
  } catch (saveError) {
    logger.error("submitTransaction: save failed, rolling back localStorage", saveError);
    if (snapshots) await rollbackTransactionChanges(snapshots);
    throw saveError;
  }
};

export async function submitTransaction(
  tx: Omit<Transaction, "userId">,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
  profileId: string,
  isCloudEnabled: boolean,
  existingTx?: Transaction,
  linkedRecord?: Transaction | null,
  linkedIdToDelete?: string,
  newSubscription?: Omit<Subscription, "userId" | "id">,
  subscriptions?: Subscription[],
  isDestHistorical?: boolean,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();
  const userId = profileId || "local";
  const isEdit = !!existingTx;

  if (!checkExchangeRateLoaded(tx, accounts, usdRate, showToast)) return;

  const txWithUser = buildTransactionWithUser(tx, userId);
  const linkedTransfer = buildLinkedTransferRecord(tx, txWithUser, isDestHistorical);
  const { reversalTxs, forwardTxs } = partitionForwardAndReversal(
    txWithUser,
    existingTx,
    linkedRecord,
    linkedTransfer,
  );

  const totalChanges = addChanges(
    sumChanges(reversalTxs, accounts, pots, pockets, -1, usdRate),
    sumChanges(forwardTxs, accounts, pots, pockets, 1, usdRate),
  );

  const updatedTransactions = buildUpdatedTransactionList(
    store.transactions,
    txWithUser,
    linkedTransfer,
    isEdit,
    linkedIdToDelete,
  );

  const now = new Date().toISOString();
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    applyChanges(accounts, pots, pockets, totalChanges, now);

  await persistAndApplyOrRollback(
    updatedTransactions,
    updatedAccounts,
    updatedPots,
    updatedPockets,
    totalChanges,
  );

  if (isCloudEnabled) {
    await syncTransactionToCloud(
      txWithUser,
      linkedTransfer,
      linkedIdToDelete,
      isEdit,
      store.transactions,
    );
  }

  await handleSubscriptionSideEffects(
    txWithUser,
    tx.date,
    newSubscription,
    isEdit,
    subscriptions,
    userId,
    now,
    isCloudEnabled,
  );

  showToast("Transaction saved", "success");
}

const handleSubscriptionSideEffects = async (
  txWithUser: Transaction,
  txDate: string,
  newSubscription: Omit<Subscription, "userId" | "id"> | undefined,
  isEdit: boolean,
  subscriptions: Subscription[] | undefined,
  userId: string,
  now: string,
  isCloudEnabled: boolean,
): Promise<void> => {
  const store = useFinanceStore.getState();

  if (newSubscription && !isEdit) {
    const sub = buildNewSubscription(newSubscription, userId, now);
    const updatedSubs = [...(subscriptions || []), sub];
    await StorageService.saveSubscriptions(updatedSubs);
    store.setSubscriptions(updatedSubs);
    if (isCloudEnabled) await SheetService.insertOne("Subscriptions", sub);
    return;
  }

  if (!txWithUser.subscriptionId || newSubscription || !subscriptions) return;
  const sub = subscriptions.find((s) => s.id === txWithUser.subscriptionId);
  if (!sub) return;
  const nextDateStr = advanceSubscriptionNextDate(sub, normalizeDate(txDate));
  if (nextDateStr === sub.nextPaymentDate) return;
  const updatedSub = { ...sub, nextPaymentDate: nextDateStr, updatedAt: now };
  const updatedSubsList = subscriptions.map((s) => (s.id === sub.id ? updatedSub : s));
  await StorageService.saveSubscriptions(updatedSubsList);
  store.setSubscriptions(updatedSubsList);
  if (isCloudEnabled) await SheetService.updateOne("Subscriptions", sub.id, updatedSub);
};

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
    const linked = transactions.find((t) => t.id === tx.linkedTransactionId);
    if (linked) {
      idsToDelete.push(linked.id);
      txsToProcess.push(linked);
    }
  }

  const now = new Date().toISOString();
  const reversalChanges = sumChanges(txsToProcess, accounts, pots, pockets, -1, usdRate);
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    applyChanges(accounts, pots, pockets, reversalChanges, now);

  if (updatedAccounts !== accounts) {
    await StorageService.saveAccounts(updatedAccounts);
    store.setAccounts(updatedAccounts);
  }
  if (updatedPots !== pots) {
    await StorageService.savePots(updatedPots);
    store.setPots(updatedPots);
  }
  if (updatedPockets !== pockets) {
    await StorageService.savePockets(updatedPockets);
    store.setPockets(updatedPockets);
  }

  const updatedTxs = store.transactions.filter((t: Transaction) => !idsToDelete.includes(t.id));
  await StorageService.saveTransactions(updatedTxs);
  store.removeTransactions(idsToDelete);

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
        const linked = transactions.find((t) => t.id === tx.linkedTransactionId);
        if (linked) {
          idsToDeleteSet.add(linked.id);
          txsToProcess.push(linked);
        }
      }
    }
  });

  if (txsToProcess.length === 0) return;

  const now = new Date().toISOString();
  const reversalChanges = sumChanges(txsToProcess, accounts, pots, pockets, -1, usdRate);
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    applyChanges(accounts, pots, pockets, reversalChanges, now);

  if (updatedAccounts !== accounts) {
    await StorageService.saveAccounts(updatedAccounts);
    store.setAccounts(updatedAccounts);
  }
  if (updatedPots !== pots) {
    await StorageService.savePots(updatedPots);
    store.setPots(updatedPots);
  }
  if (updatedPockets !== pockets) {
    await StorageService.savePockets(updatedPockets);
    store.setPockets(updatedPockets);
  }

  const idsToDelete = Array.from(idsToDeleteSet);
  const updatedTxs = store.transactions.filter((t: Transaction) => !idsToDelete.includes(t.id));
  await StorageService.saveTransactions(updatedTxs);
  store.removeTransactions(idsToDelete);

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
      const linkedRecord: Transaction = {
        ...mainTx,
        id: crypto.randomUUID(),
        accountId: mainTx.toAccountId,
        toAccountId: undefined,
        transferDirection: "IN" as const,
        linkedTransactionId: mainTx.id,
      };
      mainTx.linkedTransactionId = linkedRecord.id;
      transactionsToInsert.push(linkedRecord);
    }
  });

  const updatedTransactionsList = [...store.transactions, ...transactionsToInsert];
  await StorageService.saveTransactions(updatedTransactionsList);
  store.setTransactions(updatedTransactionsList);

  if (isCloudEnabled) {
    await SheetService.insertMany("Transactions", transactionsToInsert);
  }

  if (adjustBalance && !isHistorical) {
    const { accountChanges } = sumChanges(
      transactionsToInsert,
      accounts,
      pots,
      pockets,
      1,
      usdRate,
    );

    if (accountChanges.size > 0) {
      const now = new Date().toISOString();
      const updatedAccounts = accounts.map((a) => {
        if (accountChanges.has(a.id)) {
          return {
            ...a,
            balance: a.balance + (accountChanges.get(a.id) || 0),
            updatedAt: now,
          };
        }
        return a;
      });
      await StorageService.saveAccounts(updatedAccounts);
      store.setAccounts(updatedAccounts);
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
  const nullifyFieldsForThis = ["potId", "savingPocketId", "toSavingPocketId", "toAccountId", "subscriptionId"] as const;

  const shouldSyncLinked = (
    tx: Transaction,
    nullified: string[],
    clean: Partial<Transaction>,
    shared: readonly string[],
  ): boolean => {
    if (!tx.linkedTransactionId) return false;
    if (nullified.includes("potId")) return true;
    if (nullified.includes("savingPocketId")) return true;
    if (nullified.includes("toSavingPocketId")) return true;
    if (clean.accountId !== undefined) return true;
    if (clean.toAccountId !== undefined) return true;
    if (clean.savingPocketId !== undefined) return true;
    if (clean.toSavingPocketId !== undefined) return true;
    if (nullified.some((f) => (shared as readonly string[]).includes(f))) return true;
    if (Object.keys(clean).some((k) => (shared as readonly string[]).includes(k))) return true;
    return false;
  };

  const buildLinkedUpdates = (
    clean: Partial<Transaction>,
    shared: readonly string[],
  ): Record<string, unknown> => {
    const linked: Record<string, unknown> = { ...clean };
    if (clean.accountId !== undefined) linked.toAccountId = clean.accountId;
    if (clean.toAccountId !== undefined) linked.accountId = clean.toAccountId;
    if (clean.savingPocketId !== undefined) linked.toSavingPocketId = clean.savingPocketId;
    if (clean.toSavingPocketId !== undefined) linked.savingPocketId = clean.toSavingPocketId;
    for (const field of shared) {
      if (clean[field as keyof Partial<Transaction>] !== undefined) {
        linked[field] = clean[field as keyof Partial<Transaction>];
      }
    }
    linked.updatedAt = new Date().toISOString();
    return linked;
  };

  ids.forEach((id) => {
    const originalTx = txMap.get(id);
    if (!originalTx) return;

    const thisUpdates: Record<string, unknown> = { ...cleanUpdates };
    for (const field of nullifyFieldsForThis) {
      if (nullifiedFields.includes(field)) thisUpdates[field] = undefined;
    }
    thisUpdates.updatedAt = new Date().toISOString();
    finalUpdatesMap.set(id, thisUpdates as Partial<Transaction>);
    affectedTransactionIds.add(id);

    if (shouldSyncLinked(originalTx, nullifiedFields, cleanUpdates, sharedTransferFields)) {
      const linked = transactions.find((t) => t.id === originalTx.linkedTransactionId);
      if (linked) {
        const linkedUpdates = buildLinkedUpdates(cleanUpdates, sharedTransferFields);
        finalUpdatesMap.set(linked.id, linkedUpdates as Partial<Transaction>);
        affectedTransactionIds.add(linked.id);
      }
    }
  });

  const updatedTransactionsList = transactions.map((t) => {
    const tu = finalUpdatesMap.get(t.id);
    return tu ? { ...t, ...tu } as Transaction : t;
  });

  await StorageService.saveTransactions(updatedTransactionsList);
  store.setTransactions(updatedTransactionsList);

  if (isCloudEnabled) {
    const affectedTxs = Array.from(affectedTransactionIds)
      .map((id) => updatedTransactionsList.find((t) => t.id === id))
      .filter((tx) => tx !== undefined) as Transaction[];
    if (affectedTxs.length > 0) {
      await SheetService.updateMany("Transactions", affectedTxs);
    }
  }

  const oldTxsForChanges: Transaction[] = [];
  const newTxsForChanges: Transaction[] = [];
  affectedTransactionIds.forEach((txId) => {
    const newTx = updatedTransactionsList.find((t) => t.id === txId);
    const oldTx = transactions.find((t) => t.id === txId);
    if (oldTx && newTx) {
      oldTxsForChanges.push(oldTx);
      newTxsForChanges.push(newTx);
    }
  });

  const reversals = sumChanges(oldTxsForChanges, accounts, pots, pockets, -1, usdRate);
  const applications = sumChanges(newTxsForChanges, accounts, pots, pockets, 1, usdRate);
  const netChanges = addChanges(reversals, applications);

  const now = new Date().toISOString();
  const { accounts: updatedAccountList, pots: updatedPotList, pockets: updatedPocketList } =
    applyChanges(accounts, pots, pockets, netChanges, now);

  if (netChanges.potChanges.size > 0) {
    store.setPots(updatedPotList);
    const affectedPots = updatedPotList.filter((p) => netChanges.potChanges.has(p.id));
    StorageService.savePots(updatedPotList);
    if (isCloudEnabled && affectedPots.length > 0) {
      await SheetService.updateMany("Pots", affectedPots);
    }
  }

  if (netChanges.pocketChanges.size > 0) {
    store.setPockets(updatedPocketList);
    const affectedPockets = updatedPocketList.filter((p) =>
      netChanges.pocketChanges.has(p.id),
    );
    StorageService.savePockets(updatedPocketList);
    if (isCloudEnabled && affectedPockets.length > 0) {
      await SheetService.updateMany("Pockets", affectedPockets);
    }
  }

  if (netChanges.accountChanges.size > 0) {
    await StorageService.saveAccounts(updatedAccountList);
    store.setAccounts(updatedAccountList);
    if (isCloudEnabled) {
      const affectedAccounts = updatedAccountList.filter((a) =>
        netChanges.accountChanges.has(a.id),
      );
      if (affectedAccounts.length > 0) {
        await SheetService.updateMany("Accounts", affectedAccounts);
      }
    }
  }

  showToast(`Updated ${finalUpdatesMap.size} transactions`, "success");
}
