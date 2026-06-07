import React, { useState, useMemo } from "react";
import {
	Transaction,
	Category,
	Account,
	SavingPocket,
} from "../types";
import {
	PlusIcon,
	ChevronRightIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { useMask } from "../helpers/useMask";
import { useFinanceStore } from "../src/stores/finance.store";
import { formatDateHeader } from "./history/formatDateHeader";
import {
	useHistoryFilters,
	useDateAccountFilter,
	hasActiveFilters,
} from "./history/useHistoryFilters";
import { useBackToTop, useSearchKeyboard } from "./history/useHistoryUiState";
import { useHistoryHandlers } from "./history/useHistoryHandlers";
import { prepareTransactionForEdit } from "./history/getTransferEditPayload";
import { useFilteredTransactions } from "./history/useFilteredTransactions";
import { useSwipeGesture } from "./history/useSwipeGesture";
import { useBatchSelection } from "./history/useBatchSelection";
import TransactionItem from "./history/TransactionItem";
import BatchActionBar from "./history/BatchActionBar";
import FiltersPanel from "./history/FiltersPanel";
import BatchEditModal from "./history/BatchEditModal";
import SearchOverlay from "./history/SearchOverlay";
import { HistoryHeader } from "./history/HistoryHeader";
import { BatchSelectAllBar } from "./history/BatchSelectAllBar";
import { BackToTopButton } from "./history/BackToTopButton";

interface Props {
	transactions: Transaction[];
	categories: Category[];
	accounts: Account[];
	pockets: SavingPocket[];
	showAddModal?: boolean;
	isAssetPage?: boolean;
	onAddTransaction: () => void;
	onEditTransaction: (t: Transaction) => void;
	onDeleteTransaction: (id: string) => Promise<void>;
}

const History: React.FC<Props> = ({
	transactions,
	categories,
	accounts,
	pockets,
	showAddModal = false,
	isAssetPage = false,
	onAddTransaction,
	onEditTransaction,
	onDeleteTransaction,
}) => {
	const { maskAmount, maskText } = useMask();
	const usdRate = useFinanceStore((s) => s.usdRate);
	const { pots } = useFinanceStore();

	const filters = useHistoryFilters();
	const showBackToTop = useBackToTop();
	const [showSearchOverlay, setShowSearchOverlay] = useState(false);

	useSearchKeyboard(
		() => setShowSearchOverlay(true),
		() => {
			setShowSearchOverlay(false);
			filters.setSearchQuery("");
		},
		!showSearchOverlay,
	);

	const batch = useBatchSelection();
	const swipe = useSwipeGesture();

	const {
		filteredTransactions,
		grouped,
		sortedDates,
		visibleCount,
		setVisibleCount,
	} = useFilteredTransactions(
		transactions,
		filters.startDate,
		filters.endDate,
		filters.searchQuery,
		categories,
		accounts,
		filters.filterAccountIds,
	);

	const dateAccountFilteredTransactions = useDateAccountFilter(
		transactions,
		filters.startDate,
		filters.endDate,
		filters.filterAccountIds,
	);

	const handlers = useHistoryHandlers({
		transactions,
		accounts,
		pots,
		pockets,
		usdRate,
		swipe,
		batch,
		onEditTransaction,
		onDeleteTransaction,
	});

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const filtersActive = hasActiveFilters(
		filters.startDate,
		filters.endDate,
		filters.filterAccountIds,
	);

	if (transactions.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 text-gray-600">
				<span className="text-4xl mb-4 opacity-50">📜</span>
				<p>No history yet.</p>
				<button
					onClick={onAddTransaction}
					className="mt-4 flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-2 rounded-lg font-bold transition-all"
				>
					<PlusIcon className="w-5 h-5" />
					Add First Record
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-6 sm:space-y-8 relative">
			<BackToTopButton
				show={
					showBackToTop &&
					!isAssetPage &&
					!batch.showBatchEditModal &&
					!showAddModal
				}
				onClick={scrollToTop}
			/>

			{!batch.showBatchEditModal && !showAddModal && (
				<HistoryHeader
					hasSearchQuery={!!filters.searchQuery}
					showFilters={filters.showFilters}
					filtersActive={filtersActive}
					isBatchMode={batch.isBatchMode}
					onOpenSearch={() => setShowSearchOverlay(true)}
					onToggleFilters={() => filters.setShowFilters(!filters.showFilters)}
					onToggleBatchMode={() =>
						batch.isBatchMode ? batch.exitBatchMode() : batch.enterBatchMode()
					}
					onAddTransaction={onAddTransaction}
				/>
			)}

			{filters.showFilters && (
				<FiltersPanel
					startDate={filters.startDate}
					endDate={filters.endDate}
					onStartDateChange={filters.setStartDate}
					onEndDateChange={filters.setEndDate}
					onClear={filters.clearAllFilters}
					accountIds={filters.filterAccountIds}
					accounts={accounts}
					onAccountIdsChange={filters.setFilterAccountIds}
					onClose={() => filters.setShowFilters(false)}
				/>
			)}

			{batch.selectedIds.length > 0 &&
				!batch.showBatchEditModal &&
				!showAddModal && (
					<BatchActionBar
						selectedCount={batch.selectedIds.length}
						onBatchEdit={batch.openEditModal}
						onBatchDelete={handlers.handleBatchDelete}
						onClear={batch.clearSelection}
					/>
				)}

			{batch.isBatchMode && !batch.showBatchEditModal && !showAddModal && (
				<BatchSelectAllBar
					selectedCount={batch.selectedIds.length}
					totalCount={filteredTransactions.length}
					onToggleSelectAll={() => {
						if (batch.selectedIds.length === filteredTransactions.length) {
							batch.clearSelection();
						} else {
							batch.selectAll(filteredTransactions.map((t) => t.id));
						}
					}}
				/>
			)}

			{sortedDates.length === 0 ? (
				<div className="flex flex-col items-center justify-center h-64 text-gray-600 bg-surface/20 rounded-4xl border border-white/5 border-dashed">
					<MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
					<p className="font-bold">
						{filters.searchQuery
							? `No results for "${filters.searchQuery}".`
							: "No transactions match your filters."}
					</p>
					<button
						onClick={filters.clearAllFilters}
						className="mt-4 text-xs font-black text-indigo-400 uppercase tracking-widest"
					>
						Clear Filters & Search
					</button>
				</div>
			) : (
				sortedDates.map((dateStr) => (
					<div key={dateStr} className="animate-slideUp">
						<h3 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.2em] mb-4 pl-4 flex items-center gap-3">
							<span className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
							{formatDateHeader(dateStr)}
						</h3>
						<div className="space-y-3 sm:space-y-4">
							{grouped[dateStr].map((t) => (
								<TransactionItem
									key={t.id}
									transaction={t}
									swipedId={swipe.swipedId}
									isSelected={batch.selectedIds.includes(t.id)}
									showSelection={
										batch.isBatchMode ||
										batch.selectedIds.length > 0
									}
									isBatchMode={batch.isBatchMode}
									accounts={accounts}
									pockets={pockets}
									categories={categories}
									maskAmount={maskAmount as any}
									maskText={maskText as any}
									onSwipeEdit={() => handlers.handleSwipeEdit(t)}
									onSwipeDelete={() => handlers.handleSwipeDelete(t)}
									onSwipeClose={() => swipe.setSwipedId(null)}
									onClick={() => handlers.handleItemClick(t)}
									onPointerDown={(e) =>
										swipe.handlePointerDown(e, t.id)
									}
									onPointerMove={swipe.handlePointerMove}
									onPointerUp={(e) =>
										swipe.handlePointerUp(e, t.id)
									}
									onChevronClick={(e) =>
										handlers.handleChevronClick(e, t.id)
									}
								/>
							))}
						</div>
					</div>
				))
			)}

			{visibleCount < filteredTransactions.length && (
				<div className="flex justify-center pt-8">
					<button
						onClick={() => setVisibleCount((prev) => prev + 30)}
						className="flex items-center gap-3 bg-surface/40 hover:bg-surface/60 text-gray-400 hover:text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all active:scale-95"
					>
						Show Older Transactions
						<ChevronRightIcon className="w-4 h-4 rotate-90" />
					</button>
				</div>
			)}

			<BatchEditModal
				isOpen={batch.showBatchEditModal}
				selectedCount={batch.selectedIds.length}
				batchUpdates={batch.batchUpdates}
				categories={categories}
				pots={pots}
				pockets={pockets}
				isSubmitting={batch.isSubmitting}
				onClose={batch.closeEditModal}
				onBatchUpdatesChange={batch.setBatchUpdates}
				onSubmit={handlers.handleBatchEditSubmit}
			/>

			<SearchOverlay
				isOpen={showSearchOverlay}
				query={filters.searchQuery}
				onQueryChange={filters.setSearchQuery}
				onClose={() => {
					setShowSearchOverlay(false);
					filters.setSearchQuery("");
				}}
				transactions={dateAccountFilteredTransactions}
				categories={categories}
				accounts={accounts}
				maskAmount={maskAmount as any}
				maskText={maskText as any}
				onSelectTransaction={(t) => {
					const txToEdit = prepareTransactionForEdit(t, transactions);
					onEditTransaction(txToEdit);
				}}
			/>
		</div>
	);
};

export default History;
