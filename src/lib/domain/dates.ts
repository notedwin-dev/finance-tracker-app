export const parseDateSafe = (date: string | number): Date => {
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
	if (isNaN(d.getTime())) {
		throw new Error(`Invalid date: ${date}`);
	}
	return d.toLocaleDateString("en-CA");
};

export const toYMD = (dateInput: string | number | undefined): string => {
	if (!dateInput) return "1970-01-01";

	const s = String(dateInput);

	if (typeof dateInput === "number" || /^\d{5}$/.test(s)) {
		const serial = Number(dateInput);
		const base = Date.UTC(1899, 11, 30);
		const d = new Date(base + serial * 86400000);
		return d.toLocaleDateString("en-CA");
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		return s;
	}

	try {
		const d = new Date(s);
		if (!isNaN(d.getTime())) {
			if (s.includes("T")) {
				return d.toLocaleDateString("en-CA");
			}
			const year = d.getFullYear();
			const month = String(d.getMonth() + 1).padStart(2, "0");
			const day = String(d.getDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		}
	} catch {
		/* ignore */
	}
	return "1970-01-01";
};
