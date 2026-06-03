export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  usdRate: number,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (fromCurrency === "USD" && toCurrency === "MYR") return amount * usdRate;
  if (fromCurrency === "MYR" && toCurrency === "USD") return amount / usdRate;
  return amount;
}
