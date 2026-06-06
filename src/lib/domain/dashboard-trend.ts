import { Transaction, TransactionType } from "../../../types";
import { parseDateSafe } from "../../../helpers/transactions.helper";

export type TrendTimeframe = "1D" | "1W" | "1M" | "YTD" | "ALL" | "CUSTOM";

export const getTrendStartLimit = (
	timeframe: TrendTimeframe,
	customRange: { start: string; end: string },
	transactions: Transaction[],
	now: Date,
): Date => {
	if (timeframe === "1D") {
		const d = new Date(now);
		d.setHours(now.getHours() - 24);
		return d;
	}
	if (timeframe === "1W") {
		const d = new Date(now);
		d.setDate(now.getDate() - 7);
		return d;
	}
	if (timeframe === "1M") {
		const d = new Date(now);
		d.setDate(now.getDate() - 30);
		return d;
	}
	if (timeframe === "YTD") return new Date(now.getFullYear(), 0, 1);
	if (timeframe === "ALL") {
		const allTimes = transactions.map((t) => parseDateSafe(t.date).getTime());
		if (allTimes.length > 0) return new Date(Math.min(...allTimes));
		return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	}
	if (timeframe === "CUSTOM") return new Date(customRange.start);
	return new Date(now);
};

export const convertValueToBaseCurrency = (
	amount: number,
	currency: string,
	displayCurrency: "MYR" | "USD",
	usdRate: number,
	cryptoPrices: { BTC: number; ETH: number },
): number => {
	if (currency === "MYR") {
		return displayCurrency === "MYR" ? amount : amount / usdRate;
	}
	let valInUSD = amount;
	if (currency === "BTC") valInUSD = amount * cryptoPrices.BTC;
	else if (currency === "ETH") valInUSD = amount * cryptoPrices.ETH;
	return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
};

const isIncomeLike = (type: TransactionType) =>
	type === TransactionType.INCOME || type === TransactionType.ACCOUNT_OPENING;

const isExpenseLike = (type: TransactionType) =>
	type === TransactionType.EXPENSE || type === TransactionType.ACCOUNT_DELETE;

export const applyTransactionToBalance = (
	currentBalance: number,
	tx: Transaction,
	displayCurrency: "MYR" | "USD",
	usdRate: number,
	cryptoPrices: { BTC: number; ETH: number },
): number => {
	if (tx.isHistorical) return currentBalance;

	const valueInBase = convertValueToBaseCurrency(
		tx.amount,
		tx.currency,
		displayCurrency,
		usdRate,
		cryptoPrices,
	);

	if (isIncomeLike(tx.type)) return currentBalance - valueInBase;
	if (isExpenseLike(tx.type)) return currentBalance + valueInBase;
	if (tx.type === TransactionType.ADJUSTMENT) return currentBalance - valueInBase;

	if (tx.type === TransactionType.TRANSFER) {
		const fee = tx.fee || 0;
		if (fee <= 0) return currentBalance;
		const feeInBase = convertValueToBaseCurrency(
			fee,
			tx.currency,
			displayCurrency,
			usdRate,
			cryptoPrices,
		);
		return currentBalance + feeInBase;
	}

	return currentBalance;
};

export const sortTransactionsByDateDesc = (
	transactions: Transaction[],
): Transaction[] =>
	[...transactions].sort((a, b) => {
		const timeA = parseDateSafe(a.date).getTime();
		const timeB = parseDateSafe(b.date).getTime();
		if (timeA !== timeB) return timeB - timeA;
		return (b.createdAt || 0)
			.toString()
			.localeCompare((a.createdAt || 0).toString());
	});
