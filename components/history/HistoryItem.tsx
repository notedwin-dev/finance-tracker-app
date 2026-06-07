import React from "react";
import {
	Transaction,
	Category,
	Account,
	SavingPocket,
} from "../../types";
import { useSwipeGesture } from "./useSwipeGesture";
import { useBatchSelection } from "./useBatchSelection";
import { useHistoryHandlers } from "./useHistoryHandlers";
import TransactionItem from "./TransactionItem";
type Props = {
	transaction: Transaction;
	accounts: Account[];
	pockets: SavingPocket[];
	categories: Category[];
	swipe: ReturnType<typeof useSwipeGesture>;
	batch: ReturnType<typeof useBatchSelection>;
	handlers: ReturnType<typeof useHistoryHandlers>;
	maskAmount: any;
	maskText: any;
};

export const HistoryItem = ({
	transaction: t,
	accounts,
	pockets,
	categories,
	swipe,
	batch,
	handlers,
	maskAmount,
	maskText,
}: Props) => (
	<TransactionItem
		transaction={t as any}
		swipedId={swipe.swipedId}
		isSelected={batch.selectedIds.includes(t.id)}
		showSelection={batch.isBatchMode || batch.selectedIds.length > 0}
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
		onPointerDown={(e) => swipe.handlePointerDown(e, t.id)}
		onPointerMove={swipe.handlePointerMove}
		onPointerUp={(e) => swipe.handlePointerUp(e, t.id)}
		onChevronClick={(e) => handlers.handleChevronClick(e, t.id)}
	/>
);
