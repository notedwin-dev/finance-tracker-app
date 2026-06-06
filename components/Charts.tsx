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
import { Transaction } from "../types";
import { useMask } from "../helpers/useMask";
import Modal from "./Modal";
import { aggregateMonthly } from "../src/lib/domain/charts";

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

// --- NET WORTH CHART ---

interface Props {
  transactions: Transaction[];
  currentTotal?: number;
  usdRate?: number;
  displayCurrency?: "MYR" | "USD";
}


// --- REVENUE CHART ---

export const RevenueChart: React.FC<Props> = ({
  transactions,
  usdRate = 4.5,
  displayCurrency = "MYR",
}) => {
  const [months, setMonths] = React.useState(6);
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("1");
  const [customUnit, setCustomUnit] = React.useState<"M" | "Y">("M");

  const ytdMonths = useMemo(() => {
    return new Date().getMonth() + 1;
  }, []);

  const chartData = useMemo(() => {
    // Generate months labels based on range
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = months; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      // Use Local time for Month generation to match user expectation
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const monthStr = `${y}-${m}`;

      labels.push(
        d.toLocaleString("default", { month: "short", year: "numeric" }),
      );

      const { income, expense } = aggregateMonthly(
        transactions,
        monthStr,
        usdRate,
        displayCurrency,
      );

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
  }, [transactions, months, usdRate, displayCurrency]);

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
                maximumFractionDigits: 2,
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
          font: {
            size: 10,
          },
          autoSkip: true,
          maxTicksLimit: months > 12 ? 8 : 12,
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
          font: {
            size: 10,
          },
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
    <div className="bg-surface rounded-2xl p-6 border border-gray-800 shadow-lg h-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg text-white">Monthly Analytics</h3>
          <p className="text-gray-400 text-sm">
            Income vs Expenses (Last{" "}
            {months >= 12
              ? `${months / 12} ${months === 12 ? "Year" : "Years"}`
              : `${months} ${months === 1 ? "Month" : "Months"}`}
            )
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex bg-gray-900/50 p-1 rounded-xl border border-gray-800 self-end sm:self-auto">
          {[1, 3, 6, 12, "YTD"].map((m) => {
            const isYTD = m === "YTD";
            const val = isYTD ? ytdMonths : (m as number);
            const isActive = months === val;

            return (
              <button
                key={m}
                onClick={() => setMonths(val)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-white text-black shadow-lg"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                {isYTD ? "YTD" : m === 12 ? "1Y" : `${m}M`}
              </button>
            );
          })}
          {/* Simple Custom Entry */}
          <button
            onClick={() => setShowCustomModal(true)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
              ![1, 3, 6, 12, ytdMonths].includes(months)
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-gray-500 hover:text-white"
            }`}
          >
            ...
          </button>
        </div>
      </div>

      {/* Custom Range Modal */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="Custom Analytics Range"
        description="Enter the number of months or years to display"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="number"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
              placeholder="Number"
              min="1"
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as "M" | "Y")}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
            >
              <option value="M" className="bg-surface">
                Month(s)
              </option>
              <option value="Y" className="bg-surface">
                Year(s)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setShowCustomModal(false)}
              className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-400 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const val = parseInt(customValue);
                if (!isNaN(val) && val > 0) {
                  setMonths(customUnit === "Y" ? val * 12 : val);
                  setShowCustomModal(false);
                }
              }}
              className="py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-xl shadow-indigo-500/20"
            >
              Apply Range
            </button>
          </div>
        </div>
      </Modal>

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
}> = ({ data, height = 500, currencySymbol = "RM" }) => {
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
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transform -translate-y-15">
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
  const { maskAmount } = useMask();

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

      const { income, expense } = aggregateMonthly(
        transactions,
        monthStr,
        usdRate,
        displayCurrency,
      );

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
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }),
                    displayCurrency === "MYR" ? "RM" : "$",
                  )}
                </td>
                <td className="px-4 py-4 text-xs font-bold text-rose-400">
                  {maskAmount(
                    s.expense.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
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
                      minimumFractionDigits: 2,
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
