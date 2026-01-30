import { Transaction, Account, TransactionType } from "../types";

export interface BalanceMap {
  [accountId: string]: number;
}

export const USD_RATE = 4.45;

/**
 * Calculates account balances based on a list of transactions.
 * Handles currency conversion, initial balances, and transfers.
 */
export const calculateBalances = (
  transactions: Transaction[],
  accounts: Account[],
  usdRate: number = USD_RATE,
): BalanceMap => {
  const balances: BalanceMap = {};

  // Initialize with 0
  accounts.forEach((acc) => {
    balances[acc.id] = 0;
  });

  // Process transactions
  transactions.forEach((tx) => {
    const acc = accounts.find((a) => a.id === tx.accountId);
    if (!acc) return;

    const getConvertedAmount = (amt: number, txCur: string, accCur: string) => {
      if (txCur === accCur) return amt;
      if (txCur === "USD" && accCur === "MYR") return amt * usdRate;
      if (txCur === "MYR" && accCur === "USD") return amt / usdRate;
      return amt;
    };

    const amount = getConvertedAmount(
      tx.amount || 0,
      tx.currency,
      acc.currency,
    );

    const isPositive =
      tx.type === TransactionType.INCOME ||
      tx.type === TransactionType.ACCOUNT_OPENING ||
      tx.type === TransactionType.ADJUSTMENT;

    const isNegative = tx.type === TransactionType.EXPENSE;

    if (isPositive) {
      balances[tx.accountId] += amount;
    } else if (isNegative) {
      balances[tx.accountId] -= amount;
    } else if (tx.type === TransactionType.TRANSFER) {
      // Logic for Transfers
      if (tx.transferDirection === "OUT" || !tx.transferDirection) {
        balances[tx.accountId] -= amount;

        // Handle "Single Record" Transfers where toAccountId is in the same record
        if (
          !tx.transferDirection &&
          tx.toAccountId &&
          balances[tx.toAccountId] !== undefined
        ) {
          const toAcc = accounts.find((a) => a.id === tx.toAccountId);
          if (toAcc) {
            const toAmount = getConvertedAmount(
              tx.amount,
              tx.currency,
              toAcc.currency,
            );
            balances[tx.toAccountId] += toAmount;
          }
        }
      } else if (tx.transferDirection === "IN") {
        balances[tx.accountId] += amount;
      }
    }
  });

  return balances;
};
