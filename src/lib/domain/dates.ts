const parseDateSafe = (date: string | number): Date => {
	if (typeof date === "number") return new Date(date);
	if (!date) return new Date(NaN);

	const isoDateMatch = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(String(date));
	if (isoDateMatch) {
		const [y, m, d] = String(date).split(/[-/]/).map(Number);
		const constructedDate = new Date(y, m - 1, d);
		if (
			constructedDate.getFullYear() === y &&
			constructedDate.getMonth() === m - 1 &&
			constructedDate.getDate() === d
		) {
			return constructedDate;
		}
		return new Date(NaN);
	}

	const d = new Date(date);
	return isNaN(d.getTime()) ? new Date(NaN) : d;
};

export const normalizeDate = (date: string | number): string => {
	const d = parseDateSafe(date);
	return d.toLocaleDateString("en-CA");
};
