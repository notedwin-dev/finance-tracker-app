import { ExchangeRateData } from "../types";

const BASE_URL = "https://api.data.gov.my/data-catalogue/";
const CACHE_KEY = "zenfinance_usd_myr_rate";
const CACHE_TIME_KEY = "zenfinance_usd_myr_rate_time";
const REFRESH_INTERVAL = 60 * 60 * 1000; // Check every hour for intraday updates

const formatSource = (id: string) => id.split("_").pop() || "0900";

const getHistoricalRates = async (
  dataId: string,
  days: number = 31,
): Promise<{ date: string; rate: number }[]> => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (p: string) => parts.find((x) => x.type === p)?.value || "";
  const endDate = `${getPart("year")}-${getPart("month").padStart(2, "0")}-${getPart("day").padStart(2, "0")}`;

  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - days);
  const sParts = formatter.formatToParts(startDateObj);
  const getSPart = (p: string) => sParts.find((x) => x.type === p)?.value || "";
  const startDate = `${getSPart("year")}-${getSPart("month").padStart(2, "0")}-${getSPart("day").padStart(2, "0")}`;

  try {
    const url = `${BASE_URL}?id=${dataId}&meta=true&include=usd,rate_type,date&filter=middle@rate_type&date_start=${startDate}@date&date_end=${endDate}@date`;
    const response = await fetch(url);
    const result = await response.json();
    const data = result.data || result; // Handle both meta=true and meta=false

    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        date: item.date,
        rate: item.usd,
      }));
    }
  } catch (err) {
    console.error("Failed to fetch historical rates:", err);
  }
  return [];
};

export const getUSDToMYRRate = async (): Promise<ExchangeRateData> => {
  // 1. Check Cache
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  const now = Date.now();

  if (cached && cachedTime && now - parseInt(cachedTime) < REFRESH_INTERVAL) {
    try {
      const parsed = JSON.parse(cached);
      // Ensure history is present if we're using cache
      if (parsed.history && parsed.history.length > 0) {
        return parsed;
      }
    } catch (e) {
      // If parsing fails, fall through to fetch
    }
  }

  // 2. Determine Best Data ID based on Malaysian Time (UTC+8)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "numeric",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const hours = parseInt(getPart("hour"));
  const minutes = parseInt(getPart("minute"));
  const timeVal = hours * 100 + minutes;
  const today = `${getPart("year")}-${getPart("month").padStart(2, "0")}-${getPart("day").padStart(2, "0")}`;

  let dataId = "exchangerates_daily_0900";
  let searchDate = today;

  if (timeVal < 900) {
    // Before 9am, use yesterday's 5pm rate
    dataId = "exchangerates_daily_1700";
    const dateObj = new Date();
    dateObj.setHours(dateObj.getHours() - 12);
    const yesterdayParts = formatter.formatToParts(dateObj);
    const getYesterdayPart = (type: string) =>
      yesterdayParts.find((p) => p.type === type)?.value || "";
    searchDate = `${getYesterdayPart("year")}-${getYesterdayPart("month").padStart(2, "0")}-${getYesterdayPart("day").padStart(2, "0")}`;
  } else if (timeVal >= 1700) {
    dataId = "exchangerates_daily_1700";
  } else if (timeVal >= 1200) {
    dataId = "exchangerates_daily_1200";
  } else if (timeVal >= 1130) {
    dataId = "exchangerates_daily_1130";
  }

  // 3. Fetch from API (Live + History)
  try {
    const liveUrl = `${BASE_URL}?id=${dataId}&meta=true&limit=1&include=usd,rate_type,date&filter=${searchDate}@date,middle@rate_type`;

    const [liveRes, history] = await Promise.all([
      fetch(liveUrl).then((r) => r.json()),
      getHistoricalRates(dataId, 30),
    ]);

    let liveMeta = liveRes.meta;
    let liveData = liveRes.data || liveRes;

    if (
      (!Array.isArray(liveData) || liveData.length === 0) &&
      searchDate === today
    ) {
      // Fallback: If today's slot is empty, get absolute latest for this slot
      const fallbackUrl = `${BASE_URL}?id=${dataId}&meta=true&limit=1&include=usd,rate_type,date&filter=middle@rate_type`;
      const fallbackRes = await fetch(fallbackUrl);
      const fallbackJson = await fallbackRes.json();
      liveMeta = fallbackJson.meta;
      liveData = fallbackJson.data || fallbackJson;
    }

    if (
      Array.isArray(liveData) &&
      liveData.length > 0 &&
      typeof liveData[0].usd === "number"
    ) {
      const result: ExchangeRateData = {
        rate: liveData[0].usd,
        date: liveData[0].date,
        source: formatSource(dataId),
        lastUpdated: liveMeta?.last_updated,
        history,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return result;
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
  }

  // 4. Final Fallback
  const defaultResult: ExchangeRateData = {
    rate: 4.45,
    date: searchDate,
    source: "0900",
    history: [],
  };
  try {
    return cached ? JSON.parse(cached) : defaultResult;
  } catch {
    return defaultResult;
  }
};
