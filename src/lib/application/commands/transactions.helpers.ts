import { Account, Pot, SavingPocket, Subscription, Transaction } from "../../../../types";
import { normalizeDate, parseDateSafe } from "../../../../helpers/transactions.helper";
import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";

export function advanceSubscriptionNextDate(
  sub: Subscription,
  txDate: string,
): string {
  let nextDateStr = normalizeDate(sub.nextPaymentDate);
  if (txDate < nextDateStr) return nextDateStr;
  const d = parseDateSafe(txDate);
  if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
}

export function buildLinkedTransferRecord(
  tx: Omit<Transaction, "userId">,
  txWithUser: Transaction,
  isDestHistorical: boolean | undefined,
): Transaction | null {
  if (!tx.linkedTransactionId || tx.transferDirection !== "OUT") return null;
  return {
    ...txWithUser,
    id: tx.linkedTransactionId,
    accountId: tx.toAccountId || tx.accountId,
    toAccountId: undefined,
    transferDirection: "IN" as const,
    linkedTransactionId: txWithUser.id,
    isHistorical: isDestHistorical || false,
  };
}

export function buildNewSubscription(
  newSub: Omit<Subscription, "userId" | "id">,
  userId: string,
  now: string,
): Subscription {
  const sub: Subscription = {
    ...newSub,
    id: crypto.randomUUID(),
    userId,
    updatedAt: now,
  };
  sub.nextPaymentDate = advanceSubscriptionNextDate(
    { ...sub, nextPaymentDate: sub.nextPaymentDate },
    sub.nextPaymentDate,
  );
  return sub;
}

export async function syncTransactionToCloud(
  txWithUser: Transaction,
  linkedRecord: Transaction | null,
  linkedIdToDelete: string | undefined,
  isEdit: boolean,
  existingTransactions: Transaction[],
): Promise<void> {
  if (isEdit) {
    await SheetService.updateOne("Transactions", txWithUser.id, txWithUser);
    if (linkedRecord) {
      if (existingTransactions.some((t) => t.id === linkedRecord.id)) {
        await SheetService.updateOne("Transactions", linkedRecord.id, linkedRecord);
      } else {
        await SheetService.insertOne("Transactions", linkedRecord);
      }
    }
    if (linkedIdToDelete) {
      await SheetService.deleteOne("Transactions", linkedIdToDelete);
    }
  } else {
    await SheetService.insertOne("Transactions", txWithUser);
    if (linkedRecord) await SheetService.insertOne("Transactions", linkedRecord);
  }
}

export interface PersistSnapshots {
  transactions: Transaction[];
  accounts: Account[];
  pots: Pot[];
  pockets: SavingPocket[];
}

export async function persistTransactionChanges(
  updatedTransactions: Transaction[],
  updatedAccounts: Account[],
  updatedPots: Pot[],
  updatedPockets: SavingPocket[],
  accountChanges: Map<string, number>,
  potChanges: Map<string, number>,
  pocketChanges: Map<string, number>,
): Promise<PersistSnapshots> {
  const snapshots: PersistSnapshots = {
    transactions: StorageService.getStoredTransactions(),
    accounts: StorageService.getStoredAccounts(),
    pots: StorageService.getStoredPots(),
    pockets: StorageService.getStoredPockets(),
  };

  await StorageService.saveTransactions(updatedTransactions);
  if (accountChanges.size > 0) await StorageService.saveAccounts(updatedAccounts);
  if (potChanges.size > 0) await StorageService.savePots(updatedPots);
  if (pocketChanges.size > 0) await StorageService.savePockets(updatedPockets);

  return snapshots;
}

export async function rollbackTransactionChanges(snapshots: PersistSnapshots): Promise<void> {
  await StorageService.saveTransactions(snapshots.transactions);
  if (snapshots.accounts.length) await StorageService.saveAccounts(snapshots.accounts);
  if (snapshots.pots.length) await StorageService.savePots(snapshots.pots);
  if (snapshots.pockets.length) await StorageService.savePockets(snapshots.pockets);
}

export function applyTransactionUpdatesToStore(
  updatedTransactions: Transaction[],
  updatedAccounts: Account[],
  updatedPots: Pot[],
  updatedPockets: SavingPocket[],
  accountChanges: Map<string, number>,
  potChanges: Map<string, number>,
  pocketChanges: Map<string, number>,
): void {
  const store = useFinanceStore.getState();
  store.setTransactions(updatedTransactions);
  if (accountChanges.size > 0) store.setAccounts(updatedAccounts);
  if (potChanges.size > 0) store.setPots(updatedPots);
  if (pocketChanges.size > 0) store.setPockets(updatedPockets);
}
