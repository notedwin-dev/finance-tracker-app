import React, { useState } from "react";
import { Goal, Account, Pot } from "../types";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  BanknotesIcon,
  ChartBarIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";

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

  // Pot form state
  const [potName, setPotName] = useState("");
  const [potAccountId, setPotAccountId] = useState("");
  const [potTarget, setPotTarget] = useState("");
  const [potCurrent, setPotCurrent] = useState("");

  // Goal form state
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [goalCategory, setGoalCategory] = useState("");

  const handleEditPot = (pot: Pot) => {
    setEditingId(pot.id);
    setPotName(pot.name);
    setPotAccountId(pot.accountId);
    setPotTarget(pot.targetAmount.toString());
    setPotCurrent(pot.currentAmount.toString());
    setShowPotModal(true);
  };

  const handlePotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePot({
      id: editingId || Date.now().toString(),
      name: potName,
      accountId: potAccountId,
      targetAmount: parseFloat(potTarget),
      currentAmount: parseFloat(potCurrent) || 0,
      currency: accounts.find((a) => a.id === potAccountId)?.currency || "MYR",
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
  };

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddGoal({
      id: editingId || Date.now().toString(),
      name: goalName,
      targetAmount: parseFloat(goalTarget),
      currentAmount: 0,
      deadline: goalDeadline,
      currency: "MYR",
      type: (goalCategory as any) || "SHORT_TERM",
      icon: "🎯",
      color: "bg-primary",
      updatedAt: Date.now(),
    });
    setGoalName("");
    setGoalTarget("");
    setGoalDeadline("");
    setGoalCategory("");
    setEditingId(null);
    setShowGoalModal(false);
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
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            return (
              <div
                key={goal.id}
                className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-white font-bold text-lg">{goal.name}</h3>
                  <button
                    onClick={() => onDeleteGoal(goal.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-white font-bold">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full mb-4">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Target</p>
                    <p className="text-white font-bold">
                      {goal.currency} {goal.targetAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Deadline</p>
                    <p className="text-white font-bold">
                      {new Date(goal.deadline).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showPotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-gray-800 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">
              {editingId ? "Edit Saving Pot" : "Create Saving Pot"}
            </h3>
            <form onSubmit={handlePotSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Pot Name
                </label>
                <input
                  type="text"
                  required
                  value={potName}
                  onChange={(e) => setPotName(e.target.value)}
                  className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Dream Holiday"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Linked Account
                </label>
                <select
                  required
                  value={potAccountId}
                  onChange={(e) => setPotAccountId(e.target.value)}
                  className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary appearance-none"
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
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    required
                    value={potTarget}
                    onChange={(e) => setPotTarget(e.target.value)}
                    className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary"
                    placeholder={`MYR 0.00`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    required
                    value={potCurrent}
                    onChange={(e) => setPotCurrent(e.target.value)}
                    className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary"
                    placeholder={`MYR 0.00`}
                  />
                </div>
              </div>

              {potAccountId && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-xs text-blue-400">
                    This pot will reserve funds from{" "}
                    {getAccountName(potAccountId)}. Spending from this pot will
                    reduce its balance automatically.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPotModal(false);
                    setEditingId(null);
                    setPotName("");
                    setPotAccountId("");
                    setPotTarget("");
                    setPotCurrent("");
                  }}
                  className="flex-1 py-3 bg-gray-800 rounded-xl text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary rounded-xl text-white font-bold"
                >
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGoalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-gray-800 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Create Goal</h3>
            <form onSubmit={handleGoalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary"
                  placeholder="e.g. New Car"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Target Amount
                  </label>
                  <input
                    type="number"
                    required
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary"
                    placeholder="£0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    required
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Goal Type
                </label>
                <select
                  required
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full bg-gray-800 border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary appearance-none"
                >
                  <option value="SHORT_TERM">Short Term</option>
                  <option value="LONG_TERM">Long Term</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="flex-1 py-3 bg-gray-800 rounded-xl text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary rounded-xl text-white font-bold"
                >
                  {editingId ? "Update" : "Create"}
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
