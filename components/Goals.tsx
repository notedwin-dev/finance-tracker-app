import React, { useState } from "react";
import { Goal, Account, Pot, SavingPocket } from "../types";
import { parseDateSafe, normalizeDate } from "../helpers/transactions.helper";
import { useData } from "../context/DataContext";
import DatePicker from "./DatePicker";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  BanknotesIcon,
  ChartBarIcon,
  WalletIcon,
  XMarkIcon,
  SparklesIcon,
} from "@heroicons/react/24/solid";

interface Props {
  goals: Goal[];
  pots: Pot[];
  pockets: SavingPocket[];
  accounts: Account[];
  onAddGoal: (goal: Omit<Goal, "userId">) => void;
  onDeleteGoal: (id: string) => void;
  onSavePot: (pot: Omit<Pot, "userId">) => void;
  onDeletePot: (id: string) => void;
  onSavePocket: (pocket: Omit<SavingPocket, "userId">) => void;
  onDeletePocket: (id: string) => void;
}

const Goals: React.FC<Props> = ({
  goals,
  pots,
  pockets,
  accounts,
  onAddGoal,
  onDeleteGoal,
  onSavePot,
  onDeletePot,
  onSavePocket,
  onDeletePocket,
}) => {
  const { maskText, maskAmount } = useData();
  const [activeTab, setActiveTab] = useState<"POTS" | "GOALS" | "POCKETS">(
    "POTS",
  );
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showPotModal, setShowPotModal] = useState(false);
  const [showPocketModal, setShowPocketModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GXBank Specific State
  const [pocketType, setPocketType] = useState<
    "SAVING_POCKET" | "BONUS_POCKET"
  >("SAVING_POCKET");
  const [tenureMonths, setTenureMonths] = useState<2 | 3>(3);

  // Pot form state
  const [potName, setPotName] = useState("");
  const [potAccountId, setPotAccountId] = useState("");
  const [potTarget, setPotTarget] = useState("");
  const [potCurrent, setPotCurrent] = useState("");
  const [potResetDate, setPotResetDate] = useState("");

  // Saving Pocket form state
  const [pocketName, setPocketName] = useState("");
  const [pocketAccountId, setPocketAccountId] = useState("");
  const [pocketCurrent, setPocketCurrent] = useState("");
  const [pocketCurrency, setPocketCurrency] = useState("MYR");
  const [pocketIcon, setPocketIcon] = useState("🚀");
  const [pocketColor, setPocketColor] = useState("indigo-500");
  const [pocketResetDate, setPocketResetDate] = useState("");

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
    setPotTarget(pot.limitAmount.toFixed(2));
    setPotCurrent(pot.usedAmount.toFixed(2));
    setPotResetDate(pot.resetDate ? normalizeDate(pot.resetDate) : "");
    setShowPotModal(true);
  };

  const handleEditPocket = (pocket: SavingPocket) => {
    setEditingId(pocket.id);
    setPocketName(pocket.name);
    setPocketAccountId(pocket.accountId || "");
    setPocketCurrent(pocket.currentAmount.toFixed(2));
    setPocketCurrency(pocket.currency);
    setPocketIcon(pocket.icon);
    setPocketColor(pocket.color);
    setPocketType(pocket.pocketType || "SAVING_POCKET");
    setTenureMonths(pocket.tenureMonths || 3);
    setPocketResetDate(pocket.resetDate ? normalizeDate(pocket.resetDate) : "");
    setShowPocketModal(true);
  };

  const handlePocketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedAccount = accounts.find((a) => a.id === pocketAccountId);
      const isGXBank = selectedAccount?.providerId === "GXBANK";

      const pocketData: Omit<SavingPocket, "userId"> = {
        id: editingId || crypto.randomUUID(),
        name: pocketName,
        accountId: pocketAccountId || undefined,
        currentAmount: parseFloat(pocketCurrent) || 0,
        currency: pocketCurrency,
        icon: pocketIcon,
        color: pocketColor,
        pocketType: isGXBank ? pocketType : "SAVING_POCKET",
        tenureMonths:
          isGXBank && pocketType === "BONUS_POCKET" ? tenureMonths : undefined,
        resetDate: pocketResetDate || undefined,
      };
      await onSavePocket(pocketData);
      setPocketName("");
      setPocketAccountId("");
      setPocketCurrent("");
      setPocketResetDate("");
      setPocketType("SAVING_POCKET");
      setTenureMonths(3);
      setEditingId(null);
      setShowPocketModal(false);
    } finally {
      setIsSubmitting(false);
    }
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
      const limit = parseFloat(potTarget);
      const used = parseFloat(potCurrent) || 0;
      await onSavePot({
        id: editingId || crypto.randomUUID(),
        name: potName,
        accountId: potAccountId,
        limitAmount: limit,
        usedAmount: used,
        amountLeft: limit - used,
        currency:
          accounts.find((a) => a.id === potAccountId)?.currency || "MYR",
        icon: "💰",
        color: "bg-primary",
        resetDate: potResetDate || undefined,
        updatedAt: Date.now(),
      });
      setPotName("");
      setPotAccountId("");
      setPotTarget("");
      setPotCurrent("");
      setPotResetDate("");
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
          onClick={() => {
            if (activeTab === "POTS") setShowPotModal(true);
            else if (activeTab === "POCKETS") setShowPocketModal(true);
            else setShowGoalModal(true);
          }}
          className="w-10 h-10 bg-white text-black hover:bg-indigo-400 hover:text-white transition-all rounded-full flex items-center justify-center shadow-lg active:scale-95 group"
        >
          <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Segmented Pill Switcher - Restored High-Fidelity UX */}
      <div className="flex bg-gray-900/50 p-1 rounded-[1.25rem] border border-white/5 mb-8 shadow-2xl backdrop-blur-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("POTS")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-black text-[10px] tracking-widest min-w-30 ${
            activeTab === "POTS"
              ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <BanknotesIcon className="w-3.5 h-3.5" /> SPENDING POTS
        </button>
        <button
          onClick={() => setActiveTab("POCKETS")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-black text-[10px] tracking-widest min-w-30 ${
            activeTab === "POCKETS"
              ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <SparklesIcon className="w-3.5 h-3.5" /> SAVING POCKETS
        </button>
        <button
          onClick={() => setActiveTab("GOALS")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-black text-[10px] tracking-widest min-w-30 ${
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
              const usedAmount = pot.usedAmount;
              const limitAmount = pot.limitAmount;
              const progress = (usedAmount / limitAmount) * 100;
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
                          {maskText(pot.name)}
                        </h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          {maskText(getAccountName(pot.accountId))}
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
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">
                            Total Spent
                          </p>
                          <p className="text-2xl font-black text-white tracking-tighter">
                            {pot.currency}{" "}
                            {maskAmount(pot.usedAmount.toLocaleString())}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                            Limit
                          </p>
                          <p className="text-sm font-black text-white tracking-tight">
                            {pot.currency}{" "}
                            {maskAmount(limitAmount.toLocaleString())}
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
                        Amount left: {pot.currency}{" "}
                        {maskAmount(pot.amountLeft.toLocaleString())}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : activeTab === "POCKETS" ? (
          pockets.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
              <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
                <SparklesIcon className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                No active pockets found
              </p>
            </div>
          ) : (
            pockets.map((pocket) => (
              <div
                key={pocket.id}
                className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-indigo-500/20 group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">
                        {pocket.icon}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-white tracking-tight">
                          {maskText(pocket.name)}
                        </h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                          {pocket.accountId
                            ? getAccountName(pocket.accountId)
                            : "Endless Savings"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPocket(pocket)}
                        className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeletePocket(pocket.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
                      Current Savings
                    </p>
                    <p className="text-4xl font-black text-white tracking-tighter">
                      {pocket.currency}{" "}
                      {maskAmount(
                        pocket.currentAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        }),
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl w-fit">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    Growth Tracker Active
                  </div>
                </div>
              </div>
            ))
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
                        {maskText(goal.name)}
                      </h3>
                      {goal.linkedAccountId && (
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">
                          Linked to{" "}
                          {maskText(getAccountName(goal.linkedAccountId))}
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
                          {goal.currency}{" "}
                          {maskAmount(savedAmount.toLocaleString())}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                          Final Goal
                        </p>
                        <p className="text-sm font-black text-gray-400 tracking-tight">
                          {goal.currency}{" "}
                          {maskAmount(goal.targetAmount.toLocaleString())}
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
                  setPotResetDate("");
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

              <div>
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block">
                  Reset Date (Optional)
                </label>
                <DatePicker value={potResetDate} onChange={setPotResetDate} />
                <p className="text-[10px] text-gray-500 mt-1.5 font-medium">
                  Only count transactions from this date onwards. Leave empty to
                  include all transactions.
                </p>
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

      {showPocketModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-surface rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-white tracking-tight">
                {editingId ? "Edit Pocket" : "New Saving Pocket"}
              </h2>
              <button
                onClick={() => {
                  setShowPocketModal(false);
                  setEditingId(null);
                  setPocketName("");
                  setPocketAccountId("");
                  setPocketCurrent("");
                  setPocketResetDate("");
                }}
                className="p-2 text-gray-500 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handlePocketSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Linked Bank Account (Optional)
                </label>
                <select
                  value={pocketAccountId}
                  onChange={(e) => setPocketAccountId(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none appearance-none"
                >
                  <option value="">No Linked Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {accounts.find((a) => a.id === pocketAccountId)?.providerId ===
                "GXBANK" && (
                <div className="animate-fadeIn space-y-4 bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                      GXBank Pocket Type
                    </label>
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                      {(["SAVING_POCKET", "BONUS_POCKET"] as const).map(
                        (type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setPocketType(type)}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
                              pocketType === type
                                ? "bg-indigo-500 text-white shadow-lg"
                                : "text-gray-500 hover:text-white"
                            }`}
                          >
                            {type.replace("_", " ")}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {pocketType === "BONUS_POCKET" && (
                    <div className="space-y-2 animate-fadeIn">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">
                        Bonus Tenure (Months)
                      </label>
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        {([2, 3] as const).map((months) => (
                          <button
                            key={months}
                            type="button"
                            onClick={() => setTenureMonths(months)}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
                              tenureMonths === months
                                ? "bg-indigo-500 text-white shadow-lg"
                                : "text-gray-500 hover:text-white"
                            }`}
                          >
                            {months} MONTHS
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-gray-500 italic px-1">
                        Bonus Pockets get higher interest (5%) if held for the
                        tenure.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Pocket Name
                </label>
                <input
                  type="text"
                  value={pocketName}
                  onChange={(e) => setPocketName(e.target.value)}
                  placeholder="Emergency Fund, Holiday, etc."
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:border-indigo-500/50 transition-all outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Currency
                  </label>
                  <select
                    value={pocketCurrency}
                    onChange={(e) => setPocketCurrency(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none appearance-none"
                  >
                    <option value="MYR">MYR (RM)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Current Balance
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pocketCurrent}
                    onChange={(e) =>
                      handleAmountFormat(
                        e.target.value,
                        pocketCurrent,
                        setPocketCurrent,
                      )
                    }
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-gray-600 focus:border-indigo-500/50 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={pocketIcon}
                    onChange={(e) => setPocketIcon(e.target.value)}
                    placeholder="🚀"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none text-center text-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Color (Tailwind)
                  </label>
                  <select
                    value={pocketColor}
                    onChange={(e) => setPocketColor(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white focus:border-indigo-500/50 transition-all outline-none"
                  >
                    <option value="indigo-500">Indigo</option>
                    <option value="rose-500">Rose</option>
                    <option value="emerald-500">Emerald</option>
                    <option value="amber-500">Amber</option>
                    <option value="sky-500">Sky</option>
                    <option value="purple-500">Purple</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Reset Date (Optional)
                </label>
                <DatePicker
                  value={pocketResetDate}
                  onChange={setPocketResetDate}
                />
                <p className="text-[9px] text-gray-500 mt-1 italic px-1">
                  Only count transactions from this date onwards. Leave empty to
                  include all transactions.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black font-black py-4 rounded-2xl mt-4 hover:bg-indigo-400 hover:text-white transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting
                  ? "PROCESSING..."
                  : editingId
                    ? "UPDATE POCKET"
                    : "CREATE POCKET"}
              </button>
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
                <DatePicker value={goalDeadline} onChange={setGoalDeadline} />
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
