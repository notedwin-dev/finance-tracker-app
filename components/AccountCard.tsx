import React from "react";
import { Account, Pot, Transaction } from "../types";
import { CryptoPrices } from "../services/coin.services";
import {
	StarIcon,
	ArrowUpRightIcon,
	ArrowDownRightIcon,
} from "@heroicons/react/24/solid";
import { SparklineChart } from "./Charts";
import { useMask } from "../helpers/useMask";
import { groupTransactions } from "../helpers/transactions.helper";
import { convertToDisplayCurrency } from "../src/lib/domain/currency";
import { reconstructAccountHistory } from "../src/lib/domain/account-trend";

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

const buildTrendDelta = (
	trendData: number[],
): { diff: number; isPositive: boolean; percentChange: number } => {
	const lastPoint = trendData[trendData.length - 1];
	const prevPoint = trendData[0];
	const diff = lastPoint - prevPoint;
	const isPositive = diff >= 0;
	const percentChange = prevPoint !== 0 ? (diff / Math.abs(prevPoint)) * 100 : 0;
	return { diff, isPositive, percentChange };
};

const getCurrencySymbol = (displayCurrency: "MYR" | "USD"): string =>
	displayCurrency === "MYR" ? "RM" : "$";

const AccountCardIcon: React.FC<{ account: Account }> = ({ account }) =>
	account.iconType === "IMAGE" ? (
		<img
			src={account.iconValue}
			className="w-14 h-14 object-contain shrink-0 rounded-2xl bg-white p-1 flex items-center justify-center shadow-2xl border border-white/10 transition-transform group-hover:scale-110"
			alt=""
		/>
	) : (
		<span className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-3xl shadow-2xl transition-all group-hover:scale-110 group-hover:border-indigo-500/40">
			{account.iconValue}
		</span>
	);

const LimitsBadge: React.FC<{ count: number }> = ({ count }) => (
	<div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20 animate-pulse">
		<StarIcon className="w-2.5 h-2.5" />
		<span className="text-[9px] font-black">{count} LIMITS</span>
	</div>
);

const AccountCardHeader: React.FC<{
	account: Account;
	potsCount: number;
	maskedName: React.ReactNode;
}> = ({ account, potsCount, maskedName }) => (
	<div className="relative z-10 flex justify-between items-start">
		<div className="flex items-center gap-4 min-w-0">
			<AccountCardIcon account={account} />
			<div className="space-y-0.5 min-w-0">
				<h4 className="font-bold text-lg text-white tracking-tight truncate">
					{maskedName}
				</h4>
				<div className="flex items-center gap-2">
					<p className="text-[10px] text-gray-500 uppercase font-black tracking-widest truncate">
						{account.type} • {account.currency}
					</p>
					{potsCount > 0 && <LimitsBadge count={potsCount} />}
				</div>
			</div>
		</div>
	</div>
);

const AccountCardBalance: React.FC<{
	displayBalance: number;
	availableBalance: number;
	displayCurrency: "MYR" | "USD";
	maskAmount: (amount: number | string, currency?: string, isSensitive?: boolean) => React.ReactNode;
}> = ({ displayBalance, availableBalance, displayCurrency, maskAmount }) => {
	const symbol = getCurrencySymbol(displayCurrency);
	return (
		<div className="relative z-10">
			<div className="flex items-baseline gap-1.5">
				<span className="text-sm font-black text-gray-500">{symbol}</span>
				<span className="text-4xl font-black text-white tracking-tighter">
					{maskAmount(
						displayBalance.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						}),
					)}
				</span>
			</div>
			{availableBalance > 0 && (
				<div className="mt-1">
					<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
						{maskAmount(availableBalance.toLocaleString(), symbol)} Available
					</span>
				</div>
			)}
		</div>
	);
};

const AccountCardTrend: React.FC<{
	trendData: number[];
	isPositive: boolean;
	percentChange: number;
}> = ({ trendData, isPositive, percentChange }) => {
	const color = isPositive ? "#10b981" : "#f43f5e";
	return (
		<div className="relative z-10 flex justify-between items-end pt-4 border-t border-gray-800/30">
			<div className="space-y-1">
				<p className="text-[9px] text-gray-500 uppercase font-black tracking-widest opacity-60">
					Trend {trendData.length > 1 ? "Activity" : "Static"}
				</p>
				<div
					className={`flex items-center gap-1 text-[11px] font-black tracking-tight ${
						isPositive ? "text-emerald-400" : "text-rose-400"
					}`}
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
				<SparklineChart data={trendData} color={color} height={40} />
			</div>
		</div>
	);
};

const AccountCard: React.FC<Props> = ({
	account,
	pots,
	transactions,
	onClick,
	usdRate = 1,
	cryptoPrices = { BTC: 65000, ETH: 3500 },
	displayCurrency = "MYR",
}) => {
	const { maskAmount, maskText } = useMask();
	const accountPots = pots.filter((p) => p.accountId === account.id);
	const totalInPots = accountPots.reduce(
		(sum, p) => sum + (p.amountLeft || 0),
		0,
	);
	const availableBalance = account.balance - totalInPots;

	const displayBalance = React.useMemo(
		() =>
			convertToDisplayCurrency(
				account.balance,
				account.currency,
				displayCurrency,
				usdRate,
				cryptoPrices,
			),
		[account.balance, account.currency, usdRate, displayCurrency, cryptoPrices],
	);

	const displayPotsBalance = React.useMemo(
		() =>
			convertToDisplayCurrency(
				availableBalance,
				account.currency,
				displayCurrency,
				usdRate,
				cryptoPrices,
			),
		[availableBalance, account.currency, usdRate, displayCurrency, cryptoPrices],
	);

	const trendData = React.useMemo(() => {
		const grouped = groupTransactions(transactions);
		return reconstructAccountHistory(grouped, account, 12);
	}, [account.id, account.balance, transactions]);

	const { isPositive, percentChange } = buildTrendDelta(trendData);

	return (
		<div
			className="relative rounded-[2.5rem] bg-linear-to-br from-surface/80 to-surface/40 border border-gray-800/50 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer p-7 group h-70 flex flex-col justify-between overflow-hidden"
			onClick={() => onClick(account)}
		>
			<div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none" />
			<div
				className={`absolute -right-20 -top-20 w-48 h-48 rounded-full blur-[80px] transition-opacity duration-500 opacity-20 group-hover:opacity-40 ${
					isPositive ? "bg-emerald-500/30" : "bg-rose-500/30"
				}`}
			/>

			<AccountCardHeader
				account={account}
				potsCount={accountPots.length}
				maskedName={maskText(account.name)}
			/>
			<AccountCardBalance
				displayBalance={displayBalance}
				availableBalance={displayPotsBalance}
				displayCurrency={displayCurrency}
				maskAmount={maskAmount}
			/>
			<AccountCardTrend
				trendData={trendData}
				isPositive={isPositive}
				percentChange={percentChange}
			/>
		</div>
	);
};

export default AccountCard;
