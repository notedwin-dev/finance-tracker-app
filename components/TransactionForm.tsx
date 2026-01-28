import React, { useState, useEffect } from "react";
import {
  Account,
  Category,
  TransactionType,
  Transaction,
  Currency,
  Pot,
} from "../types";
import {
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";

interface Props {
  accounts: Account[];
  categories: Category[];
  pots?: Pot[];
  initialTransaction?: Transaction;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, "id" | "userId">) => void;
  onManageCategories: () => void;
}

const TransactionForm: React.FC<Props> = ({
  accounts,
  categories,
  pots = [],
  initialTransaction,
  onClose,
  onSubmit,
  onManageCategories,
}) => {
  const [type, setType] = useState<TransactionType>(
    initialTransaction ? initialTransaction.type : TransactionType.EXPENSE,
  );
  const [amount, setAmount] = useState(
    initialTransaction ? initialTransaction.amount.toFixed(2) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    initialTransaction ? initialTransaction.currency : "MYR",
  );
  const [accountId, setAccountId] = useState(
    initialTransaction ? initialTransaction.accountId : accounts[0]?.id || "",
  );
  const [potId, setPotId] = useState(
    initialTransaction ? initialTransaction.potId || "" : "",
  );
  const [toAccountId, setToAccountId] = useState(
    initialTransaction
      ? initialTransaction.toAccountId || ""
      : accounts.length > 1
        ? accounts[1].id
        : "",
  );
  const [categoryId, setCategoryId] = useState(
    initialTransaction
      ? initialTransaction.categoryId || ""
      : categories[0]?.id || "",
  );
  const [shopName, setShopName] = useState(
    initialTransaction ? initialTransaction.shopName : "",
  );
  const [date, setDate] = useState(
    initialTransaction
      ? initialTransaction.date
      : new Date().toISOString().split("T")[0],
  );
  const [time, setTime] = useState(
    initialTransaction ? initialTransaction.time || "" : "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-decimal with manual "." support
  const handleAmountChange = (val: string) => {
    if (!val) {
      setAmount("");
      return;
    }

    // 1. Handle Dot Promotion (e.g., "4.50" + "." -> "450.")
    if (val.endsWith(".") && !amount.endsWith(".")) {
      const d = amount.replace(/\D/g, "");
      setAmount(parseInt(d || "0", 10).toString() + ".");
      return;
    }

    // 2. Manual Decimal Entry (e.g., "450." + "2" -> "450.2")
    if (amount.endsWith(".") || amount.match(/\.\d$/)) {
      const parts = amount.split(".");
      const newChar = val.length > amount.length ? val.slice(-1) : "";

      if (/\d/.test(newChar)) {
        if (parts[1] === "") {
          setAmount(parts[0] + "." + newChar);
          return;
        }
        if (parts[1].length === 1) {
          setAmount(parts[0] + "." + parts[1] + newChar);
          return;
        }
      }
    }

    // 3. Default Shifting Logic (Calculator style)
    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setAmount("");
      return;
    }

    const cents = parseInt(digits, 10);
    setAmount((cents / 100).toFixed(2));
  };
  // Update currency based on selected account
  useEffect(() => {
    if (!initialTransaction) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc) setCurrency(acc.currency);
    }
  }, [accountId, accounts, initialTransaction]);

  const filteredPots = pots.filter((p) => p.accountId === accountId);
  const selectedPot = filteredPots.find((p) => p.id === potId);
  const isPotLow =
    selectedPot &&
    (selectedPot.currentAmount <= 0 ||
      selectedPot.currentAmount / selectedPot.targetAmount <= 0.1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setValidationError(null);

    const missingFields: string[] = [];
    if (!amount || parseFloat(amount) <= 0) missingFields.push("Amount");
    if (!accountId) missingFields.push("Account");
    if (type === TransactionType.TRANSFER && !toAccountId)
      missingFields.push("To Account");
    if (
      (type === TransactionType.EXPENSE || type === TransactionType.INCOME) &&
      !categoryId
    )
      missingFields.push("Category");
    if (!date) missingFields.push("Date");

    if (missingFields.length > 0) {
      setValidationError(
        `Missing required fields: ${missingFields.join(", ")}`,
      );
      return;
    }

    if (type === TransactionType.TRANSFER && accountId === toAccountId) {
      setValidationError("Source and Destination accounts cannot be the same");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        accountId,
        potId: potId || undefined,
        toAccountId:
          type === TransactionType.TRANSFER ? toAccountId : undefined,
        amount: Math.abs(parseFloat(amount)),
        currency,
        type,
        categoryId:
          type === TransactionType.EXPENSE || type === TransactionType.INCOME
            ? categoryId
            : undefined,
        shopName,
        date,
        time: time || undefined,
        createdAt: initialTransaction?.createdAt || Date.now(),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 md:p-6">
      <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-700 bg-surface">
          <h2 className="text-base sm:text-lg font-bold text-white">
            {initialTransaction ? "Edit Transaction" : "New Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {!initialTransaction && (
          <div className="p-1.5 flex gap-1 bg-surface m-3 sm:m-4 rounded-xl border border-gray-800">
            {[
              TransactionType.EXPENSE,
              TransactionType.INCOME,
              TransactionType.TRANSFER,
            ].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                  type === t
                    ? "bg-primary text-white shadow"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar pb-10 sm:pb-5"
        >
          {/* Amount & Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Amount
            </label>
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="bg-surface border border-gray-700 rounded-xl px-2 sm:px-3 text-white text-sm sm:text-base font-bold focus:outline-none shrink-0"
              >
                <option value="MYR">MYR</option>
                <option value="USD">USD</option>
              </select>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="flex-1 min-w-0 bg-surface border border-gray-700 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-white text-lg sm:text-xl font-bold focus:outline-none focus:border-primary"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {type === TransactionType.EXPENSE
                  ? "Deduct From"
                  : type === TransactionType.INCOME
                    ? "Deposit To"
                    : type === TransactionType.TRANSFER
                      ? "From"
                      : "Account"}
              </label>
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setPotId("");
                }}
                className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Pot Selection (Only if account has pots) */}
            {filteredPots.length > 0 && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-medium text-gray-400 mb-1 flex justify-between">
                  <span>Saving Pot (Optional)</span>
                  {selectedPot && (
                    <span className="text-secondary text-[10px] font-bold">
                      BAL: {currency === "MYR" ? "RM" : "$"}{" "}
                      {selectedPot.currentAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={potId}
                    onChange={(e) => setPotId(e.target.value)}
                    className={`w-full bg-surface border rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors ${
                      isPotLow ? "border-amber-500/50" : "border-gray-700"
                    }`}
                  >
                    <option value="">No Pot (Direct from Account)</option>
                    {filteredPots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                {isPotLow && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <ExclamationTriangleIcon className="w-3 h-3 flex-shrink-0" />
                    <span>
                      Low pot balance (
                      {selectedPot?.currentAmount <= 0
                        ? "Empty"
                        : "Less than 10% left"}
                      )
                    </span>
                  </div>
                )}
              </div>
            )}

            {type === TransactionType.TRANSFER && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  To
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none"
                >
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Category Selection (Expense & Income) */}
          {(type === TransactionType.EXPENSE ||
            type === TransactionType.INCOME) && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-gray-400">
                  Category
                </label>
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="text-[10px] text-primary hover:text-white font-bold flex items-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" /> Manage
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square sm:aspect-auto sm:min-h-[60px] ${
                      categoryId === cat.id
                        ? "bg-primary text-white border-primary"
                        : "bg-surface border-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <span className="text-xl sm:text-lg">{cat.icon}</span>
                    <span className="text-[8px] sm:text-[9px] font-medium truncate w-full text-center mt-1">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              {type === TransactionType.TRANSFER ? "Reference" : "Description"}
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
              placeholder={
                type === TransactionType.EXPENSE
                  ? "e.g., Starbucks"
                  : type === TransactionType.TRANSFER
                    ? "e.g., Monthly Rent"
                    : "e.g., Paycheck"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Time (Optional)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-800 bg-surface">
          {validationError && (
            <p className="text-red-500 text-xs text-center font-medium mb-3 bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {validationError}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] ${
              isSubmitting
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-primary hover:bg-primaryDark shadow-indigo-900/20"
            }`}
          >
            {isSubmitting ? "Saving..." : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;
