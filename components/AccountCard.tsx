import React from "react";
import { Account, Pot, Transaction, TransactionType } from "../types";
import { CryptoPrices } from "../services/coin.services";
import {
  WalletIcon,
  StarIcon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from "@heroicons/react/24/solid";
import { SparklineChart } from "./Charts";

interface Props {
  account: Account;
  pots: Pot[];
  transactions: Transaction[];
  onClick: (account: Account) => void;
  usdRate?: number;
  cryptoPrices?: CryptoPrices;
  displayCurrency?: "MYR" | "USD";
  hideBalance?: boolean;
}

const AccountCard: React.FC<Props> = ({
  account,
  pots,
  transactions,
  onClick,
  usdRate = 1,
  cryptoPrices = { BTC: 65000, ETH: 3500 },
  displayCurrency = "MYR",
  hideBalance = false,
}) => {
  const accountPots = pots.filter((p) => p.accountId === account.id);
  const totalInPots = accountPots.reduce(
    (sum, p) => sum + (p.currentAmount || 0),
    0,
  );
  const availableBalance = account.balance - totalInPots;

  // Convert balance for display
  const displayBalance = React.useMemo(() => {
    if (account.currency === "MYR") {
      return displayCurrency === "MYR"
        ? account.balance
        : account.balance / usdRate;
    }

    let valInUSD = account.balance;
    if (account.currency === "BTC")
      valInUSD = account.balance * cryptoPrices.BTC;
    else if (account.currency === "ETH")
      valInUSD = account.balance * cryptoPrices.ETH;

    return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
  }, [
    account.balance,
    account.currency,
    usdRate,
    displayCurrency,
    cryptoPrices,
  ]);

  const displayPotsBalance = React.useMemo(() => {
    if (account.currency === "MYR") {
      return displayCurrency === "MYR"
        ? availableBalance
        : availableBalance / usdRate;
    }

    let valInUSD = availableBalance;
    if (account.currency === "BTC")
      valInUSD = availableBalance * cryptoPrices.BTC;
    else if (account.currency === "ETH")
      valInUSD = availableBalance * cryptoPrices.ETH;

    return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
  }, [
    availableBalance,
    account.currency,
    usdRate,
    displayCurrency,
    cryptoPrices,
  ]);

  // Real trend data for the account
  const trendData = React.useMemo(() => {
    const accountTxs = transactions
      .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (accountTxs.length === 0) return [account.balance, account.balance];

    const balancePoints: number[] = [];
    let runningBalance = account.balance;

    // Work backwards from current balance
    const reversedTxs = [...accountTxs].reverse();
    balancePoints.push(runningBalance);

    for (const tx of reversedTxs) {
      if (tx.type === TransactionType.INCOME) {
        if (tx.accountId === account.id) runningBalance -= tx.amount;
      } else if (tx.type === TransactionType.EXPENSE) {
        if (tx.accountId === account.id) runningBalance += tx.amount;
      } else if (tx.type === TransactionType.TRANSFER) {
        if (tx.accountId === account.id) runningBalance += tx.amount;
        if (tx.toAccountId === account.id) runningBalance -= tx.amount;
      }
      balancePoints.push(runningBalance);
      if (balancePoints.length >= 15) break; // Limit to last 15 points
    }

    return balancePoints.reverse();
  }, [account.id, account.balance, transactions]);

  const lastPoint = trendData[trendData.length - 1];
  const prevPoint = trendData[0];
  const diff = lastPoint - prevPoint;
  const isPositive = diff >= 0;
  const percentChange =
    prevPoint !== 0 ? (diff / Math.abs(prevPoint)) * 100 : 0;

  return (
    <div
      className="relative rounded-[2.5rem] bg-linear-to-br from-surface/80 to-surface/40 border border-gray-800/50 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer p-7 group h-70 flex flex-col justify-between overflow-hidden"
      onClick={() => onClick(account)}
    >
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none" />

      {/* Background radial glow */}
      <div
        className={`absolute -right-20 -top-20 w-48 h-48 rounded-full blur-[80px] transition-opacity duration-500 opacity-20 group-hover:opacity-40 ${isPositive ? "bg-emerald-500/30" : "bg-rose-500/30"}`}
      />

      <div className="relative z-10 flex justify-between items-start">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 shrink-0 rounded-[1.25rem] bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-2xl group-hover:border-emerald-500/30 transition-colors">
            {account.iconType === "IMAGE" ? (
              <img
                src={account.iconValue}
                className="w-9 h-9 object-contain"
                alt=""
              />
            ) : (
              <span className="scale-110">{account.iconValue}</span>
            )}
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="font-bold text-lg text-white tracking-tight truncate">
              {account.name}
            </h4>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest truncate">
                {account.type} • {account.currency}
              </p>
              {accountPots.length > 0 && (
                <div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20 animate-pulse">
                  <StarIcon className="w-2.5 h-2.5" />
                  <span className="text-[9px] font-black">
                    {accountPots.length} LIMITS
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-black text-gray-500">
            {displayCurrency === "MYR" ? "RM" : "$"}
          </span>
          <span className="text-4xl font-black text-white tracking-tighter">
            {hideBalance
              ? "****"
              : displayBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </span>
        </div>
        {totalInPots > 0 && (
          <div className="mt-1">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              {displayCurrency === "MYR" ? "RM" : "$"}{" "}
              {hideBalance ? "****" : displayPotsBalance.toLocaleString()} Available
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10 flex justify-between items-end pt-4 border-t border-gray-800/30">
        <div className="space-y-1">
          <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest opacity-60">
            Trend {trendData.length > 1 ? "Activity" : "Static"}
          </p>
          <div
            className={`flex items-center gap-1 text-[11px] font-black tracking-tight ${isPositive ? "text-emerald-400" : "text-rose-400"}`}
          >
            {isPositive ? (
              <ArrowUpRightIcon className="w-3 h-3 stroke-3" />
            ) : (
              <ArrowDownRightIcon className="w-3 h-3 stroke-3" />
            )}
            {Math.abs(percentChange).toFixed(1)}%
          </div>
        </div>
        <div className="w-28 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
          <SparklineChart
            data={trendData}
            color={isPositive ? "#10b981" : "#f43f5e"}
            height={40}
          />
        </div>
      </div>
    </div>
  );
};

export default AccountCard;
