import React, { useState, useMemo } from "react";
import { useOutletContext, Link } from "react-router-dom";
import {
  PlusIcon,
  ChevronRightIcon,
  QrCodeIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  ListBulletIcon,
  CalendarIcon,
  EyeIcon,
  EyeSlashIcon,
  Squares2X2Icon,
  BellIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarDaysIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { ArrowUpRightIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../services/auth.services";
import { useData } from "../context/DataContext";
import CurrencyRateCard from "../components/CurrencyRateCard";
import { SparklineChart, CategoryPieChart } from "../components/Charts";
import AccountCard from "../components/AccountCard";
import AccountDetailModal from "../components/AccountDetailModal";
import AIInsights from "../components/AIInsights";
import {
  groupTransactions,
  normalizeDate,
  GroupedTransaction,
} from "../helpers/transactions.helper";
import { TransactionType, Account } from "../types";

type TimeFrame = "1D" | "1W" | "1M" | "YTD" | "ALL";

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const {
    accounts,
    transactions,
    categories,
    pots,
    goals,
    chatSessions,
    handleSaveChatSession,
    handleDeleteChatSession,
    usdRate,
    cryptoPrices,
    exchangeRate,
    displayCurrency,
    setDisplayCurrency,
  } = useData();
  const {
    setShowAddModal,
    setShowAccountForm,
    setEditingAccount,
    setShowCategoryManager,
  } = useOutletContext<any>();

  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeFrame | "CUSTOM">("1M");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTransactionPie, setShowTransactionPie] = useState(false);
  const [customRange, setCustomRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Calculate the display range label for the UI
  const displayRange = useMemo(() => {
    const end = new Date();
    let start = new Date();

    if (timeframe === "1D") {
      // Just today
    } else if (timeframe === "1W") {
      start.setDate(end.getDate() - 7);
    } else if (timeframe === "1M") {
      start.setDate(end.getDate() - 30);
    } else if (timeframe === "YTD") {
      start = new Date(end.getFullYear(), 0, 1);
    } else if (timeframe === "ALL") {
      const allDates = transactions.map((t) => new Date(t.date).getTime());
      if (allDates.length > 0) start = new Date(Math.min(...allDates));
      else start = new Date(0);
    } else if (timeframe === "CUSTOM") {
      return `${new Date(customRange.start).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} - ${new Date(customRange.end).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}`;
    }

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [timeframe, customRange, transactions]);

  // Calculate total balance in selected display currency
  const totalBalance = useMemo(() => {
    const totalMYR = accounts.reduce((sum, a) => {
      if (a.currency === "MYR") return sum + a.balance;

      let valInUSD = a.balance;
      if (a.currency === "BTC") valInUSD = a.balance * cryptoPrices.BTC;
      else if (a.currency === "ETH") valInUSD = a.balance * cryptoPrices.ETH;

      return sum + valInUSD * usdRate;
    }, 0);

    return displayCurrency === "MYR" ? totalMYR : totalMYR / usdRate;
  }, [accounts, usdRate, cryptoPrices, displayCurrency]);

  // Filter transactions based on timeframe
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    let startLimit = new Date();
    startLimit.setHours(0, 0, 0, 0);

    if (timeframe === "1D") {
      // already set to start of today
    } else if (timeframe === "1W") {
      startLimit.setDate(now.getDate() - 7);
    } else if (timeframe === "1M") {
      startLimit.setDate(now.getDate() - 30);
    } else if (timeframe === "YTD") {
      startLimit = new Date(now.getFullYear(), 0, 1);
    } else if (timeframe === "ALL") {
      startLimit = new Date(0); // Beginning of time
    } else if (timeframe === "CUSTOM") {
      startLimit = new Date(customRange.start);
      now.setTime(new Date(customRange.end).getTime());
      now.setHours(23, 59, 59, 999);
    }

    return transactions.filter((t) => {
      const d = new Date(t.date);
      return d >= startLimit && d <= now;
    });
  }, [transactions, timeframe]);

  // Calculate change for the current timeframe
  const timeframeStats = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => {
        let valInUSD = t.amount;
        if (t.currency === "MYR") {
          return (
            sum + (displayCurrency === "MYR" ? t.amount : t.amount / usdRate)
          );
        }
        if (t.currency === "BTC") valInUSD = t.amount * cryptoPrices.BTC;
        else if (t.currency === "ETH") valInUSD = t.amount * cryptoPrices.ETH;

        return (
          sum + (displayCurrency === "USD" ? valInUSD : valInUSD * usdRate)
        );
      }, 0);

    const expense = filteredTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => {
        let valInUSD = t.amount;
        if (t.currency === "MYR") {
          return (
            sum + (displayCurrency === "MYR" ? t.amount : t.amount / usdRate)
          );
        }
        if (t.currency === "BTC") valInUSD = t.amount * cryptoPrices.BTC;
        else if (t.currency === "ETH") valInUSD = t.amount * cryptoPrices.ETH;

        return (
          sum + (displayCurrency === "USD" ? valInUSD : valInUSD * usdRate)
        );
      }, 0);

    const change = income - expense;
    const isPositive = change >= 0;

    // Calculate percentage change relative to total balance
    const percentChange =
      totalBalance !== 0 ? (change / Math.abs(totalBalance)) * 100 : 0;

    return { income, expense, change, isPositive, percentChange };
  }, [filteredTransactions, usdRate, displayCurrency, totalBalance]);

  // Generate trend points for the balance overview card
  const trendPoints = useMemo(() => {
    const numPoints = 12;
    const now = new Date();
    let startLimit = new Date();

    if (timeframe === "1D") startLimit.setHours(now.getHours() - 24);
    else if (timeframe === "1W") startLimit.setDate(now.getDate() - 7);
    else if (timeframe === "1M") startLimit.setDate(now.getDate() - 30);
    else if (timeframe === "YTD")
      startLimit = new Date(now.getFullYear(), 0, 1);
    else if (timeframe === "ALL") {
      const allDates = transactions.map((t) => new Date(t.date).getTime());
      startLimit =
        allDates.length > 0
          ? new Date(Math.min(...allDates))
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "CUSTOM") {
      startLimit = new Date(customRange.start);
    }

    const duration = now.getTime() - startLimit.getTime();
    const interval = duration / (numPoints - 1);
    const resultLabels: string[] = [];
    const resultData: number[] = [];

    // All transactions sorted by date descending to help with balance backtracking
    const sortedTxs = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    for (let i = 0; i < numPoints; i++) {
      const pointTime = startLimit.getTime() + i * interval;
      const pointDate = new Date(pointTime);

      // Calculate balance at this specific point in time
      // Balance @ Point = Current Total - Transactions that happened AFTER this point
      let balanceAtPoint = totalBalance;

      for (const tx of sortedTxs) {
        const txTime = new Date(tx.date).getTime();
        if (txTime <= pointTime) break; // Optimization: since txs are sorted desc, we can stop early

        let txValueInBase = tx.amount;
        if (tx.currency === "MYR") {
          txValueInBase =
            displayCurrency === "MYR" ? tx.amount : tx.amount / usdRate;
        } else {
          // Crypto or other non-MYR
          let valInUSD = tx.amount;
          if (tx.currency === "BTC") valInUSD = tx.amount * cryptoPrices.BTC;
          else if (tx.currency === "ETH")
            valInUSD = tx.amount * cryptoPrices.ETH;
          txValueInBase =
            displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
        }

        if (tx.type === TransactionType.INCOME) balanceAtPoint -= txValueInBase;
        else if (tx.type === TransactionType.EXPENSE)
          balanceAtPoint += txValueInBase;
      }

      resultLabels.push(
        pointDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
        }),
      );
      resultData.push(balanceAtPoint);
    }

    return { labels: resultLabels, data: resultData };
  }, [
    transactions,
    timeframe,
    customRange,
    totalBalance,
    displayCurrency,
    usdRate,
    cryptoPrices,
  ]);

  // Spending data (Grouped by Category)
  const spendingByCategory = useMemo(() => {
    const spending = filteredTransactions.filter(
      (t) => t.type === TransactionType.EXPENSE,
    );
    const groups: Record<string, number> = {};

    spending.forEach((t) => {
      const catObj = categories.find((c) => c.id === t.categoryId);
      const catName = catObj?.name || "Other";

      let amountInUSD = t.amount;
      if (t.currency === "MYR") {
        amountInUSD = t.amount / usdRate;
      } else if (t.currency === "BTC") {
        amountInUSD = t.amount * cryptoPrices.BTC;
      } else if (t.currency === "ETH") {
        amountInUSD = t.amount * cryptoPrices.ETH;
      }

      const amount =
        displayCurrency === "USD" ? amountInUSD : amountInUSD * usdRate;
      groups[catName] = (groups[catName] || 0) + amount;
    });

    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [
    filteredTransactions,
    displayCurrency,
    usdRate,
    categories,
    cryptoPrices,
  ]);

  const pieChartData = useMemo(() => {
    const colors = [
      "#6366f1", // indigo
      "#10b981", // emerald
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // violet
      "#ec4899", // pink
      "#06b6d4", // cyan
    ];
    return spendingByCategory.map(([label, value], i) => ({
      label,
      value,
      color: colors[i % colors.length],
    }));
  }, [spendingByCategory]);

  // Currency strength metrics
  const currencyStats = useMemo(() => {
    if (
      !exchangeRate ||
      !exchangeRate.history ||
      exchangeRate.history.length === 0
    ) {
      return { label: "Stable", change: 0, isStronger: true };
    }

    const history = [...exchangeRate.history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const now = new Date();
    let targetDate = new Date();
    if (timeframe === "1D") targetDate.setDate(now.getDate() - 1);
    else if (timeframe === "1W") targetDate.setDate(now.getDate() - 7);
    else if (timeframe === "1M") targetDate.setDate(now.getDate() - 30);
    else if (timeframe === "YTD")
      targetDate = new Date(now.getFullYear(), 0, 1);
    else targetDate = new Date(0);

    const historicalRateObj =
      history.find((h) => new Date(h.date) <= targetDate) ||
      history[history.length - 1];
    const historicalRate = historicalRateObj.rate;
    const currentRate = usdRate;

    const change = currentRate - historicalRate;
    const percentChange = (change / historicalRate) * 100;
    const isStronger = change <= 0; // Lower rate means stronger MYR

    return {
      label: isStronger ? "Stronger" : "Weaker",
      change: Math.abs(percentChange),
      isStronger,
    };
  }, [exchangeRate, usdRate, timeframe]);

  const usdRateTrend = useMemo(() => {
    if (!exchangeRate?.history) return { labels: [], data: [] };

    const now = new Date();
    let startLimit = new Date();
    if (timeframe === "1D") startLimit.setHours(now.getHours() - 24);
    else if (timeframe === "1W") startLimit.setDate(now.getDate() - 7);
    else if (timeframe === "1M") startLimit.setDate(now.getDate() - 30);
    else if (timeframe === "YTD")
      startLimit = new Date(now.getFullYear(), 0, 1);
    else if (timeframe === "ALL") startLimit = new Date(0);
    else if (timeframe === "CUSTOM") startLimit = new Date(customRange.start);

    const filteredHistory = exchangeRate.history
      .filter((h) => new Date(h.date) >= startLimit)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      labels: filteredHistory.map((h) =>
        new Date(h.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
        }),
      ),
      data: filteredHistory.map((h) => h.rate),
    };
  }, [exchangeRate, timeframe, customRange]);

  const sortedRecentTransactions = useMemo(() => {
    return groupTransactions(filteredTransactions);
  }, [filteredTransactions]);

  return (
    <div className="animate-fadeIn space-y-8 pb-10 max-w-7xl mx-auto px-4 lg:px-8">
      {/* Laptop Style Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 py-6 pt-10">
        <div>
          <div className="flex items-center gap-3 text-gray-400 mb-1">
            <CalendarIcon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Welcome back, {profile?.name?.split(" ")[0]}!
          </h1>
        </div>
      </div>

      {/* Primary Grid Layout */}
      <div className="space-y-8">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-surface/50 border border-gray-800/50 p-1.5 rounded-2xl">
            {["1D", "1W", "1M", "YTD", "ALL"].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf as TimeFrame)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                  timeframe === tf
                    ? "bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowDatePicker(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface/50 border border-gray-800/50 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 hover:bg-surface hover:border-indigo-500/30"
          >
            <CalendarIcon className="w-4 h-4 text-indigo-400" />
            <span>{timeframe === "1D" ? "Today" : displayRange}</span>
            <ChevronUpDownIcon className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Top Row: AI, Balance, Currency */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Balance Overview Card */}
          <div className="lg:col-span-6 bg-surface/40 backdrop-blur-md border border-gray-800/60 p-8 rounded-[2rem] flex flex-col group relative overflow-hidden min-h-[320px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -mr-16 -mt-16"></div>

            <div className="relative z-10 flex justify-between items-start mb-6">
              <div>
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 block">
                  Balance Overview
                </span>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">
                    {hideBalance
                      ? "••••••"
                      : `${displayCurrency === "MYR" ? "RM" : "$"}${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0 })}`}
                  </h3>
                  <button
                    onClick={() => setHideBalance(!hideBalance)}
                    className="text-gray-600 hover:text-gray-400"
                  >
                    {hideBalance ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer">
                <ArrowUpRightIcon className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-1 font-black text-sm ${timeframeStats.isPositive ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {timeframeStats.isPositive ? "↑" : "↓"}{" "}
                    {Math.abs(timeframeStats.percentChange).toFixed(1)}%
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    from{" "}
                    {timeframe === "1D"
                      ? "yesterday"
                      : timeframe === "1W"
                        ? "last week"
                        : timeframe === "1M"
                          ? "last month"
                          : timeframe === "YTD"
                            ? "start of year"
                            : timeframe === "CUSTOM"
                              ? "prev point"
                              : "all time"}
                  </span>
                </div>
              </div>

              {!hideBalance && (
                <div className="h-24 w-full mt-4">
                  <SparklineChart
                    data={trendPoints.data}
                    labels={trendPoints.labels}
                    color={timeframeStats.isPositive ? "#10b981" : "#f43f5e"}
                    height={96}
                    interactive={true}
                  />
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Selected Date
                </span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {displayRange}
                </span>
              </div>
            </div>
          </div>

          {/* USD/MYR Card (Market Rates + Display Settings) */}
          <div className="lg:col-span-6 bg-surface/40 backdrop-blur-md border border-gray-800/60 p-8 rounded-[2rem] flex flex-col group relative overflow-hidden min-h-[320px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[60px] -mr-16 -mt-16"></div>

            <div className="relative z-10 flex justify-between items-start mb-6">
              <div>
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 block">
                  Market Rates & Settings
                </span>
                <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1 w-fit">
                  {["MYR", "USD"].map((curr) => (
                    <button
                      key={curr}
                      onClick={() => setDisplayCurrency(curr as "MYR" | "USD")}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                        displayCurrency === curr
                          ? "bg-white text-black shadow-lg"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-between">
              <div className="h-24 w-full mt-2">
                {usdRateTrend.data.length > 0 ? (
                  <SparklineChart
                    data={usdRateTrend.data}
                    labels={usdRateTrend.labels}
                    color={currencyStats.isStronger ? "#10b981" : "#f43f5e"}
                    height={96}
                    interactive={true}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-900/50 rounded-2xl border border-gray-800/50 border-dashed">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                      No history data
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-end">
                <div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">
                    Live Rate
                  </span>
                  <span className="text-2xl font-black text-white">
                    1 USD = {usdRate.toFixed(4)}{" "}
                    <span className="text-sm text-gray-500">MYR</span>
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${currencyStats.isStronger ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {currencyStats.label} ({currencyStats.change.toFixed(2)}%)
                  </span>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    vs {timeframe}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Transactions */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Transactions List */}
          <div className="lg:col-span-12 bg-surface/40 border border-gray-800/60 rounded-[2rem] overflow-hidden flex flex-col h-[450px]">
            <div className="p-8 pb-4 flex justify-between items-center sticky top-0 bg-surface/20 backdrop-blur-md z-10">
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                Recent Transactions
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-800/50 px-2 py-1 rounded-md">
                  {filteredTransactions.length}
                </span>
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTransactionPie(!showTransactionPie)}
                  className={`p-2.5 border rounded-xl transition-all ${
                    showTransactionPie
                      ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {showTransactionPie ? (
                    <ListBulletIcon className="w-5 h-5" />
                  ) : (
                    <ChartPieIcon className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/10"
                >
                  <PlusIcon className="w-5 h-5 stroke-[3]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-6">
              {showTransactionPie ? (
                <div className="h-full flex items-center justify-center p-8 animate-fadeIn">
                  {pieChartData.length > 0 ? (
                    <CategoryPieChart data={pieChartData} height={350} />
                  ) : (
                    <div className="text-center opacity-30">
                      <ChartPieIcon className="w-16 h-16 mx-auto mb-4" />
                      <p className="font-black uppercase tracking-widest text-xs">
                        No spending data
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sortedRecentTransactions
                    .slice(0, 15)
                    .map((t: GroupedTransaction) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-center px-4 py-3 hover:bg-white/5 transition-all rounded-2xl group cursor-pointer border-b border-gray-800/20 last:border-0"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 shrink-0 bg-gray-900 rounded-xl flex items-center justify-center text-lg border border-gray-800 group-hover:bg-gray-800 transition-colors">
                            {t.linkedTransaction
                              ? "↔️"
                              : categories.find((c) => c.id === t.categoryId)
                                  ?.icon ||
                                (t.type === TransactionType.TRANSFER && "↔️") ||
                                "💰"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-100 group-hover:text-indigo-400 transition-colors truncate">
                              {t.linkedTransaction
                                ? t.shopName || (
                                    <>
                                      {accounts.find(
                                        (a) => a.id === t.accountId,
                                      )?.name || "Unknown"}{" "}
                                      ➔{" "}
                                      {accounts.find(
                                        (a) => a.id === t.toAccountId,
                                      )?.name || "Unknown"}
                                    </>
                                  )
                                : t.shopName ||
                                  categories.find((c) => c.id === t.categoryId)
                                    ?.name ||
                                  "Untitled"}
                            </p>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest truncate">
                              {normalizeDate(t.date)} • {t.time || "No Time"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p
                            className={`font-black text-xl tracking-tighter whitespace-nowrap ${
                              t.linkedTransaction
                                ? "text-indigo-400"
                                : t.type === TransactionType.INCOME ||
                                    (t.type === TransactionType.TRANSFER &&
                                      t.transferDirection === "IN")
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                            }`}
                          >
                            <span className="opacity-70 mr-1.5">
                              {t.linkedTransaction
                                ? ""
                                : t.type === TransactionType.INCOME ||
                                    (t.type === TransactionType.TRANSFER &&
                                      t.transferDirection === "IN")
                                  ? "+"
                                  : "-"}
                              {displayCurrency === "MYR" ? "RM" : "$"}
                            </span>
                            {(displayCurrency === "MYR"
                              ? t.currency === "USD"
                                ? t.amount * usdRate
                                : t.amount
                              : t.currency === "MYR"
                                ? t.amount / usdRate
                                : t.amount
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  {filteredTransactions.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center py-16 text-gray-500 opacity-40">
                      <CalendarDaysIcon className="w-16 h-16 mb-4" />
                      <p className="font-black uppercase tracking-[0.2em] text-xs">
                        No transactions in this period
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account List - Gallery View */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black tracking-tight text-white uppercase tracking-[0.1em]">
            My Assets
          </h2>
          <Link
            to="/profile"
            className="text-indigo-400 text-xs font-black uppercase tracking-widest hover:text-indigo-300"
          >
            Manage Accounts
          </Link>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 lg:-mx-8 lg:px-8 snap-x">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex-shrink-0 w-[320px] snap-start">
              <AccountCard
                account={acc}
                pots={pots}
                transactions={transactions}
                onClick={(a) => setViewAccount(a)}
                hideBalance={hideBalance}
                displayCurrency={displayCurrency}
                usdRate={usdRate}
                cryptoPrices={cryptoPrices}
              />
            </div>
          ))}

          {/* Add Asset Card */}
          <button
            onClick={() => setShowAccountForm(true)}
            className="flex-shrink-0 w-[280px] h-[280px] rounded-[2.5rem] bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 flex flex-col items-center justify-center gap-4 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all group snap-start"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlusIcon className="w-8 h-8 text-indigo-400 stroke-[3]" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">
              Add New Asset
            </span>
          </button>
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

      {showDatePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDatePicker(false)}
          />
          <div className="relative w-full max-w-sm bg-surface border border-gray-800 rounded-[2.5rem] p-8 shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-black text-white tracking-tight mb-6">
              Select Date Range
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={(e) =>
                    setCustomRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                  End Date
                </label>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={(e) =>
                    setCustomRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="px-6 py-4 rounded-2xl bg-gray-900 border border-gray-800 text-gray-400 font-bold hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setTimeframe("CUSTOM");
                    setShowDatePicker(false);
                  }}
                  className="px-6 py-4 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
