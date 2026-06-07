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

const isPositiveNumber = (val: string): boolean => {
	if (!val) return false;
	const n = parseFloat(val);
	return n > 0;
};

const isTransferCategory = (type: TransactionType): boolean =>
	type === TransactionType.EXPENSE || type === TransactionType.INCOME;

const pushIfMissing = (missing: string[], condition: boolean, label: string) => {
	if (condition) missing.push(label);
};

const collectMissingFields = (state: TransactionFormState): string[] => {
	const missing: string[] = [];
	const { type, isSubsidized } = state;
	const amountValue = isSubsidized ? state.marketValue : state.amount;

	pushIfMissing(missing, !isPositiveNumber(amountValue), isSubsidized ? "Market Value" : "Amount");
	pushIfMissing(missing, !state.accountId, "Account");
	pushIfMissing(
		missing,
		type === TransactionType.TRANSFER && !state.toAccountId,
		"To Account",
	);
	pushIfMissing(
		missing,
		isTransferCategory(type) && !state.categoryId,
		"Category",
	);
	pushIfMissing(missing, !state.date, "Date");
	return missing;
};

const validateTransferAccounts = (
	type: TransactionType,
	accountId: string,
	toAccountId: string,
): string | null => {
	if (type !== TransactionType.TRANSFER) return null;
	if (accountId && toAccountId && accountId === toAccountId) {
		return "Source and Destination accounts cannot be the same";
	}
	return null;
};

const sumBreakdownTotal = (items: { amount: string }[]): number =>
	items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

const validateBreakdownTotal = (state: TransactionFormState): string | null => {
	if (!state.breakdownEnabled) return null;
	const total = sumBreakdownTotal(state.breakdownItems);
	const amount = parseFloat(state.amount);
	if (total > amount) {
		return `Breakdown total (${total.toFixed(2)}) exceeds total amount (${amount.toFixed(2)})`;
	}
	return null;
};

export const validateTransactionForm = (
	state: TransactionFormState,
): string | null => {
	const missing = collectMissingFields(state);
	if (missing.length > 0) {
		return `Missing required fields: ${missing.join(", ")}`;
	}

	const transferError = validateTransferAccounts(
		state.type,
		state.accountId,
		state.toAccountId,
	);
	if (transferError) return transferError;

	return validateBreakdownTotal(state);
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
