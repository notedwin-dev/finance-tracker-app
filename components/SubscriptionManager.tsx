import React, { useState } from "react";
import {
  Account,
  Category,
  Subscription,
  SubscriptionFrequency,
} from "../types";
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

interface Props {
  subscriptions: Subscription[];
  accounts: Account[];
  categories: Category[];
  onAdd: (sub: Omit<Subscription, "userId">) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const SubscriptionManager: React.FC<Props> = ({
  subscriptions,
  accounts,
  categories,
  onAdd,
  onDelete,
  onClose,
}) => {
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [frequency, setFrequency] = useState<SubscriptionFrequency>("MONTHLY");
  const [nextPaymentDate, setNextPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !amount || !accountId || !categoryId) return;

    const acc = accounts.find((a) => a.id === accountId);

    const newSub: Omit<Subscription, "userId"> = {
      id: crypto.randomUUID(),
      name,
      amount: parseFloat(amount),
      currency: acc?.currency || "MYR",
      accountId,
      categoryId,
      frequency,
      nextPaymentDate,
      active: true,
    };

    onAdd(newSub);
    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setAmount("");
    setNextPaymentDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-card rounded-t-3xl sm:rounded-2xl border-t sm:border border-gray-700 shadow-2xl flex flex-col h-[90vh] sm:h-auto max-h-[90vh] overflow-hidden animate-slideUp sm:animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-700 flex justify-between items-center bg-surface shrink-0">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Subscriptions
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 font-medium">
              Manage recurring payments that auto-deduct
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">
          {/* Add New Button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border-2 border-dashed border-gray-700/50 rounded-2xl text-gray-500 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 font-bold text-sm"
            >
              <PlusIcon className="w-5 h-5" />
              Add New Subscription
            </button>
          )}

          {/* Add Form */}
          {isAdding && (
            <form
              onSubmit={handleSubmit}
              className="bg-surface/50 p-4 sm:p-5 rounded-2xl border border-gray-700 space-y-5 animate-slideDown"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Netflix, Spotify..."
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Deduct From
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none appearance-none font-medium"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none appearance-none font-medium"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon && cat.icon + " "}
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as SubscriptionFrequency)
                    }
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none appearance-none font-medium"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Next Payment
                  </label>
                  <input
                    type="date"
                    required
                    value={nextPaymentDate}
                    onChange={(e) => setNextPaymentDate(e.target.value)}
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98] text-sm"
                >
                  Save Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-6 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-3">
            {subscriptions.length === 0 && !isAdding && (
              <div className="text-center py-12 bg-surface/30 rounded-3xl border border-dashed border-gray-800">
                <p className="text-sm text-gray-500 font-medium">
                  No active subscriptions found.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {subscriptions.map((sub) => {
                const accountName =
                  accounts.find((a) => a.id === sub.accountId)?.name ||
                  "Unknown";
                const category = categories.find(
                  (c) => c.id === sub.categoryId,
                );

                return (
                  <div
                    key={sub.id}
                    className="bg-surface/50 p-4 rounded-2xl border border-gray-700/50 hover:border-gray-600 transition-all flex justify-between items-center group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-xl sm:text-2xl ${category?.color || "bg-indigo-500"} bg-opacity-20 shrink-0 shadow-inner`}
                      >
                        {category?.icon || "📅"}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">
                          {sub.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate mt-0.5">
                          {sub.frequency} • Next: {sub.nextPaymentDate}
                        </p>
                        <p className="text-[10px] text-primary/80 font-bold uppercase tracking-tighter mt-1">
                          FROM {accountName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0 pl-2">
                      <span className="font-mono font-black text-white text-base sm:text-lg">
                        {sub.currency === "MYR" ? "RM" : "$"}{" "}
                        {sub.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <button
                        onClick={() => onDelete(sub.id)}
                        className="p-1 sm:p-2 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <TrashIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
