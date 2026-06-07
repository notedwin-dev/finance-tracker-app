import { Account, Transaction, Category, Goal, Subscription, Pot, SavingPocket, ChatSession } from "../types";
import { hasRequiredAuth, resolveSpreadsheetId, getProfileSheetName, getSheetNames, isProfileSheet, parseDataRow, parseProfileSheet, filterByCurrentUser, clearGapiAccessToken } from "./sheets.services";
import { logger } from "../src/lib/infrastructure/logger";
import { migrateLegacyPot } from "../src/lib/domain/pot-migration";

type SheetResult = {
	accounts: Account[];
	transactions: Transaction[];
	categories: Category[];
	goals: Goal[];
	subscriptions: Subscription[];
	pots: Pot[];
	pockets: SavingPocket[];
	chatSessions: ChatSession[];
	profile?: any;
};

type RawSheetRow = string[];

type ValueRange = {
	values?: RawSheetRow[];
};

const STANDARD_SHEETS = [
	"Accounts",
	"Transactions",
	"Categories",
	"Goals",
	"Subscriptions",
	"Pots",
	"Pockets",
	"ChatSessions",
] as const;

const STANDARD_RANGE = (s: string): string => `'${s}'!A:Z`;

const buildSheetRanges = (sheets: string[]): string[] =>
	sheets.map(STANDARD_RANGE);

const populateSheetResult = (
	sheetName: string,
	valueRanges: ValueRange[],
	rangeIndex: number,
	userEmail: string | undefined,
	result: Record<string, unknown>,
): void => {
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
		dataRows.map((row: RawSheetRow) => parseDataRow(headers, row)),
	);
};

const fetchSheetData = async (
	fileId: string,
	validSheets: string[],
): Promise<ValueRange[]> => {
	const response =
		await window.gapi.client.sheets.spreadsheets.values.batchGet({
			spreadsheetId: fileId,
			ranges: buildSheetRanges(validSheets),
			valueRenderOption: "UNFORMATTED_VALUE",
		});
	return response.result.valueRanges || [];
};

const handleBatchError = (err: unknown): never | void => {
	if ((err as { status?: number })?.status === 401) {
		clearGapiAccessToken();
		throw err;
	}
	logger.warn("Batch load failed", err);
};

const mergePotsMigrated = (result: Record<string, unknown>): Pot[] =>
	((result.pots as Pot[]) || []).map((p) =>
		migrateLegacyPot(p as unknown as Record<string, unknown>),
	);

export const loadFromGoogleSheets = async (
	userEmail?: string,
): Promise<SheetResult | null> => {
	if (!hasRequiredAuth()) return null;

	const fileId = await resolveSpreadsheetId();
	if (!fileId) return null;

	const sheetName = await getProfileSheetName(fileId);
	const sheetNamesToLoad = [...STANDARD_SHEETS, sheetName];
	const names = await getSheetNames(fileId);
	const existingSheets = names || [];

	const validSheets = sheetNamesToLoad.filter((s) =>
		existingSheets.includes(s),
	);
	if (validSheets.length === 0) return null;

	const result: Record<string, unknown> = {};

	try {
		const valueRanges = await fetchSheetData(fileId, validSheets);
		validSheets.forEach((sheet, rangeIndex) => {
			populateSheetResult(sheet, valueRanges, rangeIndex, userEmail, result);
		});
	} catch (err) {
		handleBatchError(err);
	}

	const pots = mergePotsMigrated(result);

	return {
		accounts: (result.accounts as Account[]) || [],
		transactions: (result.transactions as Transaction[]) || [],
		categories: (result.categories as Category[]) || [],
		goals: (result.goals as Goal[]) || [],
		subscriptions: (result.subscriptions as Subscription[]) || [],
		pots,
		pockets: (result.pockets as SavingPocket[]) || [],
		chatSessions: (result.chatsessions as ChatSession[]) || [],
		profile: result.profile,
	};
};
