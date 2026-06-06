export const formatCalculatorAmount = (
	val: string,
	currentVal: string,
): string => {
	if (!val) return "";

	const cleanCurrent = String(currentVal || "");

	if (val.endsWith(".") && !cleanCurrent.endsWith(".")) {
		const d = cleanCurrent.replace(/\D/g, "");
		return parseInt(d || "0", 10).toString() + ".";
	}

	if (cleanCurrent.endsWith(".") || cleanCurrent.match(/\.\d$/)) {
		const parts = cleanCurrent.split(".");
		const newChar = val.length > cleanCurrent.length ? val.slice(-1) : "";

		if (/\d/.test(newChar)) {
			if (parts[1] === "") {
				return parts[0] + "." + newChar;
			}
			if (parts[1].length === 1) {
				return parts[0] + "." + parts[1] + newChar;
			}
		}
	}

	const digits = val.replace(/\D/g, "");
	if (!digits) return "";

	const cents = parseInt(digits, 10);
	return (cents / 100).toFixed(2);
};
