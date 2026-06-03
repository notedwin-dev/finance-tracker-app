export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  usdRate: number,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === "USD" && toCurrency === "MYR") {
    if (typeof usdRate !== "number" || usdRate <= 0) {
      throw new Error(`Invalid USD rate: ${usdRate}. Must be a positive number.`);
    }
    return amount * usdRate;
  }
  if (fromCurrency === "MYR" && toCurrency === "USD") {
    if (typeof usdRate !== "number" || usdRate <= 0) {
      throw new Error(`Invalid USD rate: ${usdRate}. Must be a positive number.`);
    }
    return amount / usdRate;
  }
  throw new Error(
    `Unsupported conversion: ${fromCurrency} → ${toCurrency}. Supported: USD↔MYR.`,
  );
}
