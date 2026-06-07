import React from "react";

type Props = {
	selectedCount: number;
	totalCount: number;
	onToggleSelectAll: () => void;
};

export const BatchSelectAllBar = ({
	selectedCount,
	totalCount,
	onToggleSelectAll,
}: Props) => {
	const allSelected = selectedCount === totalCount;
	return (
		<div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-4 animate-slideDown">
			<button
				type="button"
				onClick={onToggleSelectAll}
				className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] hover:text-indigo-300 transition-colors"
			>
				{allSelected ? "Deselect All" : `Select All (${totalCount})`}
			</button>
			<p className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-widest">
				{selectedCount} of {totalCount} selected
			</p>
		</div>
	);
};
