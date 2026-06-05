import { useMemo, useState } from "react";
import { Transaction } from "../../types";
import {
  groupTransactions,
  GroupedTransaction,
  normalizeDate,
} from "../../helpers/transactions.helper";
import { PAGE_SIZE } from "./constants";
import { logger } from "../../src/lib/application/logger";
import { matchesSearch } from "../../src/lib/domain/search";

export { matchesSearch };

interface UseFilteredTransactionsResult {
  filteredTransactions: Transaction[];
  groupedList: GroupedTransaction[];
  paginatedGrouped: GroupedTransaction[];
  grouped: Record<string, GroupedTransaction[]>;
  sortedDates: string[];
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
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
      logger.warn("Failed to group transactions", e);
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
