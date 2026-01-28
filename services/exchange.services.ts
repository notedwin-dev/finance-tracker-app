const BASE_URL = "https://api.data.gov.my/data-catalogue/";
const CACHE_KEY = "zenfinance_usd_myr_rate";
const CACHE_TIME_KEY = "zenfinance_usd_myr_rate_time";
const REFRESH_INTERVAL = 60 * 60 * 1000; // Check every hour for intraday updates

export const getUSDToMYRRate = async (): Promise<number> => {
  // 1. Check Cache
  const cachedRate = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  const now = Date.now();

  if (
    cachedRate &&
    cachedTime &&
    now - parseInt(cachedTime) < REFRESH_INTERVAL
  ) {
    return parseFloat(cachedRate);
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
    dateObj.setHours(dateObj.getHours() - 12); // Move back enough to be yesterday in MYT if it's early morning
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

  // 3. Fetch from API
  try {
    const url = `${BASE_URL}?id=${dataId}&limit=1&include=usd,rate_type,date&filter=${searchDate}@date,middle@rate_type`;

    const response = await fetch(url);
    const data = await response.json();

    if (
      Array.isArray(data) &&
      data.length > 0 &&
      typeof data[0].usd === "number"
    ) {
      const rate = data[0].usd;
      localStorage.setItem(CACHE_KEY, rate.toString());
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return rate;
    }

    // Fallback: If current slot for TODAY is empty (e.g. public holiday),
    // try to just get the absolute latest whatever the date.
    const fallbackUrl = `${BASE_URL}?id=${dataId}&limit=1&include=usd,rate_type,date&filter=middle@rate_type`;
    const fallbackRes = await fetch(fallbackUrl);
    const fallbackData = await fallbackRes.json();

    if (
      Array.isArray(fallbackData) &&
      fallbackData.length > 0 &&
      typeof fallbackData[0].usd === "number"
    ) {
      const rate = fallbackData[0].usd;
      localStorage.setItem(CACHE_KEY, rate.toString());
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return rate;
    }
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
  }

  // 4. Final Fallback
  return parseFloat(cachedRate || "4.5");
};
