import { Account, Transaction, TransactionType } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function saveAccount(
  acc: Omit<Account, "userId">,
  existingAccounts: Account[],
  existingTransactions: Transaction[],
  userId: string,
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

  store.setAccounts(updated);
  await StorageService.saveAccounts(updated);

  if (isNew && accountWithUser.balance !== 0) {
    const openingTx: Transaction = {
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
    };
    const updatedTxs = [openingTx, ...existingTransactions];
    store.setTransactions(updatedTxs);
    await StorageService.saveTransactions(updatedTxs);
  }

  if (!isNew) {
    const oldAcc = existingAccounts.find((a) => a.id === acc.id);
    if (oldAcc && oldAcc.balance !== accountWithUser.balance) {
      const diff = accountWithUser.balance - oldAcc.balance;
      const adjustmentTx: Transaction = {
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
      };
      const updatedTxs = [adjustmentTx, ...existingTransactions];
      store.setTransactions(updatedTxs);
      await StorageService.saveTransactions(updatedTxs);
    }
  }

  showToast("Account saved", "success");
}

export async function deleteAccount(
  accountId: string,
  existingAccounts: Account[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingAccounts.filter((a) => a.id !== accountId);
  store.setAccounts(updated);
  await StorageService.saveAccounts(updated);
  showToast("Account deleted", "success");
}
