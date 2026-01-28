import React, { useState } from "react";
import { Category } from "../types";
import { XMarkIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

interface Props {
  categories: Category[];
  onClose: () => void;
  onSave: (category: Omit<Category, "userId">) => void;
  onDelete: (categoryId: string) => void;
}

const CategoryManager: React.FC<Props> = ({
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [color, setColor] = useState("bg-gray-500");
  const [budgetLimit, setBudgetLimit] = useState<string>("0");
  const [budgetPeriod, setBudgetPeriod] = useState<"WEEKLY" | "MONTHLY">(
    "MONTHLY",
  );

  const COLORS = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-teal-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-gray-500",
  ];

  const EMOJIS = [
    "💰",
    "💸",
    "💳",
    "🏦",
    "🤑",
    "🪙",
    "🧾",
    "📈",
    "🛍️",
    "🛒",
    "🎁",
    "🕶️",
    "👕",
    "👗",
    "👟",
    "💍",
    "🍔",
    "🍕",
    "🍣",
    "🥗",
    "🍦",
    "☕",
    "🍺",
    "🍷",
    "🍽️",
    "🚗",
    "🚕",
    "🚌",
    "✈️",
    "🚀",
    "⛽",
    "🗺️",
    "🔧",
    "🏠",
    "💡",
    "🔌",
    "📺",
    "🎮",
    "🎵",
    "📚",
    "💊",
    "🏋️",
    "🐾",
    "🏷️",
    "📦",
    "🔨",
    "💼",
    "👶",
    "🎓",
    "🎨",
    "🎬",
  ];

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setBudgetLimit(cat.budgetLimit.toString());
    setBudgetPeriod(cat.budgetPeriod || "MONTHLY");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setIcon("🏷️");
    setColor("bg-gray-500");
    setBudgetLimit("0");
    setBudgetPeriod("MONTHLY");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    onSave({
      id: editingId || crypto.randomUUID(),
      name,
      icon,
      color,
      budgetLimit: parseFloat(budgetLimit) || 0,
      budgetPeriod,
    });

    handleCancelEdit();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-white">
            Manage Categories
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-20 sm:pb-6">
          {/* Add/Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-surface p-4 sm:p-5 rounded-xl border border-gray-700 space-y-4"
          >
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest flex justify-between">
              {editingId ? "Edit Category" : "Add New Category"}
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-primary font-bold"
                >
                  Cancel
                </button>
              )}
            </h3>

            <div className="flex gap-2 relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-11 shrink-0 text-center bg-background border border-gray-700 rounded-lg text-2xl flex items-center justify-center hover:bg-gray-800 transition-colors"
              >
                {icon}
              </button>

              {showEmojiPicker && (
                <div className="absolute top-12 left-0 z-50 bg-card border border-gray-700 rounded-xl shadow-xl w-64 p-3 grid grid-cols-6 gap-2 h-48 overflow-y-auto custom-scrollbar">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setIcon(emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 min-w-0 bg-background border border-gray-700 rounded-lg px-4 text-white text-sm focus:border-primary focus:outline-none"
                placeholder="Category Name"
              />
            </div>

            {/* Budget Settings */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black uppercase mb-1 block">
                  Budget Limit
                </label>
                <input
                  type="number"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-black uppercase mb-1 block">
                  Period
                </label>
                <select
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value as any)}
                  className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-primary focus:outline-none appearance-none font-medium"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 bg-background p-2 rounded-lg overflow-x-auto custom-scrollbar">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full flex-shrink-0 transition-transform ${c} ${color === c ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-100"}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!name}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 sm:py-3 rounded-lg font-bold transition-all shadow-lg active:scale-95 text-sm"
            >
              {editingId ? "Update Category" : "Add Category"}
            </button>
          </form>

          {/* List */}
          <div className="space-y-3">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
              Existing Categories
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-surface/50 border border-gray-700/50 rounded-xl p-3 sm:p-4 flex items-center justify-between group hover:border-gray-600 transition-all"
                >
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl ${cat.color} bg-opacity-20 shrink-0 shadow-inner`}
                    >
                      {cat.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm sm:text-base truncate">
                        {cat.name}
                      </p>
                      {cat.budgetLimit > 0 && (
                        <p className="text-[10px] sm:text-xs text-primary font-medium tracking-tight">
                          {cat.budgetPeriod} BUDGET:{" "}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                          }).format(Number(cat.budgetLimit))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 sm:gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="p-1 sm:p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <PencilIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                    </button>
                    {!cat.isDefault && (
                      <button
                        onClick={() => onDelete(cat.id)}
                        className="p-1 sm:p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <TrashIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
