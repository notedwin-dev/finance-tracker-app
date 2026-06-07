import React from "react";
import { GroupedTransaction, normalizeDate } from "../helpers/transactions.helper";
import { Account, Category } from "../types";
import { Currency, MaskAmount, MaskText } from "./DashboardTypes";
import {
	isRecentRowInflow,
	getRecentRowIcon,
	getRecentRowTitle,
	formatRecentRowAmount,
	getRecentRowAmountClass,
} from "./dashboard-row-helpers";

type RowIconProps = {
	transaction: GroupedTransaction;
	categories: Category[];
};

const RowIcon = ({ transaction, categories }: RowIconProps) => (
	<div
		className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 shadow-sm ${
			transaction.linkedTransaction
				? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
				: "bg-gray-900 border border-gray-800"
		}`}
	>
		{getRecentRowIcon(transaction, categories)}
	</div>
);

type RowMetaProps = {
	transaction: GroupedTransaction;
};

const RowMeta = ({ transaction: t }: RowMetaProps) => (
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
);

type RowAmountProps = {
	transaction: GroupedTransaction;
	displayCurrency: Currency;
	usdRate: number;
	maskAmount: MaskAmount;
};

const formatMoney = (n: number): string =>
	n.toLocaleString(undefined, { minimumFractionDigits: 2 });

const amountSign = (t: GroupedTransaction): string => {
	if (t.linkedTransaction) return "";
	return isRecentRowInflow(t) ? "+" : "-";
};

const RowAmount = ({
	transaction: t,
	displayCurrency,
	usdRate,
	maskAmount,
}: RowAmountProps) => (
	<div className="text-right shrink-0 ml-4">
		<p className={`font-black text-xl tracking-tighter ${getRecentRowAmountClass(t)}`}>
			{amountSign(t)}
			{maskAmount(formatMoney(Math.abs(formatRecentRowAmount(t, displayCurrency, usdRate))))}
		</p>
		<span className="text-[10px] text-gray-600 font-black tracking-widest uppercase">
			{displayCurrency}
		</span>
	</div>
);

type RowProps = {
	transaction: GroupedTransaction;
	accounts: Account[];
	categories: Category[];
	displayCurrency: Currency;
	usdRate: number;
	maskAmount: MaskAmount;
	maskText: MaskText;
};

export const TransactionRow = ({
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
			<RowIcon transaction={t} categories={categories} />
			<div className="min-w-0">
				<p className="text-[17px] font-extrabold text-white group-hover:text-indigo-400 transition-colors truncate tracking-tight">
					{getRecentRowTitle(t, accounts, categories, maskText)}
				</p>
				<RowMeta transaction={t} />
			</div>
		</div>
		<RowAmount
			transaction={t}
			displayCurrency={displayCurrency}
			usdRate={usdRate}
			maskAmount={maskAmount}
		/>
	</div>
);
