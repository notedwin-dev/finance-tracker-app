import { TransactionType, AmountBreakdownItem } from "../../../types";

export interface TransactionFormState {
	type: TransactionType;
	amount: string;
	marketValue: string;
	accountId: string;
	toAccountId: string;
	categoryId: string;
	date: string;
	isSubsidized: boolean;
	breakdownEnabled: boolean;
	breakdownItems: { amount: string }[];
}

export const validateTransactionForm = (
	state: TransactionFormState,
): string | null => {
	const {
		type,
		amount,
		marketValue,
		accountId,
		toAccountId,
		categoryId,
		date,
		isSubsidized,
		breakdownEnabled,
		breakdownItems,
	} = state;

	const missingFields: string[] = [];
	if (!isSubsidized && (!amount || parseFloat(amount) <= 0))
		missingFields.push("Amount");
	if (isSubsidized && (!marketValue || parseFloat(marketValue) <= 0))
		missingFields.push("Market Value");
	if (!accountId) missingFields.push("Account");
	if (type === TransactionType.TRANSFER && !toAccountId)
		missingFields.push("To Account");
	if (
		(type === TransactionType.EXPENSE || type === TransactionType.INCOME) &&
		!categoryId
	)
		missingFields.push("Category");
	if (!date) missingFields.push("Date");

	if (missingFields.length > 0) {
		return `Missing required fields: ${missingFields.join(", ")}`;
	}

	if (type === TransactionType.TRANSFER && accountId === toAccountId) {
		return "Source and Destination accounts cannot be the same";
	}

	if (breakdownEnabled) {
		const breakdownTotal = breakdownItems.reduce(
			(sum, item) => sum + (parseFloat(item.amount) || 0),
			0,
		);
		if (breakdownTotal > parseFloat(amount)) {
			return `Breakdown total (${breakdownTotal.toFixed(2)}) exceeds total amount (${parseFloat(amount).toFixed(2)})`;
		}
	}

	return null;
};

export const serializeBreakdownItems = (
	enabled: boolean,
	items: { amount: string }[],
): AmountBreakdownItem[] | undefined => {
	if (!enabled || items.length === 0) return undefined;
	return items.map((item) => ({
		...item,
		amount: parseFloat(item.amount) || 0,
	})) as AmountBreakdownItem[];
};
