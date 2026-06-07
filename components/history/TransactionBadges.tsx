import React from "react";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { TransactionType, Category, SavingPocket } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";
import { cn } from "./cn";

const Dot = () => <span className="w-0.5 h-0.5 rounded-full bg-gray-700" />;

const HistBadge = ({ label }: { label: string }) => (
	<span className="text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
		{label}
	</span>
);

const PocketBadge = ({
	name,
	color,
}: {
	name: string;
	color: "indigo" | "emerald";
}) => {
	const bg = color === "indigo" ? "bg-indigo-500/10" : "bg-emerald-500/10";
	const border =
		color === "indigo" ? "border-indigo-500/20" : "border-emerald-500/20";
	const text = color === "indigo" ? "text-indigo-400" : "text-emerald-400";
	return (
		<div
			className={`flex items-center gap-1 ${bg} px-1.5 py-0.5 rounded-md border ${border}`}
		>
			<SparklesIcon className={`w-2.5 h-2.5 ${text}`} />
			<span className={`text-[9px] font-black uppercase tracking-tight ${text}`}>
				{name}
			</span>
		</div>
	);
};

type Props = {
	transaction: GroupedTransaction;
	isTransfer: boolean;
	pockets: SavingPocket[];
	categories: Category[];
};

export const TransactionBadges = ({
	transaction: t,
	isTransfer,
	pockets,
	categories,
}: Props) => {
	const subtitle = getSubtitleLabel(t, isTransfer, categories);
	const sourcePocketName = t.savingPocketId
		? pockets.find((p) => p.id === t.savingPocketId)?.name
		: undefined;
	const destPocketName =
		isTransfer && t.toSavingPocketId
			? pockets.find((p) => p.id === t.toSavingPocketId)?.name
			: undefined;

	return (
		<div className="flex items-center gap-2 mt-0.5 sm:mt-1 flex-wrap">
			{t.time && (
				<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
					{t.time}
				</span>
			)}
			{t.time && <Dot />}

			{t.isHistorical && !t.linkedTransaction && (
				<>
					<HistBadge label="Hist." />
					<Dot />
				</>
			)}

			{t.linkedTransaction && (
				<>
					{t.isHistorical && <HistBadge label="Src Hist." />}
					{t.linkedTransaction.isHistorical && <HistBadge label="Dest Hist." />}
					{(t.isHistorical || t.linkedTransaction.isHistorical) && <Dot />}
				</>
			)}

			{sourcePocketName && (
				<>
					<PocketBadge name={sourcePocketName} color="indigo" />
					<Dot />
				</>
			)}

			{destPocketName && (
				<>
					<PocketBadge name={destPocketName} color="emerald" />
					<Dot />
				</>
			)}

			<p
				className={cn(
					"text-[11px] sm:text-[11px] font-semibold sm:font-bold truncate uppercase tracking-[0.05em]",
					isTransfer
						? "text-indigo-400/70 tracking-wider"
						: "text-gray-500/70",
				)}
			>
				{subtitle}
			</p>
		</div>
	);
};

const getSubtitleLabel = (
	t: GroupedTransaction,
	isTransfer: boolean,
	categories: Category[],
): string => {
	if (isTransfer) {
		if (t.linkedTransaction) return "TRANSFER";
		if (t.transferDirection === "IN") return "TRANSFER IN";
		if (t.transferDirection === "OUT") return "TRANSFER OUT";
		return "INTERNAL TRANSFER";
	}
	return (
		categories.find((c) => c.id === t.categoryId)?.name ||
		(t.type === TransactionType.ACCOUNT_OPENING ? "OPENING BALANCE" : t.type)
	);
};
