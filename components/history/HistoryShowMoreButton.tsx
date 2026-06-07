import React from "react";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

type Props = {
	hasMore: boolean;
	onClick: () => void;
};

export const HistoryShowMoreButton = ({ hasMore, onClick }: Props) => {
	if (!hasMore) return null;
	return (
		<div className="flex justify-center pt-8">
			<button
				type="button"
				onClick={onClick}
				className="flex items-center gap-3 bg-surface/40 hover:bg-surface/60 text-gray-400 hover:text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all active:scale-95"
			>
				Show Older Transactions
				<ChevronRightIcon className="w-4 h-4 rotate-90" />
			</button>
		</div>
	);
};
