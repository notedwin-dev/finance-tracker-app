import React, { useState, useMemo } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import {
	PlusIcon,
	ChartPieIcon,
	ListBulletIcon,
	CalendarIcon,
	CalendarDaysIcon,
	ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../services/auth.services";
import { useData } from "../context/DataContext";
import {
	RevenueChart,
	MonthlyBreakdown,
	SparklineChart,
	CategoryPieChart,
} from "../components/Charts";
import AccountCard from "../components/AccountCard";
import {
	groupTransactions,
	normalizeDate,
	GroupedTransaction,
	formatDateReadable,
} from "../helpers/transactions.helper";
import { TransactionType } from "../types";
import DatePicker from "../components/DatePicker";

type TimeFrame = "1D" | "1W" | "1M" | "YTD" | "ALL";

const DashboardPage: React.FC = () => {
	const { profile } = useAuth();
	const navigate = useNavigate();
	const {
		accounts,
		transactions,
		categories,
		pots,
		usdRate,
		cryptoPrices,
		displayCurrency,
		setDisplayCurrency,
		maskAmount,
		maskText,
	} = useData();
	const { setShowAddModal, setShowAccountForm } = useOutletContext<any>();

	const [timeframe, setTimeframe] = useState<TimeFrame | "CUSTOM">("1M");
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [showTransactionPie, setShowTransactionPie] = useState(false);
	const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
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
			start.setHours(end.getHours() - 24);
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
		}

		if (timeframe === "CUSTOM") {
			return `${formatDateReadable(new Date(customRange.start))} - ${formatDateReadable(new Date(customRange.end))}`;
		}

		return `${formatDateReadable(start)} - ${formatDateReadable(end)}`;
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

				if (tx.isHistorical) continue;

				if (
					tx.type === TransactionType.INCOME ||
					tx.type === TransactionType.ACCOUNT_OPENING
				) {
					balanceAtPoint -= txValueInBase;
				} else if (
					tx.type === TransactionType.EXPENSE ||
					tx.type === TransactionType.ACCOUNT_DELETE
				) {
					balanceAtPoint += txValueInBase;
				} else if (tx.type === TransactionType.ADJUSTMENT) {
					balanceAtPoint -= txValueInBase;
				} else if (tx.type === TransactionType.TRANSFER) {
					// Total Portfolio balance only affected by the fee
					const fee = tx.fee || 0;
					if (fee > 0) {
						let feeInBase = fee;
						if (tx.currency === "MYR") {
							feeInBase = displayCurrency === "MYR" ? fee : fee / usdRate;
						} else {
							let feeInUSD = fee;
							if (tx.currency === "BTC") feeInUSD = fee * cryptoPrices.BTC;
							else if (tx.currency === "ETH") feeInUSD = fee * cryptoPrices.ETH;
							feeInBase =
								displayCurrency === "USD" ? feeInUSD : feeInUSD * usdRate;
						}
						// A fee is an expense, so reversing it means ADDING it back
						balanceAtPoint += feeInBase;
					}
				}
			}

			resultLabels.push(formatDateReadable(pointDate));
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

	const sortedRecentTransactions = useMemo(() => {
		// Show most recent 10 transactions regardless of timeframe
		return groupTransactions(transactions).slice(0, 10);
	}, [transactions]);

	return (
		<div className="animate-fadeIn space-y-6 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			{/* App-Style Header */}
			<div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-1 sm:gap-6 py-4 sm:py-6 sm:pt-10">
				<div>
					<div className="hidden sm:flex items-center gap-3 text-gray-400 mb-1">
						<CalendarIcon className="w-5 h-5" />
						<span className="text-sm font-medium">
							{new Date().toLocaleDateString("en-US", {
								weekday: "long",
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					</div>
					<span className="text-[10px] sm:hidden font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 block">
						{new Date().toLocaleDateString("en-US", {
							weekday: "long",
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</span>
					<h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
						Welcome back, {maskText(profile?.name?.split(" ")[0] || "User")}!
					</h1>
				</div>
			</div>

			{/* Primary Grid Layout */}
			<div className="space-y-6 sm:space-y-8">
				{/* Quick controls - Native Segmented Control Style */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex-1 flex items-center bg-surface/50 border border-gray-800/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
						{["1D", "1W", "1M", "YTD", "ALL"].map((tf) => (
							<button
								key={tf}
								onClick={() => setTimeframe(tf as TimeFrame)}
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
						onClick={() => setShowDatePicker(true)}
						className="flex shrink-0 items-center justify-center w-11 h-11 bg-surface/50 border border-gray-800/50 rounded-2xl text-white transition-all shadow-lg active:scale-95 hover:bg-surface hover:border-indigo-500/30"
					>
						<CalendarIcon className="w-5 h-5 text-indigo-400" />
					</button>
				</div>

				{/* Balance Section - Native Card Style */}
				<div className="bg-surface/40 backdrop-blur-md border border-gray-800/60 p-6 sm:p-8 rounded-4xl flex flex-col group relative overflow-hidden shadow-2xl">
					<div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32"></div>

					<div className="relative z-10 flex flex-col mb-8 sm:mb-6">
						<div className="flex justify-between items-center mb-2">
							<span className="text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] block">
								Total Balance
							</span>

							{/* Currency Selector Dropdown */}
							<div className="relative">
								<button
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
													onClick={() => {
														setDisplayCurrency(curr as "MYR" | "USD");
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

				{/* Account List - Gallery View */}
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

						{/* Add Asset Card */}
						<button
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

				{/* Analytics Section */}
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

				{/* Content Section */}
				<div className="grid lg:grid-cols-12 gap-6 sm:gap-8">
					{/* Transactions List - Native List Style */}
					<div className="lg:col-span-12 bg-surface/40 sm:border border-gray-800/60 rounded-[2.5rem] overflow-hidden flex flex-col h-auto max-h-125 sm:max-h-150 shadow-xl">
						<div className="px-6 py-6 sm:px-8 border-b border-gray-800/40 flex justify-between items-center bg-surface/20 backdrop-blur-md z-10">
							<h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-3">
								Transactions
								<span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-800/50 px-2.5 py-1 rounded-lg">
									{filteredTransactions.length}
								</span>
							</h3>
							<div className="flex gap-2">
								<button
									onClick={() => setShowTransactionPie(!showTransactionPie)}
									className={`p-2 sm:p-2.5 border rounded-xl transition-all ${
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
									className="p-2 sm:p-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/10"
								>
									<PlusIcon className="w-5 h-5 stroke-3" />
								</button>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-6">
							{showTransactionPie ? (
								<div className="h-full flex items-center justify-center p-6 sm:p-8 animate-fadeIn">
									{pieChartData.length > 0 ? (
										<CategoryPieChart
											data={pieChartData}
											height={500}
											currencySymbol={displayCurrency === "MYR" ? "RM" : "$"}
										/>
									) : (
										<div className="text-center opacity-30">
											<ChartPieIcon className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" />
											<p className="font-black uppercase tracking-widest text-[10px]">
												No spending data
											</p>
										</div>
									)}
								</div>
							) : (
								<div className="divide-y divide-gray-800/30 px-3">
									{sortedRecentTransactions
										.slice(0, 15)
										.map((t: GroupedTransaction) => (
											<div
												key={t.id}
												className="flex justify-between items-center px-4 py-2.5 sm:py-3 hover:bg-white/5 transition-all rounded-2xl group cursor-pointer border-b border-gray-800/20 last:border-0"
											>
												<div className="flex items-center gap-4 min-w-0">
													<div
														className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 shadow-sm ${
															t.linkedTransaction
																? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
																: "bg-gray-900 border border-gray-800"
														}`}
													>
														{t.linkedTransaction
															? "↔️"
															: categories.find((c) => c.id === t.categoryId)
																	?.icon ||
																(t.type === TransactionType.TRANSFER && "↔️") ||
																"💰"}
													</div>
													<div className="min-w-0">
														<p className="text-[17px] font-extrabold text-white group-hover:text-indigo-400 transition-colors truncate tracking-tight">
															{t.linkedTransaction ? (
																t.shopName ? (
																	maskText(t.shopName)
																) : (
																	<>
																		{maskText(
																			accounts.find((a) => a.id === t.accountId)
																				?.name || "???",
																		)}{" "}
																		→{" "}
																		{maskText(
																			accounts.find(
																				(a) => a.id === t.toAccountId,
																			)?.name || "???",
																		)}
																	</>
																)
															) : (
																maskText(
																	t.shopName ||
																		categories.find(
																			(c) => c.id === t.categoryId,
																		)?.name ||
																		"UNTITLED",
																)
															)}
														</p>
														<p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
															{t.time || "??:??"} • {normalizeDate(t.date)}
															{t.isHistorical && !t.linkedTransaction && (
																<span className="ml-2 text-amber-500/80">
																	• HIST.
																</span>
															)}
															{t.linkedTransaction &&
																(t.isHistorical ||
																	t.linkedTransaction.isHistorical) && (
																	<span className="ml-2 text-amber-500/80">
																		• HIST ({t.isHistorical ? "S" : ""}
																		{t.linkedTransaction.isHistorical
																			? "D"
																			: ""}
																		)
																	</span>
																)}
														</p>
													</div>
												</div>
												<div className="text-right shrink-0 ml-4">
													<p
														className={`font-black text-xl tracking-tighter ${
															t.linkedTransaction
																? "text-indigo-400"
																: t.type === TransactionType.INCOME ||
																	  (t.type === TransactionType.TRANSFER &&
																			t.transferDirection === "IN")
																	? "text-emerald-400"
																	: "text-rose-400"
														}`}
													>
														{t.linkedTransaction
															? ""
															: t.type === TransactionType.INCOME ||
																  (t.type === TransactionType.TRANSFER &&
																		t.transferDirection === "IN")
																? "+"
																: "-"}
														{maskAmount(
															Math.abs(
																displayCurrency === "MYR"
																	? t.currency === "USD"
																		? t.amount * usdRate
																		: t.amount
																	: t.currency === "MYR"
																		? t.amount / usdRate
																		: t.amount,
															).toLocaleString(undefined, {
																minimumFractionDigits: 2,
															}),
														)}
													</p>
													<span className="text-[10px] text-gray-600 font-black tracking-widest uppercase">
														{displayCurrency}
													</span>
												</div>
											</div>
										))}
									{sortedRecentTransactions.length === 0 && (
										<div className="h-full flex flex-col items-center justify-center py-12 sm:py-16 text-gray-500 opacity-40">
											<CalendarDaysIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-4" />
											<p className="font-black uppercase tracking-[0.2em] text-[10px]">
												No recent transactions
											</p>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{showDatePicker && (
				<div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4">
					<div
						className="absolute inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setShowDatePicker(false)}
					/>
					<div className="relative w-full max-w-sm bg-surface border-t sm:border border-gray-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-slideUp sm:animate-fadeIn">
						<h3 className="text-xl font-black text-white tracking-tight mb-6">
							Select Date Range
						</h3>

						<div className="space-y-6">
							<div>
								<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
									Start Date
								</label>
								<DatePicker
									value={customRange.start}
									onChange={(date) =>
										setCustomRange((prev) => ({
											...prev,
											start: date,
										}))
									}
								/>
							</div>

							<div>
								<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
									End Date
								</label>
								<DatePicker
									value={customRange.end}
									onChange={(date) =>
										setCustomRange((prev) => ({ ...prev, end: date }))
									}
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
