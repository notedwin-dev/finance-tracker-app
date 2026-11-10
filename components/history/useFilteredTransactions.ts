import { useMemo, useState } from "react";
import { Transaction } from "../../types";
import {
  groupTransactions,
  GroupedTransaction,
  normalizeDate,
} from "../../helpers/transactions.helper";
import { PAGE_SIZE } from "./constants";

interface UseFilteredTransactionsResult {
  filteredTransactions: Transaction[];
  groupedList: GroupedTransaction[];
  paginatedGrouped: GroupedTransaction[];
  grouped: Record<string, GroupedTransaction[]>;
  sortedDates: string[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
}

// Data can arrive with raw sheet cell types (numbers/booleans) from imports or
// legacy storage. Search must never throw on a malformed field.
const asLower = (v: unknown): string =>
  typeof v === "string"
    ? v.toLowerCase()
    : v == null
      ? ""
      : String(v).toLowerCase();

export function matchesSearch(t: Transaction, query: string, categories: { id: string; name: string }[], accounts: { id: string; name: string }[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // When query looks like a date (YYYY, YYYY-MM, YYYY-MM-DD), only match dates
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(q)) {
    return asLower(t.date).startsWith(q);
  }

  if (asLower(t.shopName).includes(q)) return true;
  if (asLower(t.note).includes(q)) return true;
  if (asLower(t.type).includes(q)) return true;
  const cat = categories.find((c) => c.id === t.categoryId);
  if (asLower(cat?.name).includes(q)) return true;
  if (asLower(t.currency).includes(q)) return true;
  if (asLower(t.date).startsWith(q)) return true;
  if (asLower(t.time).includes(q)) return true;
  if (t.toAccountId && asLower(accounts?.find((a) => a.id === t.toAccountId)?.name).includes(q)) return true;
  return false;
}

export function useFilteredTransactions(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
  searchQuery: string,
  categories: { id: string; name: string }[],
  accounts: { id: string; name: string }[],
  accountIds: string[],
): UseFilteredTransactionsResult {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tDate = normalizeDate(t.date);
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      if (accountIds.length > 0 && !accountIds.includes(t.accountId)) return false;
      if (!matchesSearch(t, searchQuery, categories, accounts)) return false;
      return true;
    });
  }, [transactions, startDate, endDate, searchQuery, categories, accounts, accountIds]);

  const groupedList = useMemo(() => {
    try {
      return groupTransactions(filteredTransactions);
    } catch (e) {
      console.warn("Failed to group transactions", e);
      return [];
    }
  }, [filteredTransactions]);

  const paginatedGrouped = useMemo(
    () => groupedList.slice(0, visibleCount),
    [groupedList, visibleCount],
  );

  const { grouped, sortedDates } = useMemo(() => {
    const grouped = paginatedGrouped.reduce(
      (acc, t) => {
        const dateKey = normalizeDate(t.date);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(t);
        return acc;
      },
      {} as Record<string, GroupedTransaction[]>,
    );

    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    return { grouped, sortedDates };
  }, [paginatedGrouped]);

  return {
    filteredTransactions,
    groupedList,
    paginatedGrouped,
    grouped,
    sortedDates,
    visibleCount,
    setVisibleCount,
  };
}
