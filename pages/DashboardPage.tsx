import React, { useState, useMemo } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { PlusIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../services/auth.services";
import { useMask } from "../helpers/useMask";
import { useFinanceStore } from "../src/stores/finance.store";
import { useUIStore } from "../src/stores/ui.store";
import { RevenueChart, MonthlyBreakdown } from "../components/Charts";
import AccountCard from "../components/AccountCard";
import { groupTransactions, formatDateReadable } from "../helpers/transactions.helper";
import {
	getTrendStartLimit,
	applyTransactionToBalance,
	sortTransactionsByDateDesc,
	TrendTimeframe,
} from "../src/lib/domain/dashboard-trend";
import { TransactionType } from "../types";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardBalanceCard } from "./DashboardBalanceCard";
import { DashboardTransactionsList } from "./DashboardTransactionsList";
import { DashboardDatePickerModal } from "./DashboardDatePickerModal";
import { TimeFrame, PieDatum } from "./DashboardTypes";

const TIME_FRAMES: TimeFrame[] = ["1D", "1W", "1M", "YTD", "ALL"];

const PIE_COLORS = [
	"#6366f1",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
];

const isoDateString = (d: Date): string => d.toISOString().split("T")[0];

const makeDefaultCustomRange = (): { start: string; end: string } => ({
	start: isoDateString(new Date(new Date().setDate(new Date().getDate() - 30))),
	end: isoDateString(new Date()),
});

const DashboardPage: React.FC = () => {
	const { profile } = useAuth();
	const navigate = useNavigate();
	const { accounts, transactions, categories, pots } = useFinanceStore();
	const usdRate = useFinanceStore((s) => s.usdRate);
	const cryptoPrices = useFinanceStore((s) => s.cryptoPrices);
	const { displayCurrency, setDisplayCurrency } = useUIStore();
	const { maskAmount, maskText } = useMask();
	const { setShowAddModal, setShowAccountForm } = useOutletContext<any>();

	const [timeframe, setTimeframe] = useState<TimeFrame>("1M");
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [customRange, setCustomRange] = useState(makeDefaultCustomRange);

	const displayRange = useMemo(() => {
		const end = new Date();
		let start = new Date();

		if (timeframe === "1D") {
			start.setHours(end.getHours() - 24);
		} else if (timeframe === "1W") {
			start.setDate(end.getDate() - 7);
		} else if (timeframe === "1M") {
			start.setDate(end.getDate() - 30);
		} else if (timeframe === "YTD") {
			start = new Date(end.getFullYear(), 0, 1);
		} else if (timeframe === "ALL") {
			const allDates = transactions.map((t) => new Date(t.date).getTime());
			start = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(0);
		}

		if (timeframe === "CUSTOM") {
			return `${formatDateReadable(new Date(customRange.start))} - ${formatDateReadable(new Date(customRange.end))}`;
		}

		return `${formatDateReadable(start)} - ${formatDateReadable(end)}`;
	}, [timeframe, customRange, transactions]);

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

	const filteredTransactions = useMemo(() => {
		const now = new Date();
		const isOneDay = timeframe === "1D";
		if (!isOneDay && timeframe !== "CUSTOM") {
			now.setHours(23, 59, 59, 999);
		}
		let startLimit = new Date();
		startLimit.setHours(0, 0, 0, 0);
		if (isOneDay) {
			startLimit = new Date();
			startLimit.setHours(startLimit.getHours() - 24);
		} else if (timeframe === "1W") {
			startLimit.setDate(now.getDate() - 7);
		} else if (timeframe === "1M") {
			startLimit.setDate(now.getDate() - 30);
		} else if (timeframe === "YTD") {
			startLimit = new Date(now.getFullYear(), 0, 1);
		} else if (timeframe === "ALL") {
			startLimit = new Date(0);
		} else if (timeframe === "CUSTOM") {
			startLimit = new Date(customRange.start);
			now.setTime(new Date(customRange.end).getTime());
			now.setHours(23, 59, 59, 999);
		}
		return transactions.filter((t) => {
			const d = new Date(t.date);
			return d >= startLimit && d <= now;
		});
	}, [transactions, timeframe, customRange]);

	const timeframeStats = useMemo(() => {
		const convert = (amount: number, currency: string) => {
			if (currency === "MYR") {
				return displayCurrency === "MYR" ? amount : amount / usdRate;
			}
			let valInUSD = amount;
			if (currency === "BTC") valInUSD = amount * cryptoPrices.BTC;
			else if (currency === "ETH") valInUSD = amount * cryptoPrices.ETH;
			return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
		};

		const income = filteredTransactions
			.filter((t) => t.type === TransactionType.INCOME)
			.reduce((sum, t) => sum + convert(t.amount, t.currency), 0);
		const expense = filteredTransactions
			.filter((t) => t.type === TransactionType.EXPENSE)
			.reduce((sum, t) => sum + convert(t.amount, t.currency), 0);

		const change = income - expense;
		const isPositive = change >= 0;
		const percentChange =
			totalBalance !== 0 ? (change / Math.abs(totalBalance)) * 100 : 0;
		return { income, expense, change, isPositive, percentChange };
	}, [filteredTransactions, usdRate, displayCurrency, totalBalance, cryptoPrices]);

	const trendPoints = useMemo(() => {
		const numPoints = 12;
		const now = new Date();
		const startLimit = getTrendStartLimit(
			timeframe as TrendTimeframe,
			customRange,
			transactions,
			now,
		);
		const duration = now.getTime() - startLimit.getTime();
		const interval = duration / (numPoints - 1);
		const labels: string[] = [];
		const data: number[] = [];
		const sortedTxs = sortTransactionsByDateDesc(transactions);

		for (let i = 0; i < numPoints; i++) {
			const pointTime = startLimit.getTime() + i * interval;
			let balanceAtPoint = totalBalance;
			for (const tx of sortedTxs) {
				const txTime = new Date(tx.date).getTime();
				if (txTime <= pointTime) break;
				balanceAtPoint = applyTransactionToBalance(
					balanceAtPoint,
					tx,
					displayCurrency,
					usdRate,
					cryptoPrices,
				);
			}
			labels.push(formatDateReadable(new Date(pointTime)));
			data.push(balanceAtPoint);
		}
		return { labels, data };
	}, [transactions, timeframe, customRange, totalBalance, displayCurrency, usdRate, cryptoPrices]);

	const spendingByCategory = useMemo(() => {
		const groups: Record<string, number> = {};
		for (const t of filteredTransactions) {
			if (t.type !== TransactionType.EXPENSE) continue;
			const catName = categories.find((c) => c.id === t.categoryId)?.name || "Other";
			let amountInUSD = t.amount;
			if (t.currency === "MYR") amountInUSD = t.amount / usdRate;
			else if (t.currency === "BTC") amountInUSD = t.amount * cryptoPrices.BTC;
			else if (t.currency === "ETH") amountInUSD = t.amount * cryptoPrices.ETH;
			const amount = displayCurrency === "USD" ? amountInUSD : amountInUSD * usdRate;
			groups[catName] = (groups[catName] || 0) + amount;
		}
		return Object.entries(groups).sort((a, b) => b[1] - a[1]);
	}, [filteredTransactions, displayCurrency, usdRate, categories, cryptoPrices]);

	const pieChartData: PieDatum[] = useMemo(
		() =>
			spendingByCategory.map(([label, value], i) => ({
				label,
				value,
				color: PIE_COLORS[i % PIE_COLORS.length],
			})),
		[spendingByCategory],
	);

	const sortedRecentTransactions = useMemo(
		() => groupTransactions(transactions).slice(0, 10),
		[transactions],
	);

	const applyCustomDateRange = () => {
		setTimeframe("CUSTOM");
		setShowDatePicker(false);
	};

	return (
		<div className="animate-fadeIn space-y-6 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<DashboardHeader profileName={profile?.name} maskText={maskText as any} />

			<div className="space-y-6 sm:space-y-8">
				<div className="flex items-center justify-between gap-3">
					<div className="flex-1 flex items-center bg-surface/50 border border-gray-800/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
						{TIME_FRAMES.map((tf) => (
							<button
								key={tf}
								type="button"
								onClick={() => setTimeframe(tf)}
								className={`flex-1 min-w-12.5 px-2 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
									timeframe === tf
										? "bg-white text-black shadow-lg"
										: "text-gray-500 hover:text-gray-300"
								}`}
							>
								{tf}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() => setShowDatePicker(true)}
						className="flex shrink-0 items-center justify-center w-11 h-11 bg-surface/50 border border-gray-800/50 rounded-2xl text-white transition-all shadow-lg active:scale-95 hover:bg-surface hover:border-indigo-500/30"
					>
						<CalendarIcon className="w-5 h-5 text-indigo-400" />
					</button>
				</div>

				<DashboardBalanceCard
					totalBalance={totalBalance}
					displayCurrency={displayCurrency}
					usdRate={usdRate}
					timeframeStats={timeframeStats}
					timeframe={timeframe}
					displayRange={displayRange}
					trendPoints={trendPoints}
					maskAmount={maskAmount as any}
					onCurrencyChange={setDisplayCurrency}
				/>

				<div className="space-y-4 sm:space-y-6">
					<div className="flex justify-between items-center px-1">
						<h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-widest">
							My Assets
						</h2>
						<Link
							to="/app/assets"
							className="text-indigo-400 text-[10px] sm:text-xs font-black uppercase tracking-widest hover:text-indigo-300 transition-all"
						>
							Manage All →
						</Link>
					</div>

					<div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 snap-x">
						{accounts.map((acc) => (
							<div
								key={acc.id}
								className="shrink-0 w-70 sm:w-[320px] snap-start"
							>
								<AccountCard
									account={acc}
									pots={pots}
									transactions={transactions}
									onClick={(a) => navigate(`/app/account/${a.id}`)}
									displayCurrency={displayCurrency}
									usdRate={usdRate}
									cryptoPrices={cryptoPrices}
								/>
							</div>
						))}

						<button
							type="button"
							onClick={() => setShowAccountForm(true)}
							className="shrink-0 w-60 sm:w-70 h-60 sm:h-70 rounded-[2.5rem] bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 flex flex-col items-center justify-center gap-4 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all group snap-start"
						>
							<div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
								<PlusIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-400 stroke-3" />
							</div>
							<span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
								Add New Asset
							</span>
						</button>
					</div>
				</div>

				<div className="grid lg:grid-cols-12 gap-6 sm:gap-8">
					<div className="lg:col-span-12">
						<RevenueChart
							transactions={transactions}
							usdRate={usdRate}
							displayCurrency={displayCurrency}
						/>
					</div>
					<div className="lg:col-span-12">
						<MonthlyBreakdown
							transactions={transactions}
							usdRate={usdRate}
							displayCurrency={displayCurrency}
						/>
					</div>
				</div>

				<div className="grid lg:grid-cols-12 gap-6 sm:gap-8">
					<DashboardTransactionsList
						filteredTransactionsCount={filteredTransactions.length}
						sortedRecentTransactions={sortedRecentTransactions}
						categories={categories}
						accounts={accounts}
						displayCurrency={displayCurrency}
						usdRate={usdRate}
						pieChartData={pieChartData}
						maskAmount={maskAmount as any}
						maskText={maskText as any}
						onAddTransaction={() => setShowAddModal(true)}
					/>
				</div>
			</div>

			<DashboardDatePickerModal
				isOpen={showDatePicker}
				customRange={customRange}
				onRangeChange={setCustomRange}
				onClose={() => setShowDatePicker(false)}
				onApply={applyCustomDateRange}
			/>
		</div>
	);
};

export default DashboardPage;
