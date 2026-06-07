import { Account, Transaction, TransactionType, UserProfile } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { logger } from "../../infrastructure/logger";

const buildAccountWithUser = (
  acc: Omit<Account, "userId">,
  userId: string,
): Account => ({
  ...acc,
  userId: userId || "local",
  updatedAt: new Date().toISOString(),
});

const buildOpeningBalanceTx = (account: Account): Transaction => ({
  id: crypto.randomUUID(),
  userId: account.userId,
  accountId: account.id,
  amount: Math.abs(account.balance),
  currency: account.currency,
  type: TransactionType.ACCOUNT_OPENING,
  shopName: "Opening Balance",
  date: new Date().toLocaleDateString("en-CA"),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const buildAdjustmentTx = (
  account: Account,
  oldBalance: number,
): Transaction => ({
  id: crypto.randomUUID(),
  userId: account.userId,
  accountId: account.id,
  amount: account.balance - oldBalance,
  currency: account.currency,
  type: TransactionType.ADJUSTMENT,
  shopName: "Manual Balance Adjustment",
  date: new Date().toLocaleDateString("en-CA"),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  note: `Manually changed balance from ${oldBalance} to ${account.balance}`,
});

const collectNewTransactions = (
  isNew: boolean,
  account: Account,
  existingAccounts: Account[],
): Transaction[] => {
  const newTxs: Transaction[] = [];
  if (isNew && account.balance !== 0) {
    newTxs.push(buildOpeningBalanceTx(account));
    return newTxs;
  }
  if (isNew) return newTxs;
  const oldAcc = existingAccounts.find((a) => a.id === account.id);
  if (oldAcc && oldAcc.balance !== account.balance) {
    newTxs.push(buildAdjustmentTx(account, oldAcc.balance));
  }
  return newTxs;
};

const persistAccountsAndTxs = async (
  updatedAccounts: Account[],
  updatedTxs: Transaction[],
  existingAccounts: Account[],
  existingTransactions: Transaction[],
) => {
  try {
    await StorageService.saveTransactions(updatedTxs);
    await StorageService.saveAccounts(updatedAccounts);
  } catch (err) {
    const rollbackResults = await Promise.allSettled([
      StorageService.saveTransactions(existingTransactions),
      StorageService.saveAccounts(existingAccounts),
    ]);
    rollbackResults.forEach((r) => {
      if (r.status === "rejected") {
        logger.error("Rollback failed during account save error", r.reason);
      }
    });
    throw err;
  }
};

export async function saveAccount(
  acc: Omit<Account, "userId">,
  existingAccounts: Account[],
  existingTransactions: Transaction[],
  userId: string,
  _profile?: UserProfile,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isNew = !existingAccounts.some((a) => a.id === acc.id);
  const accountWithUser = buildAccountWithUser(acc, userId);

  const updated = isNew
    ? [...existingAccounts, accountWithUser]
    : existingAccounts.map((a) => (a.id === acc.id ? accountWithUser : a));

  const newTxs = collectNewTransactions(isNew, accountWithUser, existingAccounts);

  if (newTxs.length > 0) {
    const updatedTxs = [...newTxs, ...existingTransactions];
    await persistAccountsAndTxs(
      updated,
      updatedTxs,
      existingAccounts,
      existingTransactions,
    );
    store.setTransactions(updatedTxs);
    store.setAccounts(updated);
  } else {
    await StorageService.saveAccounts(updated);
    store.setAccounts(updated);
  }

  showToast("Account saved", "success");
}

export async function deleteAccount(
  accountId: string,
  existingAccounts: Account[],
  existingTransactions: Transaction[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const referencing = existingTransactions.filter(
    (t) => t.accountId === accountId || t.toAccountId === accountId,
  );
  if (referencing.length > 0) {
    showToast(`Cannot delete: ${referencing.length} transaction(s) reference this account`, "alert");
    return;
  }

  const updated = existingAccounts.filter((a) => a.id !== accountId);
  await StorageService.saveAccounts(updated);
  store.setAccounts(updated);
  showToast("Account deleted", "success");
}
