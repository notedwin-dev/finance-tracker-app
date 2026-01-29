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
    // Using Binance Public API for simple price fetching
    const [btcRes, ethRes] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"),
    ]);

    const btcData = await btcRes.json();
    const ethData = await ethRes.json();

    const prices: CryptoPrices = {
      BTC: parseFloat(btcData.price),
      ETH: parseFloat(ethData.price),
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
