import React, { useState } from "react";
import { Category, Transaction, TransactionType } from "../types";
import { PencilIcon, CheckIcon } from "@heroicons/react/24/outline";
import { normalizeDate } from "../helpers/transactions.helper";

interface Props {
  categories: Category[];
  transactions: Transaction[];
  onUpdateCategory: (category: Category) => void;
}

const Budgets: React.FC<Props> = ({
  categories,
  transactions,
  onUpdateCategory,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempLimit, setTempLimit] = useState("");

  // Calculate spending per category for current month
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  const getSpent = (catId: string) => {
    return transactions
      .filter(
        (t) =>
          t.type === TransactionType.EXPENSE &&
          t.categoryId === catId &&
          normalizeDate(t.date).startsWith(currentMonthStr),
      )
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setTempLimit(cat.budgetLimit.toString());
  };

  const saveEdit = (cat: Category) => {
    const limit = parseFloat(tempLimit);
    if (!isNaN(limit)) {
      onUpdateCategory({ ...cat, budgetLimit: limit });
    }
    setEditingId(null);
  };

  // Filter out Income category usually, but let's keep all customizable categories
  const expenseCategories = categories.filter((c) => c.name !== "Income");

  return (
    <div className="space-y-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Monthly Budgets</h2>
        <span className="text-xs text-gray-400 bg-surface px-2 py-1 rounded border border-gray-700">
          {new Date().toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="grid gap-4">
        {expenseCategories.map((cat) => {
          const spent = getSpent(cat.id);
          const limit = cat.budgetLimit;
          const percentage =
            limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOver = limit > 0 && spent > limit;

          return (
            <div
              key={cat.id}
              className="bg-surface p-4 rounded-xl border border-gray-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${cat.color} bg-opacity-20 flex items-center justify-center text-xl`}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{cat.name}</h3>
                    <p className="text-xs text-gray-400">
                      ${spent.toFixed(2)} spent
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-1 bg-slate-900 rounded p-1 border border-gray-700">
                      <span className="text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        value={tempLimit}
                        onChange={(e) => setTempLimit(e.target.value)}
                        className="w-16 bg-transparent text-white text-sm outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(cat)}
                        className="text-green-500 hover:text-green-400"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="text-right group cursor-pointer"
                      onClick={() => startEdit(cat)}
                    >
                      <div className="flex items-center justify-end gap-1 text-gray-300">
                        <span className="text-sm font-medium">
                          {limit > 0 ? `$${limit}` : "No Limit"}
                        </span>
                        <PencilIcon className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-[10px] text-gray-500">Limit</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {limit > 0 && (
                <div className="mt-3">
                  <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-danger" : "bg-primary"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {isOver && (
                    <p className="text-xs text-danger mt-1 font-medium">
                      ⚠️ Exceeded by ${(spent - limit).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Budgets;
