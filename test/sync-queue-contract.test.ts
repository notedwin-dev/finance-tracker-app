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