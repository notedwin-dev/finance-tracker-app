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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-surface">
          <h2 className="text-lg font-bold text-white">Manage Categories</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Add/Edit Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-surface p-4 rounded-xl border border-gray-700 space-y-4"
          >
            <h3 className="text-sm font-bold text-gray-400 uppercase flex justify-between">
              {editingId ? "Edit Category" : "Add New"}
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-primary"
                >
                  Cancel
                </button>
              )}
            </h3>

            <div className="flex gap-2 relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-11 text-center bg-background border border-gray-700 rounded-lg text-2xl flex items-center justify-center hover:bg-gray-800 transition-colors"
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
                className="flex-1 bg-background border border-gray-700 rounded-lg px-4 text-white focus:border-primary focus:outline-none"
                placeholder="Category Name"
              />
            </div>

            {/* Budget Settings */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold">
                  Budget Limit
                </label>
                <input
                  type="number"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold">
                  Period
                </label>
                <select
                  value={budgetPeriod}
                  onChange={(e) => setBudgetPeriod(e.target.value as any)}
                  className="w-full bg-background border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none appearance-none"
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
              className="w-full py-2 bg-primary hover:bg-primaryDark disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
            >
              {editingId ? "Update Category" : "Add Category"}
            </button>
          </form>

          {/* List */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-gray-400 uppercase">
              Existing
            </h3>
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-surface rounded-xl border border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${cat.color} bg-opacity-20 text-white`}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm block">
                      {cat.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {cat.budgetLimit > 0
                        ? `Limit: ${cat.budgetLimit} / ${cat.budgetPeriod === "WEEKLY" ? "Wk" : "Mo"}`
                        : "No budget set"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(cat)}
                    className="text-gray-500 hover:text-white transition-colors p-2"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDelete(cat.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors p-2"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
