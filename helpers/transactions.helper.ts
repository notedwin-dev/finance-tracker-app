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

    // 1. Explicit Linkage (linkedTransactionId)
    if (t.linkedTransactionId) {
      const partner = transactions.find((p) => p.id === t.linkedTransactionId);
      if (partner && !processedIds.has(partner.id)) {
        const main =
          t.transferDirection === "OUT" || t.type === TransactionType.EXPENSE
            ? t
            : partner;
        const linked = main === t ? partner : t;

        grouped.push({ ...main, linkedTransaction: linked });
        processedIds.add(main.id);
        processedIds.add(linked.id);
        continue;
      }
    }

    // 2. Fuzzy Merge for Symmetric Transfers (Unlinked legs)
    if (t.type === TransactionType.TRANSFER) {
      const partner = transactions.find(
        (p) =>
          !processedIds.has(p.id) &&
          p.id !== t.id &&
          p.type === TransactionType.TRANSFER &&
          normalizeDate(p.date) === normalizeDate(t.date) &&
          p.amount === t.amount &&
          ((p.accountId === t.toAccountId && p.toAccountId === t.accountId) || // Symmetric
            (p.accountId === (t as any).toAccountId &&
              (p as any).toAccountId === t.accountId) ||
            // Or if accounts are swapped but toAccountId is not explicitly set on one
            p.accountId === t.toAccountId ||
            t.accountId === p.toAccountId),
      );

      if (partner) {
        // Double check symmetric account relationship
        const isActuallySymmetric =
          partner.accountId === t.toAccountId ||
          t.accountId === partner.toAccountId;

        if (isActuallySymmetric) {
          const main =
            t.transferDirection === "OUT" || !t.transferDirection ? t : partner;
          const linked = main === t ? partner : t;

          grouped.push({ ...main, linkedTransaction: linked });
          processedIds.add(main.id);
          processedIds.add(linked.id);
          continue;
        }
      }
    }

    grouped.push(t);
    processedIds.add(t.id);
  }

  return grouped;
};

/**
 * Safely parses a date from various formats (Serial, ISO, etc.) into a Date object
 */
export const parseDateSafe = (date: string | number | undefined): Date => {
  if (!date) return new Date();
  const s = String(date);

  // Serial date (Google Sheets)
  if (typeof date === "number" || /^\d{5}$/.test(s)) {
    const serial = Number(date);
    const base = Date.UTC(1899, 11, 30);
    return new Date(base + serial * 86400000);
  }

  // If it's YYYY-MM-DD, append a time to force local parsing if it doesn't have one
  // or handle it specifically. new Date("YYYY-MM-DD") is UTC, which we want to avoid
  // if we want to stay in local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Normalizes a date string or serial number to YYYY-MM-DD in local time
 */
export const normalizeDate = (date: string | number): string => {
  const d = parseDateSafe(date);
  return d.toLocaleDateString("en-CA");
};

export const getOrdinal = (n: number): string => {
  if (n > 3 && n < 21) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const formatDateReadable = (date: Date | string | number): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${month} ${day}${getOrdinal(day)}, ${year}`;
};
