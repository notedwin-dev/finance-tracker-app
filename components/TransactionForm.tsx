import React, { useState, useEffect } from "react";
import {
  Account,
  Category,
  TransactionType,
  Transaction,
  Currency,
  Pot,
  SavingPocket,
  AmountBreakdownItem,
  Subscription,
  SubscriptionFrequency,
} from "../types";
import {
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon as TrashIconOutline,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/24/solid";
import DatePicker from "./DatePicker";

interface Props {
  accounts: Account[];
  categories: Category[];
  pots?: Pot[];
  pockets?: SavingPocket[];
  subscriptions?: Subscription[];
  initialTransaction?: Transaction;
  onClose: () => void;
  onSubmit: (
    transaction: Omit<Transaction, "userId">,
    newSubscription?: Omit<Subscription, "userId" | "id">,
  ) => void;
  onManageCategories: () => void;
}

const TransactionForm: React.FC<Props> = ({
  accounts,
  categories,
  pots = [],
  pockets = [],
  subscriptions = [],
  initialTransaction,
  onClose,
  onSubmit,
  onManageCategories,
}) => {
  const [type, setType] = useState<TransactionType>(
    initialTransaction ? initialTransaction.type : TransactionType.EXPENSE,
  );
  const [amount, setAmount] = useState(
    initialTransaction
      ? typeof initialTransaction.amount === "number"
        ? initialTransaction.amount.toFixed(2)
        : String(initialTransaction.amount || "0.00")
      : "",
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
  const [savingPocketId, setSavingPocketId] = useState(
    initialTransaction ? initialTransaction.savingPocketId || "" : "",
  );
  const [subscriptionId, setSubscriptionId] = useState(
    initialTransaction ? initialTransaction.subscriptionId || "" : "",
  );
  const [isSubscription, setIsSubscription] = useState(false);
  const [frequency, setFrequency] = useState<SubscriptionFrequency>("MONTHLY");

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
      : new Date().toLocaleDateString("en-CA"),
  );
  const [time, setTime] = useState(
    initialTransaction ? initialTransaction.time || "" : "",
  );
  const [breakdownEnabled, setBreakdownEnabled] = useState(
    Array.isArray(initialTransaction?.amountBreakdown) &&
      initialTransaction.amountBreakdown.length > 0
      ? true
      : false,
  );
  const [breakdownItems, setBreakdownItems] = useState<any[]>(
    Array.isArray(initialTransaction?.amountBreakdown)
      ? initialTransaction.amountBreakdown.map((item) => ({
          ...item,
          amount:
            typeof item.amount === "number"
              ? item.amount.toFixed(2)
              : String(item.amount || "0.00"),
        }))
      : [],
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reusable Calculator-style decimal logic
  const formatCalculatorAmount = (val: string, currentVal: string) => {
    if (!val) return "";

    const cleanCurrent = String(currentVal || "");

    // 1. Handle Dot Promotion (e.g., "4.50" + "." -> "450.")
    if (val.endsWith(".") && !cleanCurrent.endsWith(".")) {
      const d = cleanCurrent.replace(/\D/g, "");
      return parseInt(d || "0", 10).toString() + ".";
    }

    // 2. Manual Decimal Entry (e.g., "450." + "2" -> "450.2")
    if (cleanCurrent.endsWith(".") || cleanCurrent.match(/\.\d$/)) {
      const parts = cleanCurrent.split(".");
      const newChar = val.length > cleanCurrent.length ? val.slice(-1) : "";

      if (/\d/.test(newChar)) {
        if (parts[1] === "") {
          return parts[0] + "." + newChar;
        }
        if (parts[1].length === 1) {
          return parts[0] + "." + parts[1] + newChar;
        }
      }
    }

    // 3. Default Shifting Logic (Calculator style)
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";

    const cents = parseInt(digits, 10);
    return (cents / 100).toFixed(2);
  };

  // Auto-decimal with manual "." support
  const handleAmountChange = (val: string) => {
    setAmount(formatCalculatorAmount(val, amount));
  };
  // Update currency based on selected account
  useEffect(() => {
    if (!initialTransaction) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc) setCurrency(acc.currency);
    }
  }, [accountId, accounts, initialTransaction]);

  const addBreakdownItem = () => {
    setBreakdownItems([
      ...breakdownItems,
      { id: crypto.randomUUID(), description: "", amount: "" },
    ]);
  };

  const removeBreakdownItem = (id: string) => {
    setBreakdownItems(breakdownItems.filter((i) => i.id !== id));
  };

  const updateBreakdownItem = (
    id: string,
    field: keyof AmountBreakdownItem,
    value: any,
  ) => {
    setBreakdownItems(
      breakdownItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  const filteredPots = pots.filter((p) => p.accountId === accountId);
  const selectedPot = filteredPots.find((p) => p.id === potId);
  const isPotLow =
    selectedPot &&
    (selectedPot.amountLeft <= 0 ||
      selectedPot.amountLeft / selectedPot.limitAmount <= 0.1);

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

    if (breakdownEnabled) {
      const breakdownTotal = breakdownItems.reduce(
        (sum, item) => sum + (parseFloat(item.amount) || 0),
        0,
      );
      if (breakdownTotal > parseFloat(amount)) {
        setValidationError(
          `Breakdown total (${breakdownTotal.toFixed(2)}) exceeds total amount (${parseFloat(amount).toFixed(2)})`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const txData: Omit<Transaction, "userId"> = {
        id: initialTransaction?.id || crypto.randomUUID(),
        accountId,
        potId: potId || undefined,
        savingPocketId: savingPocketId || undefined,
        subscriptionId: subscriptionId || undefined,
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
        amountBreakdown:
          breakdownEnabled && breakdownItems.length > 0
            ? breakdownItems.map((item) => ({
                ...item,
                amount: parseFloat(item.amount) || 0,
              }))
            : undefined,
        createdAt: initialTransaction?.createdAt || Date.now(),
      };

      const newSubData = isSubscription
        ? {
            name: shopName || "New Subscription",
            amount: Math.abs(parseFloat(amount)),
            currency,
            accountId,
            categoryId,
            frequency,
            nextPaymentDate: date, // Will be updated by DataProvider logic
            active: true,
          }
        : undefined;

      await onSubmit(txData, newSubData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 md:p-6">
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
                type="button"
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
          {/* Transaction Type Dropdown (Edit Mode Only) */}
          {initialTransaction && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Transaction Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none font-bold"
              >
                {[
                  TransactionType.EXPENSE,
                  TransactionType.INCOME,
                  TransactionType.TRANSFER,
                  TransactionType.ADJUSTMENT,
                  TransactionType.ACCOUNT_OPENING,
                ].map((t) => (
                  <option key={t} value={t} className="bg-surface">
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          )}

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
                <label className="text-xs font-medium text-gray-400 mb-1 flex justify-between">
                  <span>Spending Limit / Pot (Optional)</span>
                  {selectedPot && (
                    <span className="text-secondary text-[10px] font-bold">
                      AVAILABLE: {currency === "MYR" ? "RM" : "$"}{" "}
                      {selectedPot.amountLeft.toLocaleString(undefined, {
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
                    <option value="">No Limit / Pot</option>
                    {filteredPots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icon} {p.name} ({currency === "MYR" ? "RM" : "$"}
                        {p.amountLeft.toLocaleString()} left)
                      </option>
                    ))}
                  </select>
                </div>
                {isPotLow && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <ExclamationTriangleIcon className="w-3 h-3 shrink-0" />
                    <span>
                      Limit almost reached (
                      {selectedPot?.amountLeft <= 0
                        ? "Exceeded"
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
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square sm:aspect-auto sm:min-h-15 ${
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

          {/* Subscription Linking */}
          {type === TransactionType.EXPENSE && (
            <div className="space-y-3 bg-white/5 p-3 rounded-2xl border border-gray-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Subscription
                </label>
                {!subscriptionId && (
                  <button
                    type="button"
                    onClick={() => setIsSubscription(!isSubscription)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                      isSubscription
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-gray-500 border border-gray-800"
                    }`}
                  >
                    {isSubscription ? "CREATE NEW" : "SET AS REPEATING"}
                  </button>
                )}
              </div>

              {isSubscription && !subscriptionId && (
                <div className="animate-fadeIn space-y-3">
                  <div className="flex gap-2">
                    {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map(
                      (f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFrequency(f)}
                          className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border transition-all ${
                            frequency === f
                              ? "bg-primary border-primary text-white"
                              : "bg-surface border-gray-700 text-gray-400"
                          }`}
                        >
                          {f}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 italic">
                    This will create a new subscription starting from {date}.
                  </p>
                </div>
              )}

              {subscriptions.length > 0 && !isSubscription && (
                <div className="relative">
                  <select
                    value={subscriptionId}
                    onChange={(e) => {
                      const subId = e.target.value;
                      setSubscriptionId(subId);
                      if (subId) {
                        const sub = subscriptions.find((s) => s.id === subId);
                        if (sub) {
                          setCategoryId(sub.categoryId);
                          setAmount(
                            typeof sub.amount === "number"
                              ? sub.amount.toFixed(2)
                              : String(sub.amount || "0.00"),
                          );
                          setCurrency(sub.currency);
                          if (!shopName) setShopName(sub.name);
                        }
                      }
                    }}
                    className="w-full bg-surface border border-gray-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary appearance-none"
                  >
                    <option value="">Link existing subscription...</option>
                    {subscriptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.currency} {sub.amount.toLocaleString()}
                        ) - {sub.frequency}
                      </option>
                    ))}
                  </select>
                  {subscriptionId && (
                    <button
                      type="button"
                      onClick={() => setSubscriptionId("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
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
              <DatePicker value={date} onChange={setDate} />
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

          {/* Amount Breakdown Section */}
          <div className="border-t border-gray-800 pt-5">
            <button
              type="button"
              onClick={() => setBreakdownEnabled(!breakdownEnabled)}
              className="flex items-center justify-between w-full text-xs font-bold text-gray-400 mb-3 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <PlusIcon className="w-3 h-3" />
                Add Amount Breakdown
              </span>
              {breakdownEnabled ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>

            {breakdownEnabled && (
              <div className="space-y-3 animate-fadeIn mb-4">
                {breakdownItems.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center group">
                    <input
                      type="text"
                      placeholder="e.g., Burger"
                      value={item.description}
                      onChange={(e) =>
                        updateBreakdownItem(
                          item.id,
                          "description",
                          e.target.value,
                        )
                      }
                      className="flex-1 min-w-0 bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary transition-all"
                    />
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateBreakdownItem(
                            item.id,
                            "amount",
                            formatCalculatorAmount(e.target.value, item.amount),
                          )
                        }
                        className="w-full bg-gray-900/50 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-primary text-right font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBreakdownItem(item.id)}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <TrashIconOutline className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addBreakdownItem}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <PlusIcon className="w-3 h-3" /> Add Item
                </button>

                {breakdownItems.length > 0 && (
                  <div className="flex justify-between items-center px-3 py-3 bg-gray-900/40 rounded-xl border border-gray-800">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
                        Allocated
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {currency === "MYR" ? "RM" : "$"}{" "}
                        {breakdownItems
                          .reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
                          .toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                      </span>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">
                        Remaining
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          parseFloat(amount || "0") -
                            breakdownItems.reduce(
                              (s, i) => s + (parseFloat(i.amount) || 0),
                              0,
                            ) <
                          0
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {currency === "MYR" ? "RM" : "$"}{" "}
                        {(
                          parseFloat(amount || "0") -
                          breakdownItems.reduce(
                            (s, i) => s + (parseFloat(i.amount) || 0),
                            0,
                          )
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saving Pocket (Available for Expense & Income) */}
            {(type === TransactionType.EXPENSE ||
              type === TransactionType.INCOME) &&
              pockets.length > 0 && (
                <div className="animate-fadeIn">
                  <label className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-2">
                    <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Saving Pocket (Optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={savingPocketId}
                      onChange={(e) => setSavingPocketId(e.target.value)}
                      className="w-full bg-surface border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary appearance-none transition-colors"
                    >
                      <option value="">No Pocket Linked</option>
                      {pockets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.icon} {p.name} ({p.currency}{" "}
                          {p.currentAmount.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  {type === TransactionType.EXPENSE && savingPocketId && (
                    <p className="mt-1 text-[9px] text-gray-500 italic">
                      This will deduct from the pocket balance.
                    </p>
                  )}
                  {type === TransactionType.INCOME && savingPocketId && (
                    <p className="mt-1 text-[9px] text-indigo-400 font-medium italic">
                      This will add to your pocket savings!
                    </p>
                  )}
                </div>
              )}
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
            className={`w-full text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              isSubmitting
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-primary hover:bg-primaryDark shadow-indigo-900/20"
            }`}
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isSubmitting ? "Processing..." : "Save Record"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;
