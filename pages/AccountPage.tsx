import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import History from "../components/History";
import Modal from "../components/Modal";
import BulkImportModal from "../components/BulkImportModal";
import { useMask } from "../helpers/useMask";
import { useMaskStore } from "../src/stores/mask.store";
import { useFinanceStore } from "../src/stores/finance.store";
import { useUIStore } from "../src/stores/ui.store";
import { deleteTransaction, bulkImportTransactions, loadData } from "../src/lib/application/commands";
import { useAuth } from "../services/auth.services";
import * as SheetService from "../services/sheets.services";
import {
	ChevronLeftIcon,
	WalletIcon,
	PencilSquareIcon,
	ArrowUpRightIcon,
	BanknotesIcon,
	DocumentArrowUpIcon,
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
import { TransactionType } from "../types";
import {
	normalizeDate,
	formatDateReadable,
} from "../helpers/transactions.helper";

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

const AccountPage: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { profile, updateProfile } = useAuth();

	useEffect(() => {
		window.scrollTo(0, 0);
	}, [id]);

	const usdRate = useFinanceStore((s) => s.usdRate);
	const cryptoPrices = useFinanceStore((s) => s.cryptoPrices);
	const { displayCurrency } = useUIStore();
	const { maskAmount, maskText } = useMask();
	const maskMode = useMaskStore((s) => s.maskMode);
	const { transactions, categories, accounts, pots, pockets } =
		useFinanceStore();
	const {
		setShowAddModal,
		setEditingTransaction,
		setShowAccountForm,
		setEditingAccount,
	} = useOutletContext<any>();

	const [showImportModal, setShowImportModal] = useState(false);
	const [confirmationModal, setConfirmationModal] = useState<{
		isOpen: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
		confirmLabel: string;
		isDestructive?: boolean;
	}>({
		isOpen: false,
		title: "",
		description: "",
		onConfirm: () => {},
		confirmLabel: "Confirm",
	});

	const boundLoadData = (forceUnlock?: boolean) => loadData(profile, forceUnlock);

	const account = useMemo(
		() => accounts.find((a) => a.id === id),
		[accounts, id],
	);

	const accountPots = useMemo(
		() => pots.filter((p) => p.accountId === id),
		[pots, id],
	);

	const filteredTransactions = useMemo(() => {
		const results: any[] = [];
		const seen = new Set<string>();
		transactions.forEach((t) => {
			const isLegacySingleRecordTransfer =
				t.type === TransactionType.TRANSFER &&
				t.toAccountId &&
				!t.transferDirection &&
				!t.linkedTransactionId;

			if (isLegacySingleRecordTransfer) {
				if (t.accountId === id) {
					if (!seen.has(t.id)) {
						results.push({ ...t, transferDirection: "OUT" });
						seen.add(t.id);
					}
				} else if (t.toAccountId === id) {
					const inId = t.id + "_in";
					if (!seen.has(inId)) {
						results.push({
							...t,
							id: inId,
							accountId: t.toAccountId,
							toAccountId: t.accountId,
							transferDirection: "IN",
						});
						seen.add(inId);
					}
				}
			} else if (
				t.accountId === id ||
				(t.type === TransactionType.TRANSFER && t.toAccountId === id)
			) {
				if (!seen.has(t.id)) {
					results.push(t);
					seen.add(t.id);
				}
			}
		});
		return results;
	}, [transactions, id]);

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

	const totalInPots = accountPots.reduce(
		(sum, p) => sum + (p.amountLeft || 0),
		0,
	);
	const availableBalance = (account?.balance || 0) - totalInPots;

	const convertedBalance = useMemo(() => {
		if (!account || account.currency === displayCurrency) return null;

		if (account.currency === "MYR") {
			return displayCurrency === "USD" ? account.balance / usdRate : null;
		}

		let valInUSD = account.balance;
		if (account.currency === "BTC")
			valInUSD = account.balance * cryptoPrices.BTC;
		else if (account.currency === "ETH")
			valInUSD = account.balance * cryptoPrices.ETH;

		return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
	}, [account, displayCurrency, usdRate, cryptoPrices]);

	// Generate and process data for ChartJS
	const chartData = useMemo(() => {
		if (!account) return { labels: [], datasets: [] };
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
				date: formatDateReadable(d),
				fullDate: dateStr,
				balance: 0, // Placeholder, we calculate below
			};
		});

		// Calculate retrospective balance
		let runningBalance = account.balance;
		// Sort transactions descending (newest first)
		const accountTrans = filteredTransactions.sort((a, b) =>
			normalizeDate(b.date).localeCompare(normalizeDate(a.date)),
		);

		// We need bucket transactions by day to subtract/add them from current balance efficiently
		const transByDay: Record<string, number> = {};
		accountTrans.forEach((t) => {
			const d = normalizeDate(t.date);
			let amount = 0;
			const absAmount = Math.abs(t.amount);

			// Only process transactions where the current account is the primary account
			// to avoid double-counting grouped transactions in history
			if (t.accountId !== account.id) return;

			if (t.type === TransactionType.EXPENSE) amount -= absAmount;
			else if (t.type === TransactionType.TRANSFER) {
				if (t.transferDirection === "IN") amount += absAmount;
				else amount -= absAmount;
			} else if (t.type === TransactionType.INCOME) amount += absAmount;
			else if (
				t.type === TransactionType.ACCOUNT_OPENING ||
				t.type === TransactionType.ADJUSTMENT
			) {
				amount += t.amount;
			}

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
	}, [account, filteredTransactions]);

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
						if (context.parsed.y !== null && account) {
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
				grid: { display: false },
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
				grid: { color: "#333", borderDash: [5, 5] },
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

	if (!account) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<p className="text-gray-500 mb-4">Account not found</p>
				<button
					onClick={() => navigate("/app")}
					className="text-primary font-bold hover:underline"
				>
					Back to Dashboard
				</button>
			</div>
		);
	}

	return (
		<div className="animate-fadeIn max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-32 px-4 sm:px-6 lg:px-8">
			{/* Dynamic Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface/40 p-6 sm:p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
				<div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl -mr-32 -mt-32"></div>

				<div className="flex items-center gap-4 sm:gap-6 relative z-10 text-left">
					<button
						onClick={() => navigate(-1)}
						className="p-3.5 sm:p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-white border border-white/5 active:scale-95 shrink-0"
					>
						<ChevronLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
					</button>

					<div className="flex items-center gap-4 sm:gap-6">
						{account.iconType === "IMAGE" ? (
							<img
								src={account.iconValue}
								alt="icon"
								className="w-14 h-14 sm:w-20 sm:h-20 object-contain bg-white rounded-2xl sm:rounded-3xl p-1.5 shadow-2xl shrink-0"
							/>
						) : (
							<div className="w-14 h-14 sm:w-20 sm:h-20 bg-indigo-500/10 rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-5xl border border-indigo-500/20 shadow-2xl shrink-0">
								{account.iconValue}
							</div>
						)}
						<div className="min-w-0">
							<h2 className="text-xl sm:text-4xl font-extrabold sm:font-black text-white tracking-tighter leading-none mb-1.5 sm:mb-2 truncate">
								{account.name}
							</h2>
							<div className="flex items-center gap-2 sm:gap-3">
								<span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest bg-indigo-500 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg shadow-indigo-500/20 whitespace-nowrap">
									{account.type}
								</span>
								<span className="text-[10px] sm:text-xs font-bold sm:font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
									{account.currency} ACCOUNT
								</span>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
					<button
						onClick={() => setShowImportModal(true)}
						className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-primary/10 hover:bg-primary/20 rounded-2xl transition-all font-bold sm:font-black text-xs text-primary uppercase tracking-[0.2em] border border-primary/20 shadow-xl"
					>
						<DocumentArrowUpIcon className="w-4 h-4" /> Import Statements
					</button>
					<button
						onClick={() => {
							setEditingAccount(account);
							setShowAccountForm(true);
						}}
						className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all font-bold sm:font-black text-xs text-white uppercase tracking-[0.2em] border border-white/5 shadow-xl"
					>
						<PencilSquareIcon className="w-4 h-4" /> Edit Account
					</button>
				</div>
			</div>

			{/* Hero Stats */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{/* Total Balance Card */}
				<div className="bg-surface/40 backdrop-blur-3xl p-7 sm:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl group relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>
					<p className="text-gray-500 text-[10px] sm:text-xs font-bold sm:font-black uppercase tracking-[0.25em] mb-3 sm:mb-4">
						Total Balance
					</p>
					<div className="space-y-1">
						<h3 className="text-3xl sm:text-5xl font-extrabold sm:font-black text-white tracking-tighter">
							{maskAmount(
								account.balance.toLocaleString(undefined, {
									minimumFractionDigits: 2,
								}),
								getCurrencySymbol(account.currency),
							)}
						</h3>
						{convertedBalance !== null && (
							<p className="text-gray-500 text-[11px] sm:text-sm font-bold flex items-center gap-1.5 mt-2.5">
								<ArrowUpRightIcon className="w-3.5 h-3.5" />≈{" "}
								{maskAmount(
									convertedBalance.toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 6,
									}),
									getCurrencySymbol(displayCurrency),
								)}
							</p>
						)}
					</div>
				</div>

				{/* Safe to Spend Card */}
				<div className="bg-emerald-500/5 backdrop-blur-3xl p-7 sm:p-8 rounded-[2.5rem] border border-emerald-500/10 shadow-2xl relative overflow-hidden">
					<div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl -mr-16 -mt-16 text-emerald-500"></div>
					<p className="text-emerald-400 text-[10px] sm:text-xs font-bold sm:font-black uppercase tracking-[0.25em] mb-3 sm:mb-4 flex items-center gap-2">
						<WalletIcon className="w-3.5 h-3.5" /> Safe to Spend
					</p>
					<div className="space-y-1">
						<h3 className="text-3xl sm:text-5xl font-extrabold sm:font-black text-emerald-400 tracking-tighter">
							<span className="text-emerald-400/50 text-lg sm:text-xl mr-2 font-medium">
								{getCurrencySymbol(account.currency)}
							</span>
							{availableBalance.toLocaleString(undefined, {
								minimumFractionDigits: 2,
							})}
						</h3>
						<p className="text-gray-400 text-[10px] font-bold sm:font-black uppercase tracking-widest mt-2.5 truncate">
							Reserved in {accountPots.length} Limits:{" "}
							{maskAmount(
								totalInPots.toLocaleString(),
								getCurrencySymbol(account.currency),
							)}
						</p>
					</div>
				</div>

				{/* Quick Insights Card - Visible on md+ */}
				<div className="bg-indigo-500/10 backdrop-blur-3xl p-6 sm:p-8 rounded-4xl sm:rounded-[2.5rem] border border-indigo-500/20 shadow-2xl hidden md:block">
					<p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] mb-3 sm:mb-4">
						Recent Activity
					</p>
					<div className="space-y-3 sm:space-y-4">
						<div className="flex justify-between items-center text-sm">
							<span className="text-gray-500 font-bold uppercase text-[9px] sm:text-[10px]">
								Transactions
							</span>
							<span className="text-white font-black text-xs sm:text-sm">
								{filteredTransactions.length} Total
							</span>
						</div>
						<div className="flex justify-between items-center text-sm">
							<span className="text-gray-500 font-bold uppercase text-[9px] sm:text-[10px]">
								Last Update
							</span>
							<span className="text-white font-black text-xs sm:text-sm">
								{account.updatedAt
									? formatDateReadable(account.updatedAt)
									: "N/A"}
							</span>
						</div>
						<div className="h-1.5 sm:h-2 w-full bg-indigo-500/10 rounded-full overflow-hidden mt-2">
							<div className="h-full bg-indigo-500 w-2/3 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				{/* Left Column - Analytics & History */}
				<div className="lg:col-span-8 space-y-8">
					{/* Analytics expanded */}
					<div className="bg-surface/40 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col min-h-87.5 sm:min-h-112.5 lg:min-h-125">
						<div className="flex justify-between items-center mb-6 sm:mb-10">
							<h4 className="font-extrabold sm:font-black text-white uppercase tracking-[0.2em] text-[10px] sm:text-xs">
								Balance Analytics (30D)
							</h4>
							<div className="flex gap-2 text-right">
								<div className="px-3 py-1 bg-indigo-500 text-[10px] font-black rounded-lg text-white">
									LIVE
								</div>
							</div>
						</div>
						<div className="flex-1 w-full relative">
							<Line data={chartData} options={chartOptions} />
						</div>
					</div>

					{/* Transaction History */}
					<div className="bg-surface/40 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
						<h4 className="font-extrabold sm:font-black text-white uppercase tracking-[0.2em] text-[10px] sm:text-xs mb-6 sm:mb-8">
							Transaction History
						</h4>
						<History
							transactions={filteredTransactions}
							categories={categories}
							accounts={accounts}
							pockets={pockets}
							isAssetPage={true}
							onAddTransaction={() => setShowAddModal(true)}
							onEditTransaction={(t) => {
								setEditingTransaction(t);
								setShowAddModal(true);
							}}
							onDeleteTransaction={(id) =>
								deleteTransaction(
									id,
									accounts,
									pots,
									pockets,
									usdRate,
									transactions,
								)
							}
						/>
					</div>
				</div>

				{/* Right Column - Secondary Info */}
				<div className="lg:col-span-4 space-y-6 sm:space-y-8">
					{/* Active Limits / Pots */}
					{accountPots.length > 0 && (
						<div className="bg-surface/40 backdrop-blur-3xl p-6 sm:p-8 rounded-4xl sm:rounded-[2.5rem] border border-white/5 shadow-2xl space-y-5 sm:space-y-6">
							<h4 className="font-extrabold sm:font-black text-white uppercase tracking-[0.2em] text-[8px] sm:text-xs flex items-center gap-2">
								<BanknotesIcon className="w-4 h-4 text-indigo-400" /> Active
								Spending Limits
							</h4>
							<div className="space-y-3 sm:space-y-4">
								{accountPots.map((pot) => {
									const usedAmount = pot.usedAmount;
									const limitAmount = pot.limitAmount;
									const progress = (usedAmount / limitAmount) * 100;
									return (
										<div
											key={pot.id}
											className="bg-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-white/5 hover:border-indigo-500/30 transition-all group"
										>
											<div className="flex justify-between mb-3 sm:mb-4">
												<span className="text-[11px] sm:text-sm font-extrabold sm:font-black text-white tracking-tight truncate mr-2">
													{maskText(pot.name)}
												</span>
												<div className="text-right shrink-0">
													<p className="text-[7px] sm:text-[10px] font-bold sm:font-black text-rose-400 uppercase tracking-widest">
														Spent
													</p>
													<p className="text-[11px] sm:text-sm font-extrabold sm:font-black text-white font-mono">
														{maskAmount(
															pot.usedAmount.toLocaleString(),
															getCurrencySymbol(account.currency),
														)}
													</p>
												</div>
											</div>
											<div className="w-full bg-gray-900 h-1.5 sm:h-2 rounded-full overflow-hidden border border-white/5 mb-2 sm:mb-3">
												<div
													className={`h-full transition-all duration-1000 ${progress >= 100 ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" : "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"}`}
													style={{
														width: `${Math.max(0, Math.min(100, progress))}%`,
													}}
												/>
											</div>
											<div className="flex justify-between text-[10px] sm:text-[10px] font-bold sm:font-black uppercase tracking-widest text-gray-500">
												<span className="text-indigo-400">
													Available:{" "}
													{maskAmount(pot.amountLeft.toLocaleString())}
												</span>
												<span>
													Limit: {maskAmount(limitAmount.toLocaleString())}
												</span>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{account.note && (
						<div className="bg-surface/40 backdrop-blur-3xl p-6 sm:p-8 rounded-4xl sm:rounded-[2.5rem] border border-white/5 shadow-2xl">
							<p className="text-[10px] text-gray-500 italic leading-relaxed whitespace-pre-wrap">
								{maskMode
									? "•".repeat(Math.min(account.note.length, 32))
									: account.note}
							</p>
						</div>
					)}
				</div>
			</div>


			<Modal
				isOpen={confirmationModal.isOpen}
				onClose={() =>
					setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
				}
				title={confirmationModal.title}
				description={confirmationModal.description}
				iconColor={
					confirmationModal.isDestructive ? "text-rose-400" : "text-primary"
				}
				iconBgColor={
					confirmationModal.isDestructive ? "bg-rose-500/10" : "bg-primary/10"
				}
			>
				<div className="grid grid-cols-2 gap-3">
					<button
						onClick={() =>
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }))
						}
						className="py-3 px-4 rounded-xl font-bold text-sm bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={() => {
							confirmationModal.onConfirm();
							setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
						}}
						className={`py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
							confirmationModal.isDestructive
								? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white"
								: "bg-primary hover:bg-primary-600 shadow-primary/20 text-white"
						}`}
					>
						{confirmationModal.confirmLabel}
					</button>
				</div>
			</Modal>

			<BulkImportModal
				isOpen={showImportModal}
				onClose={() => setShowImportModal(false)}
				accountId={account.id}
				onImport={async (txs, isHistorical) => {
					if (!profile) return;
					const isCloud = !(profile as any).offlineMode && SheetService.isClientReady();
					const profileId = (profile as any).id || "local";
					await bulkImportTransactions(
						txs,
						account.id,
						accounts,
						pots,
						pockets,
						usdRate,
						profileId,
						isCloud,
						isHistorical,
						!isHistorical,
					);
				}}
			/>
		</div>
	);
};

export default AccountPage;
