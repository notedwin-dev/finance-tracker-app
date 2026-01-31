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
  parseDateSafe,
} from "../helpers/transactions.helper";
import { useData } from "../context/DataContext";

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
  const { maskAmount, maskText, privacyMode } = useData();
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

  // 1. Sort transactions by date and time (Newest first)
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = normalizeDate(a.date);
    const dateB = normalizeDate(b.date);
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    // If dates are equal, sort by time (HH:mm)
    const timeA = a.time || "";
    const timeB = b.time || "";
    if (timeA !== timeB) return timeB.localeCompare(timeA);

    // If times are equal (or missing), sort by createdAt
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

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
    const date = parseDateSafe(finalDateStr);

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("en-CA");

    if (finalDateStr === todayStr) return "Today";
    if (finalDateStr === yesterdayStr) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="hidden lg:flex justify-end mb-4">
        <button
          onClick={onAddTransaction}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-3xl font-black tracking-tight shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          NEW TRANSACTION
        </button>
      </div>

      {sortedDates.map((dateStr) => (
        <div key={dateStr} className="animate-slideUp">
          <h3 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.2em] mb-4 pl-4 flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/40"></span>
            {formatDateHeader(dateStr)}
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {grouped[dateStr].map((t) => (
              <div
                key={t.id}
                onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                className="group flex items-center p-4 sm:p-5 bg-surface/40 backdrop-blur-md rounded-4xl sm:rounded-4xl border border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden shadow-xl"
              >
                <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                  <div
                    className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-md sm:text-lg transition-all duration-500 ${
                      t.linkedTransaction
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                        : "bg-surface border border-white/5"
                    }`}
                  >
                    {t.linkedTransaction
                      ? "↔️"
                      : t.type === TransactionType.INCOME
                        ? "💰"
                        : getCategoryIcon(t.categoryId)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold sm:font-black text-white text-[17px] sm:text-lg tracking-tight truncate">
                        {t.linkedTransaction ? (
                          t.shopName ? (
                            maskText(t.shopName)
                          ) : (
                            <>
                              {maskText(
                                accounts.find((a) => a.id === t.accountId)
                                  ?.name || "???",
                              )}{" "}
                              →{" "}
                              {maskText(
                                accounts.find((a) => a.id === t.toAccountId)
                                  ?.name || "???",
                              )}
                            </>
                          )
                        ) : (
                          maskText(t.shopName || "UNTITLED")
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                      {t.time && (
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {t.time}
                        </span>
                      )}
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-700"></span>
                      {t.linkedTransaction ? (
                        <p className="text-[11px] sm:text-[11px] font-semibold sm:font-bold text-indigo-400/70 truncate uppercase tracking-wider">
                          INTERNAL TRANSFER
                        </p>
                      ) : (
                        <p className="text-[11px] sm:text-[11px] font-semibold sm:font-bold text-gray-500/70 truncate uppercase tracking-[0.05em]">
                          {categories.find((c) => c.id === t.categoryId)
                            ?.name ||
                            (t.type === TransactionType.ACCOUNT_OPENING
                              ? "OPENING BALANCE"
                              : t.type)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-4">
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-black text-xl sm:text-xl tracking-tighter ${
                        t.linkedTransaction
                          ? "text-indigo-400"
                          : t.type === TransactionType.INCOME ||
                              t.type === TransactionType.ACCOUNT_OPENING ||
                              (t.type === TransactionType.TRANSFER &&
                                t.transferDirection === "IN") ||
                              (t.type === TransactionType.ADJUSTMENT &&
                                t.amount >= 0)
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {t.linkedTransaction
                        ? ""
                        : t.type === TransactionType.INCOME ||
                            t.type === TransactionType.ACCOUNT_OPENING ||
                            (t.type === TransactionType.TRANSFER &&
                              t.transferDirection === "IN") ||
                            (t.type === TransactionType.ADJUSTMENT &&
                              t.amount >= 0)
                          ? "+"
                          : "-"}
                      {maskAmount(
                        Math.abs(t.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      )}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-gray-600 font-bold sm:font-black tracking-widest uppercase">
                      {t.currency}
                    </span>
                  </div>
                </div>

                {/* Simplified floating actions on expand */}
                {openMenuId === t.id && (
                  <div className="absolute inset-y-0 right-0 bg-indigo-600 flex items-center gap-4 px-4 animate animate-fadeIn">
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
                      className="p-2 bg-white/20 rounded-lg text-white hover:scale-110 transition-transform"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransaction(t.id);
                      }}
                      className="p-2 bg-rose-500/40 rounded-lg text-white hover:scale-110 transition-transform"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                      }}
                      className="p-2 bg-white/10 rounded-lg text-white/50"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;
