export type { GroupedTransaction } from "../src/lib/domain/group-transactions";
export { groupTransactions } from "../src/lib/domain/group-transactions";

/**
 * Safely parses a date from various formats (Serial, ISO, etc.) into a Date object
 */
export const parseDateSafe = (date: string | number | undefined): Date => {
	if (!date) return new Date();
	const s = String(date);

	// Serial date (Google Sheets)
	if (typeof date === "number" || /^\d{5}$/.test(s)) {
		const serial = Number(date);
		const base = Date.UTC(1899, 11, 30);
		return new Date(base + serial * 86400000);
	}

	// If it's YYYY-MM-DD, append a time to force local parsing if it doesn't have one
	// or handle it specifically. new Date("YYYY-MM-DD") is UTC, which we want to avoid
	// if we want to stay in local time.
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const [y, m, d] = s.split("-").map(Number);
		return new Date(y, m - 1, d);
	}

	const d = new Date(s);
	return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Normalizes a date string or serial number to YYYY-MM-DD in local time
 */
export const normalizeDate = (date: string | number): string => {
	const d = parseDateSafe(date);
	return d.toLocaleDateString("en-CA");
};

export const formatDateReadable = (date: Date | string | number): string => {
	const d = new Date(date);
	if (isNaN(d.getTime())) return "Invalid Date";
	const day = d.getDate();
	const suffix = day > 3 && day < 21
		? "th"
		: ["th", "st", "nd", "rd"][day % 10] ?? "th";
	const month = d.toLocaleDateString("en-US", { month: "short" });
	const year = d.getFullYear();
	return `${month} ${day}${suffix}, ${year}`;
};
