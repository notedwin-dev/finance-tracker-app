import React from "react";
import { SavingPocket, Account } from "../../types";
import { useMask } from "../../helpers/useMask";
import {
	PencilIcon,
	TrashIcon,
	SparklesIcon,
} from "@heroicons/react/24/solid";

type Props = {
	pockets: SavingPocket[];
	accounts: Account[];
	onEdit: (pocket: SavingPocket) => void;
	onDelete: (id: string) => void;
};

const getAccountName = (accounts: Account[], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

export const PocketsTab: React.FC<Props> = ({ pockets, accounts, onEdit, onDelete }) => {
	const { maskText, maskAmount } = useMask();

	if (pockets.length === 0) {
		return (
			<div className="col-span-full py-20 text-center bg-gray-900/40 rounded-[2.5rem] border border-gray-800/60 backdrop-blur-md">
				<div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
					<SparklesIcon className="w-8 h-8 text-gray-600" />
				</div>
				<p className="text-xs font-black text-gray-500 uppercase tracking-widest">
					No active pockets found
				</p>
			</div>
		);
	}

	return (
		<>
			{pockets.map((pocket) => (
				<div
					key={pocket.id}
					className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-indigo-500/20 group relative overflow-hidden"
				>
					<div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>

					<div className="relative z-10">
						<div className="flex justify-between items-center mb-6">
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">
									{pocket.icon}
								</div>
								<div className="space-y-1">
									<h3 className="text-xl font-black text-white tracking-tight">
										{maskText(pocket.name)}
									</h3>
									<p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
										{pocket.accountId
											? getAccountName(accounts, pocket.accountId)
											: "Endless Savings"}
									</p>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => onEdit(pocket)}
									className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
								>
									<PencilIcon className="w-4 h-4" />
								</button>
								<button
									onClick={() => onDelete(pocket.id)}
									className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
								>
									<TrashIcon className="w-4 h-4" />
								</button>
							</div>
						</div>

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
					</div>
				</div>
			))}
		</>
	);
};
