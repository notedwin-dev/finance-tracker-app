import React from "react";
import { Pot, Account } from "../../types";
import { useMask } from "../../helpers/useMask";
import {
	BanknotesIcon,
	PencilIcon,
	TrashIcon,
} from "@heroicons/react/24/solid";

type Props = {
	pots: Pot[];
	accounts: Account[];
	onEdit: (pot: Pot) => void;
	onDelete: (id: string) => void;
};

const getAccountName = (accounts: Account[], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

export const PotsTab: React.FC<Props> = ({ pots, accounts, onEdit, onDelete }) => {
	const { maskText, maskAmount } = useMask();

	if (pots.length === 0) {
		return (
			<div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
				<div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
					<BanknotesIcon className="w-8 h-8 text-gray-600" />
				</div>
				<p className="text-xs font-black text-gray-500 uppercase tracking-widest">
					No active pots found
				</p>
			</div>
		);
	}

	return (
		<>
			{pots.map((pot) => {
				const progress = (pot.usedAmount / pot.limitAmount) * 100;
				return (
					<div
						key={pot.id}
						className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-indigo-500/20 group relative overflow-hidden"
					>
						<div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>

						<div className="relative z-10">
							<div className="flex justify-between items-center mb-6">
								<div className="space-y-1">
									<h3 className="text-xl font-black text-white tracking-tight">
										{maskText(pot.name)}
									</h3>
									<p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
										{maskText(getAccountName(accounts, pot.accountId))}
									</p>
								</div>
								<div className="flex gap-2">
									<button
										onClick={() => onEdit(pot)}
										className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
									>
										<PencilIcon className="w-4 h-4" />
									</button>
									<button
										onClick={() => onDelete(pot.id)}
										className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
									>
										<TrashIcon className="w-4 h-4" />
									</button>
								</div>
							</div>

							<div className="mb-6">
								<div className="flex justify-between items-end mb-3">
									<div className="space-y-0.5">
										<p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">
											Total Spent
										</p>
										<p className="text-2xl font-black text-white tracking-tighter">
											{pot.currency}{" "}
											{maskAmount(pot.usedAmount.toLocaleString())}
										</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
											Limit
										</p>
										<p className="text-sm font-black text-white tracking-tight">
											{pot.currency}{" "}
											{maskAmount(pot.limitAmount.toLocaleString())}
										</p>
									</div>
								</div>

								<div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
									<div
										className="h-full bg-indigo-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)] relative"
										style={{
											width: `${Math.max(0, Math.min(100, progress))}%`,
										}}
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
									Amount left: {pot.currency}{" "}
									{maskAmount(pot.amountLeft.toLocaleString())}
								</p>
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
};
