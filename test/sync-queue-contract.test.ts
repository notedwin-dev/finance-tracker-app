import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as SheetService from "../services/sheets.services";
import {
	enqueueSyncJob,
	drainSyncQueue,
} from "../services/sync-queue.services";

// Contract tests: the queue's retry guarantee depends on the real writers
// rejecting when the cloud is unreachable. A silent resolve would dequeue
// jobs that were never delivered.

const installGapi = (overrides: {
	driveList?: () => Promise<unknown>;
	create?: () => Promise<unknown>;
} = {}) => {
	(window as any).gapi = {
		load: (_names: string, cb: () => void) => cb(),
		client: {
			setToken: () => {},
			init: async () => {},
			sheets: {
				spreadsheets: {
					get: async () => ({
						result: {
							sheets: [{ properties: { title: "Transactions", sheetId: 0 } }],
						},
					}),
					batchUpdate: async () => ({ result: {} }),
					create:
						overrides.create ??
						(async () => ({ result: { spreadsheetId: "sheet-1" } })),
					values: {
						get: async () => ({ result: { values: [["id"], ["t1"]] } }),
						update: async () => ({ result: {} }),
						batchUpdate: async () => ({ result: {} }),
					},
				},
			},
			drive: {
				files: {
					get: async () => ({ result: { id: "sheet-1" } }),
					list:
						overrides.driveList ??
						(async () => ({
							result: { files: [{ id: "sheet-1", name: "ZenFinance Data" }] },
						})),
				},
			},
		},
	};
};

const unreachableDrive = {
	driveList: async () => {
		throw { status: 500 };
	},
	create: async () => {
		throw { status: 500 };
	},
};

beforeEach(async () => {
	localStorage.clear();
	vi.stubEnv("VITE_GOOGLE_API_KEY", "test-api-key");
	installGapi();
	await SheetService.initGapiClient();
	SheetService.setGapiAccessToken("live-token", 3600);
	localStorage.setItem("zenfinance_selected_sheet_id", "sheet-1");
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

describe("row writer failure contract", () => {
	it("upsertRow rejects when the access token is gone", async () => {
		SheetService.clearGapiAccessToken();
		await expect(
			SheetService.upsertRow("Transactions", "t1", { id: "t1" }),
		).rejects.toThrow();
	});

	it("deleteRow rejects when the access token is gone", async () => {
		SheetService.clearGapiAccessToken();
		await expect(SheetService.deleteRow("Transactions", "t1")).rejects.toThrow();
	});

	it("upsertRow rejects when the spreadsheet cannot be resolved", async () => {
		localStorage.removeItem("zenfinance_selected_sheet_id");
		installGapi(unreachableDrive);
		await expect(
			SheetService.upsertRow("Transactions", "t1", { id: "t1" }),
		).rejects.toThrow();
	});

	it("deleteRow rejects when the spreadsheet cannot be resolved", async () => {
		localStorage.removeItem("zenfinance_selected_sheet_id");
		installGapi(unreachableDrive);
		await expect(SheetService.deleteRow("Transactions", "t1")).rejects.toThrow();
	});

	it("keeps the fire-and-forget wrappers non-throwing", async () => {
		SheetService.clearGapiAccessToken();
		await expect(
			SheetService.updateOne("Transactions", "t1", { id: "t1" }),
		).resolves.toBeUndefined();
		await expect(
			SheetService.deleteOne("Transactions", "t1"),
		).resolves.toBeUndefined();
	});
});

describe("drain against the real writers", () => {
	it("keeps queued jobs when the live writers cannot reach the cloud", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: { id: "t1", amount: 10 },
		});
		SheetService.clearGapiAccessToken();

		const result = await drainSyncQueue({
			upsert: (sheet, item) => SheetService.upsertRow(sheet, item.id, item),
			remove: (sheet, id) => SheetService.deleteRow(sheet, id),
		});

		expect(result).toEqual({ processed: 0, remaining: 1 });
	});
});

describe("getCurrentSpreadsheetId", () => {
	it("reflects a new selection immediately, before the next resolution", () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-new");
		expect(SheetService.getCurrentSpreadsheetId()).toBe("sheet-new");
	});

	it("falls back to the last resolved spreadsheet when none is selected", async () => {
		localStorage.removeItem("zenfinance_selected_sheet_id");
		await SheetService.upsertRow("Transactions", "t1", { id: "t1" });
		expect(SheetService.getCurrentSpreadsheetId()).toBe("sheet-1");
	});

	it("falls back to the last resolved id when the selection read throws", async () => {
		localStorage.removeItem("zenfinance_selected_sheet_id");
		await SheetService.upsertRow("Transactions", "t1", { id: "t1" });
		const original = Storage.prototype.getItem;
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
			this: Storage,
			key: string,
		) {
			if (key === "zenfinance_selected_sheet_id")
				throw new Error("SecurityError");
			return original.call(this, key);
		});
		expect(SheetService.getCurrentSpreadsheetId()).toBe("sheet-1");
	});
});

describe("withSessionRefresh", () => {
	it("retries a 401 write once after a silent refresh", async () => {
		SheetService.setAuthRefreshHandler(async () => "fresh-token");
		let calls = 0;
		const result = await SheetService.withSessionRefresh(async () => {
			calls += 1;
			if (calls === 1) throw { status: 401 };
			return "delivered";
		});
		expect(result).toBe("delivered");
		expect(calls).toBe(2);
	});

	it("clears the token and rethrows when the refresh cannot recover", async () => {
		SheetService.setAuthRefreshHandler(async () => null);
		await expect(
			SheetService.withSessionRefresh(async () => {
				throw { status: 401 };
			}),
		).rejects.toMatchObject({ status: 401 });
		expect(SheetService.isClientReady()).toBe(false);
	});
});

describe("row writers honor a pinned spreadsheet", () => {
	it("upsertRow targets the pinned id instead of re-resolving the selection", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-current");
		const get = vi.fn(async () => ({ result: { values: [["id"], ["t1"]] } }));
		(window as any).gapi.client.sheets.spreadsheets.values.get = get;

		await SheetService.upsertRow("Transactions", "t1", { id: "t1" }, "sheet-pinned");

		expect(get).toHaveBeenCalledWith(
			expect.objectContaining({ spreadsheetId: "sheet-pinned" }),
		);
	});

	it("deleteRow targets the pinned id instead of re-resolving the selection", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-current");
		const getMeta = vi.fn(async () => ({
			result: { sheets: [{ properties: { title: "Transactions", sheetId: 0 } }] },
		}));
		(window as any).gapi.client.sheets.spreadsheets.get = getMeta;

		await SheetService.deleteRow("Transactions", "t1", "sheet-pinned");

		expect(getMeta).toHaveBeenCalledWith(
			expect.objectContaining({ spreadsheetId: "sheet-pinned" }),
		);
	});
});

describe("upsertRow insert fallbacks honor the pinned spreadsheet", () => {
	it("pins the row-missing insert fallback to the target id", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-current");
		// Headers exist but t1 is absent, so upsertRow falls back to insertOne.
		const get = vi.fn(async () => ({ result: { values: [["id"], ["other"]] } }));
		const append = vi.fn(async () => ({ result: {} }));
		(window as any).gapi.client.sheets.spreadsheets.values.get = get;
		(window as any).gapi.client.sheets.spreadsheets.values.append = append;

		await SheetService.upsertRow("Transactions", "t1", { id: "t1" }, "sheet-pinned");

		expect(append).toHaveBeenCalledWith(
			expect.objectContaining({ spreadsheetId: "sheet-pinned" }),
		);
	});

	it("pins the no-id-column insert fallback to the target id", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-current");
		const get = vi.fn(async () => ({ result: { values: [["name"]] } }));
		const append = vi.fn(async () => ({ result: {} }));
		(window as any).gapi.client.sheets.spreadsheets.values.get = get;
		(window as any).gapi.client.sheets.spreadsheets.values.append = append;

		await SheetService.upsertRow("Transactions", "t1", { id: "t1" }, "sheet-pinned");

		expect(append).toHaveBeenCalledWith(
			expect.objectContaining({ spreadsheetId: "sheet-pinned" }),
		);
	});

	it("pins the sheet-initialization saveToSheet fallback to the target id", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "sheet-current");
		// No headers at all: upsertRow -> insertOne -> saveToSheet initializes.
		const get = vi.fn(async () => ({ result: { values: [] } }));
		const update = vi.fn(async () => ({ result: {} }));
		(window as any).gapi.client.sheets.spreadsheets.values.get = get;
		(window as any).gapi.client.sheets.spreadsheets.values.update = update;

		await SheetService.upsertRow("Transactions", "t1", { id: "t1" }, "sheet-pinned");

		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({ spreadsheetId: "sheet-pinned" }),
		);
	});
});