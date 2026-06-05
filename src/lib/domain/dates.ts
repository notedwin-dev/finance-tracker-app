const parseDateSafe = (date: string | number): Date => {
	if (typeof date === "number") return new Date(date);
	if (!date) return new Date(NaN);
	const d = new Date(date);
	if (!isNaN(d.getTime())) return d;
	const [y, m, day] = date.split(/[-/]/).map(Number);
	return new Date(y, (m || 1) - 1, day || 1);
};

export const normalizeDate = (date: string | number): string => {
	const d = parseDateSafe(date);
	return d.toLocaleDateString("en-CA");
};
