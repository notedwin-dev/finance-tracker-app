import { Account, Transaction, Subscription, TransactionType } from "../../../types";
import { parseDateSafe, normalizeDate } from "./dates";

export interface NextOccurrencesResult {
  nextDateStr: string | null;
  generatedTxDates: string[];
  bailed: boolean;
}

export const advanceDateByFrequency = (
  date: Date,
  frequency: Subscription["frequency"],
): Date => {
  const next = new Date(date);
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7);
  else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (frequency === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  else next.setDate(next.getDate() + 1);
  return next;
};

export const computeNextOccurrences = (
  sub: Pick<Subscription, "id" | "nextPaymentDate" | "frequency">,
  today: string,
  maxIterations: number = 365,
): NextOccurrencesResult => {
  let nextDateStr = normalizeDate(sub.nextPaymentDate);
  if (!nextDateStr) {
    return { nextDateStr: null, generatedTxDates: [], bailed: false };
  }
  const generatedTxDates: string[] = [];
  let iterations = 0;
  while (nextDateStr <= today && iterations < maxIterations) {
    iterations++;
    generatedTxDates.push(nextDateStr);
    const d = advanceDateByFrequency(parseDateSafe(nextDateStr), sub.frequency);
    nextDateStr = d.toLocaleDateString("en-CA");
  }
  return {
    nextDateStr,
    generatedTxDates,
    bailed: iterations >= maxIterations,
  };
};

export const buildSubscriptionTransaction = (
  sub: Subscription,
  date: string,
  userId: string,
  now: string,
): Transaction => ({
  id: `sub-${sub.id}-${date}`,
  userId,
  accountId: sub.accountId,
  amount: sub.amount,
  currency: sub.currency,
  type: TransactionType.EXPENSE,
  categoryId: sub.categoryId,
  shopName: `${sub.name} (Subscription)`,
  date,
  subscriptionId: sub.id,
  createdAt: now,
  updatedAt: now,
});

export const convertTransactionAmountForAccount = (
  tx: Pick<Transaction, "amount" | "currency">,
  account: Pick<Account, "currency">,
  usdRate: number,
  rateValid: boolean,
): number => {
  if (tx.currency === account.currency) return tx.amount;
  if (!rateValid) return 0;
  if (tx.currency === "USD") return tx.amount * usdRate;
  if (tx.currency === "MYR") return tx.amount / usdRate;
  return tx.amount;
};

export const dedupeTransactions = <T extends Pick<Transaction, "id">>(
  existing: T[],
  candidates: T[],
): T[] => {
  const existingIds = new Set(existing.map((t) => t.id));
  return candidates.filter((c) => !existingIds.has(c.id));
};
