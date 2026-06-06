import type { Transaction } from "../../../types";

export function matchesSearch(
	t: Transaction,
	query: string,
	categories: { id: string; name: string }[],
	accounts: { id: string; name: string }[],
): boolean {
	if (!query) return true;
	const q = query.toLowerCase();

	if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(q)) {
		return t.date?.toLowerCase().startsWith(q) === true;
	}

	if (t.shopName?.toLowerCase().includes(q)) return true;
	if (t.note?.toLowerCase().includes(q)) return true;
	if (t.type?.toLowerCase().includes(q)) return true;
	const cat = categories.find((c) => c.id === t.categoryId);
	if (cat?.name?.toLowerCase().includes(q)) return true;
	if (t.currency?.toLowerCase().includes(q)) return true;
	if (t.date?.toLowerCase().startsWith(q)) return true;
	if (t.time?.toLowerCase().includes(q)) return true;
	if (
		t.toAccountId &&
		accounts?.find((a) => a.id === t.toAccountId)?.name?.toLowerCase().includes(q)
	) {
		return true;
	}
	return false;
}
