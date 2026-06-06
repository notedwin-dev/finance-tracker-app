import { Transaction, TransactionType } from "../../../types";
import { normalizeDate } from "./dates";

export interface GroupedTransaction extends Transaction {
	linkedTransaction?: Transaction;
}

const isSymmetricTransfer = (
	a: Pick<Transaction, "accountId" | "toAccountId">,
	b: Pick<Transaction, "accountId" | "toAccountId">,
): boolean => {
	if (!a.toAccountId || !b.toAccountId) return false;
	return (
		(a.accountId === b.toAccountId && a.toAccountId === b.accountId) ||
		(a.accountId === b.accountId && a.toAccountId === b.toAccountId)
	);
};

const findExplicitPartner = (
	t: Transaction,
	transactions: Transaction[],
	processedIds: Set<string>,
): Transaction | null => {
	if (!t.linkedTransactionId) return null;
	const partner = transactions.find((p) => p.id === t.linkedTransactionId);
	if (!partner || processedIds.has(partner.id)) return null;
	return partner;
};

const findFuzzyTransferPartner = (
	t: Transaction,
	transactions: Transaction[],
	processedIds: Set<string>,
): Transaction | null => {
	if (t.type !== TransactionType.TRANSFER) return null;
	return (
		transactions.find((p) => {
			if (
				processedIds.has(p.id) ||
				p.id === t.id ||
				p.type !== TransactionType.TRANSFER
			) {
				return false;
			}
			if (normalizeDate(p.date) !== normalizeDate(t.date)) return false;
			if (p.amount !== t.amount) return false;
			return isSymmetricTransfer(t, p) || t.accountId === p.toAccountId;
		}) || null
	);
};

const buildVirtualPartner = (t: Transaction): Transaction => ({
	...t,
	id: `${t.id}_virtual_in`,
	accountId: t.toAccountId || t.accountId,
	toAccountId: t.accountId,
	transferDirection: "IN",
	linkedTransactionId: t.id,
});

const pickMainAndLinked = (
	t: Transaction,
	partner: Transaction,
): { main: Transaction; linked: Transaction } => {
	const tIsOut =
		t.transferDirection === "OUT" || t.type === TransactionType.EXPENSE;
	const main = tIsOut ? t : partner;
	const linked = main === t ? partner : t;
	return { main, linked };
};

export const groupTransactions = (
	transactions: Transaction[],
): GroupedTransaction[] => {
	const grouped: GroupedTransaction[] = [];
	const processedIds = new Set<string>();

	const sorted = [...transactions].sort((a, b) => {
		const dateA = normalizeDate(a.date);
		const dateB = normalizeDate(b.date);
		if (dateA !== dateB) return dateB.localeCompare(dateA);

		const timeA = a.time || "";
		const timeB = b.time || "";
		if (timeA !== timeB) return timeB.localeCompare(timeA);

		return (
			((b.createdAt as unknown as number) || 0) -
			((a.createdAt as unknown as number) || 0)
		);
	});

	for (const t of sorted) {
		if (processedIds.has(t.id)) continue;

		const explicit = findExplicitPartner(t, transactions, processedIds);
		if (explicit) {
			const { main, linked } = pickMainAndLinked(t, explicit);
			grouped.push({ ...main, linkedTransaction: linked });
			processedIds.add(main.id);
			processedIds.add(linked.id);
			continue;
		}

		if (t.type === TransactionType.TRANSFER) {
			const fuzzy = findFuzzyTransferPartner(t, transactions, processedIds);
			if (fuzzy) {
				const { main, linked } = pickMainAndLinked(t, fuzzy);
				grouped.push({ ...main, linkedTransaction: linked });
				processedIds.add(main.id);
				processedIds.add(linked.id);
				continue;
			}

			if (
				t.toAccountId &&
				t.accountId !== t.toAccountId &&
				!t.transferDirection
			) {
				const partner = buildVirtualPartner(t);
				const main = {
					...t,
					transferDirection: "OUT" as const,
					linkedTransaction: partner,
				};
				grouped.push(main);
				processedIds.add(t.id);
				continue;
			}
		}

		grouped.push(t);
		processedIds.add(t.id);
	}

	return grouped;
};
