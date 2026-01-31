export interface CryptoPrices {
  BTC: number;
  ETH: number;
}

const CACHE_KEY = "crypto_prices_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCryptoPrices(): Promise<CryptoPrices> {
  // Check cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { prices, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return prices;
    }
  }

  try {
    // Switching to CoinGecko public API (No API key required for basic usage)
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
    );
    const data = await response.json();

    const prices: CryptoPrices = {
      BTC: data.bitcoin.usd,
      ETH: data.ethereum.usd,
    };

    // Store in cache
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        prices,
        timestamp: Date.now(),
      }),
    );

    return prices;
  } catch (error) {
    console.error("Error fetching crypto prices:", error);
    // Fallback prices if API fails
    return {
      BTC: 65000,
      ETH: 3500,
    };
  }
}
