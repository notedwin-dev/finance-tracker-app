import React from "react";
import {
	PlusIcon,
	CheckIcon,
	FunnelIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { cn } from "./cn";

type Props = {
	hasSearchQuery: boolean;
	showFilters: boolean;
	filtersActive: boolean;
	isBatchMode: boolean;
	onOpenSearch: () => void;
	onToggleFilters: () => void;
	onToggleBatchMode: () => void;
	onAddTransaction: () => void;
};

export const HistoryHeader = ({
	hasSearchQuery,
	showFilters,
	filtersActive,
	isBatchMode,
	onOpenSearch,
	onToggleFilters,
	onToggleBatchMode,
	onAddTransaction,
}: Props) => (
	<div className="sticky top-20 lg:top-4 z-60 -mx-4 px-4 py-2 sm:py-3 bg-background/80 backdrop-blur-md border-b sm:border-b-0 border-white/5 sm:bg-transparent sm:backdrop-blur-none transition-all">
		<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
				<button
					type="button"
					onClick={onOpenSearch}
					className={cn(
						"flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
						hasSearchQuery
							? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
							: "bg-surface/40 text-gray-500 border border-white/5 hover:border-white/10",
					)}
				>
					<MagnifyingGlassIcon className="w-3.5 h-3.5" />
					Search
					<span className="hidden sm:inline text-[8px] text-gray-600 ml-1">
						Ctrl+K
					</span>
				</button>

				<button
					type="button"
					onClick={onToggleFilters}
					className={cn(
						"flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
						showFilters || filtersActive
							? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
							: "bg-surface/40 text-gray-500 border border-white/5 hover:border-white/10",
					)}
				>
					<FunnelIcon className="w-3.5 h-3.5" />
					Filter {filtersActive ? "(Active)" : ""}
				</button>

				<button
					type="button"
					onClick={onToggleBatchMode}
					className={cn(
						"flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
						isBatchMode
							? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
							: "bg-surface/40 text-gray-500 border border-white/5 hover:border-white/10",
					)}
				>
					<CheckIcon className="w-3.5 h-3.5" />
					{isBatchMode ? "Exit Batch" : "Batch Actions"}
				</button>
			</div>

			<div className="hidden lg:block">
				<button
					type="button"
					onClick={onAddTransaction}
					className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-3xl font-black tracking-tight shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
				>
					<PlusIcon className="w-5 h-5" />
					NEW TRANSACTION
				</button>
			</div>
		</div>
	</div>
);
