import { ExchangeRateData } from "../types";
import { logger } from "../src/lib/infrastructure/logger";

const BASE_URL = "https://api.data.gov.my/data-catalogue/";
const CACHE_KEY = "zenfinance_usd_myr_rate";
const CACHE_TIME_KEY = "zenfinance_usd_myr_rate_time";
const REFRESH_INTERVAL = 60 * 60 * 1000; // Check every hour for intraday updates

const formatSource = (id: string) => id.split("_").pop() || "0900";

const MY_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  hour: "numeric",
  minute: "numeric",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour12: false,
});

const partsToMYDate = (parts: Intl.DateTimeFormatPart[]): string => {
  const find = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${find("year")}-${find("month").padStart(2, "0")}-${find("day").padStart(2, "0")}`;
};

const getCachedRate = (now: number): ExchangeRateData | null => {
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  if (!cached || !cachedTime) return null;
  if (now - parseInt(cachedTime) >= REFRESH_INTERVAL) return null;
  try {
    const parsed = JSON.parse(cached);
    if (parsed.history && parsed.history.length > 0) return parsed;
  } catch {
    return null;
  }
  return null;
};

const selectDailyRateSlot = (
  now: Date,
): { dataId: string; searchDate: string; today: string } => {
  const parts = MY_DATETIME_FORMATTER.formatToParts(now);
  const find = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const hours = parseInt(find("hour"));
  const minutes = parseInt(find("minutes"));
  const timeVal = hours * 100 + minutes;
  const today = partsToMYDate(parts);

  if (timeVal < 900) {
    const yesterday = new Date(now);
    yesterday.setHours(yesterday.getHours() - 12);
    return {
      dataId: "exchangerates_daily_1700",
      searchDate: partsToMYDate(MY_DATETIME_FORMATTER.formatToParts(yesterday)),
      today,
    };
  }
  if (timeVal >= 1700) return { dataId: "exchangerates_daily_1700", searchDate: today, today };
  if (timeVal >= 1200) return { dataId: "exchangerates_daily_1200", searchDate: today, today };
  if (timeVal >= 1130) return { dataId: "exchangerates_daily_1130", searchDate: today, today };
  return { dataId: "exchangerates_daily_0900", searchDate: today, today };
};

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
    // Increase limit to accommodate a full year of data if needed (approx 365 days)
    const limit = Math.max(days + 10, 400);
    const url = `${BASE_URL}?id=${dataId}&meta=true&limit=${limit}&include=usd,rate_type,date&filter=middle@rate_type&date_start=${startDate}@date&date_end=${endDate}@date`;
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
    logger.error("Failed to fetch historical rates:", err);
  }
  return [];
};

const buildLiveUrl = (dataId: string, searchDate: string): string =>
  `${BASE_URL}?id=${dataId}&meta=true&limit=1&include=usd,rate_type,date&filter=${searchDate}@date,middle@rate_type`;

const buildFallbackUrl = (dataId: string): string =>
  `${BASE_URL}?id=${dataId}&meta=true&limit=1&include=usd,rate_type,date&filter=middle@rate_type`;

const fetchLatestRateForSlot = async (
  dataId: string,
  searchDate: string,
  today: string,
): Promise<{ liveData: any[] | any; liveMeta: any }> => {
  const liveRes = await fetch(buildLiveUrl(dataId, searchDate)).then((r) =>
    r.json(),
  );
  let liveMeta = liveRes.meta;
  let liveData = liveRes.data || liveRes;

  const slotEmpty = !Array.isArray(liveData) || liveData.length === 0;
  if (slotEmpty && searchDate === today) {
    const fallbackRes = await fetch(buildFallbackUrl(dataId));
    const fallbackJson = await fallbackRes.json();
    liveMeta = fallbackJson.meta;
    liveData = fallbackJson.data || fallbackJson;
  }

  return { liveData, liveMeta };
};

const persistRate = (result: ExchangeRateData) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
};

const buildRateResult = (
  liveData: any,
  liveMeta: any,
  dataId: string,
  history: { date: string; rate: number }[],
): ExchangeRateData | null => {
  if (
    !Array.isArray(liveData) ||
    liveData.length === 0 ||
    typeof liveData[0].usd !== "number"
  ) {
    return null;
  }
  return {
    rate: liveData[0].usd,
    date: liveData[0].date,
    source: formatSource(dataId),
    lastUpdated: liveMeta?.last_updated,
    history,
  };
};

const getFallbackResult = (searchDate: string): ExchangeRateData => {
  const rawCache = localStorage.getItem(CACHE_KEY);
  const defaultResult: ExchangeRateData = {
    rate: 4.45,
    date: searchDate,
    source: "0900",
    history: [],
  };
  try {
    return rawCache ? JSON.parse(rawCache) : defaultResult;
  } catch {
    return defaultResult;
  }
};

export const getUSDToMYRRate = async (): Promise<ExchangeRateData> => {
  const cached = getCachedRate(Date.now());
  if (cached) return cached;

  const { dataId, searchDate, today } = selectDailyRateSlot(new Date());

  try {
    const [latest, history] = await Promise.all([
      fetchLatestRateForSlot(dataId, searchDate, today),
      getHistoricalRates(dataId, 450),
    ]);

    const result = buildRateResult(latest.liveData, latest.liveMeta, dataId, history);
    if (result) {
      persistRate(result);
      return result;
    }
  } catch (error) {
    logger.error("Failed to fetch exchange rate:", error);
  }

  return getFallbackResult(searchDate);
};
