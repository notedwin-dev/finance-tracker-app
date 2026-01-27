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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-card rounded-3xl border border-gray-800 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-surface">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CalendarDaysIcon className="w-6 h-6 text-primary" />
              Subscriptions
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Manage recurring payments that auto-deduct
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Add New Button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 font-bold"
            >
              <PlusIcon className="w-5 h-5" />
              Add New Subscription
            </button>
          )}

          {/* Add Form */}
          {isAdding && (
            <form
              onSubmit={handleSubmit}
              className="bg-surface p-5 rounded-2xl border border-gray-700 space-y-4 animate-slideDown"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Netflix, Spotify..."
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Deduct From
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as SubscriptionFrequency)
                    }
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase">
                    Next Payment
                  </label>
                  <input
                    type="date"
                    required
                    value={nextPaymentDate}
                    onChange={(e) => setNextPaymentDate(e.target.value)}
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary outline-none mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primaryDark text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Save Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-3">
            {subscriptions.length === 0 && !isAdding && (
              <p className="text-center text-gray-500 py-8">
                No active subscriptions found.
              </p>
            )}
            {subscriptions.map((sub) => {
              const accountName =
                accounts.find((a) => a.id === sub.accountId)?.name || "Unknown";
              const category = categories.find((c) => c.id === sub.categoryId);

              return (
                <div
                  key={sub.id}
                  className="bg-surface p-4 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg">
                      {category?.icon || "📅"}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{sub.name}</h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        {sub.frequency} • Next: {sub.nextPaymentDate} • From{" "}
                        {accountName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-white text-lg">
                      {sub.currency === "MYR" ? "RM" : "$"}
                      {sub.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => onDelete(sub.id)}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
