import React from "react";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/solid";

type SavingsCardProps = {
	name: React.ReactNode;
	subInfo: React.ReactNode;
	icon?: React.ReactNode;
	onEdit: () => void;
	onDelete: () => void;
	children: React.ReactNode;
};

export const SavingsCard: React.FC<SavingsCardProps> = ({
	name,
	subInfo,
	icon,
	onEdit,
	onDelete,
	children,
}) => (
	<div className="bg-surface/40 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/5 shadow-2xl transition-all hover:border-indigo-500/20 group relative overflow-hidden">
		<div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-2xl -mr-16 -mt-16"></div>

		<div className="relative z-10">
			<div className="flex justify-between items-center mb-6">
				<div className={icon ? "flex items-center gap-4" : "space-y-1"}>
					{icon && (
						<div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">
							{icon}
						</div>
					)}
					<div className="space-y-1">
						<h3 className="text-xl font-black text-white tracking-tight">
							{name}
						</h3>
						<p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
							{subInfo}
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						onClick={onEdit}
						className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
					>
						<PencilIcon className="w-4 h-4" />
					</button>
					<button
						onClick={onDelete}
						className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
					>
						<TrashIcon className="w-4 h-4" />
					</button>
				</div>
			</div>

			{children}
		</div>
	</div>
);
