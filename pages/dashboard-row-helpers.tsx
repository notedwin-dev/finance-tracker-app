import React from "react";
import { TransactionType } from "../types";
import { GroupedTransaction } from "../helpers/transactions.helper";
import { Account, Category } from "../types";
import { Currency, MaskText } from "./DashboardTypes";

export const isRecentRowInflow = (t: GroupedTransaction): boolean =>
	t.type === TransactionType.INCOME ||
	(t.type === TransactionType.TRANSFER && t.transferDirection === "IN");

export const getRecentRowIcon = (
	t: GroupedTransaction,
	categories: Category[],
): string => {
	if (t.linkedTransaction) return "↔️";
	return (
		categories.find((c) => c.id === t.categoryId)?.icon ||
		(t.type === TransactionType.TRANSFER ? "↔️" : "💰")
	);
};

export const getRecentRowTitle = (
	t: GroupedTransaction,
	accounts: Account[],
	categories: Category[],
	maskText: MaskText,
): React.ReactNode => {
	if (t.linkedTransaction) {
		if (t.shopName) return maskText(t.shopName);
		const from = maskText(
			accounts.find((a) => a.id === t.accountId)?.name || "???",
		);
		const to = maskText(
			accounts.find((a) => a.id === t.toAccountId)?.name || "???",
		);
		return (
			<>
				{from} → {to}
			</>
		);
	}
	return maskText(
		t.shopName || categories.find((c) => c.id === t.categoryId)?.name || "UNTITLED",
	);
};

export const formatRecentRowAmount = (
	t: GroupedTransaction,
	displayCurrency: Currency,
	usdRate: number,
): number => {
	if (displayCurrency === "MYR") {
		return t.currency === "USD" ? t.amount * usdRate : t.amount;
	}
	return t.currency === "MYR" ? t.amount / usdRate : t.amount;
};

export const getRecentRowAmountClass = (t: GroupedTransaction): string => {
	if (t.linkedTransaction) return "text-indigo-400";
	return isRecentRowInflow(t) ? "text-emerald-400" : "text-rose-400";
};
