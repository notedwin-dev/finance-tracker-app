import React, { useState } from "react";
import {
	PlusIcon,
	ChartPieIcon,
	ListBulletIcon,
	CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { CategoryPieChart } from "../components/Charts";
import { GroupedTransaction, normalizeDate } from "../helpers/transactions.helper";
import { Account, Category } from "../types";
import { Currency, MaskAmount, MaskText, PieDatum } from "./DashboardTypes";
import {
	isRecentRowInflow,
	getRecentRowIcon,
	getRecentRowTitle,
	formatRecentRowAmount,
	getRecentRowAmountClass,
} from "./dashboard-row-helpers";

type Props = {
	filteredTransactionsCount: number;
	sortedRecentTransactions: GroupedTransaction[];
	categories: Category[];
	accounts: Account[];
	displayCurrency: Currency;
	usdRate: number;
	pieChartData: PieDatum[];
	maskAmount: MaskAmount;
	maskText: MaskText;
	onAddTransaction: () => void;
};

export const DashboardTransactionsList = ({
	filteredTransactionsCount,
	sortedRecentTransactions,
	categories,
	accounts,
	displayCurrency,
	usdRate,
	pieChartData,
	maskAmount,
	maskText,
	onAddTransaction,
}: Props) => {
	const [showTransactionPie, setShowTransactionPie] = useState(false);

	return (
		<div className="lg:col-span-12 bg-surface/40 sm:border border-gray-800/60 rounded-[2.5rem] overflow-hidden flex flex-col h-auto max-h-125 sm:max-h-150 shadow-xl">
			<div className="px-6 py-6 sm:px-8 border-b border-gray-800/40 flex justify-between items-center bg-surface/20 backdrop-blur-md z-10">
				<h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-3">
					Transactions
					<span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-800/50 px-2.5 py-1 rounded-lg">
						{filteredTransactionsCount}
					</span>
				</h3>
				<div className="flex gap-2">
					<button
						type="button"
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
						type="button"
						onClick={onAddTransaction}
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
						{sortedRecentTransactions.slice(0, 15).map((t) => (
							<TransactionRow
								key={t.id}
								transaction={t}
								accounts={accounts}
								categories={categories}
								displayCurrency={displayCurrency}
								usdRate={usdRate}
								maskAmount={maskAmount}
								maskText={maskText}
							/>
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
	);
};

type RowProps = {
	transaction: GroupedTransaction;
	accounts: Account[];
	categories: Category[];
	displayCurrency: Currency;
	usdRate: number;
	maskAmount: MaskAmount;
	maskText: MaskText;
};

const TransactionRow = ({
	transaction: t,
	accounts,
	categories,
	displayCurrency,
	usdRate,
	maskAmount,
	maskText,
}: RowProps) => (
	<div className="flex justify-between items-center px-4 py-2.5 sm:py-3 hover:bg-white/5 transition-all rounded-2xl group cursor-pointer border-b border-gray-800/20 last:border-0">
		<div className="flex items-center gap-4 min-w-0">
			<div
				className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 shadow-sm ${
					t.linkedTransaction
						? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
						: "bg-gray-900 border border-gray-800"
				}`}
			>
				{getRecentRowIcon(t, categories)}
			</div>
			<div className="min-w-0">
				<p className="text-[17px] font-extrabold text-white group-hover:text-indigo-400 transition-colors truncate tracking-tight">
					{getRecentRowTitle(t, accounts, categories, maskText)}
				</p>
				<p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
					{t.time || "??:??"} • {normalizeDate(t.date)}
					{t.isHistorical && !t.linkedTransaction && (
						<span className="ml-2 text-amber-500/80">• HIST.</span>
					)}
					{t.linkedTransaction &&
						(t.isHistorical || t.linkedTransaction.isHistorical) && (
							<span className="ml-2 text-amber-500/80">
								• HIST ({t.isHistorical ? "S" : ""}
								{t.linkedTransaction.isHistorical ? "D" : ""})
							</span>
						)}
				</p>
			</div>
		</div>
		<div className="text-right shrink-0 ml-4">
			<p
				className={`font-black text-xl tracking-tighter ${getRecentRowAmountClass(t)}`}
			>
				{t.linkedTransaction
					? ""
					: isRecentRowInflow(t)
						? "+"
						: "-"}
				{maskAmount(
					Math.abs(
						formatRecentRowAmount(t, displayCurrency, usdRate),
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
);
