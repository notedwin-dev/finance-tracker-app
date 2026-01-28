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

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

let gapiInited = false;
let hasAccessToken = false;

export const initGapiClient = async (): Promise<void> => {
  if (!API_KEY) {
    console.warn("Google API Key not found.");
    return;
  }

  // Ensure window.gapi is available (it might take a moment to load from index.html)
  const waitForGapi = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.gapi) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (window.gapi) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 5000);
      }
    });
  };

  await waitForGapi();

  if (!window.gapi) {
    console.error("Google API script (gapi) failed to load.");
    return;
  }

  return new Promise<void>((resolve) => {
    window.gapi.load("client", async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log("GAPI Client initialized");
      } catch (err) {
        console.error("GAPI Client init error", err);
      }
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

  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return;

    // Check if sheet exists
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

    // 2. Filter out CURRENT user's data (keeping other users')
    const targetUserId =
      currentUserId || data.find((d) => !/^c\d+$/.test(d.id))?.userId || null;

    let otherUsersData: any[] = [];
    if (targetUserId) {
      otherUsersData = existingData.filter((d) => {
        // Shared categories (id starts with 'c' followed by digits) are GLOBAL
        const isDefaultCat = sheetName === "Categories" && /^c\d+$/.test(d.id);
        if (isDefaultCat) return false; // Exclude from "otherUsersData" so they merge as singletons

        return d.userId !== targetUserId;
      });
    } else {
      otherUsersData = existingData;
    }

    // 3. Merge and Deduplicate by ID
    // We use a Map to ensure each ID only appears once in the final save.
    // We prioritize the NEW data (the 'data' parameter) over existing data.
    const mergedMap = new Map<string, any>();

    // Add existing data from other users first
    otherUsersData.forEach((item) => {
      if (item.id) mergedMap.set(item.id, item);
    });

    // Add/Overwrite with current user's data
    data.forEach((item) => {
      if (item.id) mergedMap.set(item.id, item);
    });

    const combinedData = Array.from(mergedMap.values());

    if (combinedData.length === 0) {
      // Clear the sheet if empty data
      await window.gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: fileId,
        range: `'${sheetName}'!A:Z`,
      });
      return;
    }

    // Generate headers from the first item
    const headers = Object.keys(combinedData[0]);

    const rowsToUpdate = combinedData.map((item) => {
      return headers.map((header) => {
        const val = item[header];
        if (typeof val === "object" && val !== null) {
          return JSON.stringify(val);
        }
        return val;
      });
    });

    const values = [headers, ...rowsToUpdate];

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
    console.log(`Saved ${sheetName} to Google Sheets`);
  } catch (err: any) {
    if (err?.status === 401) {
      console.warn("Google Access Token expired, clearing session.");
      clearGapiAccessToken();
    }
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
  if (!gapiInited) {
    console.error("GAPI not initialized");
    return null;
  }
  if (!hasAccessToken) {
    console.warn("No access token found for sync");
    return null;
  }

  const fileId = await getSpreadsheetId();
  if (!fileId) {
    console.warn("Could not retrieve spreadsheet ID");
    return null;
  }

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
  const names = await getSheetNames(fileId);
  const existingSheets = names || [];

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
