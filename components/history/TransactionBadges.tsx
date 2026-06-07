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

const findPocketName = (
	pockets: SavingPocket[],
	id: string | undefined,
): string | undefined => (id ? pockets.find((p) => p.id === id)?.name : undefined);

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

const TimeBadge = ({ time }: { time: string }) => (
	<>
		<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
			{time}
		</span>
		<Dot />
	</>
);

const HistGroup = ({ label }: { label: string }) => (
	<>
		<HistBadge label={label} />
		<Dot />
	</>
);

const LinkedHistGroup = ({ transaction }: { transaction: GroupedTransaction }) => (
	<>
		{transaction.isHistorical && <HistBadge label="Src Hist." />}
		{transaction.linkedTransaction?.isHistorical && <HistBadge label="Dest Hist." />}
		{(transaction.isHistorical || transaction.linkedTransaction?.isHistorical) && <Dot />}
	</>
);

const PocketGroup = ({ name, color }: { name: string; color: "indigo" | "emerald" }) => (
	<>
		<PocketBadge name={name} color={color} />
		<Dot />
	</>
);

const Subtitle = ({
	label,
	isTransfer,
}: {
	label: string;
	isTransfer: boolean;
}) => (
	<p
		className={cn(
			"text-[11px] sm:text-[11px] font-semibold sm:font-bold truncate uppercase tracking-[0.05em]",
			isTransfer
				? "text-indigo-400/70 tracking-wider"
				: "text-gray-500/70",
		)}
	>
		{label}
	</p>
);

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
	const sourcePocketName = findPocketName(pockets, t.savingPocketId);
	const destPocketName = isTransfer
		? findPocketName(pockets, t.toSavingPocketId)
		: undefined;

	return (
		<div className="flex items-center gap-2 mt-0.5 sm:mt-1 flex-wrap">
			{t.time && <TimeBadge time={t.time} />}
			{t.isHistorical && !t.linkedTransaction && <HistGroup label="Hist." />}
			{t.linkedTransaction && <LinkedHistGroup transaction={t} />}
			{sourcePocketName && <PocketGroup name={sourcePocketName} color="indigo" />}
			{destPocketName && <PocketGroup name={destPocketName} color="emerald" />}
			<Subtitle label={subtitle} isTransfer={isTransfer} />
		</div>
	);
};
