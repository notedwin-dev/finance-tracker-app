import React, { useState, useMemo } from "react";
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";
import { ExchangeRateData } from "../types";

interface Props {
  usdRate: number;
  exchangeRate?: ExchangeRateData | null;
}

type TimeFrame = "1d" | "7d" | "30d";

const CurrencyRateCard: React.FC<Props> = ({ usdRate, exchangeRate }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1d");

  const { changePercent, isUp, comparisonLabel } = useMemo(() => {
    if (!exchangeRate?.history || exchangeRate.history.length < 2) {
      return { changePercent: 0, isUp: usdRate > 4.45, comparisonLabel: "" };
    }

    const history = [...exchangeRate.history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    let comparisonRate = history[1]?.rate; // Default to yesterday

    if (timeFrame === "7d") {
      comparisonRate = history[Math.min(7, history.length - 1)]?.rate;
    } else if (timeFrame === "30d") {
      comparisonRate = history[history.length - 1]?.rate;
    }

    const currentRate = exchangeRate.rate;
    const diff = currentRate - comparisonRate;
    const percent = (diff / comparisonRate) * 100;

    return {
      changePercent: Math.abs(percent),
      isUp: diff >= 0,
      comparisonLabel:
        timeFrame === "1d" ? "vs yesterday" : `vs ${timeFrame} ago`,
    };
  }, [exchangeRate, timeFrame, usdRate]);

  const lastUpdatedText = exchangeRate?.lastUpdated
    ? `Last updated: ${exchangeRate.lastUpdated}`
    : exchangeRate?.date
      ? `Last updated: ${exchangeRate.date} ${exchangeRate.source}`
      : "Updated just now";

  return (
    <div className="bg-card border border-gray-800 rounded-3xl p-6 flex flex-col justify-between h-64 relative overflow-hidden group">
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🇺🇸</span>
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
              USD / MYR
            </span>
          </div>
          <div className="relative">
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value as TimeFrame)}
              className="appearance-none bg-gray-800/50 border border-gray-700 text-gray-300 text-[10px] font-bold py-1 pl-2 pr-6 rounded-lg focus:outline-none hover:bg-gray-800 transition-colors"
            >
              <option value="1d">1D</option>
              <option value="7d">7D</option>
              <option value="30d">30D</option>
            </select>
            <ChevronDownIcon className="w-3 h-3 text-gray-500 absolute right-2 top-1.5 pointer-events-none" />
          </div>
        </div>

        <h3 className="text-3xl font-black text-white">
          {usdRate.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          })}
        </h3>

        <div className="flex items-center gap-1.5 mt-2">
          <div
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isUp
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-rose-500/10 text-rose-500"
            }`}
          >
            {isUp ? (
              <ArrowUpRightIcon className="w-3 h-3" />
            ) : (
              <ArrowDownRightIcon className="w-3 h-3" />
            )}
            {changePercent.toFixed(2)}%
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            {comparisonLabel}
          </p>
        </div>
        <p className="text-[10px] text-gray-400/50 mt-1 font-medium">
          {lastUpdatedText}
        </p>
      </div>

      <div className="relative z-10">
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <p className="text-[10px] text-gray-500 font-bold uppercase italic">
              Real-time valuation
            </p>
            <p className="text-xs font-mono text-primary font-bold">
              1 USD = {usdRate.toFixed(4)} MYR
            </p>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${(usdRate / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
    </div>
  );
};

export default CurrencyRateCard;
