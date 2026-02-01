import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ScriptableContext,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import { Transaction, TransactionType } from "../types";
import { useData } from "../context/DataContext";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
);

// --- HELPER TO PARSE DATE SAFE ---
const toYMD = (dateInput: string | number | undefined): string => {
  if (!dateInput) return "1970-01-01";

  const s = String(dateInput);

  // If it's a numeric serial date (usually 5 digits)
  if (typeof dateInput === "number" || /^\d{5}$/.test(s)) {
    const serial = Number(dateInput);
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + serial * 86400000);
    return d.toLocaleDateString("en-CA");
  }

  // If it's already a simple YYYY-MM-DD string, trust it (avoid timezone shifts)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Try parsing (Handles ISO strings, etc)
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      // Use local timezone as requested
      if (s.includes("T")) {
        return d.toLocaleDateString("en-CA");
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    /* ignore */
  }
  return "1970-01-01";
};

// --- NET WORTH CHART ---

interface Props {
  transactions: Transaction[];
  currentTotal?: number;
  usdRate?: number;
  displayCurrency?: "MYR" | "USD";
}

export const NetWorthChart: React.FC<Props> = ({
  transactions,
  currentTotal = 0,
  usdRate = 4.5,
  displayCurrency = "MYR",
}) => {
  const chartData = useMemo(() => {
    const points: { date: string; balance: number }[] = [];
    let runningBalance = currentTotal;

    // Push today's state
    const now = new Date();
    const todayStr = toYMD(now.toISOString());

    points.push({
      date: todayStr,
      balance: runningBalance,
    });

    if (transactions.length === 0) {
      // flat line
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      points.push({
        date: toYMD(yesterday.toISOString()),
        balance: runningBalance,
      });
    } else {
      const sortedDetails = [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      const dailyEffects = new Map<string, number>();

      sortedDetails.forEach((t) => {
        const date = toYMD(t.date);
        let effect = 0;
        const absAmount = Math.abs(t.amount);

        if (t.type === TransactionType.INCOME) effect = absAmount;
        else if (t.type === TransactionType.EXPENSE) effect = -absAmount;
        else if (
          t.type === TransactionType.ADJUSTMENT ||
          t.type === TransactionType.ACCOUNT_OPENING
        )
          effect = t.amount;
        else if (t.type === TransactionType.ACCOUNT_DELETE) effect = -t.amount;

        // Convert the transaction amount to the DISPLAY currency for backtracking
        // 1. If we are displaying MYR, all USD/Crypto txs must be converted to MYR
        // 2. If we are displaying USD, all MYR txs must be converted to USD
        if (displayCurrency === "MYR") {
          if (t.currency !== "MYR") effect *= usdRate;
        } else {
          if (t.currency === "MYR") effect /= usdRate;
          // non-MYR are already USD-equivalent in our logic
        }

        dailyEffects.set(date, (dailyEffects.get(date) || 0) + effect);
      });

      const dates = Array.from(dailyEffects.keys()).sort((a, b) =>
        b.localeCompare(a),
      );

      dates.forEach((date) => {
        if (date !== todayStr) {
          points.push({ date, balance: runningBalance });
        }
        const effect = dailyEffects.get(date) || 0;
        runningBalance -= effect;
      });

      // Add start point
      if (dates.length > 0 && dates[dates.length - 1]) {
        const oldestStr = dates[dates.length - 1];
        const [y, m, d] = oldestStr.split("-").map(Number);
        const firstDate = new Date(y, m - 1, d);
        firstDate.setDate(firstDate.getDate() - 1);
        const fy = firstDate.getFullYear();
        const fm = String(firstDate.getMonth() + 1).padStart(2, "0");
        const fd = String(firstDate.getDate()).padStart(2, "0");

        points.push({
          date: `${fy}-${fm}-${fd}`,
          balance: runningBalance,
        });
      }
    }

    const dataPoints = points.reverse();

    return {
      labels: dataPoints.map((p) => p.date),
      datasets: [
        {
          label: "Net Worth",
          data: dataPoints.map((p) => p.balance),
          fill: true,
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
            gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
            return gradient;
          },
          borderColor: "#6366f1", // Indigo 500
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4, // Smooth curve
        },
      ],
    };
  }, [transactions, currentTotal]);

  const hasData =
    chartData.datasets.length > 0 && chartData.datasets[0].data.length > 0;

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "#1e293b",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#334155",
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat("en-MY", {
                style: "currency",
                currency: "MYR",
              }).format(context.parsed.y);
            }
            return label;
          },
          title: (tooltipItems: any[]) => {
            const dateStr = tooltipItems[0].label;
            const [y, m, d] = dateStr.split("-").map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toDateString();
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: "#64748b",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          font: {
            size: 10,
          },
          callback: function (val: any, index: number) {
            const labels = this.getLabelForValue(val) as string;
            if (!labels) return "";
            const [y, m, d] = labels.split("-").map(Number);
            const dateObj = new Date(y, m - 1, d);
            return `${dateObj.getDate()} ${dateObj.toLocaleString("default", { month: "short" })}`;
          },
        },
        border: {
          display: true,
          color: "#334155",
        },
      },
      y: {
        grid: {
          color: "#334155",
          drawBorder: false,
          borderDash: [5, 5],
        },
        ticks: {
          color: "#64748b",
          font: {
            size: 10,
          },
          callback: (value: any) => {
            if (value >= 1000) return `RM ${(value / 1000).toFixed(1)}k`;
            return `RM ${value}`;
          },
        },
        border: {
          display: false,
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <div className="bg-surface rounded-2xl p-6 border border-gray-800 shadow-lg h-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-white">Net Worth Trend</h3>
      </div>
      <div className="w-full h-64">
        {hasData ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
            No transaction data for the last 6 months
          </div>
        )}
      </div>
    </div>
  );
};

// --- REVENUE CHART ---

export const RevenueChart: React.FC<Props> = ({
  transactions,
  usdRate = 4.5,
  displayCurrency = "MYR",
}) => {
  const chartData = useMemo(() => {
    // Generate last 6 months labels
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      // Use Local time for Month generation to match user expectation
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const monthStr = `${y}-${m}`;

      labels.push(d.toLocaleString("default", { month: "short" }));

      const income = transactions
        .filter(
          (t) =>
            t.type === TransactionType.INCOME &&
            toYMD(t.date).startsWith(monthStr),
        )
        .reduce((sum, t) => {
          let val = t.amount;
          if (t.currency !== displayCurrency) {
            if (t.currency === "USD" && displayCurrency === "MYR")
              val = t.amount * usdRate;
            else if (t.currency === "MYR" && displayCurrency === "USD")
              val = t.amount / usdRate;
          }
          return sum + val;
        }, 0);

      const expense = transactions
        .filter(
          (t) =>
            t.type === TransactionType.EXPENSE &&
            toYMD(t.date).startsWith(monthStr),
        )
        .reduce((sum, t) => {
          let val = t.amount;
          if (t.currency !== displayCurrency) {
            if (t.currency === "USD" && displayCurrency === "MYR")
              val = t.amount * usdRate;
            else if (t.currency === "MYR" && displayCurrency === "USD")
              val = t.amount / usdRate;
          }
          return sum + val;
        }, 0);

      incomeData.push(income);
      expenseData.push(expense);
    }

    return {
      labels,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          fill: true,
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)"); // Green
            gradient.addColorStop(1, "rgba(16, 185, 129, 0)");
            return gradient;
          },
          borderColor: "#10b981",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        },
        {
          label: "Expense",
          data: expenseData,
          fill: true,
          backgroundColor: (context: ScriptableContext<"line">) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)"); // Indigo
            gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
            return gradient;
          },
          borderColor: "#6366f1",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        },
      ],
    };
  }, [transactions]);

  const hasData = chartData.datasets.some((ds) =>
    ds.data.some((val) => (val as number) > 0),
  );

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "#1e293b",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#334155",
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: displayCurrency,
                maximumFractionDigits: 0,
              }).format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: "#94a3b8",
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "#334155",
          drawBorder: false,
        },
        ticks: {
          color: "#94a3b8",
          callback: (value: any) => {
            if (value >= 1000)
              return `${displayCurrency === "MYR" ? "RM" : "$"}${(value / 1000).toFixed(1)}k`;
            return `${displayCurrency === "MYR" ? "RM" : "$"}${value}`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-surface rounded-2xl p-6 border border-gray-800 shadow-lg h-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-lg text-white">Monthly Analytics</h3>
          <p className="text-gray-400 text-sm">
            Income vs Expenses (Last 6 Months)
          </p>
        </div>
      </div>
      <div className="w-full h-75">
        {hasData ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-10 h-10 mb-2 opacity-30"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            <p className="text-sm">No analytics data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const GoalProgressCard: React.FC<{
  achieved: number;
  target: number;
}> = ({ achieved, target }) => {
  const percentage = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;

  return (
    <div className="bg-surface rounded-2xl p-6 border border-gray-800 shadow-lg h-full flex flex-col justify-center relative overflow-hidden group">
      <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="flex justify-between items-end mb-4 relative z-10">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🎯 Goal Progress
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            Overall savings across all goals
          </p>
        </div>
        <span className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-purple-400">
          {percentage.toFixed(0)}%
        </span>
      </div>

      <div className="relative z-10">
        <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-gray-700/50 backdrop-blur-sm">
          <div
            className="h-full bg-linear-to-r from-indigo-500 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          >
            <div className="w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-size-[1rem_1rem] animate-spin opacity-30"></div>
          </div>
        </div>

        <div className="flex justify-between mt-4 text-sm font-medium">
          <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">
              Saved
            </span>
            <span className="text-white font-mono">
              RM {achieved.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">
              Target
            </span>
            <span className="text-gray-400 font-mono">
              RM {target.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SPARKLINE CHART (MINI CHART) ---

export const SparklineChart: React.FC<{
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  interactive?: boolean;
}> = ({
  data,
  labels,
  color = "#6366f1",
  height = 40,
  interactive = false,
}) => {
  const chartData = {
    labels: (labels || data.map((_, i) => i)) as string[],
    datasets: [
      {
        data: data,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: interactive ? 4 : 0,
        tension: 0.4,
        fill: true,
        backgroundColor: (context: ScriptableContext<"line">) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, height);
          gradient.addColorStop(0, `${color}44`);
          gradient.addColorStop(1, `${color}00`);
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: interactive,
        mode: "index" as const,
        intersect: false,
        backgroundColor: "#18181b",
        titleColor: "#9ca3af",
        bodyFont: { weight: "bold" as const },
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return (
              (context.dataset.label || "") +
              " " +
              context.parsed.y.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })
            );
          },
        },
      },
    },
    scales: {
      x: {
        display: interactive,
        grid: { display: false },
        ticks: {
          display: interactive,
          color: "#4b5563",
          font: { size: 9, weight: "bold" as const },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 5,
        },
      },
      y: { display: false },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export const CategoryPieChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  height?: number;
  currencySymbol?: string;
}> = ({ data, height = 300, currencySymbol = "RM" }) => {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.value),
        backgroundColor: data.map((d) => d.color),
        borderColor: "#18181b",
        borderWidth: 4,
        hoverOffset: 20,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#9ca3af",
          padding: 20,
          usePointStyle: true,
          pointStyle: "circle",
          font: { size: 11, weight: "bold" as const },
        },
      },
      tooltip: {
        backgroundColor: "#18181b",
        padding: 12,
        titleFont: { size: 14, weight: "bold" as const },
        bodyFont: { size: 13 },
        callbacks: {
          label: (context: any) => {
            const label = context.label || "";
            const value = context.parsed || 0;
            const totalVal = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0,
            );
            const percentage = ((value / totalVal) * 100).toFixed(1);
            return ` ${label}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${percentage}%)`;
          },
        },
      },
    },
    cutout: "70%",
  };

  return (
    <div style={{ height }} className="relative">
      <Pie data={chartData} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transform -translate-y-8">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">
          Total Spent
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black text-indigo-400">
            {currencySymbol}
          </span>
          <span className="text-2xl font-black text-white tracking-tighter">
            {total.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MonthlyBreakdown: React.FC<Props> = ({
  transactions,
  usdRate = 4.5,
  displayCurrency = "MYR",
}) => {
  const { maskAmount } = useData();

  const monthlyStats = useMemo(() => {
    const stats: {
      month: string;
      income: number;
      expense: number;
      net: number;
    }[] = [];

    // Last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const monthStr = `${y}-${m}`;
      const monthLabel = d.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const income = transactions
        .filter(
          (t) =>
            t.type === TransactionType.INCOME &&
            toYMD(t.date).startsWith(monthStr),
        )
        .reduce((sum, t) => {
          let val = t.amount;
          if (t.currency !== displayCurrency) {
            if (t.currency === "USD" && displayCurrency === "MYR")
              val = t.amount * usdRate;
            else if (t.currency === "MYR" && displayCurrency === "USD")
              val = t.amount / usdRate;
          }
          return sum + val;
        }, 0);

      const expense = transactions
        .filter(
          (t) =>
            t.type === TransactionType.EXPENSE &&
            toYMD(t.date).startsWith(monthStr),
        )
        .reduce((sum, t) => {
          let val = t.amount;
          if (t.currency !== displayCurrency) {
            if (t.currency === "USD" && displayCurrency === "MYR")
              val = t.amount * usdRate;
            else if (t.currency === "MYR" && displayCurrency === "USD")
              val = t.amount / usdRate;
          }
          return sum + val;
        }, 0);

      if (income === 0 && expense === 0) continue;

      stats.push({
        month: monthLabel,
        income,
        expense,
        net: income - expense,
      });
    }
    return stats;
  }, [transactions, usdRate, displayCurrency]);

  if (monthlyStats.length === 0) return null;

  return (
    <div className="bg-surface rounded-3xl p-6 border border-gray-800 shadow-xl overflow-hidden mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-black text-lg text-white tracking-tight">
            Monthly Performance
          </h3>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Summary for {displayCurrency}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <th className="px-4 py-2 border-b border-gray-800/40">Month</th>
              <th className="px-4 py-2 border-b border-gray-800/40">Income</th>
              <th className="px-4 py-2 border-b border-gray-800/40">Spent</th>
              <th className="px-4 py-2 border-b border-gray-800/40 text-right">
                Net
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30">
            {monthlyStats.map((s) => (
              <tr key={s.month} className="group hover:bg-white/2">
                <td className="px-4 py-4 text-xs font-black text-white">
                  {s.month}
                </td>
                <td className="px-4 py-4 text-xs font-bold text-emerald-400">
                  {maskAmount(
                    s.income.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }),
                    displayCurrency === "MYR" ? "RM" : "$",
                  )}
                </td>
                <td className="px-4 py-4 text-xs font-bold text-rose-400">
                  {maskAmount(
                    s.expense.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }),
                    displayCurrency === "MYR" ? "RM" : "$",
                  )}
                </td>
                <td
                  className={`px-4 py-4 text-xs font-black text-right ${s.net >= 0 ? "text-indigo-400" : "text-rose-500"}`}
                >
                  {maskAmount(
                    s.net.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }),
                    displayCurrency === "MYR" ? "RM" : "$",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
