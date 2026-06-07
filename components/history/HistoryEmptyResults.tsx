import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";

type Props = {
	hasSearchQuery: boolean;
	onClearFilters: () => void;
};

export const HistoryEmptyResults = ({ hasSearchQuery, onClearFilters }: Props) => (
	<div className="flex flex-col items-center justify-center h-64 text-gray-600 bg-surface/20 rounded-4xl border border-white/5 border-dashed">
		<MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
		<p className="font-bold">
			{hasSearchQuery
				? `No results for "${hasSearchQuery}".`
				: "No transactions match your filters."}
		</p>
		<button
			type="button"
			onClick={onClearFilters}
			className="mt-4 text-xs font-black text-indigo-400 uppercase tracking-widest"
		>
			Clear Filters & Search
		</button>
	</div>
);
