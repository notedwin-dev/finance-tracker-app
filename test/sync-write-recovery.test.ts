import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as SheetService from "../services/sheets.services";
import { Transaction, TransactionType } from "../types";

const TABS = [
	"Accounts",
	"Transactions",
	"Categories",
	"Goals",
	"Subscriptions",
	"Pots",
	"Pockets",
	"ChatSessions",
];

const row: Transaction = {
	id: "t1",
	userId: "user-1",
	accountId: "a1",
	amount: 10,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	shopName: "Test Shop",
	date: "2026-11-11",
	createdAt: "2026-11-11T00:00:00.000Z",
};

let currentToken: string | null = null;
let updateMock: ReturnType<typeof vi.fn>;
let refreshHandler: ReturnType<typeof vi.fn>;

const installGapi = (
	updateImpl: (token: string | null) => Promise<unknown>,
) => {
	currentToken = null;
	updateMock = vi.fn(async () => updateImpl(currentToken));
	(window as any).gapi = {
		load: (_names: string, cb: () => void) => cb(),
		client: {
			setToken: (token: { access_token: string } | null) => {
				currentToken = token?.access_token ?? null;
			},
			init: async () => {},
			sheets: {
				spreadsheets: {
					get: async () => ({
						result: {
							sheets: TABS.map((title) => ({ properties: { title } })),
						},
					}),
					batchUpdate: async () => ({ result: {} }),
					values: {
						get: async () => ({ result: {} }),
						update: updateMock,
						clear: async () => ({ result: {} }),
					},
				},
			},
			drive: {
				files: {
					get: async () => ({ result: { id: "sheet-1" } }),
					list: async () => ({
						result: { files: [{ id: "sheet-1", name: "ZenFinance Data" }] },
					}),
				},
			},
		},
	};
};

// The stale token is dead server-side; any refreshed token works. Keying
// the 401 off the token (not call order) keeps concurrent saves honest.
const staleTokenUpdate = async (token: string | null) => {
	if (token === "stale-token") throw { status: 401 };
	return { result: {} };
};

beforeEach(async () => {
	localStorage.clear();
	vi.stubEnv("VITE_GOOGLE_API_KEY", "test-api-key");
	installGapi(staleTokenUpdate);
	await SheetService.initGapiClient();
	SheetService.setGapiAccessToken("stale-token", 3600);
	localStorage.setItem("google_access_token", "stale-token");
	localStorage.setItem("zenfinance_selected_sheet_id", "sheet-1");
	// Mirrors auth.services refreshAccessToken: new token into the client
	// and into storage.
	refreshHandler = vi.fn(async () => {
		SheetService.setGapiAccessToken("fresh-token", 3600);
		localStorage.setItem("google_access_token", "fresh-token");
		return "fresh-token";
	});
	SheetService.setAuthRefreshHandler(refreshHandler);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	SheetService.setAuthRefreshHandler(null);
	SheetService.clearGapiAccessToken();
	delete (window as any).gapi;
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	localStorage.clear();
});

describe("saveToSheet session recovery", () => {
	it("retries a 401 write after a silent refresh instead of failing the sync", async () => {
		await SheetService.saveToSheet("Transactions", [row]);

		expect(refreshHandler).toHaveBeenCalledTimes(1);
		expect(updateMock).toHaveBeenCalledTimes(2);
		expect(localStorage.getItem("google_access_token")).toBe("fresh-token");
		expect(SheetService.isClientReady()).toBe(true);
	});

	it("does not refresh on a successful write", async () => {
		installGapi(async () => ({ result: {} }));

		await SheetService.saveToSheet("Transactions", [row]);

		expect(refreshHandler).not.toHaveBeenCalled();
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("clears the session and rethrows when silent refresh fails", async () => {
		refreshHandler.mockResolvedValue(null);

		await expect(
			SheetService.saveToSheet("Transactions", [row]),
		).rejects.toMatchObject({ status: 401 });

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem("google_access_token")).toBeNull();
		expect(SheetService.isClientReady()).toBe(false);
	});

	it("clears the session when the refreshed retry still 401s", async () => {
		installGapi(async () => {
			throw { status: 401 };
		});

		await expect(
			SheetService.saveToSheet("Transactions", [row]),
		).rejects.toMatchObject({ status: 401 });

		expect(refreshHandler).toHaveBeenCalledTimes(1);
		expect(updateMock).toHaveBeenCalledTimes(2);
		expect(localStorage.getItem("google_access_token")).toBeNull();
	});

	it("rethrows non-401 write errors without refreshing or clearing", async () => {
		installGapi(async () => {
			throw { status: 500 };
		});

		await expect(
			SheetService.saveToSheet("Transactions", [row]),
		).rejects.toMatchObject({ status: 500 });

		expect(refreshHandler).not.toHaveBeenCalled();
		expect(localStorage.getItem("google_access_token")).toBe("stale-token");
	});

	it("keeps the session when the refresh fails transiently", async () => {
		refreshHandler.mockRejectedValue(new Error("network down"));

		await expect(
			SheetService.saveToSheet("Transactions", [row]),
		).rejects.toMatchObject({ status: 401 });

		expect(localStorage.getItem("google_access_token")).toBe("stale-token");
		expect(SheetService.isClientReady()).toBe(true);
	});
});

describe("syncWithGoogleSheets concurrent writes", () => {
	it("shares a single refresh across tabs when the token dies mid-sync", async () => {
		refreshHandler.mockImplementation(async () => {
			// Hold the refresh open so every concurrent tab reaches its 401
			// while the refresh is still in flight.
			await new Promise((r) => setTimeout(r, 10));
			SheetService.setGapiAccessToken("fresh-token", 3600);
			localStorage.setItem("google_access_token", "fresh-token");
			return "fresh-token";
		});

		await SheetService.syncWithGoogleSheets(
			undefined,
			[row],
			[
				{
					id: "c1",
					userId: "user-1",
					name: "Food",
					icon: "F",
					budgetLimit: 0,
					color: "#fff",
				},
			],
			[
				{
					id: "g1",
					userId: "user-1",
					name: "Emergency",
					targetAmount: 1000,
					currentAmount: 0,
					currency: "MYR",
					type: "SHORT_TERM",
					color: "#fff",
					icon: "G",
				},
			],
		);

		expect(refreshHandler).toHaveBeenCalledTimes(1);
		const ranges = updateMock.mock.calls.map((call) => call[0].range);
		for (const tab of ["Transactions", "Categories", "Goals"]) {
			expect(
				ranges.some((r: string) => r.startsWith(`'${tab}'!A1`)),
			).toBe(true);
		}
		expect(localStorage.getItem("google_access_token")).toBe("fresh-token");
	});
});

describe("syncWithGoogleSheets full-save pinning", () => {
	it("pins every full-save task and refresh retry to the passed spreadsheet id", async () => {
		refreshHandler.mockImplementation(async () => {
			// Hold open so every concurrent tab hits its 401 first, then flip
			// the live selection: pinned retries must ignore the new selection.
			await new Promise((r) => setTimeout(r, 10));
			localStorage.setItem("zenfinance_selected_sheet_id", "sheet-other");
			SheetService.setGapiAccessToken("fresh-token", 3600);
			localStorage.setItem("google_access_token", "fresh-token");
			return "fresh-token";
		});

		await SheetService.syncWithGoogleSheets(
			undefined,
			[row],
			[
				{
					id: "c1",
					userId: "user-1",
					name: "Food",
					icon: "F",
					budgetLimit: 0,
					color: "#fff",
				},
			],
			[
				{
					id: "g1",
					userId: "user-1",
					name: "Emergency",
					targetAmount: 1000,
					currentAmount: 0,
					currency: "MYR",
					type: "SHORT_TERM",
					color: "#fff",
					icon: "G",
				},
			],
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			"sheet-1",
		);

		expect(refreshHandler).toHaveBeenCalledTimes(1);
		const ids = updateMock.mock.calls.map((call) => call[0].spreadsheetId);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(id).toBe("sheet-1");
	});
});

describe("updateUser pinning", () => {
	it("writes to the pinned spreadsheet id, not the live selection", async () => {
		installGapi(async () => ({ result: {} }));
		(window as any).gapi.client.sheets.spreadsheets.values.get = async ({
			range,
		}: any) =>
			range.startsWith("'Profile'")
				? {
						result: {
							values: [
								["email", "name"],
								["u@example.invalid", "Old"],
							],
						},
					}
				: { result: {} };
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-other");

		const ok = await SheetService.updateUser(
			"u@example.invalid",
			{ name: "New" },
			"sheet-pinned",
		);

		expect(ok).toBe(true);
		const write = updateMock.mock.calls.find((call) =>
			call[0].range.startsWith("'Profile'!A2"),
		);
		expect(write?.[0].spreadsheetId).toBe("sheet-pinned");
	});
});