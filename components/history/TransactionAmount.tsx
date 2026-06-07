import React from "react";
import { Transaction } from "../../types";
import { cn } from "./cn";

type MaskAmount = (amount: number | string, currency?: string) => React.ReactNode;

type Props = {
	transaction: Transaction;
	isIncome: boolean;
	maskAmount: MaskAmount;
};

const getAmountColor = (t: Transaction, isIncome: boolean): string => {
	if (t.linkedTransactionId) return "text-indigo-400";
	if (isIncome) return "text-emerald-400";
	return "text-rose-400";
};

const getAmountPrefix = (t: Transaction, isIncome: boolean): string => {
	if (t.linkedTransactionId) return "";
	return isIncome ? "+" : "-";
};

const formatMoney = (n: number): string =>
	n.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

export const TransactionAmount = ({
	transaction: t,
	isIncome,
	maskAmount,
}: Props) => (
	<div className="flex flex-col items-end">
		<span
			className={cn(
				"font-black text-xl sm:text-xl tracking-tighter",
				getAmountColor(t, isIncome),
			)}
		>
			{getAmountPrefix(t, isIncome)}
			{maskAmount(formatMoney(Math.abs(t.amount)))}
		</span>
		<span className="text-[8px] sm:text-[9px] text-gray-600 font-bold sm:font-black tracking-widest uppercase">
			{t.currency}
			{t.fee && t.fee > 0 && (
				<span className="ml-1 text-rose-400/80">
					(Fee: {t.fee.toFixed(2)})
				</span>
			)}
		</span>
		{t.isSubsidized && t.marketValue && (
			<span className="text-[9px] text-indigo-400/80 font-bold italic mt-1">
				Val: {maskAmount(formatMoney(t.marketValue))}
			</span>
		)}
	</div>
);
