import React from "react";
import { Transaction } from "../../types";
import { formatDateHeader } from "./formatDateHeader";
import { HistoryItem } from "./HistoryItem";
import { useSwipeGesture } from "./useSwipeGesture";
import { useBatchSelection } from "./useBatchSelection";
import { useHistoryHandlers } from "./useHistoryHandlers";
import { GroupedTransaction } from "../../helpers/transactions.helper";

type Props = {
	grouped: Record<string, GroupedTransaction[]>;
	sortedDates: string[];
	accounts: any[];
	pockets: any[];
	categories: any[];
	swipe: ReturnType<typeof useSwipeGesture>;
	batch: ReturnType<typeof useBatchSelection>;
	handlers: ReturnType<typeof useHistoryHandlers>;
	maskAmount: any;
	maskText: any;
};

export const HistoryGroupedList = ({
	grouped,
	sortedDates,
	accounts,
	pockets,
	categories,
	swipe,
	batch,
	handlers,
	maskAmount,
	maskText,
}: Props) => (
	<>
		{sortedDates.map((dateStr) => (
			<div key={dateStr} className="animate-slideUp">
				<h3 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-[0.2em] mb-4 pl-4 flex items-center gap-3">
					<span className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
					{formatDateHeader(dateStr)}
				</h3>
				<div className="space-y-3 sm:space-y-4">
					{grouped[dateStr].map((t) => (
						<HistoryItem
							key={t.id}
							transaction={t as unknown as Transaction}
							accounts={accounts}
							pockets={pockets}
							categories={categories}
							swipe={swipe}
							batch={batch}
							handlers={handlers}
							maskAmount={maskAmount}
							maskText={maskText}
						/>
					))}
				</div>
			</div>
		))}
	</>
);
