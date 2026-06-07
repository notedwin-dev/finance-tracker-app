import {
	Account,
	Transaction,
	Category,
	Goal,
	Subscription,
	Pot,
	SavingPocket,
	ChatSession,
} from "../types";
import { fromSerialDate, fromSerialTime } from "../helpers/sheets.helper";
import { logger } from "../src/lib/infrastructure/logger";
import { migrateLegacyPot } from "../src/lib/domain/pot-migration";

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

const getApiKey = () => {
	const meta = import.meta.env?.VITE_GOOGLE_API_KEY;
	if (meta) return meta;
	if (typeof process !== "undefined" && process.env) {
		return process.env.VITE_GOOGLE_API_KEY;
	}
	return undefined;
};

const maskFileIdForLogging = (fileId: string): string => {
	if (!fileId || fileId.length < 8) return "***";
	return `${fileId.substring(0, 4)}...${fileId.substring(fileId.length - 4)}`;
};

let gapiInited = false;
let gapiInitializing: Promise<void> | null = null;
let hasAccessToken = false;
let tokenExpiryTime = 0;

// Helper to get profile sheet name (supports legacy "Users" sheet for existing users)
let cachedSheetName: string | null = null;
const getProfileSheetName = async (fileId: string): Promise<string> => {
	if (cachedSheetName) return cachedSheetName;

	try {
		const sheetsResponse = await window.gapi.client.sheets.spreadsheets.get({
			spreadsheetId: fileId,
		});
		const existingSheets =
			sheetsResponse.result.sheets?.map((s: any) => s.properties?.title) || [];

		if (existingSheets.includes("Profile")) {
			cachedSheetName = "Profile";
		} else if (existingSheets.includes("Users")) {
			logger.log(
				"📋 Using legacy 'Users' sheet. Consider migrating to 'Profile'.",
			);
			cachedSheetName = "Users";
		} else {
			// Neither exists - will create "Profile" in ensureSheetExists
			cachedSheetName = "Profile";
		}

		return cachedSheetName;
	} catch (error) {
		logger.error("Error detecting profile sheet:", error);
		return "Profile"; // Default fallback
	}
};

/**
 * Clear the cached sheet name (call when switching spreadsheets)
 */
export const clearSheetNameCache = () => {
	cachedSheetName = null;
};

export const initGapiClient = (): Promise<void> => {
	if (gapiInited) return Promise.resolve();
	if (gapiInitializing) return gapiInitializing;

	gapiInitializing = (async (): Promise<void> => {
		try {
			const apiKey = getApiKey();
			if (!apiKey) {
				logger.warn("Google API Key not found.");
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
				logger.error("Google API script (gapi) failed to load.");
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

			await new Promise<void>((resolve) => {
				window.gapi.load("client:picker", async () => {
					try {
						await window.gapi.client.init({
							apiKey,
							discoveryDocs: DISCOVERY_DOCS,
						});

						// Final verification that we have the expected services
						if (window.gapi.client.sheets && window.gapi.client.drive) {
							gapiInited = true;
							logger.log(
								"GAPI Client successfully initialized with Sheets, Drive and Picker",
							);
						} else {
							logger.error("GAPI Client init finished but services missing", {
								sheets: !!window.gapi.client.sheets,
								drive: !!window.gapi.client.drive,
							});
						}
					} catch (err) {
						logger.error("GAPI Client init error", err);
					}
					resolve();
				});
			});
		} finally {
			gapiInitializing = null;
		}
	})();

	return gapiInitializing;
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
	cachedSheetName = null; // Clear cached sheet name on logout
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

const isGapiClientReady = (): boolean =>
  !!window.gapi?.client?.drive && !!window.gapi?.client?.sheets;

const handleAuthError = (err: any, action: string): never | null => {
  if (err?.status === 401) {
    logger.warn(`Unauthorized in ${action}, clearing token`);
    clearGapiAccessToken();
    throw err;
  }
  return null;
};

const verifySavedSheetId = async (savedId: string): Promise<string | null> => {
  try {
    await window.gapi.client.drive.files.get({ fileId: savedId, fields: "id" });
    return savedId;
  } catch (e: any) {
    handleAuthError(e, "verifySavedSheetId");
    logger.warn("Saved spreadsheet ID is no longer accessible", e);
    localStorage.removeItem("zenfinance_selected_sheet_id");
    return null;
  }
};

const findExistingSheetByTitle = async (): Promise<string | null> => {
  try {
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${currentSheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: "files(id, name)",
    });
    const files = response.result.files;
    if (files && files.length > 0) return files[0].id;
    return null;
  } catch (err: any) {
    handleAuthError(err, "getSpreadsheetId");
    logger.error("Error finding sheet", err);
    return null;
  }
};

const createNewSheet = async (): Promise<string | null> => {
  try {
    const createResponse = await window.gapi.client.sheets.spreadsheets.create({
      properties: { title: currentSheetTitle },
    });
    return createResponse.result.spreadsheetId;
  } catch (err: any) {
    handleAuthError(err, "creating sheet");
    logger.error("Error creating sheet", err);
    return null;
  }
};

// Helper to get or create the spreadsheet ID
const getSpreadsheetId = async (): Promise<string | null> => {
  if (!gapiInited || !hasAccessToken) return null;
  if (!isGapiClientReady()) {
    logger.warn("GAPI client libraries (drive/sheets) not fully loaded");
    return null;
  }

  const savedId = localStorage.getItem("zenfinance_selected_sheet_id");
  if (savedId) {
    const verified = await verifySavedSheetId(savedId);
    if (verified) return verified;
  }

  const existing = await findExistingSheetByTitle();
  if (existing) return existing;

  return createNewSheet();
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
		logger.warn("Failed to fetch sheet metadata", e);
		return null;
	}
};

export const findUser = async (email: string) => {
	if (!isClientReady()) return null;
	try {
		const fileId = await getSpreadsheetId();
		if (!fileId) return null;

		const sheetName = await getProfileSheetName(fileId);
		const res = await window.gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A:Z`,
		});

		const rows = res.result.values || [];
		if (rows.length <= 1) return null;

		const headers = rows[0];

		// Migration: ensure all required headers exist
		const requiredHeaders = [
			"maskMode",
			"schemaVersion",
			"showAIAssistant",
			"syncChatToSheets",
			"lastUpdatedAt",
			"lastSyncAt",
		];
		const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
		if (missingHeaders.length > 0) {
			const sheetName = await getProfileSheetName(fileId);
			const newHeaders = [...headers, ...missingHeaders];
			await window.gapi.client.sheets.spreadsheets.values.update({
				spreadsheetId: fileId,
				range: `'${sheetName}'!A1:${getColumnLetter(newHeaders.length - 1)}1`,
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
	} catch (e: any) {
		if (e?.status === 401) {
			hasAccessToken = false;
			gapiInited = false;
			localStorage.removeItem("google_access_token");
			localStorage.removeItem("google_token_expiry");
			throw e;
		}
		return null;
	}
};

/**
 * Helper to parse a raw user row into a structured object.
 */
const normalizeEmptyCell = (val: any): any =>
	val === undefined || val === "" ? null : val;

const parseStringBoolean = (val: any): any => {
	if (typeof val !== "string") return val;
	const lower = val.toLowerCase();
	if (lower === "true") return true;
	if (lower === "false") return false;
	return val;
};

const parseTimestampField = (val: any, header: string): any => {
	if (typeof val !== "string" || val.trim() === "") return val;
	if (header !== "lastSyncAt" && header !== "updatedAt") return val;
	const num = Number(val);
	return isNaN(num) ? val : num;
};

const parseJsonString = (val: any): any => {
	if (typeof val !== "string") return val;
	const looksLikeJson =
		(val.startsWith("{") && val.endsWith("}")) ||
		(val.startsWith("[") && val.endsWith("]"));
	if (!looksLikeJson) return val;
	try {
		return JSON.parse(val);
	} catch {
		return val;
	}
};

const parseUserRow = (headers: string[], userRow: any[]) => {
	const user: any = {};
	headers.forEach((h: string, i: number) => {
		let val = userRow[i];
		val = normalizeEmptyCell(val);
		val = parseStringBoolean(val);
		val = parseTimestampField(val, h);
		val = parseJsonString(val);
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
		const sheetName = await getProfileSheetName(fileId);

		if (!sheets?.includes(sheetName)) {
			await window.gapi.client.sheets.spreadsheets.batchUpdate({
				spreadsheetId: fileId,
				resource: {
					requests: [{ addSheet: { properties: { title: sheetName } } }],
				},
			});
			// Add headers - profile + cloud settings
			await window.gapi.client.sheets.spreadsheets.values.update({
				spreadsheetId: fileId,
				range: `'${sheetName}'!A1:J1`,
				valueInputOption: "RAW",
				resource: {
					values: [
						[
							"email",
							"password",
							"name",
							"createdAt",
							"maskMode",
							"schemaVersion",
							"showAIAssistant",
							"syncChatToSheets",
							"lastUpdatedAt",
							"lastSyncAt",
						],
					],
				},
			});
		}

		const headersRes = await window.gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: fileId,
			range: `'${sheetName}'!1:1`,
		});
		const headers = headersRes.result.values?.[0] || [];

		const row = headers.map((h: string) => {
			if (h === "email") return userData.email;
			if (h === "password") return userData.password;
			if (h === "name") return userData.name;
			if (h === "createdAt") return new Date().toISOString();
			if (h === "maskMode") return userData.maskMode || false;
			if (h === "schemaVersion") return userData.schemaVersion ?? 2;
			if (h === "showAIAssistant") return userData.showAIAssistant !== false;
			if (h === "syncChatToSheets") return userData.syncChatToSheets !== false;
			if (h === "lastUpdatedAt") return new Date().toISOString();
			return "";
		});

		await window.gapi.client.sheets.spreadsheets.values.append({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A1`,
			valueInputOption: "RAW",
			resource: {
				values: [row],
			},
		});
		return true;
	} catch (e) {
		logger.error("Failed to create user", e);
		return false;
	}
};

export const updateUser = async (email: string, updates: any) => {
	if (!gapiInited || !hasAccessToken) return false;
	try {
		const maskEmail = (email: string): string => {
			if (!email || email.length < 3) return "***";
			const atIndex = email.indexOf("@");
			if (atIndex === -1) return "***";
			return `${email.charAt(0)}***${email.charAt(atIndex - 1)}${email.substring(atIndex)}`;
		};

		logger.log("📝 updateUser called with:", {
			maskedEmail: maskEmail(email),
			updatedFields: Object.keys(updates || {}),
		});

		const fileId = await getSpreadsheetId();
		if (!fileId) return false;

		const sheetName = await getProfileSheetName(fileId);
		// 1. Get current user data
		const res = await window.gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A:Z`,
		});
		const rows = res.result.values || [];
		if (rows.length === 0) return false;

		const headers = rows[0];

		// Migration: ensure headers include the fields we are trying to update
		const updateKeys = Object.keys(updates);
		const missingHeaders = updateKeys.filter((k) => !headers.includes(k));
		if (missingHeaders.length > 0) {
			logger.log(
				"➕ Adding missing headers to Profile sheet:",
				missingHeaders,
			);
			const newHeaders = [...headers, ...missingHeaders];
			await window.gapi.client.sheets.spreadsheets.values.update({
				spreadsheetId: fileId,
				range: `'${sheetName}'!A1:${getColumnLetter(newHeaders.length - 1)}1`,
				valueInputOption: "RAW",
				resource: { values: [newHeaders] },
			});
			logger.log("✅ Headers added, re-running updateUser");
			// Re-fetch to get new headers
			return updateUser(email, updates);
		}

		const emailIdx = headers.indexOf("email");
		const rowIndex = rows.findIndex((r) => r[emailIdx] === email);
		if (rowIndex === -1) return false;

		// 2. Prepare updated row based on headers
		const currentRow = rows[rowIndex];
		const updatedRow = headers.map((header, i) => {
			if (updates[header] !== undefined) {
				const val = updates[header];
				if (typeof val === "boolean") return val.toString();
				return serializeCellValue(val);
			}
			return currentRow[i] ?? "";
		});

		// 3. Update the row
		logger.log("💾 Updating Profile sheet row:", {
			rowIndex: rowIndex + 1,
			updatedFields: Object.keys(updates),
		});

		await window.gapi.client.sheets.spreadsheets.values.update({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A${rowIndex + 1}`,
			valueInputOption: "USER_ENTERED",
			resource: { values: [updatedRow] },
		});

		logger.log("✅ Profile sheet updated successfully");
		return true;
	} catch (e) {
		logger.error("Failed to update user", e);
		return false;
	}
};

export const saveToSheet = async (sheetName: string, data: any[]) => {
	if (!gapiInited || !hasAccessToken) return;

	try {
		const fileId = await getSpreadsheetId();
		if (!fileId) return;

		await ensureSheetExists(fileId, sheetName);

		const { existingData, rows, totalExistingRows } = await fetchSheetData(fileId, sheetName);
		const { otherUsersData } = partitionByUser(existingData, data, currentUserId);
		const combinedData = mergeById(otherUsersData, data);

		if (
			await handleEmptyMerge(fileId, sheetName, {
				combinedData,
				existingData,
				data,
				totalExistingRows,
			})
		) {
			return;
		}

		const sanitizedItems = stripSensitiveFields(combinedData);
		const headers = collectHeaders(sanitizedItems);
		const values = serializeRows(sanitizedItems, headers);

		await writeSheetData(fileId, sheetName, values);
		await clearRemainders(fileId, sheetName, {
			totalExistingRows,
			newRowCount: values.length,
			oldColCount: (rows[0] || []).length,
			newColCount: headers.length,
		});

		logger.log(`Saved ${sheetName} to Google Sheets`);
	} catch (err: any) {
		if (err?.status === 401) {
			logger.warn("Google Access Token expired, clearing session.");
			clearGapiAccessToken();
		}
		logger.error(`Error saving ${sheetName}`, err);
	}
};

export const insertOne = async (sheetName: string, item: any) => {
	if (!gapiInited || !hasAccessToken) return;

	const headers = await fetchSheetHeaders(sheetName, "A1:Z1");

	// If no headers, we must initialize the sheet (fallback to saveToSheet)
	if (headers.length === 0) {
		return saveToSheet(sheetName, [item]);
	}

	const fileId = await getSpreadsheetId();
	if (!fileId) return;

	// 2. Align Data to Headers
	const row = headers.map((header) => {
		const val = item[header];
		return serializeCellValue(val) ?? "";
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
		logger.log(`Inserted row into ${sheetName}`);
	} catch (e) {
		logger.error(`Error inserting into ${sheetName}`, e);
	}
};

export const insertMany = async (sheetName: string, items: any[]) => {
	if (!gapiInited || !hasAccessToken || items.length === 0) return;

	const headers = await fetchSheetHeaders(sheetName, "A1:Z1");

	// If no headers, initialize sheet with saveToSheet
	if (headers.length === 0) {
		return saveToSheet(sheetName, items);
	}

	const fileId = await getSpreadsheetId();
	if (!fileId) return;

	// 2. Align Data to Headers
	const rows = items.map((item) => {
		return headers.map((header) => {
			const val = item[header];
			return serializeCellValue(val) ?? "";
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
		logger.log(`Inserted ${items.length} rows into ${sheetName}`);
	} catch (e) {
		logger.error(`Error inserting bulk into ${sheetName}`, e);
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

async function fetchSheetHeaders(
	sheetName: string,
	range = "1:1",
): Promise<string[]> {
	const fileId = await getSpreadsheetId();
	if (!fileId) return [];
	try {
		const res = await window.gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: fileId,
			range: `'${sheetName}'!${range}`,
		});
		return res.result.values?.[0] || [];
	} catch {
		return [];
	}
}

const serializeCellValue = (val: unknown): unknown => {
	if (typeof val === "object" && val !== null) return JSON.stringify(val);
	return val;
};

const coerceStringValue = (val: unknown): unknown => {
	if (typeof val !== "string") return val;
	if (val.trim().startsWith("{") || val.trim().startsWith("[")) {
		try {
			return JSON.parse(val);
		} catch {
			/* ignore */
		}
	}
	const lower = val.toLowerCase();
	if (lower === "true") return true;
	if (lower === "false") return false;
	return val;
};

const NUMERIC_FIELDS = new Set([
	"amount",
	"balance",
	"limit",
	"targetAmount",
	"currentAmount",
	"usedAmount",
	"limitAmount",
	"amountLeft",
]);

const SENSITIVE_FIELDS = new Set([
	"details",
	"isEncrypted",
	"accountNumber",
	"cardNumber",
	"holderName",
	"expiry",
	"cvv",
]);

const parseSheetRow = (headers: string[], row: unknown[]): any => {
	const obj: any = {};
	headers.forEach((header, index) => {
		let val = coerceStringValue(row[index]);
		if (
			typeof val === "string" &&
			val.trim() !== "" &&
			NUMERIC_FIELDS.has(header)
		) {
			const num = Number(val);
			if (!isNaN(num)) val = num;
		}
		if (val !== undefined) obj[header] = val;
	});
	return obj;
};

const partitionByUser = (
	existingData: any[],
	data: any[],
	currentUserId: string | null,
): { otherUsersData: any[]; targetUserId: string | null } => {
	const targetUserId =
		currentUserId || data.find((d) => !/^c\d+$/.test(d.id))?.userId || null;
	const otherUsersData = targetUserId
		? existingData.filter((d) => d.userId !== targetUserId)
		: existingData;
	return { otherUsersData, targetUserId };
};

const mergeById = (otherUsersData: any[], data: any[]): any[] => {
	const mergedMap = new Map<string, any>();
	otherUsersData.forEach((item) => {
		if (item.id) mergedMap.set(String(item.id), item);
	});
	data.forEach((item) => {
		if (item.id) mergedMap.set(String(item.id), item);
	});
	return Array.from(mergedMap.values());
};

const stripSensitiveFields = (items: any[]): any[] => {
	return items.map((item) => {
		const sanitized: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(item)) {
			if (!SENSITIVE_FIELDS.has(key)) sanitized[key] = value;
		}
		return sanitized;
	});
};

const collectHeaders = (items: any[]): string[] => {
	const headerSet = new Set<string>();
	const hasId = items.some((item) => item.id !== undefined);
	if (hasId) headerSet.add("id");
	items.forEach((item) => {
		Object.keys(item).forEach((key) => headerSet.add(key));
	});
	return Array.from(headerSet);
};

const ensureSheetExists = async (fileId: string, sheetName: string) => {
	const existingSheets = await getSheetNames(fileId);
	if (!existingSheets || !existingSheets.includes(sheetName)) {
		try {
			await window.gapi.client.sheets.spreadsheets.batchUpdate({
				spreadsheetId: fileId,
				resource: {
					requests: [{ addSheet: { properties: { title: sheetName } } }],
				},
			});
		} catch {
			/* ignore race condition */
		}
	}
};

const fetchSheetData = async (
	fileId: string,
	sheetName: string,
): Promise<{ existingData: any[]; rows: any[][]; totalExistingRows: number }> => {
	const res = await window.gapi.client.sheets.spreadsheets.values.get({
		spreadsheetId: fileId,
		range: `'${sheetName}'!A:Z`,
		valueRenderOption: "UNFORMATTED_VALUE",
	});
	const rows = res.result.values || [];
	const totalExistingRows = rows.length;
	if (totalExistingRows <= 1) {
		return { existingData: [], rows, totalExistingRows };
	}
	const headers = rows[0] as string[];
	const dataRows = rows.slice(1);
	const existingData = dataRows.map((row) => parseSheetRow(headers, row));
	return { existingData, rows, totalExistingRows };
};

const handleEmptyMerge = async (
	fileId: string,
	sheetName: string,
	state: {
		combinedData: any[];
		existingData: any[];
		data: any[];
		totalExistingRows: number;
	},
): Promise<boolean> => {
	const { combinedData, existingData, data, totalExistingRows } = state;
	if (combinedData.length !== 0) return false;

	if (existingData.length > 0 && data.length > 0) {
		logger.error(
			`Sync safety check failed for ${sheetName}: Merge resulted in 0 items when existingData=${existingData.length} and newData=${data.length}. Aborting to prevent data loss.`,
		);
		throw new Error(
			`Prevented clearing ${sheetName} sheet - merge logic produced empty result`,
		);
	}

	if (data.length === 0 && totalExistingRows > 0) {
		await window.gapi.client.sheets.spreadsheets.values.clear({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A:Z`,
		});
	}
	return true;
};

const serializeRows = (items: any[], headers: string[]): any[][] => {
	const rowsToUpdate = items.map((item) =>
		headers.map((header) => serializeCellValue(item[header]) ?? ""),
	);
	return [headers, ...rowsToUpdate];
};

const writeSheetData = async (
	fileId: string,
	sheetName: string,
	values: any[][],
) => {
	await window.gapi.client.sheets.spreadsheets.values.update({
		spreadsheetId: fileId,
		range: `'${sheetName}'!A1`,
		valueInputOption: "USER_ENTERED",
		resource: { values },
	});
};

const clearRemainders = async (
	fileId: string,
	sheetName: string,
	state: {
		totalExistingRows: number;
		newRowCount: number;
		oldColCount: number;
		newColCount: number;
	},
) => {
	const { totalExistingRows, newRowCount, oldColCount, newColCount } = state;
	if (totalExistingRows <= newRowCount && oldColCount <= newColCount) return;

	const maxCols = Math.max(newColCount, oldColCount);
	if (totalExistingRows > newRowCount) {
		await window.gapi.client.sheets.spreadsheets.values.clear({
			spreadsheetId: fileId,
			range: `'${sheetName}'!A${newRowCount + 1}:${getColumnLetter(maxCols - 1)}${totalExistingRows + 10}`,
		});
	}
	if (oldColCount > newColCount) {
		await window.gapi.client.sheets.spreadsheets.values.clear({
			spreadsheetId: fileId,
			range: `'${sheetName}'!${getColumnLetter(newColCount)}1:${getColumnLetter(maxCols - 1)}${newRowCount}`,
		});
	}
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
		const headers = await fetchSheetHeaders(sheetName);
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
			return serializeCellValue(val) ?? "";
		});

		// 4. Update specific row (A1 notation requires 1-based indexing for rows)
		// Safe update: only update columns present in the item object to prevent clearing legacy data
		const data: any[] = [];
		headers.forEach((header: string, colIndex: number) => {
			const val = item[header];
				if (val !== undefined) {
					const colLetter = getColumnLetter(colIndex);
					data.push({
						range: `'${sheetName}'!${colLetter}${rowIndex + 1}`,
						values: [[serializeCellValue(val)]],
					});
				}
		});

		if (data.length > 0) {
			await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
				spreadsheetId: fileId,
				resource: {
					data,
					valueInputOption: "USER_ENTERED",
				},
			});
			logger.log(
				`Updated ${data.length} cells in ${sheetName} at row ${rowIndex + 1}`,
			);
		}
	} catch (e) {
		logger.warn(`Error updating row in ${sheetName}`, e);
		// Fallback: If finding specific row fails, we might need a full sync
	}
};

/**
 * Batch update multiple rows in a sheet (much more efficient than individual updateOne calls).
 * Only fetches headers once and finds all rows, then updates in bulk.
 * @param columnsToUpdate Optional list of headers to update. If omitted, the entire row is updated.
 */
export const updateMany = async (
	sheetName: string,
	items: any[],
	columnsToUpdate?: string[],
) => {
	if (!gapiInited || !hasAccessToken || items.length === 0) return;

	try {
		const fileId = await getSpreadsheetId();
		if (!fileId) return;

		// 1. Get Headers once
		const headers = await fetchSheetHeaders(sheetName);
		const idColumnIndex = headers.indexOf("id");

		if (idColumnIndex === -1) {
			logger.warn(`No id column in ${sheetName}, falling back to insertMany`);
			return insertMany(sheetName, items);
		}

		const idColLetter = getColumnLetter(idColumnIndex);

		// 2. Get all IDs in the sheet once
		const res = await window.gapi.client.sheets.spreadsheets.values.get({
			spreadsheetId: fileId,
			range: `'${sheetName}'!${idColLetter}:${idColLetter}`,
		});

		const sheetIds = res.result.values || [];
		const idToRowIndex = new Map<string, number>();
		sheetIds.forEach((row: any[], idx: number) => {
			if (row[0]) idToRowIndex.set(row[0], idx);
		});

		// 3. Prepare batch update with data and ranges
		const data: any[] = [];
		items.forEach((item) => {
			const rowIndex = idToRowIndex.get(item.id);
			if (rowIndex !== undefined && rowIndex > 0) {
				const colsToProcess = columnsToUpdate || headers;

				colsToProcess.forEach((header: string) => {
					const colIndex = headers.indexOf(header);
					if (colIndex !== -1) {
						const val = item[header];
						// Only update if value is present in the object
					if (val !== undefined) {
						const colLetter = getColumnLetter(colIndex);
						data.push({
							range: `'${sheetName}'!${colLetter}${rowIndex + 1}`,
							values: [[serializeCellValue(val) ?? ""]],
						});
					}
					}
				});
			}
		});

		// 4. Execute batch update if there are items to update
		if (data.length > 0) {
			await window.gapi.client.sheets.spreadsheets.values.batchUpdate({
				spreadsheetId: fileId,
				resource: {
					data,
					valueInputOption: "USER_ENTERED",
				},
			});
			logger.log(
				`Batch updated ${data.length} ${columnsToUpdate ? "cells" : "rows"} in ${sheetName}`,
			);
		}
	} catch (e) {
		logger.warn(`Error batch updating ${sheetName}`, e);
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

		logger.log(`Deleted row ${rowIndex + 1} from ${sheetName}`);
	} catch (e) {
		logger.error(`Error deleting row from ${sheetName}`, e);
	}
};

export const syncWithGoogleSheets = async (
	accounts?: Account[],
	transactions?: Transaction[],
	categories?: Category[],
	goals?: Goal[],
	subscriptions?: Subscription[],
	pots?: Pot[],
	pockets?: SavingPocket[],
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
	if (pockets) tasks.push(saveToSheet("Pockets", pockets));
	if (chatSessions) tasks.push(saveToSheet("ChatSessions", chatSessions));

	// Sync profile/security settings
	if (profile && profile.email) {
		tasks.push(updateUser(profile.email, profile));
	}

	await Promise.all(tasks);
};

const hasRequiredAuth = (): boolean => {
	if (!gapiInited) {
		logger.error("GAPI not initialized");
		return false;
	}
	if (!hasAccessToken) {
		logger.warn("No access token found for sync");
		return false;
	}
	return true;
};

const resolveSpreadsheetId = async (): Promise<string | null> => {
	const fileId = await getSpreadsheetId();
	if (!fileId) {
		logger.warn("Could not retrieve spreadsheet ID");
	}
	return fileId;
};

const NUMERIC_SHEET_FIELDS = new Set([
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
]);

const isProfileSheet = (name: string) => name === "Profile" || name === "Users";

const coerceSheetValue = (header: string, val: unknown): unknown => {
	if (val === undefined) return val;
	if (header === "date" && typeof val === "number") return fromSerialDate(val);
	if (header === "time" && typeof val === "number") return fromSerialTime(val);
	const coerced = coerceStringValue(val);
	if (
		typeof coerced === "string" &&
		coerced.trim() !== "" &&
		NUMERIC_SHEET_FIELDS.has(header)
	) {
		const num = Number(coerced);
		return isNaN(num) ? coerced : num;
	}
	if (header === "id") return String(coerced);
	return coerced;
};

const parseDataRow = (headers: string[], row: unknown[]): any => {
	const obj: any = {};
	headers.forEach((header, index) => {
		const val = coerceSheetValue(header, row[index]);
		if (val !== undefined) obj[header] = val;
	});
	return obj;
};

const parseProfileSheet = (
	headers: string[],
	dataRows: unknown[][],
	userEmail?: string,
): any | undefined => {
	const emailIdx = headers.indexOf("email");
	if (emailIdx === -1) return undefined;
	const emailToFind = userEmail || currentUserId;
	const userRow = dataRows.find((r: any[]) => r[emailIdx] === emailToFind);
	return userRow ? parseUserRow(headers, userRow) : undefined;
};

const filterByCurrentUser = (rows: any[]): any[] =>
	rows.filter(
		(d: any) => !currentUserId || d.userId === currentUserId || !d.userId,
	);

export const loadFromGoogleSheets = async (
	userEmail?: string,
): Promise<{
	accounts: Account[];
	transactions: Transaction[];
	categories: Category[];
	goals: Goal[];
	subscriptions: Subscription[];
	pots: Pot[];
	pockets: SavingPocket[];
	chatSessions: ChatSession[];
	profile?: any;
} | null> => {
	if (!hasRequiredAuth()) return null;

	const fileId = await resolveSpreadsheetId();
	if (!fileId) return null;

	const result: any = {};

	const sheetName = await getProfileSheetName(fileId);
	const sheetNamesToLoad = [
		"Accounts",
		"Transactions",
		"Categories",
		"Goals",
		"Subscriptions",
		"Pots",
		"Pockets",
		"ChatSessions",
		sheetName,
	];

	const names = await getSheetNames(fileId);
	const existingSheets = names || [];

	const validSheets = sheetNamesToLoad.filter((s) =>
		existingSheets.includes(s),
	);
	if (validSheets.length === 0) return null;

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

			if (isProfileSheet(sheetName)) {
				result.profile = parseProfileSheet(headers, dataRows, userEmail);
				return;
			}

			result[sheetName.toLowerCase()] = filterByCurrentUser(
				dataRows.map((row: any[]) => parseDataRow(headers, row)),
			);
		});
	} catch (err: any) {
		if (err?.status === 401) {
			clearGapiAccessToken();
			throw err;
		}
		logger.warn("Batch load failed", err);
	}

	const pots = (result.pots || []).map((p: any) => migrateLegacyPot(p));

	return {
		accounts: result.accounts || [],
		transactions: result.transactions || [],
		categories: result.categories || [],
		goals: result.goals || [],
		subscriptions: result.subscriptions || [],
		pots,
		pockets: result.pockets || [],
		chatSessions: result.chatsessions || [],
		profile: result.profile,
	};
};
/**
 * Opens a Google Picker to let the user select a specific spreadsheet.
 * This is crucial for the drive.file scope to gain access to a file
 * that was not created by this app (e.g., from a previous manual sync).
 */
/**
 * Legacy function - kept for backward compatibility
 * Use GoogleDrivePicker React component instead
 * @deprecated Use GoogleDrivePicker component from @googleworkspace/drive-picker-react
 */
export const selectSpreadsheetWithPicker = async (): Promise<string | null> => {
	logger.warn(
		"selectSpreadsheetWithPicker is deprecated. Use GoogleDrivePicker component instead.",
	);

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
					logger.log("User selected spreadsheet via picker:", maskFileIdForLogging(fileId));
					// Store selected file ID to skip search next time
					localStorage.setItem("zenfinance_selected_sheet_id", fileId);
					cachedSheetName = null; // Clear cache when switching spreadsheets
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
