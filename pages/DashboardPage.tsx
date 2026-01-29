import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../services/auth.services";
import { useData } from "../context/DataContext";
import CurrencyRateCard from "../components/CurrencyRateCard";
import { GoalProgressCard, NetWorthChart } from "../components/Charts";
import AccountCard from "../components/AccountCard";
import AccountDetailModal from "../components/AccountDetailModal";
import {
  groupTransactions,
  normalizeDate,
} from "../helpers/transactions.helper";
import { TransactionType, Account } from "../types";

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const { accounts, transactions, pots, goals, usdRate, handleMigrateData } =
    useData();
  const { setShowAddModal, setShowAccountForm, setEditingAccount } =
    useOutletContext<any>();

  const [viewAccount, setViewAccount] = useState<Account | null>(null);

  const totalBalanceMYR = accounts.reduce((sum, a) => {
    let val = a.balance;
    if (a.currency === "USD") val = val * usdRate;
    return sum + val;
  }, 0);

  const totalGoalTarget = goals.reduce((sum, g) => {
    let val = g.targetAmount;
    if (g.currency === "USD") val *= usdRate;
    return sum + val;
  }, 0);

  const totalGoalSaved = goals.reduce((sum, g) => {
    let savedVal = 0;
    if (g.linkedAccountId) {
      const acc = accounts.find((a) => a.id === g.linkedAccountId);
      savedVal = acc ? acc.balance : 0;
      if (acc && acc.currency === "USD") savedVal *= usdRate;
    } else {
      savedVal = g.currentAmount;
      if (g.currency === "USD") savedVal *= usdRate;
    }
    return sum + savedVal;
  }, 0);

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Welcome, {profile.name || "User"}
          </h2>
          <p className="text-gray-400 text-sm">Overview of your wealth.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="hidden lg:flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg hover:scale-105"
        >
          <PlusIcon className="w-5 h-5" /> Add Record
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <CurrencyRateCard usdRate={usdRate} />

        <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-gradient-to-br from-primary to-purple-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-64 border border-white/10">
          <div className="relative z-10">
            <p className="text-indigo-200 text-sm font-medium mb-1">
              Total Balance
            </p>
            <h3 className="text-4xl font-black tracking-tight">
              RM{" "}
              {totalBalanceMYR.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h3>
          </div>
          <div className="relative z-10 flex gap-2">
            <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full text-xs border border-white/10">
              {accounts.length} Assets
            </div>
            <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full text-xs border border-white/10">
              {transactions.length} Records
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </div>

        <div className="col-span-1 md:col-span-3 lg:col-span-2 bg-card rounded-3xl p-6 border border-gray-800 h-64 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-200">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
            {groupTransactions(transactions)
              .slice(0, 5)
              .map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between items-center text-sm p-2 hover:bg-surface rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg bg-surface w-8 h-8 rounded-full flex items-center justify-center border border-gray-700">
                      {t.type === TransactionType.TRANSFER
                        ? "↔️"
                        : t.type === TransactionType.INCOME
                          ? "💰"
                          : "🛒"}
                    </div>
                    <div>
                      <p className="font-bold text-gray-200 truncate max-w-[120px]">
                        {t.shopName || "Untitled"}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {normalizeDate(t.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={
                        t.type === TransactionType.EXPENSE
                          ? "text-white"
                          : "text-success"
                      }
                    >
                      {t.type === TransactionType.EXPENSE ? "-" : "+"}
                      {t.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {t.currency}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2">
          <NetWorthChart
            transactions={transactions}
            currentTotal={totalBalanceMYR}
            usdRate={usdRate}
          />
        </div>
        <div className="col-span-1 h-80">
          <GoalProgressCard
            achieved={totalGoalSaved}
            target={totalGoalTarget}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">My Holdings</h3>
          <button
            onClick={() => {
              setShowAccountForm(true);
              setEditingAccount(undefined);
            }}
            className="text-xs bg-surface hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full transition-colors text-white"
          >
            + Add Asset
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              pots={pots}
              onClick={(a) => setViewAccount(a)}
            />
          ))}
        </div>
      </div>

      {viewAccount && (
        <AccountDetailModal
          account={viewAccount}
          transactions={transactions}
          pots={pots}
          onClose={() => setViewAccount(null)}
          onEdit={(acc) => {
            setViewAccount(null);
            setEditingAccount(acc);
            setShowAccountForm(true);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
