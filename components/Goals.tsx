import React, { useState } from "react";
import { Goal, Account, Pot } from "../types";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  BanknotesIcon,
  ChartBarIcon,
  WalletIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

interface Props {
  goals: Goal[];
  pots: Pot[];
  accounts: Account[];
  onAddGoal: (goal: Omit<Goal, "userId">) => void;
  onDeleteGoal: (id: string) => void;
  onSavePot: (pot: Omit<Pot, "userId">) => void;
  onDeletePot: (id: string) => void;
}

const Goals: React.FC<Props> = ({
  goals,
  pots,
  accounts,
  onAddGoal,
  onDeleteGoal,
  onSavePot,
  onDeletePot,
}) => {
  const [activeTab, setActiveTab] = useState<"POTS" | "GOALS">("POTS");
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showPotModal, setShowPotModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pot form state
  const [potName, setPotName] = useState("");
  const [potAccountId, setPotAccountId] = useState("");
  const [potTarget, setPotTarget] = useState("");
  const [potCurrent, setPotCurrent] = useState("");

  // Goal form state
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [goalCategory, setGoalCategory] = useState("");
  const [goalLinkedAccountId, setGoalLinkedAccountId] = useState("");

  const handleAmountFormat = (
    val: string,
    currentVal: string,
    setter: (v: string) => void,
  ) => {
    if (!val) {
      setter("");
      return;
    }

    if (val.endsWith(".") && !currentVal.endsWith(".")) {
      const d = currentVal.replace(/\D/g, "");
      setter(parseInt(d || "0", 10).toString() + ".");
      return;
    }

    if (currentVal.endsWith(".") || currentVal.match(/\.\d$/)) {
      const parts = currentVal.split(".");
      const newChar = val.length > currentVal.length ? val.slice(-1) : "";
      if (/\d/.test(newChar)) {
        if (parts[1] === "") {
          setter(parts[0] + "." + newChar);
          return;
        }
        if (parts[1].length === 1) {
          setter(parts[0] + "." + parts[1] + newChar);
          return;
        }
      }
    }

    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setter("");
      return;
    }
    const cents = parseInt(digits, 10);
    setter((cents / 100).toFixed(2));
  };

  const handleEditPot = (pot: Pot) => {
    setEditingId(pot.id);
    setPotName(pot.name);
    setPotAccountId(pot.accountId);
    setPotTarget(pot.targetAmount.toFixed(2));
    setPotCurrent(pot.currentAmount.toFixed(2));
    setShowPotModal(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingId(goal.id);
    setGoalName(goal.name);
    setGoalTarget(goal.targetAmount.toFixed(2));
    setGoalCurrent(goal.currentAmount.toFixed(2));
    setGoalDeadline(goal.deadline || "");
    setGoalCategory(goal.type);
    setGoalLinkedAccountId(goal.linkedAccountId || "");
    setShowGoalModal(true);
  };

  const handlePotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSavePot({
        id: editingId || crypto.randomUUID(),
        name: potName,
        accountId: potAccountId,
        targetAmount: parseFloat(potTarget),
        currentAmount: parseFloat(potCurrent) || 0,
        currency:
          accounts.find((a) => a.id === potAccountId)?.currency || "MYR",
        icon: "💰",
        color: "bg-primary",
        updatedAt: Date.now(),
      });
      setPotName("");
      setPotAccountId("");
      setPotTarget("");
      setPotCurrent("");
      setEditingId(null);
      setShowPotModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddGoal({
        id: editingId || crypto.randomUUID(),
        name: goalName,
        targetAmount: parseFloat(goalTarget),
        currentAmount: parseFloat(goalCurrent) || 0,
        deadline: goalDeadline || undefined,
        currency: "MYR",
        type: (goalCategory as any) || "SHORT_TERM",
        linkedAccountId: goalLinkedAccountId || undefined,
        icon: "🎯",
        color: "bg-primary",
        updatedAt: Date.now(),
      });
      setGoalName("");
      setGoalTarget("");
      setGoalCurrent("");
      setGoalDeadline("");
      setGoalCategory("");
      setGoalLinkedAccountId("");
      setEditingId(null);
      setShowGoalModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || "Unknown Account";

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-900/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab("POTS")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
            activeTab === "POTS"
              ? "bg-primary text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <WalletIcon className="w-5 h-5" />
          Saving Pots
        </button>
        <button
          onClick={() => setActiveTab("GOALS")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
            activeTab === "GOALS"
              ? "bg-primary text-white"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <ChartBarIcon className="w-5 h-5" />
          Financial Goals
        </button>
      </div>

      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold text-white">
          {activeTab === "POTS" ? "Saving Pots" : "Financial Goals"}
        </h2>
        <button
          onClick={() =>
            activeTab === "POTS"
              ? setShowPotModal(true)
              : setShowGoalModal(true)
          }
          className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
        >
          <PlusIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeTab === "POTS" ? (
          pots.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
              <BanknotesIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No saving pots yet. Create one to organize your funds!</p>
            </div>
          ) : (
            pots.map((pot) => {
              const progress = (pot.currentAmount / pot.targetAmount) * 100;
              return (
                <div
                  key={pot.id}
                  className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-white font-bold text-lg">
                          {pot.name}
                        </h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          {getAccountName(pot.accountId)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPot(pot)}
                          className="p-2 text-gray-400 hover:text-white"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePot(pot.id)}
                          className="p-2 text-gray-400 hover:text-red-400"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-primary font-bold">
                        {pot.currency} {pot.currentAmount.toLocaleString()}
                      </span>
                      <span className="text-gray-500">
                        of {pot.currency} {pot.targetAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-gray-800 text-gray-400">
                      {Math.round(progress)}% Available
                    </span>
                    <span className="text-xs text-gray-500">
                      {pot.currency}{" "}
                      {(pot.targetAmount - pot.currentAmount).toLocaleString()}{" "}
                      used
                    </span>
                  </div>
                </div>
              );
            })
          )
        ) : goals.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
            <ChartBarIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No goals yet. Dream big and start tracking!</p>
          </div>
        ) : (
          goals.map((goal) => {
            let savedAmount = goal.currentAmount;
            if (goal.linkedAccountId) {
              const acc = accounts.find((a) => a.id === goal.linkedAccountId);
              savedAmount = acc ? acc.balance : 0;
            }
            const progress = (savedAmount / goal.targetAmount) * 100;

            return (
              <div
                key={goal.id}
                className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {goal.name}
                      </h3>
                      {goal.linkedAccountId && (
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider">
                          Linked to {getAccountName(goal.linkedAccountId)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditGoal(goal)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white font-bold">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 h-2 rounded-full mb-4 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Saved</p>
                      <p className="text-primary font-bold">
                        {goal.currency} {savedAmount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Target</p>
                      <p className="text-white font-bold">
                        {goal.currency} {goal.targetAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {goal.deadline && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500 uppercase mb-1">
                      Deadline
                    </p>
                    <p className="text-white font-medium text-sm">
                      {new Date(goal.deadline).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showPotModal && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingId ? "Edit Saving Pot" : "Create Saving Pot"}
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">
                  Reserve funds within an account
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPotModal(false);
                  setEditingId(null);
                  setPotName("");
                  setPotAccountId("");
                  setPotTarget("");
                  setPotCurrent("");
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handlePotSubmit}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-20 sm:pb-6"
            >
              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Pot Name
                </label>
                <input
                  type="text"
                  required
                  value={potName}
                  onChange={(e) => setPotName(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
                  placeholder="e.g. Dream Holiday"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Linked Account
                </label>
                <select
                  required
                  value={potAccountId}
                  onChange={(e) => setPotAccountId(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency} {acc.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Target Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={potTarget}
                    onChange={(e) =>
                      handleAmountFormat(
                        e.target.value,
                        potTarget,
                        setPotTarget,
                      )
                    }
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Current Balance
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={potCurrent}
                    onChange={(e) =>
                      handleAmountFormat(
                        e.target.value,
                        potCurrent,
                        setPotCurrent,
                      )
                    }
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {potAccountId && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-4">
                  <p className="text-[10px] sm:text-xs text-primary/80 font-medium leading-relaxed">
                    This pot will reserve funds from{" "}
                    {getAccountName(potAccountId)}. Spending from this pot will
                    reduce its balance automatically.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] text-sm ${
                    isSubmitting
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-primary hover:bg-primary-hover"
                  }`}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Update Pot"
                      : "Create Pot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingId ? "Edit Savings Goal" : "Create Savings Goal"}
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">
                  Track progress towards a target
                </p>
              </div>
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setEditingId(null);
                  setGoalName("");
                  setGoalTarget("");
                  setGoalCurrent("");
                  setGoalDeadline("");
                  setGoalCategory("");
                  setGoalLinkedAccountId("");
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleGoalSubmit}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-20 sm:pb-6"
            >
              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
                  placeholder="e.g. New Car"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Target Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={goalTarget}
                    onChange={(e) =>
                      handleAmountFormat(
                        e.target.value,
                        goalTarget,
                        setGoalTarget,
                      )
                    }
                    className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                    Current (Manual)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={goalCurrent}
                    disabled={!!goalLinkedAccountId}
                    onChange={(e) =>
                      handleAmountFormat(
                        e.target.value,
                        goalCurrent,
                        setGoalCurrent,
                      )
                    }
                    className={`w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none ${!!goalLinkedAccountId ? "opacity-30 cursor-not-allowed" : ""}`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Linked Account (Auto-sync)
                </label>
                <select
                  value={goalLinkedAccountId}
                  onChange={(e) => {
                    setGoalLinkedAccountId(e.target.value);
                    if (e.target.value) setGoalCurrent("");
                  }}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
                >
                  <option value="">No Link (Manual Tracking)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency} {acc.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
                {goalLinkedAccountId && (
                  <p className="text-[10px] text-primary mt-2 font-medium">
                    Goal progress will track this account's live balance.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm focus:border-primary outline-none [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Goal Type
                </label>
                <select
                  required
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none appearance-none font-medium"
                >
                  <option value="SHORT_TERM">Short Term</option>
                  <option value="LONG_TERM">Long Term</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 text-white font-bold py-3 sm:py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] text-sm ${
                    isSubmitting
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-primary hover:bg-primary-hover"
                  }`}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Update Goal"
                      : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
