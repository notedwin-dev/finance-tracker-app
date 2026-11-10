export const SHEET_STRING_FIELDS = {
  Transactions: [
    "id",
    "userId",
    "accountId",
    "toAccountId",
    "categoryId",
    "shopName",
    "currency",
    "type",
    "date",
    "time",
    "note",
    "feeType",
    "linkedTransactionId",
    "transferDirection",
    "potId",
    "savingPocketId",
    "toSavingPocketId",
    "subscriptionId",
  ],
  Accounts: ["id", "userId", "name", "type", "color", "iconType", "iconValue", "currency", "providerId"],
  Categories: ["id", "userId", "name", "icon", "color", "budgetPeriod"],
  Goals: ["id", "userId", "name", "type", "currency", "deadline", "linkedAccountId", "color", "icon"],
  Subscriptions: ["id", "userId", "name", "currency", "accountId", "categoryId", "nextPaymentDate", "frequency"],
  Pots: ["id", "userId", "accountId", "name", "currency", "color", "icon", "resetDate"],
  Pockets: ["id", "userId", "accountId", "name", "currency", "pocketType", "color", "icon", "resetDate"],
  ChatSessions: ["id", "userId", "title", "updatedAt"],
};

export const SHEET_NUMERIC_FIELDS = [
  "amount",
  "balance",
  "limit",
  "targetAmount",
  "currentAmount",
  "usedAmount",
  "limitAmount",
  "amountLeft",
  "budgetLimit",
  "tenureMonths",
  "fee",
  "marketValue",
  "updatedAt",
  "createdAt",
  "lastSyncAt",
];

// Helper to convert Google Sheets serial date number to YYYY-MM-DD string
export const fromSerialDate = (serial: number | any): string => {
  if (typeof serial !== "number") return String(serial || "");
  // If it's a large number, it's definitely a timestamp (Date.now()) or ID, not a serial date
  if (serial > 100000) return String(serial);

  // Excel/Sheets base date is Dec 30, 1899 in UTC
  const baseDate = Date.UTC(1899, 11, 30);
  const d = new Date(baseDate + serial * 24 * 60 * 60 * 1000);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const fromSerialTime = (serial: number | any): string => {
  if (typeof serial !== "number") return String(serial || "");
  // Time is a fraction of a day
  const fraction = serial % 1;
  const totalSeconds = Math.round(fraction * 24 * 3600);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}`;
};

const SHEET_JSON_PREFIX_RE = /^[ \t]*(\{|\[)/;

/**
 * Stored token expiry survives only as a finite ms timestamp. Anything else
 * ("NaN", empty, garbage) means unknown, so callers fall back to
 * refresh-first / trust-until-401 instead of treating a dead token as fresh.
 */
export const parseStoredExpiry = (stored: string | null | undefined): number => {
  if (!stored) return 0;
  const n = parseInt(stored, 10);
  return isFinite(n) ? n : 0;
};

/**
 * Poll until `check` returns true, bounded by `timeoutMs`. Returns false at
 * the deadline instead of waiting forever (gapi load / init can stall on
 * blocked networks — the app must stay usable meanwhile).
 */
export const waitForCondition = async (
  check: () => boolean,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<boolean> => {
  const intervalMs = opts.intervalMs ?? 100;
  const deadline = Date.now() + (opts.timeoutMs ?? 10000);
  while (!check()) {
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return true;
};

const recoveryErrStatus = (err: any): number | undefined =>
  err?.status ?? err?.result?.error?.code;

/**
 * Retry `performLoad` once through a silent token refresh when it fails
 * with 401 (dead access token). The token is cleared only when the session
 * is unrecoverable — refresh failed or the refreshed retry 401'd again —
 * so one stale hour never forces a manual reconnect. Any other error is
 * rethrown untouched for the caller's usual handling.
 */
export const attemptWithSessionRefresh = async <T>(
  performLoad: () => Promise<T>,
  deps: { tryRefresh: () => Promise<boolean>; clearToken: () => void },
): Promise<T> => {
  try {
    return await performLoad();
  } catch (err) {
    if (recoveryErrStatus(err) !== 401) throw err;
    if (!(await deps.tryRefresh())) {
      deps.clearToken();
      throw err;
    }
    try {
      return await performLoad();
    } catch (retryErr) {
      if (recoveryErrStatus(retryErr) === 401) deps.clearToken();
      throw retryErr;
    }
  }
};

/**
 * Parse one Google Sheets row (UNFORMATTED_VALUE render) into a typed object.
 *
 * Sheet cells lose their column type: a date typed into any column comes back
 * as an Excel serial number, booleans come back as booleans, and text stays
 * text. Callers pass the sheet name so text columns get coerced back to
 * strings, keeping the object shapes the app's types promise.
 */
export const parseSheetRow = (
  headers: string[],
  row: any[],
  sheetName?: string,
): Record<string, any> => {
  const obj: Record<string, any> = {};
  const stringFields = SHEET_STRING_FIELDS[sheetName || ""] || [];

  headers.forEach((header, index) => {
    let val = row[index];

    if (header === "date" && typeof val === "number") val = fromSerialDate(val);
    if (header === "time" && typeof val === "number") val = fromSerialTime(val);

    // Only known numeric columns may hold numbers or booleans. Every other
    // column (text, JSON blob, or unknown) must be a string, whatever the
    // sheet stored: dates typed into text columns arrive as Excel serials.
    // Missing trailing cells (undefined/null) stay absent — never "undefined".
    if (
      val !== undefined &&
      val !== null &&
      typeof val !== "string" &&
      !SHEET_NUMERIC_FIELDS.includes(header)
    ) {
      val = String(val);
    }

    // Objects/arrays are stored in cells as JSON strings. Text columns stay
    // literal text (a shop named "[2024]" must not become an array).
    if (
      typeof val === "string" &&
      !stringFields.includes(header) &&
      SHEET_JSON_PREFIX_RE.test(val)
    ) {
      try {
        val = JSON.parse(val);
      } catch {
        /* ignore */
      }
    }

    // Convert booleans (text columns keep the word as text)
    if (typeof val === "string" && !stringFields.includes(header)) {
      const lower = val.toLowerCase();
      if (lower === "true") val = true;
      else if (lower === "false") val = false;
    }

    // Convert numeric columns stored as strings
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      SHEET_NUMERIC_FIELDS.includes(header)
    ) {
      const num = Number(val);
      if (!isNaN(num)) val = num;
    }

    if (header === "id" && val !== undefined) val = String(val);
    if (val !== undefined) obj[header] = val;
  });

  return obj;
};
