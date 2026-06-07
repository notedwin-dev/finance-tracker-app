import React, { useState } from "react";
import {
	Transaction,
	Category,
	Account,
	SavingPocket,
} from "../types";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useMask } from "../helpers/useMask";
import { useFinanceStore } from "../src/stores/finance.store";
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
import BatchActionBar from "./history/BatchActionBar";
import FiltersPanel from "./history/FiltersPanel";
import BatchEditModal from "./history/BatchEditModal";
import SearchOverlay from "./history/SearchOverlay";
import { HistoryHeader } from "./history/HistoryHeader";
import { BatchSelectAllBar } from "./history/BatchSelectAllBar";
import { BackToTopButton } from "./history/BackToTopButton";
import { HistoryGroupedList } from "./history/HistoryGroupedList";
import { HistoryEmptyResults } from "./history/HistoryEmptyResults";
import { HistoryShowMoreButton } from "./history/HistoryShowMoreButton";

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
				<HistoryEmptyResults
					hasSearchQuery={!!filters.searchQuery}
					onClearFilters={filters.clearAllFilters}
				/>
			) : (
				<HistoryGroupedList
					grouped={grouped}
					sortedDates={sortedDates}
					accounts={accounts}
					pockets={pockets}
					categories={categories}
					swipe={swipe}
					batch={batch}
					handlers={handlers}
					maskAmount={maskAmount}
					maskText={maskText}
				/>
			)}

			<HistoryShowMoreButton
				hasMore={visibleCount < filteredTransactions.length}
				onClick={() => setVisibleCount((prev) => prev + 30)}
			/>

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
