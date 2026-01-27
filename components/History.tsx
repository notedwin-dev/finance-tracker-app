import React, { useState } from "react";
import { Transaction, TransactionType, Category, Account } from "../types";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  groupTransactions,
  GroupedTransaction,
  normalizeDate,
} from "../utils/transactions";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onAddTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const History: React.FC<Props> = ({
  transactions,
  categories,
  accounts,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600">
        <span className="text-4xl mb-4 opacity-50">📜</span>
        <p>No history yet.</p>
        <button
          onClick={onAddTransaction}
          className="mt-4 flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          Add First Record
        </button>
      </div>
    );
  }

  // 1. Sort transactions by date descending (Newest first)
  const sortedTransactions = [...transactions].sort((a, b) =>
    normalizeDate(b.date).localeCompare(normalizeDate(a.date)),
  );

  // Group grouped transactions first, then by date
  const groupedList = groupTransactions(sortedTransactions);

  const grouped = groupedList.reduce(
    (acc, t) => {
      // Use just the date part (YYYY-MM-DD) for grouping headers
      // Handle cases where t.date might be full ISO including time
      const dateKey = normalizeDate(t.date);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(t);
      return acc;
    },
    {} as Record<string, GroupedTransaction[]>,
  );

  // Sort dates
  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const getCategoryIcon = (catId?: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.icon : "📄";
  };

  const formatDateHeader = (dateStr: string | number) => {
    const finalDateStr = normalizeDate(dateStr);
    const date = new Date(finalDateStr);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // dateStr is already in YYYY-MM-DD format (UTC based from TransactionForm)
    if (finalDateStr === todayStr) return "Today";
    if (finalDateStr === yesterdayStr) return "Yesterday";

    // Force UTC timezone for consistent formatting since inputs are UTC-based date strings
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="hidden lg:flex justify-end mb-4">
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          Add Transaction
        </button>
      </div>

      {sortedDates.map((dateStr) => (
        <div key={dateStr} className="animate-slideUp">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pl-1">
            {formatDateHeader(dateStr)}
          </h3>
          <div className="space-y-3">
            {grouped[dateStr].map((t) => (
              <div
                key={t.id}
                className="group flex items-center justify-between p-4 bg-card rounded-2xl border border-gray-800 hover:bg-surface transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-surface border border-gray-700`}
                  >
                    {t.linkedTransaction
                      ? "↔️"
                      : t.type === TransactionType.INCOME
                        ? "💰"
                        : getCategoryIcon(t.categoryId)}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">
                      {t.shopName ||
                        (t.linkedTransaction ? "Transfer" : "Untitled")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 uppercase bg-white/5 px-1.5 rounded">
                        {t.currency}
                      </span>
                      {t.linkedTransaction ? (
                        <p className="text-xs text-gray-400">
                          {accounts.find((a) => a.id === t.accountId)?.name ||
                            "Unknown"}{" "}
                          ➔{" "}
                          {accounts.find((a) => a.id === t.toAccountId)?.name ||
                            "Unknown"}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">
                          {categories.find((c) => c.id === t.categoryId)
                            ?.name || t.type}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-row items-end gap-2">
                  <div>
                    {t.linkedTransaction ? (
                      <>
                        <span className="font-mono font-bold text-indigo-400">
                          {Math.abs(t.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] text-gray-500">
                            {t.currency}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span
                        className={`font-mono font-bold ${
                          t.type === TransactionType.INCOME ||
                          t.type === TransactionType.ACCOUNT_OPENING ||
                          (t.type === TransactionType.ADJUSTMENT &&
                            t.amount >= 0)
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {t.type === TransactionType.INCOME ||
                        t.type === TransactionType.ACCOUNT_OPENING ||
                        (t.type === TransactionType.ADJUSTMENT && t.amount >= 0)
                          ? "+"
                          : "-"}
                        {Math.abs(t.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        <span className="text-[10px] text-gray-500">
                          {t.currency}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Expandable Actions Menu */}
                  <div
                    className={`${
                      openMenuId === t.id ? "flex" : "hidden group-hover:flex"
                    } items-center ml-2 relative z-10`}
                  >
                    {openMenuId === t.id ? (
                      /* Expanded Actions */
                      <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 p-1 rounded-lg shadow-xl animate-in fade-in slide-in-from-right-2 duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTransaction(
                              t.linkedTransaction &&
                                t.transferDirection === "IN" &&
                                t.linkedTransaction
                                ? t.linkedTransaction
                                : t,
                            );
                            setOpenMenuId(null);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-md text-blue-400 hover:text-white transition-colors"
                          title="Edit Details"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-0.5"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(t.id);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete Record"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-0.5"></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
                          title="Close"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* Trigger Icon */
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(t.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;
