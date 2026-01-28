import {
  Account,
  Transaction,
  Category,
  Goal,
  Subscription,
  Pot,
} from "../types";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
];

let gapiInited = false;
let hasAccessToken = false;

// We assume these are available in environment or fall back to user intervention
// Hardcoded fallback included for environments where .env is not processed
const API_KEY =
  process.env.REACT_APP_GOOGLE_API_KEY ||
  "AIzaSyCNH6pugQi4Yw0lgDrFu6FKcDu2QdfdTFA";

export const initGapiClient = async (): Promise<void> => {
  if (!API_KEY) {
    console.warn("Google API Key not found.");
    return;
  }

  return new Promise<void>((resolve) => {
    window.gapi.load("client", async () => {
      await window.gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
      });
      gapiInited = true;
      resolve();
    });
  });
};

export const setGapiAccessToken = (accessToken: string) => {
  if (window.gapi && window.gapi.client) {
    window.gapi.client.setToken({ access_token: accessToken });
    hasAccessToken = true;
  }
};

export const clearGapiAccessToken = () => {
  if (window.gapi && window.gapi.client) {
    window.gapi.client.setToken(null);
  }
  hasAccessToken = false;
  localStorage.removeItem("google_access_token");
};

export const isClientReady = () => gapiInited && hasAccessToken;

let currentSheetTitle = "ZenFinance Data";
let currentUserId: string | null = null;

export const setSheetUser = (userId: string) => {
  if (userId) {
    currentUserId = userId;
  }
};

// Helper to get or create the spreadsheet ID
const getSpreadsheetId = async (): Promise<string | null> => {
  if (!gapiInited || !hasAccessToken) return null;

  // Find the file
  try {
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${currentSheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id, name)",
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
  } catch (err) {
    console.error("Error finding sheet", err);
    return null;
  }

  // Create if not exists
  try {
    const createResponse = await window.gapi.client.sheets.spreadsheets.create({
      properties: { title: currentSheetTitle },
    });
    return createResponse.result.spreadsheetId;
  } catch (err) {
    console.error("Error creating sheet", err);
    return null;
  }
};

const getSheetNames = async (
  spreadsheetId: string,
): Promise<string[] | null> => {
  try {
    const response = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });
    return response.result.sheets.map((s: any) => s.properties.title);
  } catch (e) {
    console.warn("Failed to fetch sheet metadata", e);
    return null;
  }
};

export const saveToSheet = async (sheetName: string, data: any[]) => {
  if (!gapiInited || !hasAccessToken) return;

  const fileId = await getSpreadsheetId();
  if (!fileId) return;

  // Check if sheet exists to avoid 400 errors (if metadata fetch succeeds)
  const existingSheets = await getSheetNames(fileId);

  if (!existingSheets || !existingSheets.includes(sheetName)) {
    try {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileId,
        resource: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    } catch (e) {
      /* ignore if exists race condition */
    }
  }

  // Multi-user Safe Sync:
  // 1. Fetch ALL existing data
  let existingData: any[] = [];
  try {
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = res.result.values;
    if (rows && rows.length > 1) {
      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);
      existingData = dataRows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          let val = row[index];
          if (
            typeof val === "string" &&
            (val.trim().startsWith("{") || val.trim().startsWith("["))
          ) {
            try {
              val = JSON.parse(val);
            } catch {
              /* ignore */
            }
          }
          if (val !== undefined) obj[header] = val;
        });
        return obj;
      });
    }
  } catch (e) {
    /* ignore read error, assume empty */
  }

  // 2. Filter out CURRENT user's data (keeping other users')
  // We need currentUserId to do this safely. If not set, we might be in trouble, but App sets it on login.
  // We double check if the passed data has userId to infer it if missing?
  // Better to rely on the module variable set by Auth.
  const targetUserId =
    currentUserId || (data.length > 0 ? data[0].userId : null);

  let otherUsersData: any[] = [];
  if (targetUserId) {
    otherUsersData = existingData.filter((d) => d.userId !== targetUserId);
  } else {
    // If we can't identify the user, we run a RISK.
    // Ideally we shouldn't save if we're not sure, OR we assume single user mode if no userId column.
    // For this app, we assume everything has userId now.
    otherUsersData = existingData;
    console.warn(
      "Saving to sheet without known userId - Risk of data Duplication/Loss",
    );
  }

  // 3. Merge
  const combinedData = [...otherUsersData, ...data];

  if (combinedData.length === 0) {
    // Clear the sheet if empty data
    try {
      await window.gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: fileId,
        range: `'${sheetName}'!A:Z`,
      });
    } catch (e) {
      console.warn("Clear failed", e);
    }
    return;
  }

  // Generate headers from the first item (prefer new data structure if available)
  const headers = Object.keys(combinedData[0]);

  const rows = combinedData.map((item) => {
    return headers.map((header) => {
      const val = item[header];
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return val;
    });
  });

  const values = [headers, ...rows];

  try {
    // Clear content first
    await window.gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A:Z`,
    });

    // Write new data
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });
    console.log(`Saved ${sheetName} to Google Sheets (Grid Format)`);
  } catch (err) {
    console.error(`Error saving ${sheetName}`, err);
  }
};

export const insertOne = async (sheetName: string, item: any) => {
  if (!gapiInited || !hasAccessToken) return;

  const fileId = await getSpreadsheetId();
  if (!fileId) return;

  // 1. Get Headers to ensure column alignment
  let headers: string[] = [];
  try {
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1:Z1`,
    });
    const rows = res.result.values;
    if (rows && rows.length > 0) {
      headers = rows[0];
    }
  } catch (e) {
    /* ignore */
  }

  // If no headers, we must initialize the sheet (fallback to saveToSheet)
  if (headers.length === 0) {
    return saveToSheet(sheetName, [item]);
  }

  // 2. Align Data to Headers
  const row = headers.map((header) => {
    const val = item[header];
    if (typeof val === "object" && val !== null) {
      return JSON.stringify(val);
    }
    return val ?? "";
  });

  // 3. Append Row
  try {
    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: { values: [row] },
    });
    console.log(`Inserted row into ${sheetName}`);
  } catch (e) {
    console.error(`Error inserting into ${sheetName}`, e);
  }
};

export const syncWithGoogleSheets = async (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  goals: Goal[],
  subscriptions: Subscription[] = [],
  pots: Pot[] = [],
) => {
  // Sync in parallel
  await Promise.all([
    saveToSheet("Accounts", accounts),
    saveToSheet("Transactions", transactions),
    saveToSheet("Categories", categories),
    saveToSheet("Goals", goals),
    saveToSheet("Subscriptions", subscriptions),
    saveToSheet("Pots", pots),
  ]);
};

// Helper to convert Google Sheets serial date number to YYYY-MM-DD string
const fromSerialDate = (serial: number | any): string => {
  if (typeof serial !== "number") return String(serial || "");
  // Excel/Sheets base date is Dec 30, 1899 in UTC
  const baseDate = Date.UTC(1899, 11, 30);
  const d = new Date(baseDate + serial * 24 * 60 * 60 * 1000);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const loadFromGoogleSheets = async (): Promise<{
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  pots: Pot[];
} | null> => {
  if (!gapiInited || !hasAccessToken) return null;

  const fileId = await getSpreadsheetId();
  if (!fileId) return null;

  const result: any = {};
  const sheets = [
    "Accounts",
    "Transactions",
    "Categories",
    "Goals",
    "Subscriptions",
    "Pots",
  ];

  // Check which sheets exist to avoid 400 errors for missing sheets
  const existingSheets = await getSheetNames(fileId);

  for (const sheet of sheets) {
    if (!existingSheets.includes(sheet)) {
      result[sheet.toLowerCase()] = [];
      continue;
    }

    try {
      const res = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: `'${sheet}'!A:Z`,
        valueRenderOption: "UNFORMATTED_VALUE", // Preserves numbers/booleans types
      });

      const rows = res.result.values;
      if (rows && rows.length > 1) {
        const headers = rows[0] as string[];
        const dataRows = rows.slice(1);

        const parsedData = dataRows.map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            let val = row[index];

            // Special handling for Google Sheets Serial Dates (Numbers in the 'date' column)
            if (header === "date" && typeof val === "number") {
              val = fromSerialDate(val);
            }

            // Basic check if it's a stringified object/array
            if (
              typeof val === "string" &&
              (val.trim().startsWith("{") || val.trim().startsWith("["))
            ) {
              try {
                val = JSON.parse(val);
              } catch {
                /* keep as string if parse fails */
              }
            }
            // Explicit check if undefined (ragged rows)
            if (val !== undefined) {
              obj[header] = val;
            }
          });
          return obj;
        });

        // FILTER: Only return data for the current user
        if (currentUserId) {
          result[sheet.toLowerCase()] = parsedData.filter(
            (d: any) => d.userId === currentUserId,
          );
        } else {
          // Fallback: Return all if no user known? Or return filtered?
          // If we don't filter, we leak other users' data.
          // But if currentUserId is somehow null (e.g. init failure), the user sees nothing.
          // We'll return nothing to be safe, assuming authentication sets this.
          result[sheet.toLowerCase()] = [];
          console.warn(`No user ID set, hiding all data for ${sheet}`);
        }
      } else {
        result[sheet.toLowerCase()] = [];
      }
    } catch (err: any) {
      if (err?.status === 401) {
        console.warn("Google Access Token expired, clearing session.");
        clearGapiAccessToken();
      }
      console.warn(`Could not read ${sheet} from cloud`, err);
      result[sheet.toLowerCase()] = [];
    }
  }

  return {
    accounts: result.accounts || [],
    transactions: result.transactions || [],
    categories: result.categories || [],
    goals: result.goals || [],
    subscriptions: result.subscriptions || [],
    pots: result.pots || [],
  };
};
