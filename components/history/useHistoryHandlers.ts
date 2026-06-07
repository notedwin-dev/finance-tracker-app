import { useCallback } from "react";
import { Transaction, Account, Pot, SavingPocket } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";
import { batchDeleteTransaction, batchEditTransactions } from "../../src/lib/application/commands";
import { logger } from "../../src/lib/infrastructure/logger";
import { prepareTransactionForEdit } from "./getTransferEditPayload";
import type { useSwipeGesture } from "./useSwipeGesture";
import type { useBatchSelection } from "./useBatchSelection";

type UseSwipeGestureResult = ReturnType<typeof useSwipeGesture>;
type UseBatchSelectionResult = ReturnType<typeof useBatchSelection>;

type Dependencies = {
	transactions: Transaction[];
	accounts: Account[];
	pots: Pot[];
	pockets: SavingPocket[];
	usdRate: number;
	swipe: UseSwipeGestureResult;
	batch: UseBatchSelectionResult;
	onEditTransaction: (t: Transaction) => void;
	onDeleteTransaction: (id: string) => Promise<void>;
};

export type HistoryHandlers = {
	handleItemClick: (t: GroupedTransaction) => void;
	handleSwipeEdit: (t: GroupedTransaction) => void;
	handleSwipeDelete: (t: GroupedTransaction) => Promise<void>;
	handleBatchDelete: () => Promise<void>;
	handleBatchEditSubmit: () => Promise<void>;
	handleChevronClick: (e: React.MouseEvent, id: string) => void;
};

export const useHistoryHandlers = (deps: Dependencies): HistoryHandlers => {
	const {
		transactions,
		accounts,
		pots,
		pockets,
		usdRate,
		swipe,
		batch,
		onEditTransaction,
		onDeleteTransaction,
	} = deps;

	const handleItemClick = useCallback(
		(t: GroupedTransaction) => {
			if (swipe.isGestureActive.current) {
				swipe.isGestureActive.current = false;
				return;
			}
			if (swipe.swipedId) {
				swipe.setSwipedId(null);
				return;
			}
			if (batch.isBatchMode || batch.selectedIds.length > 0) {
				batch.toggleSelection(t.id);
			} else {
				const txToEdit = prepareTransactionForEdit(t, transactions);
				onEditTransaction(txToEdit);
			}
		},
		[swipe, batch, transactions, onEditTransaction],
	);

	const handleSwipeEdit = useCallback(
		(t: GroupedTransaction) => {
			const txToEdit = prepareTransactionForEdit(t, transactions);
			onEditTransaction(txToEdit);
			swipe.setSwipedId(null);
		},
		[transactions, onEditTransaction, swipe.setSwipedId],
	);

	const handleSwipeDelete = useCallback(
		async (t: GroupedTransaction) => {
			if (window.confirm("Delete this transaction? This cannot be undone.")) {
				try {
					await onDeleteTransaction(t.id);
					swipe.setSwipedId(null);
				} catch (e) {
					logger.error("Failed to delete transaction", e);
				}
			}
		},
		[onDeleteTransaction, swipe.setSwipedId],
	);

	const handleBatchDelete = useCallback(async () => {
		batch.startSubmit();
		try {
			if (
				window.confirm(
					`Delete ${batch.selectedIds.length} transactions? This cannot be undone.`,
				)
			) {
				await batchDeleteTransaction(
					batch.selectedIds,
					accounts,
					pots,
					pockets,
					usdRate,
					transactions,
				);
				batch.clearSelection();
			}
		} finally {
			batch.endSubmit();
		}
	}, [batch, accounts, pots, pockets, usdRate, transactions]);

	const handleBatchEditSubmit = useCallback(async () => {
		batch.startSubmit();
		try {
			await batchEditTransactions(
				batch.selectedIds,
				batch.batchUpdates,
				transactions,
				accounts,
				pots,
				pockets,
				usdRate,
				false,
			);
		} finally {
			batch.endSubmit();
		}
	}, [batch, batchEditTransactions, transactions, accounts, pots, pockets, usdRate]);

	const handleChevronClick = useCallback(
		(e: React.MouseEvent, id: string) => {
			e.stopPropagation();
			swipe.setSwipedId(swipe.swipedId === id ? null : id);
		},
		[swipe],
	);

	return {
		handleItemClick,
		handleSwipeEdit,
		handleSwipeDelete,
		handleBatchDelete,
		handleBatchEditSubmit,
		handleChevronClick,
	};
};
