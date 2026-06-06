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

export function convertToDisplayCurrency(
  amount: number,
  accountCurrency: string,
  displayCurrency: "MYR" | "USD",
  usdRate: number,
  cryptoPrices: { BTC: number; ETH: number } = { BTC: 0, ETH: 0 },
): number {
  if (accountCurrency === "MYR") {
    return displayCurrency === "MYR" ? amount : amount / usdRate;
  }
  let valInUSD = amount;
  if (accountCurrency === "BTC") valInUSD = amount * cryptoPrices.BTC;
  else if (accountCurrency === "ETH") valInUSD = amount * cryptoPrices.ETH;
  return displayCurrency === "USD" ? valInUSD : valInUSD * usdRate;
}
