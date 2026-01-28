import { Transaction, TransactionType } from "../types";

export interface GroupedTransaction extends Transaction {
  linkedTransaction?: Transaction;
}

export const groupTransactions = (
  transactions: Transaction[],
): GroupedTransaction[] => {
  const grouped: GroupedTransaction[] = [];
  const processedIds = new Set<string>();

  // Sort transactions by date, time, and createdAt (Newest first)
  const sorted = [...transactions].sort((a, b) => {
    const dateA = normalizeDate(a.date);
    const dateB = normalizeDate(b.date);
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    const timeA = a.time || "";
    const timeB = b.time || "";
    if (timeA !== timeB) return timeB.localeCompare(timeA);

    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  for (const t of sorted) {
    if (processedIds.has(t.id)) continue;

    if (t.linkedTransactionId && t.type === TransactionType.TRANSFER) {
      const partner = transactions.find((p) => p.id === t.linkedTransactionId);
      if (partner) {
        // We found the pair.
        // We prefer to use the 'OUT' transaction as the main one to represent the Transfer
        // because it represents the source of funds.
        const main = t.transferDirection === "OUT" ? t : partner;
        const linked = t.transferDirection === "OUT" ? partner : t;

        grouped.push({
          ...main,
          linkedTransaction: linked,
        });
        processedIds.add(main.id);
        processedIds.add(linked.id);
        continue;
      }
    }

    grouped.push(t);
    processedIds.add(t.id);
  }

  return grouped;
};

/**
 * Normalizes a date string or serial number to YYYY-MM-DD
 */
export const normalizeDate = (date: string | number): string => {
  if (!date) return "";
  const s = String(date);

  // Check if it's a numeric serial date (usually 5 digits for current decade)
  if (typeof date === "number" || /^\d{5}$/.test(s)) {
    const serial = Number(date);
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + serial * 86400000);
    return d.toISOString().split("T")[0];
  }

  // If it's already YYYY-MM-DD or contains time, just take the date part
  return s.split("T")[0];
};
