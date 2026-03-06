import React from "react";
import { Account, Pot, Transaction, TransactionType } from "../types";
import { CryptoPrices } from "../services/coin.services";
import {
	WalletIcon,
	StarIcon,
	ArrowUpRightIcon,
	ArrowDownRightIcon,
} from "@heroicons/react/24/solid";
import { SparklineChart } from "./Charts";
import { useData } from "../context/DataContext";

interface Props {
	account: Account;
	pots: Pot[];
	transactions: Transaction[];
	onClick: (account: Account) => void;
	usdRate?: number;
	cryptoPrices?: CryptoPrices;
	displayCurrency?: "MYR" | "USD";
	hideBalance?: boolean;
}

const AccountCard: React.FC<Props> = ({
	account,
	pots,
	transactions,
	onClick,
	usdRate = 1,
	cryptoPrices = { BTC: 65000, ETH: 3500 },
	displayCurrency = "MYR",
	hideBalance = false,
}) => {
	const { maskAmount, maskText } = useData();
	const accountPots = pots.filter((p) => p.accountId === account.id);
	const totalInPots = accountPots.reduce(
		(sum, p) => sum + (p.amountLeft || 0),
		0,
	);
	const availableBalance = account.balance - totalInPots;

	// Convert balance for display
	const displayBalance = React.useMemo(() => {
		if (account.currency === "MYR") {
			return displayCurrency === "MYR"
				? account.balance
				: account.balance / usdRate;
		}

		let valInUSD = account.balance;
		if (account.currency === "BTC")
			valInUSD = account.balance * cryptoPrices.BTC;
		else if (account.currency === "ETH")
			valInUSD = account.balance * cryptoPrices.ETH;

		return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
	}, [
		account.balance,
		account.currency,
		usdRate,
		displayCurrency,
		cryptoPrices,
	]);

	const displayPotsBalance = React.useMemo(() => {
		if (account.currency === "MYR") {
			return displayCurrency === "MYR"
				? availableBalance
				: availableBalance / usdRate;
		}

		let valInUSD = availableBalance;
		if (account.currency === "BTC")
			valInUSD = availableBalance * cryptoPrices.BTC;
		else if (account.currency === "ETH")
			valInUSD = availableBalance * cryptoPrices.ETH;

		return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
	}, [
		availableBalance,
		account.currency,
		usdRate,
		displayCurrency,
		cryptoPrices,
	]);

	// Real trend data for the account
	const trendData = React.useMemo(() => {
		const accountTxs = transactions
			.filter((t) => t.accountId === account.id || t.toAccountId === account.id)
			.sort((a, b) => {
				const timeA = new Date(a.date).getTime();
				const timeB = new Date(b.date).getTime();
				if (timeA !== timeB) return timeA - timeB;
				return (a.createdAt || 0).toString().localeCompare((b.createdAt || 0).toString());
			});

		if (accountTxs.length === 0) return [account.balance, account.balance];

		const balancePoints: number[] = [];
		let runningBalance = account.balance;

		// Work backwards from current balance
		const reversedTxs = [...accountTxs].reverse();
		balancePoints.push(runningBalance);

		for (const tx of reversedTxs) {
			if (tx.isHistorical) continue;

			if (tx.type === TransactionType.INCOME || tx.type === TransactionType.ACCOUNT_OPENING) {
				if (tx.accountId === account.id) runningBalance -= tx.amount;
			} else if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.ACCOUNT_DELETE) {
				if (tx.accountId === account.id) runningBalance += tx.amount;
			} else if (tx.type === TransactionType.ADJUSTMENT) {
				if (tx.accountId === account.id) runningBalance -= tx.amount;
			} else if (tx.type === TransactionType.TRANSFER) {
				const fee = tx.fee || 0;
				const feeType = tx.feeType || "INCLUSIVE";
				// To go backward:
				// - If money came IN (toAccountId), we SUBTRACT it
				// - If money went OUT (accountId), we ADD it
				if (tx.toAccountId === account.id) {
					// Inflow amount could be reduced by fee if feeType is EXCLUSIVE (receiver pays fee)
					const actualInflow = feeType === "EXCLUSIVE" ? tx.amount - fee : tx.amount;
					runningBalance -= actualInflow;
				} else if (tx.accountId === account.id) {
					// Outflow amount is amount + fee if feeType is INCLUSIVE (sender pays fee)
					const actualOutflow = feeType === "INCLUSIVE" ? tx.amount + fee : tx.amount;
					runningBalance += actualOutflow;
				}
			}
			balancePoints.push(runningBalance);
			if (balancePoints.length >= 15) break; // Limit to last 15 points
		}

		return balancePoints.reverse();
	}, [account.id, account.balance, transactions]);

	const lastPoint = trendData[trendData.length - 1];
	const prevPoint = trendData[0];
	const diff = lastPoint - prevPoint;
	const isPositive = diff >= 0;
	const percentChange =
		prevPoint !== 0 ? (diff / Math.abs(prevPoint)) * 100 : 0;

	return (
		<div
			className="relative rounded-[2.5rem] bg-linear-to-br from-surface/80 to-surface/40 border border-gray-800/50 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer p-7 group h-70 flex flex-col justify-between overflow-hidden"
			onClick={() => onClick(account)}
		>
			{/* Glossy Overlay */}
			<div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none" />

			{/* Background radial glow */}
			<div
				className={`absolute -right-20 -top-20 w-48 h-48 rounded-full blur-[80px] transition-opacity duration-500 opacity-20 group-hover:opacity-40 ${isPositive ? "bg-emerald-500/30" : "bg-rose-500/30"}`}
			/>

			<div className="relative z-10 flex justify-between items-start">
				<div className="flex items-center gap-4 min-w-0">
					{account.iconType === "IMAGE" ? (
						<img
							src={account.iconValue}
							className="w-14 h-14 object-contain shrink-0 rounded-2xl bg-white p-1 flex items-center justify-center shadow-2xl border border-white/10 transition-transform group-hover:scale-110"
							alt=""
						/>
					) : (
						<span className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl shadow-2xl transition-all group-hover:scale-110 group-hover:border-indigo-500/40">
							{account.iconValue}
						</span>
					)}
					<div className="space-y-0.5 min-w-0">
						<h4 className="font-bold text-lg text-white tracking-tight truncate">
							{maskText(account.name)}
						</h4>
						<div className="flex items-center gap-2">
							<p className="text-[10px] text-gray-500 uppercase font-black tracking-widest truncate">
								{account.type} • {account.currency}
							</p>
							{accountPots.length > 0 && (
								<div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20 animate-pulse">
									<StarIcon className="w-2.5 h-2.5" />
									<span className="text-[9px] font-black">
										{accountPots.length} LIMITS
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="relative z-10">
				<div className="flex items-baseline gap-1.5">
					<span className="text-sm font-black text-gray-500">
						{displayCurrency === "MYR" ? "RM" : "$"}
					</span>
					<span className="text-4xl font-black text-white tracking-tighter">
						{maskAmount(
							displayBalance.toLocaleString(undefined, {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							}),
						)}
					</span>
				</div>
				{totalInPots > 0 && (
					<div className="mt-1">
						<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
							{maskAmount(
								displayPotsBalance.toLocaleString(),
								displayCurrency === "MYR" ? "RM" : "$",
							)}{" "}
							Available
						</span>
					</div>
				)}
			</div>

			<div className="relative z-10 flex justify-between items-end pt-4 border-t border-gray-800/30">
				<div className="space-y-1">
					<p className="text-[9px] text-gray-500 uppercase font-black tracking-widest opacity-60">
						Trend {trendData.length > 1 ? "Activity" : "Static"}
					</p>
					<div
						className={`flex items-center gap-1 text-[11px] font-black tracking-tight ${isPositive ? "text-emerald-400" : "text-rose-400"}`}
					>
						{isPositive ? (
							<ArrowUpRightIcon className="w-3 h-3 stroke-3" />
						) : (
							<ArrowDownRightIcon className="w-3 h-3 stroke-3" />
						)}
						{Math.abs(percentChange).toFixed(1)}%
					</div>
				</div>
				<div className="w-28 h-10 opacity-60 group-hover:opacity-100 transition-opacity">
					<SparklineChart
						data={trendData}
						color={isPositive ? "#10b981" : "#f43f5e"}
						height={40}
					/>
				</div>
			</div>
		</div>
	);
};

export default AccountCard;
