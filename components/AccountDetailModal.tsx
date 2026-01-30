import React, { useMemo } from "react";
import { Account, Transaction, TransactionType, Pot } from "../types";
import { useData } from "../context/DataContext";
import {
  XMarkIcon,
  CreditCardIcon,
  ClipboardDocumentIcon,
  WalletIcon,
} from "@heroicons/react/24/outline";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
);

import { normalizeDate } from "../helpers/transactions.helper";

interface Props {
  account: Account;
  transactions: Transaction[];
  pots: Pot[];
  onClose: () => void;
  onEdit: (account: Account) => void;
}

const AccountDetailModal: React.FC<Props> = ({
  account,
  transactions,
  pots,
  onClose,
  onEdit,
}) => {
  const { usdRate, cryptoPrices, displayCurrency } = useData();

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case "MYR":
        return "RM";
      case "USD":
        return "$";
      case "BTC":
        return "₿";
      case "ETH":
        return "Ξ";
      default:
        return currency;
    }
  };

  const accountPots = pots.filter((p) => p.accountId === account.id);
  const totalInPots = accountPots.reduce((sum, p) => sum + p.currentAmount, 0);
  const availableBalance = account.balance - totalInPots;

  // Conversion value if different from display currency
  const convertedBalance = useMemo(() => {
    if (account.currency === displayCurrency) return null;

    if (account.currency === "MYR") {
      return displayCurrency === "USD" ? account.balance / usdRate : null;
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
    displayCurrency,
    usdRate,
    cryptoPrices,
  ]);

  // Generate and process data for ChartJS
  const chartData = useMemo(() => {
    // Generate data for the last 30 days
    const data = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));

      // Format YYYY-MM-DD local time
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fullDate: dateStr,
        balance: 0, // Placeholder, we calculate below
      };
    });

    // Calculate retrospective balance
    let runningBalance = account.balance;
    // Sort transactions descending (newest first)
    const accountTrans = transactions
      .filter((t) => t.accountId === account.id || t.toAccountId === account.id)
      .sort((a, b) =>
        normalizeDate(b.date).localeCompare(normalizeDate(a.date)),
      );

    // We need bucket transactions by day to subtract/add them from current balance efficiently
    const transByDay: Record<string, number> = {};
    accountTrans.forEach((t) => {
      const d = normalizeDate(t.date);
      let amount = 0;
      const absAmount = Math.abs(t.amount);

      if (t.accountId === account.id && t.type === TransactionType.EXPENSE)
        amount -= absAmount;
      else if (
        t.accountId === account.id &&
        t.type === TransactionType.TRANSFER
      )
        amount -= absAmount;
      else if (
        t.toAccountId === account.id &&
        t.type === TransactionType.TRANSFER
      )
        amount += absAmount;
      else if (t.type === TransactionType.INCOME) amount += absAmount;
      else if (
        t.type === TransactionType.ACCOUNT_OPENING ||
        t.type === TransactionType.ADJUSTMENT
      )
        amount += t.amount;

      transByDay[d] = (transByDay[d] || 0) + amount;
    });

    // Fill data array backwards
    let currentSimulatedBalance = runningBalance;

    for (let i = data.length - 1; i >= 0; i--) {
      data[i].balance = currentSimulatedBalance;
      const change = transByDay[data[i].fullDate] || 0;
      currentSimulatedBalance -= change;
    }

    return {
      labels: data.map((d) => d.date),
      datasets: [
        {
          label: "Balance",
          data: data.map((d) => d.balance),
          fill: true,
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
            gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
            return gradient;
          },
          borderColor: "#6366f1", // Indigo 500
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        },
      ],
    };
  }, [account, transactions]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "#18181b",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#27272a",
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label +=
                getCurrencySymbol(account.currency) +
                " " +
                context.parsed.y.toLocaleString(undefined, {
                  minimumFractionDigits:
                    account.currency === "BTC" || account.currency === "ETH"
                      ? 8
                      : 2,
                });
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: "#666",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: { size: 10 },
        },
        border: { display: true, color: "#333" },
      },
      y: {
        grid: { color: "#333", drawBorder: false, borderDash: [5, 5] },
        ticks: {
          color: "#666",
          font: { size: 10 },
          callback: (value: any) => {
            if (value >= 1000000000)
              return `${(value / 1000000000).toFixed(1)}B`;
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value;
          },
        },
        border: { display: false },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  const copyToClipboard = (text?: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      // Optional: show small toast
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-sm p-0 sm:p-4 md:p-6 animate-fadeIn">
      <div className="w-full max-w-2xl md:max-w-4xl bg-card rounded-t-3xl sm:rounded-3xl border-t sm:border border-gray-800 shadow-2xl flex flex-col h-[92vh] sm:h-auto max-h-[92vh] md:max-h-[85vh] overflow-hidden animate-slideUp sm:animate-fadeIn">
        {/* Header */}
        <div className="p-4 sm:p-6 pb-2 flex justify-between items-start shrink-0 border-b border-gray-800 sm:border-none">
          <div className="flex items-center gap-3 sm:gap-4">
            {account.iconType === "IMAGE" ? (
              <img
                src={account.iconValue}
                alt="icon"
                className="w-10 h-10 sm:w-14 sm:h-14 object-contain bg-white rounded-full p-1"
              />
            ) : (
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-surface rounded-full flex items-center justify-center text-xl sm:text-3xl border border-gray-700">
                {account.iconValue}
              </div>
            )}
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">
                {account.name}
              </h2>
              <span className="text-[10px] sm:text-xs bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold tracking-wider inline-block mt-1">
                {account.type}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(account)}
              className="text-xs sm:text-sm px-3 sm:px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors font-bold text-white"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 sm:border-none"
            >
              <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 overflow-y-auto flex-1 custom-scrollbar pb-20 sm:pb-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
            {/* Header / Summary Section - Full Width on md */}
            <div className="md:col-span-12">
              {/* Main Balance */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <p className="text-gray-400 text-[10px] sm:text-xs mb-1 uppercase tracking-widest font-bold">
                    Current Balance
                  </p>
                  <h3 className="text-3xl sm:text-4xl font-black text-white">
                    <span className="text-gray-500 text-sm sm:text-base mr-1 font-medium">
                      {getCurrencySymbol(account.currency)}
                    </span>
                    {account.balance.toLocaleString("en-US", {
                      minimumFractionDigits:
                        account.currency === "BTC" || account.currency === "ETH"
                          ? 8
                          : 2,
                    })}
                  </h3>
                  {convertedBalance !== null && (
                    <p className="text-gray-500 text-sm font-bold mt-1">
                      ≈ {getCurrencySymbol(displayCurrency)}{" "}
                      {convertedBalance.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}
                    </p>
                  )}
                </div>
                {totalInPots > 0 && (
                  <div className="sm:text-right bg-primary/5 sm:bg-transparent p-3 sm:p-0 rounded-2xl border border-primary/10 sm:border-none">
                    <p className="text-primary text-[10px] sm:text-xs mb-1 uppercase tracking-widest font-bold flex items-center sm:justify-end gap-1">
                      <WalletIcon className="w-3 h-3 sm:w-4 sm:h-4" /> Available
                      • {accountPots.length} Active Pots
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-success">
                      <span className="text-success/50 text-sm sm:text-base mr-1 font-medium">
                        {getCurrencySymbol(account.currency)}
                      </span>
                      {availableBalance.toLocaleString("en-US", {
                        minimumFractionDigits:
                          account.currency === "BTC" ||
                          account.currency === "ETH"
                            ? 8
                            : 2,
                      })}
                    </h3>
                  </div>
                )}
              </div>
            </div>

            {/* Left Side - Analytics */}
            <div className="md:col-span-7 space-y-8">
              {/* Graph */}
              <div className="h-64 md:h-full min-h-64 md:min-h-80 w-full bg-surface/50 rounded-2xl p-4 border border-gray-800">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Right Side - Details & Limits */}
            <div className="md:col-span-5 space-y-8">
              {/* Active Limits */}
              {accountPots.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <WalletIcon className="w-5 h-5 text-primary" /> Active
                    Limits
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 md:grid-cols-1 gap-3">
                    {accountPots.map((pot) => {
                      const usedAmount = pot.targetAmount - pot.currentAmount;
                      const progress = (usedAmount / pot.targetAmount) * 100;
                      return (
                        <div
                          key={pot.id}
                          className="bg-surface rounded-xl p-4 border border-gray-800"
                        >
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-bold text-white">
                              {pot.name}
                            </span>
                            <span className="text-xs text-primary font-bold">
                              {getCurrencySymbol(account.currency)}
                              {pot.currentAmount.toLocaleString(undefined, {
                                minimumFractionDigits:
                                  account.currency === "BTC" ||
                                  account.currency === "ETH"
                                    ? 8
                                    : 2,
                              })}{" "}
                              Available
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${progress >= 100 ? "bg-red-500" : "bg-primary"}`}
                              style={{
                                width: `${Math.max(0, Math.min(100, progress))}%`,
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-gray-500 uppercase">
                              Used: {getCurrencySymbol(account.currency)}
                              {usedAmount.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase">
                              Limit: {getCurrencySymbol(account.currency)}
                              {pot.targetAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Account Details */}
              {account.details && (
                <div className="bg-surface rounded-xl p-5 border border-gray-800 space-y-4">
                  <h4 className="font-bold text-white flex items-center gap-2">
                    <CreditCardIcon className="w-5 h-5 text-primary" /> Account
                    Details
                  </h4>

                  <div className="grid grid-cols-1 lg:grid-cols-2 md:grid-cols-1 gap-6">
                    {account.details.holderName && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">
                          Account Holder
                        </label>
                        <p className="font-mono text-gray-200">
                          {account.details.holderName}
                        </p>
                      </div>
                    )}
                    {account.details.accountNumber && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">
                          Account Number
                        </label>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-gray-200 text-lg tracking-wider">
                            {account.details.accountNumber}
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(account.details?.accountNumber)
                            }
                            className="text-gray-500 hover:text-white"
                          >
                            <ClipboardDocumentIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {account.details.expiry && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">
                          Expiry
                        </label>
                        <p className="font-mono text-gray-200">
                          {account.details.expiry}
                        </p>
                      </div>
                    )}
                    {account.details.cvv && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase">
                          CVV
                        </label>
                        <p className="font-mono text-gray-200">***</p>
                      </div>
                    )}
                  </div>

                  {account.details.note && (
                    <div className="pt-2 border-t border-gray-800">
                      <p className="text-xs text-gray-500 italic">
                        {account.details.note}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDetailModal;
