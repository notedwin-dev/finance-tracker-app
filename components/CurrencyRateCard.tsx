import React from "react";
import {
  ArrowUpRightIcon,
  ArrowDownRightIcon,
} from "@heroicons/react/24/solid";

interface Props {
  usdRate: number;
}

const CurrencyRateCard: React.FC<Props> = ({ usdRate }) => {
  // We can simulate a "trend" or just show the rate beautifully
  // In a real app, you might compare today's rate with yesterday's
  const isUp = usdRate > 4.45; // Just a dummy threshold for visual interest

  return (
    <div className="bg-card border border-gray-800 rounded-3xl p-6 flex flex-col justify-between h-64 relative overflow-hidden group">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🇺🇸</span>
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">
            USD / MYR
          </span>
        </div>
        <h3 className="text-3xl font-black text-white">{usdRate.toFixed(2)}</h3>
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
            Live Rate
          </div>
          <p className="text-[10px] text-gray-500 font-medium">
            Updated just now
          </p>
        </div>
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
