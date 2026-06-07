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

const CRYPTO_AMOUNT_PATTERN = /^\d*\.?\d*$/;

export const isValidCryptoAmount = (val: string): boolean =>
	CRYPTO_AMOUNT_PATTERN.test(val);

export const formatAccountBalance = (
	val: string,
	currentVal: string,
	currency: string,
): string => {
	if (!val) return "";
	if (currency === "BTC" || currency === "ETH") {
		return isValidCryptoAmount(val) ? val : currentVal;
	}
	return formatCalculatorAmount(val, currentVal);
};

export const applyAmountFormat = (
	val: string,
	currentVal: string,
	setter: (v: string) => void,
): void => {
	setter(formatCalculatorAmount(val, currentVal));
};
