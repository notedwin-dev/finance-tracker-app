import React, { useState } from "react";
import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { SparklineChart } from "../components/Charts";
import { CurrencyCode, MaskAmount, TimeFrame, TimeframeStats, TrendPoints } from "./DashboardTypes";

type Props = {
	totalBalance: number;
	displayCurrency: CurrencyCode;
	usdRate: number;
	timeframeStats: TimeframeStats;
	timeframe: TimeFrame;
	displayRange: string;
	trendPoints: TrendPoints;
	maskAmount: MaskAmount;
	onCurrencyChange: (currency: CurrencyCode) => void;
};

export const DashboardBalanceCard = ({
	totalBalance,
	displayCurrency,
	usdRate,
	timeframeStats,
	timeframe,
	displayRange,
	trendPoints,
	maskAmount,
	onCurrencyChange,
}: Props) => {
	const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

	return (
		<div className="bg-surface/40 backdrop-blur-md border border-gray-800/60 p-6 sm:p-8 rounded-4xl flex flex-col group relative overflow-hidden shadow-2xl">
			<div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32"></div>

			<div className="relative z-10 flex flex-col mb-8 sm:mb-6">
				<div className="flex justify-between items-center mb-2">
					<span className="text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] block">
						Total Balance
					</span>

					<div className="relative">
						<button
							type="button"
							onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
							className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-xl px-3 py-1.5 text-[10px] font-black tracking-widest text-indigo-400 hover:text-white transition-all focus:outline-none"
						>
							{displayCurrency}
							<ChevronUpDownIcon className="w-3.5 h-3.5" />
						</button>

						{showCurrencyDropdown && (
							<>
								<div
									className="fixed inset-0 z-40"
									onClick={(e) => {
										e.stopPropagation();
										setShowCurrencyDropdown(false);
									}}
								/>
								<div className="absolute right-0 top-full mt-2 w-24 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
									{["MYR", "USD"].map((curr) => (
										<button
											key={curr}
											type="button"
											onClick={() => {
												onCurrencyChange(curr as CurrencyCode);
												setShowCurrencyDropdown(false);
											}}
											className={`w-full text-left px-4 py-3 text-[10px] font-black tracking-widest transition-colors ${
												displayCurrency === curr
													? "bg-indigo-600 text-white"
													: "text-gray-400 hover:bg-white/5 hover:text-white"
											}`}
										>
											{curr}
										</button>
									))}
								</div>
							</>
						)}
					</div>
				</div>

				<h3 className="text-4xl sm:text-6xl font-black text-white tracking-tighter break-all">
					{maskAmount(
						totalBalance.toLocaleString(undefined, {
							minimumFractionDigits: 2,
						}),
						displayCurrency === "MYR" ? "RM" : "$",
					)}
				</h3>
			</div>

			<div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-3">
						<div
							className={`flex items-center gap-1 font-black text-xs sm:text-sm px-2 py-0.5 rounded-full ${
								timeframeStats.isPositive
									? "bg-emerald-400/20 text-emerald-400"
									: "bg-rose-400/20 text-rose-400"
							}`}
						>
							{timeframeStats.isPositive ? "↑" : "↓"}{" "}
							{Math.abs(timeframeStats.percentChange).toFixed(1)}%
						</div>
						<div className="flex sm:hidden items-center gap-1 text-[10px] font-black text-gray-500 uppercase tracking-widest">
							<span className="w-1 h-1 rounded-full bg-gray-800"></span>
							{timeframe} Comparison
						</div>
					</div>

					<div className="flex items-center gap-4">
						<div className="flex flex-col">
							<span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">
								Live Market
							</span>
							<p className="text-sm font-bold text-white">
								1 USD = {usdRate.toFixed(4)}{" "}
								<span className="text-[10px] opacity-50">MYR</span>
							</p>
						</div>
						<div className="w-px h-8 bg-gray-800"></div>
						<div className="flex flex-col text-right">
							<span className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">
								Selected Date
							</span>
							<p className="text-sm font-bold text-white uppercase">
								{displayRange}
							</p>
						</div>
					</div>
				</div>

				<div className="h-16 sm:h-24 w-full sm:w-64">
					<SparklineChart
						data={trendPoints.data}
						labels={trendPoints.labels}
						color={timeframeStats.isPositive ? "#10b981" : "#f43f5e"}
						height={64}
						interactive={true}
					/>
				</div>
			</div>
		</div>
	);
};
