import {
  Account,
  Transaction,
  Category,
  Goal,
  Subscription,
  Pot,
  ChatSession,
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

const getApiKey = () =>
  import.meta.env?.VITE_GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;

let gapiInited = false;
let gapiInitializing = false;
let hasAccessToken = false;
let tokenExpiryTime = 0;

export const initGapiClient = async (): Promise<void> => {
  if (gapiInited) return;
  if (gapiInitializing) {
    // Wait for the already running initialization
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (gapiInited) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  gapiInitializing = true;
  const apiKey = getApiKey();
  if (!apiKey) {
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
    window.gapi.load("client:picker", async () => {
      try {
        await window.gapi.client.init({
          apiKey,
          discoveryDocs: DISCOVERY_DOCS,
        });

        // Final verification that we have the expected services
        if (window.gapi.client.sheets && window.gapi.client.drive) {
          gapiInited = true;
          console.log(
            "GAPI Client successfully initialized with Sheets, Drive and Picker",
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

  // 1. Check if the user has manually selected a file via the picker before
  const savedId = localStorage.getItem("zenfinance_selected_sheet_id");
  if (savedId) {
    try {
      // Verify it still exists and we have access
      await window.gapi.client.drive.files.get({
        fileId: savedId,
        fields: "id",
      });
      return savedId;
    } catch (e) {
      console.warn("Saved spreadsheet ID is no longer accessible", e);
      localStorage.removeItem("zenfinance_selected_sheet_id");
    }
  }

  // 2. Find the file using search (works only for files CREATED by this app under drive.file scope)
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

    // Migration: ensure all required headers exist
    const requiredHeaders = [
      "isVaultCreated",
      "isVaultLocked",
      "biometricCredId",
      "biometricCredIds",
      "devices",
      "privacyMode",
      "vaultSalt",
      "showAIAssistant",
      "syncChatToSheets",
    ];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      const newHeaders = [...headers, ...missingHeaders];
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: `'Users'!A1:${getColumnLetter(newHeaders.length - 1)}1`,
        valueInputOption: "RAW",
        resource: { values: [newHeaders] },
      });
      // Re-fetch to get current state after header update
      return findUser(email);
    }

    const emailIdx = headers.indexOf("email");
    if (emailIdx === -1) return null;

    const userRow = rows.find((row: any[]) => row[emailIdx] === email);
    if (!userRow) return null;

    return parseUserRow(headers, userRow);
  } catch (e) {
    return null;
  }
};

/**
 * Helper to parse a raw user row into a structured object.
 */
const parseUserRow = (headers: string[], userRow: any[]) => {
  const user: any = {};
  headers.forEach((h: string, i: number) => {
    let val = userRow[i];

    // Handle empty cells
    if (val === undefined || val === "") {
      val = null;
    }

    // Convert booleans and handle JSON
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (lower === "true") val = true;
      else if (lower === "false") val = false;
    }

    // Convert numeric fields
    if (
      typeof val === "string" &&
      val.trim() !== "" &&
      (h === "lastSyncAt" || h === "updatedAt")
    ) {
      const num = Number(val);
      if (!isNaN(num)) val = num;
    }

    if (
      typeof val === "string" &&
      ((val.startsWith("{") && val.endsWith("}")) ||
        (val.startsWith("[") && val.endsWith("]")))
    ) {
      try {
        val = JSON.parse(val);
      } catch {
        /* ignore */
      }
    }
    user[h] = val;
  });
  return user;
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
      // Add headers - Updated to include security and settings
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: "'Users'!A1:L1",
        valueInputOption: "RAW",
        resource: {
          values: [
            [
              "email",
              "password",
              "name",
              "createdAt",
              "isVaultEnabled",
              "isVaultCreated",
              "isVaultLocked",
              "vaultSalt",
              "privacyMode",
              "biometricCredId",
              "biometricCredIds",
              "devices",
              "showAIAssistant",
              "syncChatToSheets",
            ],
          ],
        },
      });
    }

    const headersRes = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: "'Users'!1:1",
    });
    const headers = headersRes.result.values?.[0] || [];

    const row = headers.map((h: string) => {
      if (h === "email") return userData.email;
      if (h === "password") return userData.password;
      if (h === "name") return userData.name;
      if (h === "createdAt") return new Date().toISOString();
      if (h === "isVaultEnabled") return userData.isVaultEnabled || false;
      if (h === "isVaultCreated") return userData.isVaultCreated || false;
      if (h === "isVaultLocked") return userData.isVaultLocked || true;
      if (h === "vaultSalt") return userData.vaultSalt || "";
      if (h === "privacyMode") return userData.privacyMode || false;
      if (h === "showAIAssistant") return userData.showAIAssistant !== false;
      if (h === "syncChatToSheets") return userData.syncChatToSheets !== false;
      if (h === "biometricCredId") return userData.biometricCredId || "";
      if (h === "biometricCredIds")
        return JSON.stringify(userData.biometricCredIds || []);
      if (h === "devices") return JSON.stringify(userData.devices || []);
      return "";
    });

    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: "'Users'!A1",
      valueInputOption: "RAW",
      resource: {
        values: [row],
      },
    });
    return true;
  } catch (e) {
    console.error("Failed to create user", e);
    return false;
  }
};

export const updateUser = async (email: string, updates: any) => {
  if (!gapiInited || !hasAccessToken) return false;
  try {
    const fileId = await getSpreadsheetId();
    if (!fileId) return false;

    // 1. Get current user data
    const res = await window.gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range: "'Users'!A:Z",
    });
    const rows = res.result.values || [];
    if (rows.length === 0) return false;

    const headers = rows[0];

    // Migration: ensure headers include the fields we are trying to update
    const updateKeys = Object.keys(updates);
    const missingHeaders = updateKeys.filter((k) => !headers.includes(k));
    if (missingHeaders.length > 0) {
      const newHeaders = [...headers, ...missingHeaders];
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: `'Users'!A1:${getColumnLetter(newHeaders.length - 1)}1`,
        valueInputOption: "RAW",
        resource: { values: [newHeaders] },
      });
      // Re-fetch to get new headers
      return updateUser(email, updates);
    }

    const emailIdx = headers.indexOf("email");
    const rowIndex = rows.findIndex((r) => r[emailIdx] === email);
    if (rowIndex === -1) return false;

    // 2. Prepare updated row based on headers
    const currentRow = rows[rowIndex];
    const updatedRow = headers.map((header, i) => {
      // Smart Merging for Array fields to prevent overwrites from stale clients
      if (
        (header === "biometricCredIds" ||
          header === "devices" ||
          header === "biometricCredId") && // include legacy field if needed, or handle separately
        updates[header] !== undefined
      ) {
        let currentVal = currentRow[i];
        let currentArr: any[] = [];

        // Parse current value
        try {
          if (currentVal && typeof currentVal === "string") {
            if (currentVal.startsWith("[") && currentVal.endsWith("]")) {
              currentArr = JSON.parse(currentVal);
            } else if (header === "biometricCredId" && currentVal) {
              currentArr = [currentVal];
            }
          }
        } catch (e) {
          console.warn(`Failed to parse existing ${header}`, e);
        }

        const updatesVal = updates[header];
        let newArr: any[] = [];

        if (Array.isArray(updatesVal)) {
          newArr = updatesVal;
        } else if (updatesVal) {
          newArr = [updatesVal];
        }

        // Merge and Dedupe
        // If the update intends to CLEAR (empty array passed), we should respect that?
        // User asked: "replaces instead of adding".
        // We will assume Set union for these fields unless explicit reset is detected (handle elsewhere if needed)
        // Actually, if user clicks "Unlink all", they send empty array.
        // We need to distinguish between "I added one" and "I cleared all".
        // The `updateProfile` in auth service passes the whole new state.

        // Strategy:
        // If updates[header] is EMPTY, it might be a clear operation.
        // If updates[header] has items, we MERGE with existing cloud items to ensure we don't lose other devices.
        if (newArr.length > 0) {
          const merged = Array.from(new Set([...currentArr, ...newArr]));
          return JSON.stringify(merged);
        }

        // If empty array passed, it's likely a clear operation (Unlink All)
        return JSON.stringify([]);
      }

      if (updates[header] !== undefined) {
        // Basic check: stringify boolean/objects
        const val = updates[header];
        if (typeof val === "boolean") return val.toString();
        if (typeof val === "object" && val !== null) return JSON.stringify(val);
        return val;
      }
      return currentRow[i] ?? "";
    });

    // 3. Update the row
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'Users'!A${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      resource: { values: [updatedRow] },
    });
    return true;
  } catch (e) {
    console.error("Failed to update user", e);
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

          // Convert numeric fields
          const numericFields = [
            "amount",
            "balance",
            "updatedAt",
            "createdAt",
            "limit",
            "targetAmount",
            "currentAmount",
            "lastSyncAt",
            "usedAmount",
            "limitAmount",
            "amountLeft",
          ];
          if (
            typeof val === "string" &&
            val.trim() !== "" &&
            numericFields.includes(header)
          ) {
            const num = Number(val);
            if (!isNaN(num)) val = num;
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
      Object.keys(item).forEach((key) => {
        // Security check: Never allow sensitive account details to become top-level columns
        const sensitiveFields = [
          "accountNumber",
          "cardNumber",
          "cvv",
          "expiry",
          "holderName",
        ];
        if (sheetName === "Accounts" && sensitiveFields.includes(key)) {
          return;
        }
        headerSet.add(key);
      });
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

    // Security: If we are saving Accounts, we want to make sure old sensitive columns are wiped.
    // If headers decreased in width, we should clear the wider range.
    const maxCols = Math.max(headers.length, (rows[0] || []).length);
    const clearRange = `'${sheetName}'!A1:${getColumnLetter(maxCols - 1)}${Math.max(totalExistingRows, values.length)}`;

    // Write new data starting from A1
    await window.gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    // If new data is shorter or narrower than old data, clear the remainders
    if (
      totalExistingRows > values.length ||
      (rows[0] || []).length > headers.length
    ) {
      // Clear anything from the end of our new data to the end of the old data range
      // This is a bit complex with A1 notation, so we'll just clear the specific rows/cols if needed.
      if (totalExistingRows > values.length) {
        await window.gapi.client.sheets.spreadsheets.values.clear({
          spreadsheetId: fileId,
          range: `'${sheetName}'!A${values.length + 1}:${getColumnLetter(maxCols - 1)}${totalExistingRows + 10}`,
        });
      }
      if ((rows[0] || []).length > headers.length) {
        // Clear columns to the right
        await window.gapi.client.sheets.spreadsheets.values.clear({
          spreadsheetId: fileId,
          range: `'${sheetName}'!${getColumnLetter(headers.length)}1:${getColumnLetter(maxCols - 1)}${values.length}`,
        });
      }
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

export const insertMany = async (sheetName: string, items: any[]) => {
  if (!gapiInited || !hasAccessToken || items.length === 0) return;

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

  // If no headers, initialize sheet with saveToSheet
  if (headers.length === 0) {
    return saveToSheet(sheetName, items);
  }

  // 2. Align Data to Headers
  const rows = items.map((item) => {
    return headers.map((header) => {
      const val = item[header];
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val);
      }
      return val ?? "";
    });
  });

  // 3. Append Rows in Bulk
  try {
    await window.gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      resource: { values: rows },
    });
    console.log(`Inserted ${items.length} rows into ${sheetName}`);
  } catch (e) {
    console.error(`Error inserting bulk into ${sheetName}`, e);
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
export const updateOne = async (sheetName: string, id: string, item: any) => {
  if (!gapiInited || !hasAccessToken || !id) return;

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
    const rowIndex = ids.findIndex((row: any[]) => row[0] === id);

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

    // 4. Update specific row (A1 notation requires 1-based indexing for rows)
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
  chatSessions?: ChatSession[],
  profile?: any,
) => {
  const tasks = [];
  if (accounts) tasks.push(saveToSheet("Accounts", accounts));
  if (transactions) tasks.push(saveToSheet("Transactions", transactions));
  if (categories) tasks.push(saveToSheet("Categories", categories));
  if (goals) tasks.push(saveToSheet("Goals", goals));
  if (subscriptions) tasks.push(saveToSheet("Subscriptions", subscriptions));
  if (pots) tasks.push(saveToSheet("Pots", pots));
  if (chatSessions) tasks.push(saveToSheet("ChatSessions", chatSessions));

  // Sync profile/security settings
  if (profile && profile.email) {
    tasks.push(updateUser(profile.email, profile));
  }

  await Promise.all(tasks);
};

export const loadFromGoogleSheets = async (
  userEmail?: string,
): Promise<{
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  pots: Pot[];
  chatSessions: ChatSession[];
  profile?: any;
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

  const sheetNamesToLoad = [
    "Accounts",
    "Transactions",
    "Categories",
    "Goals",
    "Subscriptions",
    "Pots",
    "ChatSessions",
    "Users",
  ];

  const names = await getSheetNames(fileId);
  const existingSheets = names || [];

  const validSheets = sheetNamesToLoad.filter((s) =>
    existingSheets.includes(s),
  );
  if (validSheets.length === 0) return result;

  try {
    const response =
      await window.gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: fileId,
        ranges: validSheets.map((s) => `'${s}'!A:Z`),
        valueRenderOption: "UNFORMATTED_VALUE",
      });

    const valueRanges = response.result.valueRanges || [];

    validSheets.forEach((sheetName, rangeIndex) => {
      const rows = valueRanges[rangeIndex]?.values;
      if (!rows || rows.length <= 1) {
        result[sheetName.toLowerCase()] = [];
        return;
      }

      const headers = rows[0] as string[];
      const dataRows = rows.slice(1);

      // Handle Users sheet differently (lookup single user)
      if (sheetName === "Users") {
        const emailIdx = headers.indexOf("email");
        if (emailIdx !== -1) {
          const emailToFind = userEmail || currentUserId;
          const userRow = dataRows.find((r) => r[emailIdx] === emailToFind);
          if (userRow) {
            result.profile = parseUserRow(headers, userRow);
          }
        }
        return;
      }

      result[sheetName.toLowerCase()] = dataRows
        .map((row: any[]) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            let val = row[index];
            if (header === "date" && typeof val === "number")
              val = fromSerialDate(val);
            if (header === "time" && typeof val === "number")
              val = fromSerialTime(val);

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

            // Convert numeric fields
            const numericFields = [
              "amount",
              "balance",
              "updatedAt",
              "createdAt",
              "limit",
              "targetAmount",
              "currentAmount",
              "lastSyncAt",
              "usedAmount",
              "limitAmount",
              "amountLeft",
            ];
            if (
              typeof val === "string" &&
              val.trim() !== "" &&
              numericFields.includes(header)
            ) {
              const num = Number(val);
              if (!isNaN(num)) val = num;
            }

            if (header === "id" && val !== undefined) val = String(val);
            if (val !== undefined) obj[header] = val;
          });
          return obj;
        })
        .filter(
          (d: any) => !currentUserId || d.userId === currentUserId || !d.userId,
        );
    });
  } catch (err: any) {
    if (err?.status === 401) clearGapiAccessToken();
    console.warn("Batch load failed", err);
  }

  // Perform migration for Pots if needed
  const pots = (result.pots || []).map((p: any) => {
    // Migration from old naming: targetAmount -> limitAmount, currentAmount -> amountLeft
    const migratedPot = { ...p };
    if (
      migratedPot.limitAmount === undefined &&
      migratedPot.targetAmount !== undefined
    ) {
      migratedPot.limitAmount = Number(migratedPot.targetAmount);
    }
    if (
      migratedPot.amountLeft === undefined &&
      migratedPot.currentAmount !== undefined
    ) {
      migratedPot.amountLeft = Number(migratedPot.currentAmount);
    }
    // Ensure usedAmount is calculated if missing
    if (migratedPot.usedAmount === undefined) {
      if (
        migratedPot.limitAmount !== undefined &&
        migratedPot.amountLeft !== undefined
      ) {
        migratedPot.usedAmount =
          migratedPot.limitAmount - migratedPot.amountLeft;
      } else {
        migratedPot.usedAmount = 0;
      }
    }
    return migratedPot;
  });

  return {
    accounts: result.accounts || [],
    transactions: result.transactions || [],
    categories: result.categories || [],
    goals: result.goals || [],
    subscriptions: result.subscriptions || [],
    pots,
    chatSessions: result.chatsessions || [],
    profile: result.profile,
  };
};
/**
 * Opens a Google Picker to let the user select a specific spreadsheet.
 * This is crucial for the drive.file scope to gain access to a file
 * that was not created by this app (e.g., from a previous manual sync).
 */
export const selectSpreadsheetWithPicker = async (): Promise<string | null> => {
  if (!gapiInited || !hasAccessToken) return null;

  const accessToken = localStorage.getItem("google_access_token");
  const apiKey = getApiKey();

  if (!accessToken || !apiKey) return null;

  return new Promise((resolve) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView(
          window.google.picker.ViewId.SPREADSHEETS,
        )
          .setMode(window.google.picker.DocsViewMode.LIST)
          .setQuery(currentSheetTitle),
      )
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: any) => {
        if (
          data[window.google.picker.Response.ACTION] ===
          window.google.picker.Action.PICKED
        ) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          const fileId = doc[window.google.picker.Document.ID];
          console.log("User selected spreadsheet via picker:", fileId);
          // Store selected file ID to skip search next time
          localStorage.setItem("zenfinance_selected_sheet_id", fileId);
          resolve(fileId);
        } else if (
          data[window.google.picker.Response.ACTION] ===
          window.google.picker.Action.CANCEL
        ) {
          resolve(null);
        }
      })
      .setTitle(`Select Your ${currentSheetTitle} File`)
      .build();

    picker.setVisible(true);
  });
};
