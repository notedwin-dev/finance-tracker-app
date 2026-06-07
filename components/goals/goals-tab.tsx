import React from "react";
import { Goal, Account } from "../../types";
import { useMask } from "../../helpers/useMask";
import { formatTimeRemaining } from "../../src/lib/domain/goal-time";
import { parseDateSafe } from "../../helpers/transactions.helper";
import {
	ChartBarIcon,
	PencilIcon,
	TrashIcon,
} from "@heroicons/react/24/solid";

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const getAccountName = (accounts: Account[], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

const computeDaysLeft = (deadline: string | undefined): number | null => {
	if (!deadline) return null;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.ceil(
		(parseDateSafe(deadline).getTime() - today.getTime()) / MILLIS_PER_DAY,
	);
};

const daysLeftColor = (daysLeft: number | null): string => {
	if (daysLeft === null) return "text-gray-500";
	if (daysLeft < 0) return "text-rose-400";
	if (daysLeft < 30) return "text-orange-400";
	return "text-gray-500";
};

const computeSavedAmount = (goal: Goal, accounts: Account[]): number => {
	if (!goal.linkedAccountId) return goal.currentAmount;
	const acc = accounts.find((a) => a.id === goal.linkedAccountId);
	return acc ? acc.balance : 0;
};

type Props = {
	goals: Goal[];
	accounts: Account[];
	onEdit: (goal: Goal) => void;
	onDelete: (id: string) => void;
};

export const GoalsTab: React.FC<Props> = ({ goals, accounts, onEdit, onDelete }) => {
	const { maskText, maskAmount } = useMask();

	if (goals.length === 0) {
		return (
			<div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
				<div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
					<ChartBarIcon className="w-8 h-8 text-gray-600" />
				</div>
				<p className="text-xs font-black text-gray-500 uppercase tracking-widest">
					No financial goals set
				</p>
			</div>
		);
	}

	return (
		<>
			{goals.map((goal) => {
				const savedAmount = computeSavedAmount(goal, accounts);
				const progress = (savedAmount / goal.targetAmount) * 100;
				const daysLeft = computeDaysLeft(goal.deadline);
				const timeLabel = goal.deadline
					? formatTimeRemaining(goal.deadline)
					: "DEADLINE NOT SET";

				return (
					<div
						key={goal.id}
						className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-emerald-500/20 group relative overflow-hidden"
					>
						<div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl -mr-16 -mt-16"></div>

						<div className="relative z-10">
							<div className="flex justify-between items-center mb-6">
								<div className="space-y-1">
									<h3 className="text-xl font-black text-white tracking-tight">
										{maskText(goal.name)}
									</h3>
									{goal.linkedAccountId && (
										<p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">
											Linked to{" "}
											{maskText(getAccountName(accounts, goal.linkedAccountId))}
										</p>
									)}
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => onEdit(goal)}
										className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
									>
										<PencilIcon className="w-4 h-4" />
									</button>
									<button
										onClick={() => onDelete(goal.id)}
										className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
									>
										<TrashIcon className="w-4 h-4" />
									</button>
								</div>
							</div>

							<div className="mb-6">
								<div className="flex justify-between items-end mb-3">
									<div className="space-y-0.5">
										<p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
											Saved So Far
										</p>
										<p className="text-2xl font-black text-white tracking-tighter">
											{goal.currency}{" "}
											{maskAmount(savedAmount.toLocaleString())}
										</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
											Final Goal
										</p>
										<p className="text-sm font-black text-gray-400 tracking-tight">
											{goal.currency}{" "}
											{maskAmount(goal.targetAmount.toLocaleString())}
										</p>
									</div>
								</div>

								<div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
									<div
										className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
										style={{ width: `${Math.min(100, progress)}%` }}
									/>
								</div>
							</div>

							<div className="flex justify-between items-center">
								<div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
									<span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
										{Math.round(progress)}% PROGRESS
									</span>
								</div>
								<p
									className={`text-[10px] font-black uppercase tracking-widest ${daysLeftColor(daysLeft)}`}
								>
									{timeLabel}
								</p>
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
};
