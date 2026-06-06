import { Subscription, Transaction } from "../../../../types";
import { normalizeDate, parseDateSafe } from "../../../../helpers/transactions.helper";
import * as SheetService from "../../../../services/sheets.services";

export function bumpSubscriptionNextDate(
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

export function buildPartnerLeg(
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
  sub.nextPaymentDate = bumpSubscriptionNextDate(
    { ...sub, nextPaymentDate: sub.nextPaymentDate },
    sub.nextPaymentDate,
  );
  return sub;
}

export async function syncTransactionToCloud(
  txWithUser: Transaction,
  partnerLeg: Transaction | null,
  partnerIdToDelete: string | undefined,
  isEdit: boolean,
  existingTransactions: Transaction[],
): Promise<void> {
  if (isEdit) {
    await SheetService.updateOne("Transactions", txWithUser.id, txWithUser);
    if (partnerLeg) {
      if (existingTransactions.some((t) => t.id === partnerLeg.id)) {
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
