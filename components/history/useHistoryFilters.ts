import { useState, useEffect, useCallback, useMemo } from "react";
import { Transaction } from "../../types";
import { normalizeDate } from "../../helpers/transactions.helper";

type FilterState = {
	startDate: string;
	endDate: string;
	searchQuery: string;
	filterAccountIds: string[];
	showFilters: boolean;
};

type FilterActions = {
	setStartDate: (d: string) => void;
	setEndDate: (d: string) => void;
	setSearchQuery: (q: string) => void;
	setFilterAccountIds: (ids: string[]) => void;
	setShowFilters: (b: boolean) => void;
	clearAllFilters: () => void;
};

export const useHistoryFilters = (): FilterState & FilterActions => {
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [filterAccountIds, setFilterAccountIds] = useState<string[]>([]);
	const [showFilters, setShowFilters] = useState(false);

	const clearAllFilters = useCallback(() => {
		setStartDate("");
		setEndDate("");
		setSearchQuery("");
		setFilterAccountIds([]);
	}, []);

	return {
		startDate,
		endDate,
		searchQuery,
		filterAccountIds,
		showFilters,
		setStartDate,
		setEndDate,
		setSearchQuery,
		setFilterAccountIds,
		setShowFilters,
		clearAllFilters,
	};
};

export const useDateAccountFilter = (
	transactions: Transaction[],
	startDate: string,
	endDate: string,
	filterAccountIds: string[],
): Transaction[] =>
	useMemo(
		() =>
			transactions.filter((t) => {
				if (startDate || endDate) {
					const tDate = normalizeDate(t.date);
					if (startDate && tDate < startDate) return false;
					if (endDate && tDate > endDate) return false;
				}
				if (filterAccountIds.length > 0 && !filterAccountIds.includes(t.accountId)) return false;
				return true;
			}),
		[transactions, startDate, endDate, filterAccountIds],
	);

export const hasActiveFilters = (
	startDate: string,
	endDate: string,
	filterAccountIds: string[],
): boolean => !!(startDate || endDate || filterAccountIds.length > 0);
