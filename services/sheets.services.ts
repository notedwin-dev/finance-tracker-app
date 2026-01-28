import {
  Account,
  Transaction,
  Category,
  Goal,
  Subscription,
  Pot,
} from "../types";
import { fromSerialDate, fromSerialTime } from "../helpers/sheets.helper";

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
let tokenExpiryTime = 0;

export const initGapiClient = async (): Promise<void> => {
  if (!API_KEY) {
    console.warn("Google API Key not found.");
    return;
  }

  // Ensure window.gapi is available
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
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 10000); // 10s timeout
      }
    });
  };

  await waitForGapi();

  if (!window.gapi) {
    console.error("Google API script (gapi) failed to load.");
    return;
  }

  // Attempt to restore token from localStorage for auto-sync
  const savedToken = localStorage.getItem("google_access_token");
  const savedExpiry = localStorage.getItem("google_token_expiry");
  if (savedToken) {
    hasAccessToken = true;
    if (savedExpiry) {
      tokenExpiryTime = parseInt(savedExpiry);
    }
  }

  return new Promise<void>((resolve) => {
    window.gapi.load("client", async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        });

        // Final verification that we have the expected services
        if (window.gapi.client.sheets && window.gapi.client.drive) {
          gapiInited = true;
          console.log(
            "GAPI Client successfully initialized with Sheets and Drive",
          );
        } else {
          console.error("GAPI Client init finished but services missing", {
            sheets: !!window.gapi.client.sheets,
            drive: !!window.gapi.client.drive,
          });
        }
      } catch (err) {
        console.error("GAPI Client init error", err);
      }
      resolve();
    });
  });
};

export const setGapiAccessToken = (accessToken: string, expiresIn?: number) => {
  if (window.gapi && window.gapi.client) {
    window.gapi.client.setToken({ access_token: accessToken });
    hasAccessToken = true;
    if (expiresIn) {
      tokenExpiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem("google_token_expiry", tokenExpiryTime.toString());
    }
  }
};

export const clearGapiAccessToken = () => {
  if (window.gapi && window.gapi.client) {
    window.gapi.client.setToken(null);
  }
  hasAccessToken = false;
  tokenExpiryTime = 0;
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("google_token_expiry");
};

export const isClientReady = () => {
  if (!gapiInited || !hasAccessToken) return false;
  // Check if token is expired (with 1 minute buffer)
  if (tokenExpiryTime > 0 && Date.now() > tokenExpiryTime - 60000) {
    return false;
  }
  return true;
};

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

  // Defensive check for gapi client libraries
  if (!window.gapi?.client?.drive || !window.gapi?.client?.sheets) {
    console.warn("GAPI client libraries (drive/sheets) not fully loaded");
    return null;
  }

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
  } catch (err: any) {
    if (err?.status === 401) {
      console.warn("Unauthorized in getSpreadsheetId, clearing token");
      clearGapiAccessToken();
    }
    console.error("Error finding sheet", err);
    return null;
  }

  // Create if not exists
  try {
    const createResponse = await window.gapi.client.sheets.spreadsheets.create({
      properties: { title: currentSheetTitle },
    });
    return createResponse.result.spreadsheetId;
  } catch (err: any) {
    if (err?.status === 401) {
      console.warn("Unauthorized in creating sheet, clearing token");
      clearGapiAccessToken();
    }
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

export const findUser = async (email: string) => {
  if (!gapiInited || !hasAccessToken) return null;
  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return null;

    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: "'Users'!A:Z",
    });

    const rows = res.result.values || [];
    if (rows.length <= 1) return null;

    const headers = rows[0];
    const emailIdx = headers.indexOf("email");
    if (emailIdx === -1) return null;

    const userRow = rows.find((row: any[]) => row[emailIdx] === email);
    if (!userRow) return null;

    const user: any = {};
    headers.forEach((h: string, i: number) => (user[h] = userRow[i]));
    return user;
  } catch (e) {
    return null;
  }
};

export const createUser = async (userData: any) => {
  if (!gapiInited || !hasAccessToken) return false;
  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return false;

    // Ensure sheet exists
    const sheets = await getSheetNames(fileId);
    if (!sheets?.includes("Users")) {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileId,
        resource: {
          requests: [{ addSheet: { properties: { title: "Users" } } }],
        },
      });
      // Add headers
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: "'Users'!A1:D1",
        valueInputOption: "RAW",
        resource: { values: [["email", "password", "name", "createdAt"]] },
      });
    }

    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: "'Users'!A:D",
      valueInputOption: "RAW",
      resource: {
        values: [
          [
            userData.email,
            userData.password,
            userData.name,
            new Date().toISOString(),
          ],
        ],
      },
    });
    return true;
  } catch (e) {
    console.error("Failed to create user", e);
    return false;
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

    // Optimization: If it's a small dataset, just write it.
    // If it's a large dataset (like Transactions), we might want to be smarter,
    // but the most efficient way to maintain multi-user consistency is still
    // fetching existing data once and merging locally.

    // To speed up: We'll skip the 'clear' call and use 'update' with a range that overwrites.
    // If the new data is shorter, we'll clear ONLY the remaining rows.

    // 1. Fetch ALL existing data (still needed for multi-user merge)
    let existingData: any[] = [];
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = res.result.values || [];
    const totalExistingRows = rows.length;

    if (totalExistingRows > 1) {
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
        return d.userId !== targetUserId;
      });
    } else {
      otherUsersData = existingData;
    }

    // 3. Merge
    const mergedMap = new Map<string, any>();
    otherUsersData.forEach((item) => {
      if (item.id) mergedMap.set(String(item.id), item);
    });
    data.forEach((item) => {
      if (item.id) mergedMap.set(String(item.id), item);
    });

    const combinedData = Array.from(mergedMap.values());

    if (combinedData.length === 0) {
      if (totalExistingRows > 0) {
        await window.gapi.client.sheets.spreadsheets.values.clear({
          spreadsheetId: fileId,
          range: `'${sheetName}'!A:Z`,
        });
      }
      return;
    }

    // Generate headers from all items to ensure no fields are lost (migration support)
    const headerSet = new Set<string>();
    // Force 'id' to be the first column if it exists in any item
    const hasId = combinedData.some((item) => item.id !== undefined);
    if (hasId) headerSet.add("id");

    combinedData.forEach((item) => {
      Object.keys(item).forEach((key) => headerSet.add(key));
    });
    const headers = Array.from(headerSet);

    const rowsToUpdate = combinedData.map((item) => {
      return headers.map((header) => {
        const val = item[header];
        if (typeof val === "object" && val !== null) {
          return JSON.stringify(val);
        }
        return val ?? "";
      });
    });

    const values = [headers, ...rowsToUpdate];

    // Write new data starting from A1
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    // If new data is shorter than old data, clear the bottom rows
    if (totalExistingRows > values.length) {
      await window.gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: fileId,
        range: `'${sheetName}'!A${values.length + 1}:Z${totalExistingRows}`,
      });
    }

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

const getColumnLetter = (index: number): string => {
  let letter = "";
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

/**
 * Updates a specific row based on the 'id' field.
 * This is much faster than saveToSheet for single edits.
 */
export const updateOne = async (sheetName: string, item: any) => {
  if (!gapiInited || !hasAccessToken || !item.id) return;

  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return;

    // 1. Get Headers to align columns and find ID column
    const headerRes = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!1:1`,
    });
    const headers = headerRes.result.values?.[0] || [];
    const idColumnIndex = headers.indexOf("id");

    if (idColumnIndex === -1) {
      // If no id column, we might need a full save or something is wrong
      return insertOne(sheetName, item);
    }

    const idColLetter = getColumnLetter(idColumnIndex);

    // 2. Find the row index of the ID
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!${idColLetter}:${idColLetter}`,
    });

    const ids = res.result.values || [];
    const rowIndex = ids.findIndex((row: any[]) => row[0] === item.id);

    if (rowIndex === -1) {
      // If not found, maybe it was deleted or just added. Fallback to insert.
      return insertOne(sheetName, item);
    }

    // 3. Prepare the updated row
    const row = headers.map((header: string) => {
      const val = item[header];
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return val ?? "";
    });

    // 4. Update specific row (using 1-based index)
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [row] },
    });

    console.log(`Updated row in ${sheetName} at row ${rowIndex + 1}`);
  } catch (e) {
    console.warn(`Error updating row in ${sheetName}`, e);
    // Fallback: If finding specific row fails, we might need a full sync
  }
};

/**
 * Deletes a specific row based on the 'id' field.
 */
export const deleteOne = async (sheetName: string, id: string) => {
  if (!gapiInited || !hasAccessToken || !id) return;

  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return;

    // 1. Get the sheet ID (different from spreadsheetId) and Headers
    const spreadsheet = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: fileId,
    });
    const sheet = spreadsheet.result.sheets.find(
      (s: any) => s.properties.title === sheetName,
    );
    if (!sheet) return;

    const sheetId = sheet.properties.sheetId;

    const headerRes = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!1:1`,
    });
    const headers = headerRes.result.values?.[0] || [];
    const idColumnIndex = headers.indexOf("id");

    if (idColumnIndex === -1) return;
    const idColLetter = getColumnLetter(idColumnIndex);

    // 2. Find the row index
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: `'${sheetName}'!${idColLetter}:${idColLetter}`,
    });

    const ids = res.result.values || [];
    const rowIndex = ids.findIndex((row: any[]) => row[0] === id);

    if (rowIndex === -1) return;

    // 3. Delete the specific row
    await window.gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    console.log(`Deleted row ${rowIndex + 1} from ${sheetName}`);
  } catch (e) {
    console.error(`Error deleting row from ${sheetName}`, e);
  }
};

export const syncWithGoogleSheets = async (
  accounts?: Account[],
  transactions?: Transaction[],
  categories?: Category[],
  goals?: Goal[],
  subscriptions?: Subscription[],
  pots?: Pot[],
) => {
  const tasks = [];
  if (accounts) tasks.push(saveToSheet("Accounts", accounts));
  if (transactions) tasks.push(saveToSheet("Transactions", transactions));
  if (categories) tasks.push(saveToSheet("Categories", categories));
  if (goals) tasks.push(saveToSheet("Goals", goals));
  if (subscriptions) tasks.push(saveToSheet("Subscriptions", subscriptions));
  if (pots) tasks.push(saveToSheet("Pots", pots));

  await Promise.all(tasks);
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

            if (header === "time" && typeof val === "number") {
              val = fromSerialTime(val);
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

            // Ensure IDs are always strings to prevent merge mismatches
            if (header === "id" && val !== undefined && val !== null) {
              val = String(val);
            }

            // Explicit check if undefined (ragged rows)
            if (val !== undefined) {
              obj[header] = val;
            }
          });
          return obj;
        });

        // FILTER: Only return data for the current user OR global data (no userId)
        if (currentUserId) {
          result[sheet.toLowerCase()] = parsedData.filter(
            (d: any) => d.userId === currentUserId || !d.userId,
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
