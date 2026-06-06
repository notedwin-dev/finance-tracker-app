import { Account, Transaction, TransactionType } from "../../../types";

const sortNewestFirst = (a: Transaction, b: Transaction): number => {
	const dateA = new Date(a.date).getTime();
	const dateB = new Date(b.date).getTime();
	if (dateA !== dateB) return dateB - dateA;
	return (b.createdAt || 0).toString().localeCompare((a.createdAt || 0).toString());
};

const isAccountRelevant = (tx: GroupedTx, accountId: string): boolean =>
	tx.accountId === accountId || tx.toAccountId === accountId;

interface GroupedTx extends Transaction {
	linkedTransaction?: Transaction;
}

const isInflowType = (t: Transaction): boolean =>
	t.type === TransactionType.INCOME || t.type === TransactionType.ACCOUNT_OPENING;

const isOutflowType = (t: Transaction): boolean =>
	t.type === TransactionType.EXPENSE || t.type === TransactionType.ACCOUNT_DELETE;

const reverseInflowOnAccount = (t: Transaction, accountId: string, running: number): number =>
	isInflowType(t) && t.accountId === accountId ? running - t.amount : running;

const reverseOutflowOnAccount = (t: Transaction, accountId: string, running: number): number =>
	isOutflowType(t) && t.accountId === accountId ? running + t.amount : running;

const reverseAdjustmentOnAccount = (t: Transaction, accountId: string, running: number): number =>
	t.type === TransactionType.ADJUSTMENT && t.accountId === accountId ? running - t.amount : running;

const reverseTransferOnAccount = (
	t: Transaction,
	accountId: string,
	running: number,
): number => {
	if (t.type !== TransactionType.TRANSFER) return running;
	const fee = t.fee || 0;
	const feeType = t.feeType || "INCLUSIVE";
	if (t.accountId === accountId) {
		const actualOutflow = feeType === "INCLUSIVE" ? t.amount + fee : t.amount;
		return running + actualOutflow;
	}
	if (t.toAccountId === accountId) {
		const actualInflow = feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
		return running - actualInflow;
	}
	return running;
};

const reverseTransactionOnAccount = (
	t: Transaction,
	accountId: string,
	running: number,
): number => {
	if (t.isHistorical) return running;
	if (t.accountId !== accountId && t.toAccountId !== accountId) return running;
	running = reverseInflowOnAccount(t, accountId, running);
	running = reverseOutflowOnAccount(t, accountId, running);
	running = reverseAdjustmentOnAccount(t, accountId, running);
	running = reverseTransferOnAccount(t, accountId, running);
	return running;
};

export const reconstructAccountHistory = (
	groupedTransactions: GroupedTx[],
	account: Account,
	limit: number,
): number[] => {
	const relevant = groupedTransactions
		.filter((t) => isAccountRelevant(t, account.id))
		.sort(sortNewestFirst);

	const points: number[] = [account.balance];
	let running = account.balance;
	for (const tx of relevant) {
		if (tx.isHistorical) continue;
		if (tx.accountId !== account.id && tx.toAccountId !== account.id) continue;
		running = reverseTransactionOnAccount(tx, account.id, running);
		points.push(running);
		if (points.length >= limit) break;
	}
	return points.reverse();
};
