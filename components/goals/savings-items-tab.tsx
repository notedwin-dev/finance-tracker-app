import React from "react";
import { BanknotesIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { useMask } from "../../helpers/useMask";
import { Account, Pot, SavingPocket } from "../../types";
import { EmptyTabState } from "./empty-tab-state";
import { SavingsCard } from "./savings-card";

type MaskHelpers = ReturnType<typeof useMask>;

type SavingsItemsTabProps<T extends { id: string; name: string }> = {
	items: T[];
	emptyIcon: React.ReactNode;
	emptyMessage: string;
	onEdit: (item: T) => void;
	onDelete: (id: string) => void;
	getSubInfo: (item: T, mask: MaskHelpers) => React.ReactNode;
	getIcon?: (item: T) => React.ReactNode;
	renderBody: (item: T, mask: MaskHelpers) => React.ReactNode;
};

export function SavingsItemsTab<T extends { id: string; name: string }>({
	items,
	emptyIcon,
	emptyMessage,
	onEdit,
	onDelete,
	getSubInfo,
	getIcon,
	renderBody,
}: SavingsItemsTabProps<T>) {
	const mask = useMask();

	if (items.length === 0) {
		return <EmptyTabState icon={emptyIcon} message={emptyMessage} />;
	}

	return (
		<>
			{items.map((item) => (
				<SavingsCard
					key={item.id}
					name={mask.maskText(item.name)}
					subInfo={getSubInfo(item, mask)}
					icon={getIcon?.(item)}
					onEdit={() => onEdit(item)}
					onDelete={() => onDelete(item.id)}
				>
					{renderBody(item, mask)}
				</SavingsCard>
			))}
		</>
	);
}

type PocketsTabProps = {
	pockets: SavingPocket[];
	accounts: Account[];
	onEdit: (pocket: SavingPocket) => void;
	onDelete: (id: string) => void;
};

type PotsTabProps = {
	pots: Pot[];
	accounts: Account[];
	onEdit: (pot: Pot) => void;
	onDelete: (id: string) => void;
};

const getAccountName = (accounts: Account[], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

export const PocketsTab: React.FC<PocketsTabProps> = ({ pockets, accounts, onEdit, onDelete }) => (
	<SavingsItemsTab
		items={pockets}
		emptyIcon={<SparklesIcon className="w-8 h-8 text-gray-600" />}
		emptyMessage="No active pockets found"
		onEdit={onEdit}
		onDelete={onDelete}
		getSubInfo={(pocket) =>
			pocket.accountId
				? getAccountName(accounts, pocket.accountId)
				: "Endless Savings"
		}
		getIcon={(pocket) => pocket.icon}
		renderBody={(pocket, { maskAmount }) => (
			<>
				<div className="mb-6">
					<p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
						Current Savings
					</p>
					<p className="text-4xl font-black text-white tracking-tighter">
						{pocket.currency}{" "}
						{maskAmount(
							pocket.currentAmount.toLocaleString(undefined, {
								minimumFractionDigits: 2,
							}),
						)}
					</p>
				</div>

				<div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl w-fit">
					<div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
					Growth Tracker Active
				</div>
			</>
		)}
	/>
);

export const PotsTab: React.FC<PotsTabProps> = ({ pots, accounts, onEdit, onDelete }) => (
	<SavingsItemsTab
		items={pots}
		emptyIcon={<BanknotesIcon className="w-8 h-8 text-gray-600" />}
		emptyMessage="No active pots found"
		onEdit={onEdit}
		onDelete={onDelete}
		getSubInfo={(pot, { maskText }) => maskText(getAccountName(accounts, pot.accountId))}
		renderBody={(pot, { maskAmount }) => {
			const progress = (pot.usedAmount / pot.limitAmount) * 100;

			return (
				<>
					<div className="mb-6">
						<div className="flex justify-between items-end mb-3">
							<div className="space-y-0.5">
								<p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">
									Total Spent
								</p>
								<p className="text-2xl font-black text-white tracking-tighter">
									{pot.currency} {maskAmount(pot.usedAmount.toLocaleString())}
								</p>
							</div>
							<div className="text-right">
								<p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
									Limit
								</p>
								<p className="text-sm font-black text-white tracking-tight">
									{pot.currency} {maskAmount(pot.limitAmount.toLocaleString())}
								</p>
							</div>
						</div>

						<div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
							<div
								className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)] relative"
								style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
							></div>
						</div>
					</div>

					<div className="flex justify-between items-center">
						<div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
							<span className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">
								{Math.round(progress)}% USED
							</span>
						</div>
						<p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
							Amount left: {pot.currency} {maskAmount(pot.amountLeft.toLocaleString())}
						</p>
					</div>
				</>
			);
		}}
	/>
);
