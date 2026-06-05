import { Account, Transaction, TransactionType, UserProfile } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

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
  const accountWithUser = {
    ...acc,
    userId: userId || "local",
    updatedAt: new Date().toISOString(),
  } as Account;

  const updated = isNew
    ? [...existingAccounts, accountWithUser]
    : existingAccounts.map((a) => (a.id === acc.id ? accountWithUser : a));

  const newTxs: Transaction[] = [];
  if (isNew && accountWithUser.balance !== 0) {
    newTxs.push({
      id: crypto.randomUUID(),
      userId: accountWithUser.userId,
      accountId: accountWithUser.id,
      amount: Math.abs(accountWithUser.balance),
      currency: accountWithUser.currency,
      type: TransactionType.ACCOUNT_OPENING,
      shopName: "Opening Balance",
      date: new Date().toLocaleDateString("en-CA"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (!isNew) {
    const oldAcc = existingAccounts.find((a) => a.id === acc.id);
    if (oldAcc && oldAcc.balance !== accountWithUser.balance) {
      const diff = accountWithUser.balance - oldAcc.balance;
      newTxs.push({
        id: crypto.randomUUID(),
        userId: accountWithUser.userId,
        accountId: accountWithUser.id,
        amount: diff,
        currency: accountWithUser.currency,
        type: TransactionType.ADJUSTMENT,
        shopName: "Manual Balance Adjustment",
        date: new Date().toLocaleDateString("en-CA"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        note: `Manually changed balance from ${oldAcc.balance} to ${accountWithUser.balance}`,
      });
    }
  }

  if (newTxs.length > 0) {
    const updatedTxs = [...newTxs, ...existingTransactions];
    await StorageService.saveAccounts(updated);
    try {
      await StorageService.saveTransactions(updatedTxs);
      store.setTransactions(updatedTxs);
      store.setAccounts(updated);
    } catch (error) {
      await StorageService.saveAccounts(existingAccounts);
      throw error;
    }
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

  const referencing = existingTransactions.filter((t) => t.accountId === accountId);
  if (referencing.length > 0) {
    showToast(`Cannot delete: ${referencing.length} transaction(s) reference this account`, "alert");
    return;
  }

  const updated = existingAccounts.filter((a) => a.id !== accountId);
  await StorageService.saveAccounts(updated);
  store.setAccounts(updated);
  showToast("Account deleted", "success");
}
