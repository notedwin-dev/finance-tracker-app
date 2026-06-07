const isTrailingDotInput = (val: string, current: string): boolean =>
	val.endsWith(".") && !current.endsWith(".");

const buildTrailingDotValue = (current: string): string => {
	const d = current.replace(/\D/g, "");
	return parseInt(d || "0", 10).toString() + ".";
};

const isMidDecimalState = (current: string): boolean =>
	current.endsWith(".") || /\.\d$/.test(current);

const buildMidDecimalValue = (val: string, current: string): string | null => {
	const newChar = val.length > current.length ? val.slice(-1) : "";
	if (!/\d/.test(newChar)) return null;
	const [whole, frac = ""] = current.split(".");
	if (frac === "") return `${whole}.${newChar}`;
	if (frac.length === 1) return `${whole}.${frac}${newChar}`;
	return null;
};

const digitsToAmount = (val: string): string => {
	const digits = val.replace(/\D/g, "");
	if (!digits) return "";
	const cents = parseInt(digits, 10);
	return (cents / 100).toFixed(2);
};

export const formatCalculatorAmount = (
	val: string,
	currentVal: string,
): string => {
	if (!val) return "";
	const current = String(currentVal || "");

	if (isTrailingDotInput(val, current)) return buildTrailingDotValue(current);
	if (isMidDecimalState(current)) {
		const mid = buildMidDecimalValue(val, current);
		if (mid !== null) return mid;
	}
	return digitsToAmount(val);
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
