import { Transaction, TransactionType } from "../../../types";
import { normalizeDate } from "./dates";

const isLegacySingleRecordTransfer = (t: Transaction): boolean =>
	t.type === TransactionType.TRANSFER &&
	!!t.toAccountId &&
	!t.transferDirection &&
	!t.linkedTransactionId;

const buildLegacyInRecord = (t: Transaction): Transaction => ({
	...t,
	id: `${t.id}_in`,
	accountId: t.toAccountId || t.accountId,
	toAccountId: t.accountId,
	transferDirection: "IN" as const,
});

const buildLegacyOutRecord = (t: Transaction): Transaction => ({
	...t,
	transferDirection: "OUT" as const,
});

const isTransferDestination = (t: Transaction, accountId: string): boolean =>
	t.type === TransactionType.TRANSFER && t.toAccountId === accountId;

const pushLegacyForAccount = (
	t: Transaction,
	accountId: string,
	results: Transaction[],
	seen: Set<string>,
): void => {
	if (t.accountId === accountId) {
		if (!seen.has(t.id)) {
			results.push(buildLegacyOutRecord(t));
			seen.add(t.id);
		}
		return;
	}
	if (t.toAccountId === accountId) {
		const inId = `${t.id}_in`;
		if (!seen.has(inId)) {
			results.push(buildLegacyInRecord(t));
			seen.add(inId);
		}
	}
};

const pushDirectMatch = (
	t: Transaction,
	accountId: string,
	results: Transaction[],
	seen: Set<string>,
): void => {
	if (seen.has(t.id)) return;
	if (t.accountId === accountId || isTransferDestination(t, accountId)) {
		results.push(t);
		seen.add(t.id);
	}
};

export const filterTransactionsForAccount = (
	transactions: Transaction[],
	accountId: string,
): Transaction[] => {
	const results: Transaction[] = [];
	const seen = new Set<string>();

	for (const t of transactions) {
		if (isLegacySingleRecordTransfer(t)) {
			pushLegacyForAccount(t, accountId, results, seen);
		} else {
			pushDirectMatch(t, accountId, results, seen);
		}
	}

	return results;
};

export const sortTransactionsByDateDesc = (
	transactions: Transaction[],
): Transaction[] =>
	[...transactions].sort((a, b) =>
		normalizeDate(b.date).localeCompare(normalizeDate(a.date)),
	);
