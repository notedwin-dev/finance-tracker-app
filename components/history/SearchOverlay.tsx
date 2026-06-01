import React, { useEffect, useRef, useMemo } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Transaction, TransactionType, Category, Account } from "../../types";
import { matchesSearch } from "./useFilteredTransactions";

interface MergedResult {
  id: string;
  transaction: Transaction;
  linkedIn?: Transaction;
}

interface Props {
  isOpen: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  maskAmount: (amount: number | string, currency?: string, isSensitive?: boolean) => React.ReactNode;
  maskText: (text: string, isSensitive?: boolean, permanentMask?: boolean) => React.ReactNode;
  onSelectTransaction: (t: Transaction) => void;
}

const CategoryIcon: React.FC<{ catId?: string; categories: Category[] }> = ({ catId, categories }) => {
  const cat = categories.find((c) => c.id === catId);
  return <span>{cat ? cat.icon : "📄"}</span>;
};

const SearchOverlay: React.FC<Props> = ({
  isOpen,
  query,
  onQueryChange,
  onClose,
  transactions,
  categories,
  accounts,
  maskAmount,
  maskText,
  onSelectTransaction,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const results: MergedResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const matched = transactions.filter((t) => matchesSearch(t, query, categories, accounts));
    const merged: MergedResult[] = [];
    const skipped = new Set<string>();
    for (const t of matched) {
      if (skipped.has(t.id)) continue;
      if (t.type === TransactionType.TRANSFER && t.transferDirection === "OUT" && t.linkedTransactionId) {
        const linkedIn = matched.find(
          (x) => x.id === t.linkedTransactionId && x.transferDirection === "IN",
        );
        if (linkedIn) {
          skipped.add(linkedIn.id);
          merged.push({ id: t.id, transaction: t, linkedIn });
          continue;
        }
      }
      merged.push({ id: t.id, transaction: t });
    }
    return merged;
  }, [transactions, query, categories]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, results.length - 1);
        setActiveIndex(next);
        const buttons = listRef.current?.querySelectorAll("button");
        buttons?.[next]?.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(activeIndex - 1, 0);
        setActiveIndex(next);
        const buttons = listRef.current?.querySelectorAll("button");
        buttons?.[next]?.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter" && results[activeIndex]) {
        onSelectTransaction(results[activeIndex].transaction);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, activeIndex, onClose, onSelectTransaction]);

  if (!isOpen) return null;

  const getAccountName = (id?: string) => {
    if (!id) return "";
    const a = accounts.find((x) => x.id === id);
    return a ? a.name : "";
  };

  const getDisplayAmount = (t: Transaction) => {
    const isIncome =
      t.type === TransactionType.INCOME ||
      t.type === TransactionType.ACCOUNT_OPENING ||
      (t.type === TransactionType.ADJUSTMENT && t.amount >= 0);
    const prefix = isIncome ? "+" : "-";
    return `${prefix}${maskAmount(Math.abs(t.amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }))}`;
  };

  const getCategoryName = (catId?: string, fallback?: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : fallback || "Unknown";
  };

  const getColor = (t: Transaction) => {
    if (t.type === TransactionType.TRANSFER) return "text-indigo-400";
    const isIncome =
      t.type === TransactionType.INCOME ||
      t.type === TransactionType.ACCOUNT_OPENING ||
      (t.type === TransactionType.ADJUSTMENT && t.amount >= 0);
    return isIncome ? "text-emerald-400" : "text-rose-400";
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-surface border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden animate-slideDown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <MagnifyingGlassIcon className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search transactions..."
            className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-gray-600"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              className="text-gray-500 hover:text-white transition-colors p-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-[10px] font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg"
          >
            Esc
          </button>
        </div>

        <div
          ref={listRef}
          className="overflow-y-auto max-h-[50vh] custom-scrollbar"
        >
          {query && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <MagnifyingGlassIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-bold text-sm">No results for "{query}"</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 py-2">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((r, i) => {
                const { transaction: t, linkedIn } = r;
                const isTransfer = t.type === TransactionType.TRANSFER;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTransaction(t);
                      onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left ${
                      i === activeIndex
                        ? "bg-indigo-500/10 border border-indigo-500/20"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-surface border border-white/5 flex items-center justify-center text-md">
                      {isTransfer ? "↔️" : t.type === TransactionType.INCOME ? "💰" : <CategoryIcon catId={t.categoryId} categories={categories} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">
                        {isTransfer && linkedIn
                          ? `${getAccountName(t.accountId)} → ${getAccountName(t.toAccountId)}`
                          : maskText(t.shopName || "UNTITLED")}
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold truncate">
                        {t.date}
                        {t.time && <> at {t.time}</>}
                        {" · "}
                        {isTransfer
                          ? "Transfer"
                          : getCategoryName(t.categoryId, t.type)}
                        {!isTransfer && (
                          <>
                            {" · "}
                            {getAccountName(t.accountId)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-black text-sm ${getColor(t)}`}>
                        {isTransfer ? "" : getDisplayAmount(t)}
                      </p>
                      <p className="text-[9px] text-gray-600 font-bold">{t.currency}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!query && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-sm">Type to search transactions</p>
              <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                <span className="bg-white/5 px-2 py-1 rounded">↑↓</span>
                <span>Navigate</span>
                <span className="bg-white/5 px-2 py-1 rounded">↵</span>
                <span>Open</span>
                <span className="bg-white/5 px-2 py-1 rounded">Esc</span>
                <span>Close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
