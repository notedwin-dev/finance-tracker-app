import {
  Account, Transaction, Pot, SavingPocket, Subscription,
} from "../../../../types";
import {
  accumulateDeltas,
  materializeDeltas,
  mergeDeltas,
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
import { buildPartnerLeg, buildNewSubscription, bumpSubscriptionNextDate, syncTransactionToCloud, persistTransactionChanges, rollbackTransactionChanges, applyTransactionUpdatesToStore, PersistSnapshots } from "./transactions.helpers";

const mergePartnerLegForEdit = (
  storeTransactions: Transaction[],
  txWithUser: Transaction,
  partnerLeg: Transaction | null,
  partnerIdToDelete: string | undefined,
): Transaction[] => {
  let next = storeTransactions.map((t) => (t.id === txWithUser.id ? txWithUser : t));
  if (partnerLeg) {
    if (next.some((t) => t.id === partnerLeg.id)) {
      next = next.map((t) => (t.id === partnerLeg.id ? partnerLeg : t));
    } else {
      next = [...next, partnerLeg];
    }
  }
  if (partnerIdToDelete) {
    next = next.filter((t) => t.id !== partnerIdToDelete);
  }
  return next;
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

  const txWithUser: Transaction = {
    ...tx,
    userId,
    id: tx.id || generateId(),
    createdAt: tx.createdAt || new Date().toISOString(),
  };
  const partnerLeg = buildPartnerLeg(tx, txWithUser, isDestHistorical);

  const reversalTxs: Transaction[] = [];
  if (existingTx) reversalTxs.push(existingTx);
  if (partnerTx) reversalTxs.push(partnerTx);
  const forwardTxs: Transaction[] = [txWithUser];
  if (partnerLeg) forwardTxs.push(partnerLeg);

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  const accumulated = mergeDeltas(
    accumulateDeltas(reversalTxs, accounts, pots, pockets, -1, usdRate),
    accumulateDeltas(forwardTxs, accounts, pots, pockets, 1, usdRate),
  );
  for (const [id, delta] of accumulated.accountDeltas) accountUpdates.set(id, delta);
  for (const [id, delta] of accumulated.potDeltas) potUpdates.set(id, delta);
  for (const [id, delta] of accumulated.pocketDeltas) pocketUpdates.set(id, delta);

  let updatedTransactions: Transaction[];
  if (isEdit) {
    updatedTransactions = mergePartnerLegForEdit(
      store.transactions,
      txWithUser,
      partnerLeg ?? null,
      partnerIdToDelete,
    );
  } else {
    updatedTransactions = [...store.transactions, txWithUser];
    if (partnerLeg) updatedTransactions.push(partnerLeg);
  }

  const now = new Date().toISOString();
  const { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets } =
    materializeDeltas(accounts, pots, pockets, accumulated, now);

  let snapshots: PersistSnapshots | null = null;
  try {
    snapshots = await persistTransactionChanges(
      updatedTransactions,
      updatedAccounts,
      updatedPots,
      updatedPockets,
      accountUpdates,
      potUpdates,
      pocketUpdates,
    );
    applyTransactionUpdatesToStore(
      updatedTransactions,
      updatedAccounts,
      updatedPots,
      updatedPockets,
      accountUpdates,
      potUpdates,
      pocketUpdates,
    );
  } catch (saveError) {
    logger.error("submitTransaction: save failed, rolling back localStorage", saveError);
    if (snapshots) await rollbackTransactionChanges(snapshots);
    throw saveError;
  }

  if (isCloudEnabled) {
    await syncTransactionToCloud(
      txWithUser,
      partnerLeg,
      partnerIdToDelete,
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
  const nextDateStr = bumpSubscriptionNextDate(sub, normalizeDate(txDate));
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
  await StorageService.saveTransactions(updatedTransactionsList);
  store.setTransactions(updatedTransactionsList);

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

  const shouldSyncPartner = (
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

  const buildPartnerUpdates = (
    clean: Partial<Transaction>,
    shared: readonly string[],
  ): Record<string, unknown> => {
    const partner: Record<string, unknown> = { ...clean };
    if (clean.accountId !== undefined) partner.toAccountId = clean.accountId;
    if (clean.toAccountId !== undefined) partner.accountId = clean.toAccountId;
    if (clean.savingPocketId !== undefined) partner.toSavingPocketId = clean.savingPocketId;
    if (clean.toSavingPocketId !== undefined) partner.savingPocketId = clean.toSavingPocketId;
    for (const field of shared) {
      if (clean[field as keyof Partial<Transaction>] !== undefined) {
        partner[field] = clean[field as keyof Partial<Transaction>];
      }
    }
    partner.updatedAt = new Date().toISOString();
    return partner;
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

    if (shouldSyncPartner(originalTx, nullifiedFields, cleanUpdates, sharedTransferFields)) {
      const partner = transactions.find((t) => t.id === originalTx.linkedTransactionId);
      if (partner) {
        const partnerUpdates = buildPartnerUpdates(cleanUpdates, sharedTransferFields);
        finalUpdatesMap.set(partner.id, partnerUpdates as Partial<Transaction>);
        affectedTransactionIds.add(partner.id);
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
    await StorageService.saveAccounts(updatedAccountList);
    store.setAccounts(updatedAccountList);
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
