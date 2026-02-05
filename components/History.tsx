import React, { useState, useEffect } from "react";
import {
  Transaction,
  TransactionType,
  Category,
  Account,
  SavingPocket,
} from "../types";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  InboxIcon,
  ArrowUpIcon,
  FunnelIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import {
  groupTransactions,
  GroupedTransaction,
  normalizeDate,
  parseDateSafe,
  formatDateReadable,
} from "../helpers/transactions.helper";
import { useData } from "../context/DataContext";
import Modal from "./Modal";
import DatePicker from "./DatePicker";

interface Props {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  pockets: SavingPocket[];
  showAddModal?: boolean;
  isAssetPage?: boolean;
  onAddTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const History: React.FC<Props> = ({
  transactions,
  categories,
  accounts,
  pockets,
  showAddModal = false,
  isAssetPage = false,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const {
    maskAmount,
    maskText,
    privacyMode,
    handleBatchTransactionDelete,
    handleBatchTransactionEdit,
    pots,
  } = useData();
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchUpdates, setBatchUpdates] = useState<Partial<Transaction>>({});

  const touchStartX = React.useRef<number>(0);
  const touchStartY = React.useRef<number>(0);
  const longPressTimer = React.useRef<any>(null);
  const isLongPressActive = React.useRef<boolean>(false);

  // Filters & Pagination
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  // Scroll to Top state
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleItemPointerDown = (e: React.PointerEvent, id: string) => {
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    isLongPressActive.current = false;

    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      toggleSelection(id);
      if (window.navigator.vibrate) window.navigator.vibrate(20);
    }, 2500); // Increased to 2.5s for more deliberate selection
  };

  const handleItemPointerMove = (e: React.PointerEvent) => {
    if (!longPressTimer.current) return;

    const deltaX = Math.abs(e.clientX - touchStartX.current);
    const deltaY = Math.abs(e.clientY - touchStartY.current);

    // If moved significantly, cancel the long press (user is probably scrolling or swiping)
    if (deltaX > 10 || deltaY > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleItemPointerUp = (e: React.PointerEvent, id: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (isLongPressActive.current) return;

    const deltaX = e.clientX - touchStartX.current;
    const deltaY = e.clientY - touchStartY.current;

    // Swipe detection
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30) {
      // Don't allow swipe if in selection mode or if long press just happened
      if (selectedIds.length > 0 || isBatchMode) return;

      if (deltaX < 0) {
        setSwipedId(id);
      } else {
        if (swipedId === id) setSwipedId(null);
      }
      // If we detected a swipe, we should prevent the subsequent click
      isLongPressActive.current = true;
      setTimeout(() => {
        isLongPressActive.current = false;
      }, 100);
    }
  };

  const handleItemClick = (t: GroupedTransaction) => {
    if (isLongPressActive.current) {
      isLongPressActive.current = false;
      return;
    }

    if (swipedId) {
      setSwipedId(null);
      return;
    }

    // If batch mode or items selected, tap to toggle selection
    if (isBatchMode || selectedIds.length > 0) {
      toggleSelection(t.id);
    } else {
      // Default: Tap to edit
      onEditTransaction(
        t.linkedTransaction &&
          t.transferDirection === "IN" &&
          t.linkedTransaction
          ? t.linkedTransaction
          : t,
      );
    }
  };

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const isSelected = prev.includes(id);
      const next = isSelected ? prev.filter((i) => i !== id) : [...prev, id];
      // Automatically enable/disable batch mode UI based on selection
      if (next.length > 0) setIsBatchMode(true);
      else setIsBatchMode(false);
      return next;
    });
  };

  const selectAll = () => {
    const filteredTxs = getFilteredTransactions();
    if (selectedIds.length === filteredTxs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTxs.map((t) => t.id));
      setIsBatchMode(true);
    }
  };

  const handleBatchDelete = async () => {
    if (
      window.confirm(
        `Delete ${selectedIds.length} transactions? This cannot be undone.`,
      )
    ) {
      await handleBatchTransactionDelete(selectedIds);
      setSelectedIds([]);
      setIsBatchMode(false);
    }
  };

  const handleBatchEditSubmit = async () => {
    await handleBatchTransactionEdit(selectedIds, batchUpdates);
    setSelectedIds([]);
    setShowBatchEditModal(false);
    setBatchUpdates({});
    setIsBatchMode(false);
  };

  const getFilteredTransactions = () => {
    return transactions.filter((t) => {
      const tDate = normalizeDate(t.date);
      if (startDate && tDate < startDate) return false;
      if (endDate && tDate > endDate) return false;
      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

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
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
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

  // Apply Pagination
  const paginatedTransactions = sortedTransactions.slice(0, visibleCount);

  // Group grouped transactions first, then by date
  const groupedList = groupTransactions(paginatedTransactions);

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

    return formatDateReadable(date);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6 sm:space-y-8 relative">
      {/* Back to Top Button */}
      {showBackToTop &&
        !isAssetPage &&
        !showBatchEditModal &&
        !showAddModal && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 sm:right-10 z-60 bg-indigo-600 text-white p-4 rounded-full shadow-2xl shadow-indigo-500/40 hover:scale-110 active:scale-95 transition-all animate-bounce"
          >
            <ArrowUpIcon className="w-6 h-6" />
          </button>
        )}

      {/* Sticky Header Section */}
      {!showBatchEditModal && !showAddModal && (
        <div className="sticky top-20 lg:top-4 z-60 -mx-4 px-4 py-2 sm:py-3 bg-background/80 backdrop-blur-md border-b sm:border-b-0 border-white/5 sm:bg-transparent sm:backdrop-blur-none transition-all">
          {/* Filters Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  showFilters || startDate || endDate
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-surface/40 text-gray-500 border border-white/5 hover:border-white/10"
                }`}
              >
                <FunnelIcon className="w-3.5 h-3.5" />
                Filter {startDate || endDate ? "(Active)" : ""}
              </button>

              <button
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  if (isBatchMode) setSelectedIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  isBatchMode
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : "bg-surface/40 text-gray-500 border border-white/5 hover:border-white/10"
                }`}
              >
                <CheckIcon className="w-3.5 h-3.5" />
                {isBatchMode ? "Exit Batch" : "Batch Actions"}
              </button>
            </div>

            <div className="hidden lg:block">
              <button
                onClick={onAddTransaction}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-3xl font-black tracking-tight shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                <PlusIcon className="w-5 h-5" />
                NEW TRANSACTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="relative z-55 bg-surface/40 backdrop-blur-md rounded-3xl p-6 border border-white/5 animate-slideDown">
          <div className="flex justify-between items-center mb-6">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
              Date Range Filter
            </p>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-[10px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-300"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                From Date
              </label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                To Date
              </label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && !showBatchEditModal && !showAddModal && (
        <div className="sticky top-20 lg:top-4 z-70 animate-fadeIn bg-indigo-600/70 backdrop-blur-xl shadow-2xl shadow-indigo-500/30 rounded-4xl p-3 sm:p-4 mb-8 flex items-center justify-between border border-white/20">
          <div className="flex items-center gap-3 pl-2 sm:pl-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-black text-sm sm:text-base">
              {selectedIds.length}
            </div>
            <p className="text-white font-black text-xs sm:text-sm uppercase tracking-widest hidden sm:block">
              Selected
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchEditModal(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all"
            >
              <PencilIcon className="w-4 h-4" />
              Batch Edit
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
            <div className="w-px h-8 bg-white/10 mx-1"></div>
            <button
              onClick={() => {
                setSelectedIds([]);
                setIsBatchMode(false);
              }}
              className="p-2 sm:p-3 text-white/50 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 sm:w-6 h-5 sm:h-6" />
            </button>
          </div>
        </div>
      )}

      {isBatchMode && !showBatchEditModal && !showAddModal && (
        <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-4 animate-slideDown">
          <button
            onClick={selectAll}
            className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors"
          >
            {selectedIds.length === filteredTransactions.length
              ? "Deselect All"
              : `Select All (${filteredTransactions.length})`}
          </button>
          <p className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">
            {selectedIds.length} of {filteredTransactions.length} selected
          </p>
        </div>
      )}

      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600 bg-surface/20 rounded-4xl border border-white/5 border-dashed">
          <FunnelIcon className="w-12 h-12 mb-4 opacity-20" />
          <p className="font-bold">No transactions match your filters.</p>
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="mt-4 text-xs font-black text-indigo-400 uppercase tracking-widest"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        sortedDates.map((dateStr) => (
          <div key={dateStr} className="animate-slideUp">
            <h3 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.2em] mb-4 pl-4 flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/40"></span>
              {formatDateHeader(dateStr)}
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {grouped[dateStr].map((t) => (
                <div
                  key={t.id}
                  className="relative overflow-hidden rounded-4xl group"
                >
                  {/* Backdrop Action Buttons (revealed on slide) */}
                  {swipedId === t.id && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 gap-2 animate-fadeIn">
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
                          setSwipedId(null);
                        }}
                        className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg border border-indigo-500/20 active:scale-95"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              "Delete this transaction? This cannot be undone.",
                            )
                          ) {
                            onDeleteTransaction(t.id);
                            setSwipedId(null);
                          }
                        }}
                        className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg border border-rose-500/20 active:scale-95"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwipedId(null);
                        }}
                        className="w-12 h-12 bg-white/10 text-gray-500 rounded-full flex items-center justify-center hover:bg-white/20 hover:text-white transition-all shadow-lg border border-white/10 active:scale-95"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* Transaction Content Layer */}
                  <div
                    onClick={() => handleItemClick(t)}
                    onPointerDown={(e) => handleItemPointerDown(e, t.id)}
                    onPointerMove={handleItemPointerMove}
                    onPointerUp={(e) => handleItemPointerUp(e, t.id)}
                    className={`relative flex items-center p-4 sm:p-5 bg-card rounded-4xl border transition-all cursor-pointer select-none active:scale-[0.99] shadow-xl touch-pan-y ${
                      swipedId === t.id
                        ? "-translate-x-48 sm:-translate-x-46"
                        : "translate-x-0"
                    } ${
                      selectedIds.includes(t.id)
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-white/5 hover:border-indigo-500/30"
                    }`}
                  >
                    {/* Selection Checkbox (Left) */}
                    {(isBatchMode || selectedIds.length > 0) && (
                      <div
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all ${
                          selectedIds.includes(t.id)
                            ? "bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/30"
                            : "border-white/10 group-hover:border-indigo-500/50"
                        }`}
                      >
                        {selectedIds.includes(t.id) && (
                          <CheckIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                      <div
                        className={`shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-md sm:text-lg transition-all duration-500 ${
                          t.linkedTransaction ||
                          t.type === TransactionType.TRANSFER
                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                            : selectedIds.includes(t.id)
                              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                              : "bg-surface border border-white/5"
                        }`}
                      >
                        {t.linkedTransaction ||
                        t.type === TransactionType.TRANSFER
                          ? "↔️"
                          : t.type === TransactionType.INCOME
                            ? "💰"
                            : getCategoryIcon(t.categoryId)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold sm:font-black text-white text-[17px] sm:text-lg tracking-tight truncate">
                            {t.linkedTransaction ||
                            t.type === TransactionType.TRANSFER ? (
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
                          {t.isSubsidized && (
                            <SparklesIcon className="w-4 h-4 text-indigo-400 shrink-0 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                          {t.time && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {t.time}
                            </span>
                          )}
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-700"></span>
                          {t.savingPocketId && (
                            <>
                              <div className="flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                                <SparklesIcon className="w-2.5 h-2.5 text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">
                                  {
                                    pockets.find(
                                      (p) => p.id === t.savingPocketId,
                                    )?.name
                                  }
                                </span>
                              </div>
                              <span className="w-0.5 h-0.5 rounded-full bg-gray-700"></span>
                            </>
                          )}
                          {(t.type === TransactionType.TRANSFER ||
                            t.linkedTransaction) &&
                            t.toSavingPocketId && (
                              <>
                                <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                                  <SparklesIcon className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tight">
                                    {
                                      pockets.find(
                                        (p) => p.id === t.toSavingPocketId,
                                      )?.name
                                    }
                                  </span>
                                </div>
                                <span className="w-0.5 h-0.5 rounded-full bg-gray-700"></span>
                              </>
                            )}
                          {t.linkedTransaction ||
                          t.type === TransactionType.TRANSFER ? (
                            <p className="text-[11px] sm:text-[11px] font-semibold sm:font-bold text-indigo-400/70 truncate uppercase tracking-wider">
                              {t.transferDirection === "IN"
                                ? "TRANSFER IN"
                                : t.transferDirection === "OUT"
                                  ? "TRANSFER OUT"
                                  : "INTERNAL TRANSFER"}
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

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 px-2">
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
                          {t.fee && t.fee > 0 && (
                            <span className="ml-1 text-rose-400/80">
                              (Fee: {t.fee.toFixed(2)})
                            </span>
                          )}
                        </span>
                        {t.isSubsidized && t.marketValue && (
                          <span className="text-[9px] text-indigo-400/80 font-bold italic mt-1">
                            Val:{" "}
                            {maskAmount(
                              t.marketValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }),
                            )}
                          </span>
                        )}
                      </div>

                      {/* Desktop/Laptop Action Toggle (Chevron) */}
                      {!isBatchMode && selectedIds.length === 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedId(swipedId === t.id ? null : t.id);
                          }}
                          className={`hidden lg:flex p-2 rounded-xl transition-all ${
                            swipedId === t.id
                              ? "bg-indigo-500 text-white"
                              : "text-gray-600 hover:bg-white/5 hover:text-gray-400"
                          }`}
                        >
                          <ChevronRightIcon
                            className={`w-5 h-5 transition-transform duration-300 ${
                              swipedId === t.id ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Pagination "Load More" */}
      {visibleCount < filteredTransactions.length && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setVisibleCount((prev) => prev + 30)}
            className="flex items-center gap-3 bg-surface/40 hover:bg-surface/60 text-gray-400 hover:text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all active:scale-95"
          >
            Show Older Transactions
            <ChevronRightIcon className="w-4 h-4 rotate-90" />
          </button>
        </div>
      )}

      {/* Batch Edit Modal */}
      <Modal
        isOpen={showBatchEditModal}
        onClose={() => {
          setShowBatchEditModal(false);
          setBatchUpdates({});
        }}
        title={`Batch Edit ${selectedIds.length} items`}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col max-h-[70vh]">
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 -mr-2">
            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                Note
              </p>
              <p className="text-gray-400 text-xs leading-relaxed">
                Batch editing is limited to non-financial fields to prevent
                accidental balance corruption. Amounts and accounts must be
                edited individually.
              </p>
            </div>

            <div className="space-y-4">
              {/* Title / Shop Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <PencilIcon className="w-3.5 h-3.5" /> Title
                </label>
                <input
                  type="text"
                  value={batchUpdates.shopName || ""}
                  onChange={(e) =>
                    setBatchUpdates((prev) => ({
                      ...prev,
                      shopName: e.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep unchanged"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <FunnelIcon className="w-3.5 h-3.5" /> Category
                </label>
                <select
                  value={batchUpdates.categoryId || "KEEP"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBatchUpdates((prev) => {
                      const next = { ...prev };
                      if (val === "KEEP") delete next.categoryId;
                      else next.categoryId = val;
                      return next;
                    });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value="KEEP" className="bg-surface">
                    — Keep Unchanged —
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-surface">
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5" /> Date
                </label>
                <DatePicker
                  value={batchUpdates.date || ""}
                  onChange={(date) =>
                    setBatchUpdates((prev) => ({ ...prev, date }))
                  }
                />
              </div>

              {/* Time */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <ClockIcon className="w-3.5 h-3.5" /> Time
                </label>
                <input
                  type="time"
                  value={batchUpdates.time || ""}
                  onChange={(e) =>
                    setBatchUpdates((prev) => ({
                      ...prev,
                      time: e.target.value,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
                />
              </div>

              {/* Spending Limit / Pot */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <InboxIcon className="w-3.5 h-3.5" /> Assign to Limit (Pot)
                </label>
                <select
                  value={
                    batchUpdates.potId === undefined
                      ? "KEEP"
                      : batchUpdates.potId === null
                        ? "REMOVE"
                        : batchUpdates.potId
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setBatchUpdates((prev) => {
                      const next = { ...prev };
                      if (val === "KEEP") delete next.potId;
                      else if (val === "REMOVE") next.potId = null as any;
                      else next.potId = val;
                      return next;
                    });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value="KEEP" className="bg-surface">
                    — Keep Unchanged —
                  </option>
                  <option value="REMOVE" className="bg-surface">
                    None (Remove from Pot)
                  </option>
                  {pots.map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Saving Pocket */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <SparklesIcon className="w-3.5 h-3.5" /> Assign to source
                    pocket
                  </label>
                  <select
                    value={
                      batchUpdates.savingPocketId === undefined
                        ? "KEEP"
                        : batchUpdates.savingPocketId === null
                          ? "REMOVE"
                          : batchUpdates.savingPocketId
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setBatchUpdates((prev) => {
                        const next = { ...prev };
                        if (val === "KEEP") delete next.savingPocketId;
                        else if (val === "REMOVE")
                          next.savingPocketId = null as any;
                        else next.savingPocketId = val;
                        return next;
                      });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                  >
                    <option value="KEEP" className="bg-surface">
                      — Keep Unchanged —
                    </option>
                    <option value="REMOVE" className="bg-surface">
                      None (Remove from Pocket)
                    </option>
                    {pockets.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface">
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <SparklesIcon className="w-3.5 h-3.5 text-emerald-400" />{" "}
                    Assign to destination pocket
                  </label>
                  <select
                    value={
                      batchUpdates.toSavingPocketId === undefined
                        ? "KEEP"
                        : batchUpdates.toSavingPocketId === null
                          ? "REMOVE"
                          : batchUpdates.toSavingPocketId
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setBatchUpdates((prev) => {
                        const next = { ...prev };
                        if (val === "KEEP") delete next.toSavingPocketId;
                        else if (val === "REMOVE")
                          next.toSavingPocketId = null as any;
                        else next.toSavingPocketId = val;
                        return next;
                      });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                  >
                    <option value="KEEP" className="bg-surface">
                      — Keep Unchanged —
                    </option>
                    <option value="REMOVE" className="bg-surface">
                      None (Remove from Pocket)
                    </option>
                    {pockets.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface">
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-6 border-t border-white/5 bg-surface mt-2">
            <button
              onClick={() => {
                setShowBatchEditModal(false);
                setBatchUpdates({});
              }}
              className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-400 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchEditSubmit}
              disabled={Object.keys(batchUpdates).length === 0}
              className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-xl shadow-indigo-500/20"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default History;
