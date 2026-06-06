import React from "react";
import {
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ChevronRightIcon,
  CheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";
import { TransactionType, Account, SavingPocket, Category } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";
import { cn } from "./cn";

interface Props {
  transaction: GroupedTransaction;
  swipedId: string | null;
  isSelected: boolean;
  showSelection: boolean;
  isBatchMode: boolean;
  accounts: Account[];
  pockets: SavingPocket[];
  categories: Category[];
  maskAmount: (amount: number | string, currency?: string, isSensitive?: boolean) => React.ReactNode;
  maskText: (text: string, isSensitive?: boolean, permanentMask?: boolean) => React.ReactNode;
  onSwipeEdit: () => void;
  onSwipeDelete: () => void;
  onSwipeClose: () => void;
  onClick: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onChevronClick: (e: React.MouseEvent) => void;
}

type MaskText = (s: string) => string | React.ReactNode;

const isTransferTx = (t: GroupedTransaction): boolean =>
  !!t.linkedTransaction || t.type === TransactionType.TRANSFER;

const isIncomeTx = (t: GroupedTransaction): boolean =>
  t.type === TransactionType.INCOME ||
  t.type === TransactionType.ACCOUNT_OPENING ||
  (t.type === TransactionType.TRANSFER && t.transferDirection === "IN") ||
  (t.type === TransactionType.ADJUSTMENT && t.amount >= 0);

const getCategoryIconFor = (categories: Category[], catId?: string): string => {
  const cat = categories.find((c) => c.id === catId);
  return cat ? cat.icon : "📄";
};

const getAmountPrefix = (t: GroupedTransaction, isIncome: boolean): string => {
  if (t.linkedTransaction) return "";
  return isIncome ? "+" : "-";
};

const getAmountColor = (t: GroupedTransaction, isIncome: boolean): string => {
  if (t.linkedTransaction) return "text-indigo-400";
  if (isIncome) return "text-emerald-400";
  return "text-rose-400";
};

const getDisplayName = (
  t: GroupedTransaction,
  isTransfer: boolean,
  accounts: Account[],
  maskText: MaskText,
): React.ReactNode => {
  if (isTransfer) {
    if (t.shopName) return maskText(t.shopName);
    const sourceId = t.transferDirection === "IN" ? t.toAccountId : t.accountId;
    const destId = t.transferDirection === "IN" ? t.accountId : t.toAccountId;
    const sourceAccount = accounts.find((a) => a.id === sourceId);
    const destAccount = accounts.find((a) => a.id === destId);
    return (
      <>
        {maskText(sourceAccount?.name || "???")} → {maskText(destAccount?.name || "???")}
      </>
    );
  }
  return maskText(t.shopName || "UNTITLED");
};

const getSubtitleLabel = (
  t: GroupedTransaction,
  isTransfer: boolean,
  categories: Category[],
): string => {
  if (isTransfer) {
    if (t.linkedTransaction) return "TRANSFER";
    if (t.transferDirection === "IN") return "TRANSFER IN";
    if (t.transferDirection === "OUT") return "TRANSFER OUT";
    return "INTERNAL TRANSFER";
  }
  return (
    categories.find((c) => c.id === t.categoryId)?.name ||
    (t.type === TransactionType.ACCOUNT_OPENING ? "OPENING BALANCE" : t.type)
  );
};

const TransactionItem: React.FC<Props> = ({
  transaction: t,
  swipedId,
  isSelected,
  showSelection,
  isBatchMode,
  accounts,
  pockets,
  categories,
  maskAmount,
  maskText,
  onSwipeEdit,
  onSwipeDelete,
  onSwipeClose,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onChevronClick,
}) => {
  const isSwiped = swipedId === t.id;
  const isTransfer = isTransferTx(t);
  const isIncome = isIncomeTx(t);
  const isExpense = t.type === TransactionType.EXPENSE;

  return (
    <div className="relative overflow-hidden rounded-4xl group">
      {isSwiped && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 gap-2 animate-fadeIn">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwipeEdit();
            }}
            className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg border border-indigo-500/20 active:scale-95"
            aria-label="Edit transaction"
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwipeDelete();
            }}
            className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg border border-rose-500/20 active:scale-95"
            aria-label="Delete transaction"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSwipeClose();
            }}
            className="w-12 h-12 bg-white/10 text-gray-500 rounded-full flex items-center justify-center hover:bg-white/20 hover:text-white transition-all shadow-lg border border-white/10 active:scale-95"
            aria-label="Close actions"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <div
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "relative flex items-center p-4 sm:p-5 bg-card rounded-4xl border transition-all cursor-pointer select-none active:scale-[0.99] shadow-xl touch-pan-y",
          isSwiped ? "-translate-x-48 sm:-translate-x-46" : "translate-x-0",
          isSelected
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-white/5 hover:border-indigo-500/30",
        )}
      >
        {(showSelection) && (
          <div
            className={cn(
              "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all",
              isSelected
                ? "bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/30"
                : "border-white/10 group-hover:border-indigo-500/50",
            )}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={-1}
          >
            {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
          </div>
        )}

        <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
          <div
            className={cn(
              "shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-md sm:text-lg transition-all duration-500",
              isTransfer || isSelected
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                : "bg-surface border border-white/5",
            )}
          >
            {isTransfer
              ? "↔️"
              : t.type === TransactionType.INCOME
                ? "💰"
                : getCategoryIconFor(categories, t.categoryId)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-extrabold sm:font-black text-white text-[17px] sm:text-lg tracking-tight truncate">
                {getDisplayName(t, isTransfer, accounts, maskText)}
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
              <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />

              {t.isHistorical && !t.linkedTransaction && (
                <>
                  <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Hist.
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />
                </>
              )}

              {t.linkedTransaction && (
                <>
                  {t.isHistorical && (
                    <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.2 py-0.3 rounded-sm uppercase tracking-tighter">
                      Src Hist.
                    </span>
                  )}
                  {t.linkedTransaction.isHistorical && (
                    <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.2 py-0.3 rounded-sm uppercase tracking-tighter">
                      Dest Hist.
                    </span>
                  )}
                  {(t.isHistorical || t.linkedTransaction.isHistorical) && (
                    <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />
                  )}
                </>
              )}

              {t.savingPocketId && (
                <>
                  <div className="flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                    <SparklesIcon className="w-2.5 h-2.5 text-indigo-400" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">
                      {pockets.find((p) => p.id === t.savingPocketId)?.name}
                    </span>
                  </div>
                  <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />
                </>
              )}

              {isTransfer && t.toSavingPocketId && (
                <>
                  <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                    <SparklesIcon className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tight">
                      {pockets.find((p) => p.id === t.toSavingPocketId)?.name}
                    </span>
                  </div>
                  <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />
                </>
              )}

              <p
                className={cn(
                  "text-[11px] sm:text-[11px] font-semibold sm:font-bold truncate uppercase tracking-[0.05em]",
                  isTransfer ? "text-indigo-400/70 tracking-wider" : "text-gray-500/70",
                )}
              >
                {getSubtitleLabel(t, isTransfer, categories)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0 px-2">
          <div className="flex flex-col items-end">
            <span className={cn("font-black text-xl sm:text-xl tracking-tighter", getAmountColor(t, isIncome))}>
              {getAmountPrefix(t, isIncome)}
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
                <span className="ml-1 text-rose-400/80">(Fee: {t.fee.toFixed(2)})</span>
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

          {!isBatchMode && !showSelection && (
            <button
              onClick={onChevronClick}
              className="hidden lg:flex p-2 rounded-xl transition-all"
              aria-label={isSwiped ? "Close actions" : "Open actions"}
            >
              <ChevronRightIcon
                className={cn(
                  "w-5 h-5 transition-transform duration-300",
                  isSwiped ? "rotate-180 text-white bg-indigo-500 rounded-xl" : "text-gray-600",
                )}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
