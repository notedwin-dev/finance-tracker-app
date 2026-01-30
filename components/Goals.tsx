import React, { useState } from "react";
import { Goal, Account, Pot } from "../types";
import { parseDateSafe, normalizeDate } from "../helpers/transactions.helper";
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

  const formatTimeRemaining = (deadline: string) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = parseDateSafe(deadline);
    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (totalDays === 0) return "DUE TODAY";

    const isPast = totalDays < 0;
    const d1 = isPast ? end : start;
    const d2 = isPast ? start : end;

    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();

    if (days < 0) {
      months--;
      const prevMonthLastDay = new Date(
        d2.getFullYear(),
        d2.getMonth(),
        0,
      ).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years}Y`);
    if (months > 0) parts.push(`${months}M`);
    if (days > 0) parts.push(`${days}D`);

    const result = parts.length > 0 ? parts.join(" ") : "0D";
    return isPast ? `PAST DUE BY ${result}` : `${result} LEFT`;
  };

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
    setGoalDeadline(goal.deadline ? normalizeDate(goal.deadline) : "");
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex justify-between items-center px-1 pt-6">
        <h1 className="text-3xl font-black text-white tracking-tighter">
          LIMITS & GOALS
        </h1>
        <button
          onClick={() =>
            activeTab === "POTS"
              ? setShowPotModal(true)
              : setShowGoalModal(true)
          }
          className="w-10 h-10 bg-white text-black hover:bg-indigo-400 hover:text-white transition-all rounded-full flex items-center justify-center shadow-lg active:scale-95 group"
        >
          <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Segmented Pill Switcher - Restored High-Fidelity UX */}
      <div className="flex bg-gray-900/50 p-1 rounded-[1.25rem] border border-white/5 mb-8 shadow-2xl backdrop-blur-xl">
        <button
          onClick={() => setActiveTab("POTS")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-[10px] tracking-widest ${
            activeTab === "POTS"
              ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <BanknotesIcon className="w-3.5 h-3.5" /> SPENDING POTS
        </button>
        <button
          onClick={() => setActiveTab("GOALS")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-[10px] tracking-widest ${
            activeTab === "GOALS"
              ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <ChartBarIcon className="w-3.5 h-3.5" /> FINANCIAL GOALS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pb-20">
        {activeTab === "POTS" ? (
          pots.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
              <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
                <BanknotesIcon className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                No active pots found
              </p>
            </div>
          ) : (
            pots.map((pot) => {
              const usedAmount = pot.targetAmount - pot.currentAmount;
              const progress = (usedAmount / pot.targetAmount) * 100;
              return (
                <div
                  key={pot.id}
                  className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-indigo-500/20 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-center mb-6">
                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-white tracking-tight">
                          {pot.name}
                        </h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          {getAccountName(pot.accountId)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditPot(pot)}
                          className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePot(pot.id)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            Available
                          </p>
                          <p className="text-2xl font-black text-white tracking-tighter">
                            {pot.currency} {pot.currentAmount.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            Limit
                          </p>
                          <p className="text-sm font-black text-gray-400 tracking-tight">
                            {pot.currency} {pot.targetAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)] relative"
                          style={{
                            width: `${Math.max(0, Math.min(100, progress))}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
                          {Math.round(progress)}% USED
                        </span>
                      </div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        {Math.max(0, usedAmount).toLocaleString()}{" "}
                        {pot.currency} TOTAL SPENT
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : goals.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
            <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
              <ChartBarIcon className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
              No financial goals set
            </p>
          </div>
        ) : (
          goals.map((goal) => {
            let savedAmount = goal.currentAmount;
            if (goal.linkedAccountId) {
              const acc = accounts.find((a) => a.id === goal.linkedAccountId);
              savedAmount = acc ? acc.balance : 0;
            }
            const progress = (savedAmount / goal.targetAmount) * 100;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const daysLeft = goal.deadline
              ? Math.ceil(
                  (parseDateSafe(goal.deadline).getTime() - today.getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;

            const timeLabel = goal.deadline
              ? formatTimeRemaining(goal.deadline)
              : "DEADLINE NOT SET";

            return (
              <div
                key={goal.id}
                className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-emerald-500/20 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl -mr-16 -mt-16"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-white tracking-tight">
                        {goal.name}
                      </h3>
                      {goal.linkedAccountId && (
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                          Linked to {getAccountName(goal.linkedAccountId)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditGoal(goal)}
                        className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between items-end mb-3">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                          Saved So Far
                        </p>
                        <p className="text-2xl font-black text-white tracking-tighter">
                          {goal.currency} {savedAmount.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                          Final Goal
                        </p>
                        <p className="text-sm font-black text-gray-400 tracking-tight">
                          {goal.currency} {goal.targetAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                        {Math.round(progress)}% PROGRESS
                      </span>
                    </div>
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        daysLeft === null
                          ? "text-gray-500"
                          : daysLeft < 0
                            ? "text-rose-400"
                            : daysLeft < 30
                              ? "text-orange-400"
                              : "text-gray-500"
                      }`}
                    >
                      {timeLabel}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showPotModal && (
        <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-700 overflow-hidden flex flex-col h-[85vh] sm:h-auto max-h-[90vh] animate-slideUp sm:animate-fadeIn">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-700 bg-surface shrink-0 flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingId ? "Edit Spending Pot" : "Create Spending Pot"}
                </h3>
                <p className="text-[10px] text-gray-500 font-medium">
                  Set a spending limit within an account
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
                    Spending Limit
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
                    Amount Used
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
                    This pot sets a spending limit for funds within{" "}
                    {getAccountName(potAccountId)}. Tracking your usage here
                    helps you stay within budget.
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
        <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
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
                  className="w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm focus:border-primary outline-none scheme-dark"
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
