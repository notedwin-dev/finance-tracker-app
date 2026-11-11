import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider } from "../context/DataProvider";
import { useData } from "../context/DataContext";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import * as SyncQueue from "../services/sync-queue.services";
import { Transaction, TransactionType, UserProfile } from "../types";

const auth = vi.hoisted(() => ({
	profile: {} as UserProfile,
	isInitialized: false,
	updateProfile: vi.fn(),
	loginWithGoogle: vi.fn(),
}));

vi.mock("../services/auth.services", () => ({ useAuth: () => auth }));
vi.mock("../services/exchange.services", () => ({
	getUSDToMYRRate: async () => ({ rate: 4.45 }),
}));
vi.mock("../services/coin.services", () => ({
	getCryptoPrices: async () => ({ BTC: 65000, ETH: 3500 }),
}));
vi.mock("../services/sheets.services", () => ({
	isClientReady: () => true,
	isGapiInited: () => true,
	setSheetUser: vi.fn(),
	initGapiClient: vi.fn(async () => {}),
	setGapiAccessToken: vi.fn(),
	loadFromGoogleSheets: vi.fn(),
	syncWithGoogleSheets: vi.fn(async () => {}),
	saveToSheet: vi.fn(async () => {}),
	insertOne: vi.fn(async () => {}),
	updateOne: vi.fn(async () => {}),
	deleteOne: vi.fn(async () => {}),
	upsertRow: vi.fn(async () => {}),
	deleteRow: vi.fn(async () => {}),
	insertMany: vi.fn(async () => {}),
	updateMany: vi.fn(async () => {}),
}));

const tx = (
	overrides: Partial<Transaction> = {},
): Omit<Transaction, "userId"> => ({
	id: "tx-1",
	accountId: "acc-1",
	amount: 25,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	shopName: "Cloud Failure Cafe",
	date: "2026-11-11",
	createdAt: "2026-11-11T00:00:00.000Z",
	...overrides,
});

const cloudData = (overrides: Record<string, unknown> = {}) => ({
	accounts: [],
	transactions: [],
	categories: [],
	goals: [],
	subscriptions: [],
	pots: [],
	pockets: [],
	chatSessions: [],
	spreadsheetId: "sheet-id",
	...overrides,
});

let root: Root;
let data: ReturnType<typeof useData>;
const Capture = () => {
	data = useData();
	return null;
};

const renderProvider = async () => {
	await act(async () => {
		root.render(
			<DataProvider>
				<Capture />
			</DataProvider>,
		);
	});
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	localStorage.clear();
	auth.profile = {
		id: "test-user",
		name: "Test",
		email: "test@example.invalid",
		isLoggedIn: true,
	};
	StorageService.saveProfile(auth.profile);
	vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(cloudData());
	root = createRoot(document.createElement("div"));
});

afterEach(async () => {
	await act(async () => {
		root.unmount();
	});
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	localStorage.clear();
});

describe("transaction creation under cloud failure", () => {
	it("saves locally and queues the cloud write when the insert fails", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(StorageService.getStoredTransactions().map((t) => t.id)).toContain(
			"tx-1",
		);
		expect(data.transactions.map((t) => t.id)).toContain("tx-1");
		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			sheet: "Transactions",
			op: "insert",
			itemId: "tx-1",
		});
		expect(jobs[0].payload.amount).toBe(25);
	});

	it("queues both legs of a transfer when the cloud is down", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(
				tx({ type: TransactionType.TRANSFER, toAccountId: "acc-2" }),
			);
		});

		expect(data.transactions).toHaveLength(2);
		expect(StorageService.getStoredTransactions()).toHaveLength(2);
		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(2);
		expect(jobs.every((j) => j.sheet === "Transactions" && j.op === "insert")).toBe(
			true,
		);
		expect(jobs.map((j) => j.itemId)).toContain("tx-1");
	});

	it("saves an edit locally and queues it when the cloud update fails", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		vi.mocked(SheetService.upsertRow).mockRejectedValue({ status: 401 });
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 99 }));
		});

		expect(
			StorageService.getStoredTransactions().find((t) => t.id === "tx-1")?.amount,
		).toBe(99);
		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			sheet: "Transactions",
			op: "update",
			itemId: "tx-1",
		});
		expect(jobs[0].payload.amount).toBe(99);
	});
});

describe("queued writes replay after recovery", () => {
	it("drains the queue through upserts once a sync succeeds", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});
		expect(SyncQueue.getSyncQueue()).toHaveLength(1);

		// Cloud recovers: the next full sync succeeds and replays the queue.
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.syncWithGoogleSheets).toHaveBeenCalled();
		expect(SheetService.upsertRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			expect.objectContaining({ id: "tx-1", amount: 25 }),
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});

	it("keeps queued jobs when the sync itself fails", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(null);
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.upsertRow).not.toHaveBeenCalled();
		expect(SyncQueue.getSyncQueue()).toHaveLength(1);
	});
});

describe("pending local writes survive cloud sync", () => {
	it("keeps an offline-created transaction when the cloud brings newer items", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		// Another device synced a newer transaction while this one was offline.
		const cloudTx: Transaction = {
			...tx({ id: "tx-2", amount: 70 }),
			userId: "test-user",
			updatedAt: new Date().toISOString(),
		} as Transaction;
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ transactions: [cloudTx] }),
		);
		await act(async () => {
			await data.syncData();
		});

		expect(data.transactions.map((t) => t.id).sort()).toEqual(["tx-1", "tx-2"]);
		expect(
			StorageService.getStoredTransactions().map((t) => t.id).sort(),
		).toEqual(["tx-1", "tx-2"]);
		const savedTxs = vi.mocked(SheetService.syncWithGoogleSheets).mock
			.calls[0][1] as Transaction[];
		expect(savedTxs.map((t) => t.id).sort()).toEqual(["tx-1", "tx-2"]);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});

	it("does not let a newer cloud version overwrite a queued local edit", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		vi.mocked(SheetService.upsertRow).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 99 }));
		});
		expect(SyncQueue.getSyncQueue()).toHaveLength(1);

		// Cloud recovers, but another device's newer version of the same row
		// must not clobber the edit still pending in the queue.
		vi.mocked(SheetService.upsertRow).mockResolvedValue(undefined);
		const cloudTx: Transaction = {
			...tx({ amount: 50 }),
			userId: "test-user",
			updatedAt: new Date().toISOString(),
		} as Transaction;
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ transactions: [cloudTx] }),
		);
		await act(async () => {
			await data.syncData();
		});

		expect(
			data.transactions.find((t) => t.id === "tx-1")?.amount,
		).toBe(99);
		expect(
			StorageService.getStoredTransactions().find((t) => t.id === "tx-1")
				?.amount,
		).toBe(99);
		const savedTxs = vi.mocked(SheetService.syncWithGoogleSheets).mock
			.calls[0][1] as Transaction[];
		expect(savedTxs.find((t) => t.id === "tx-1")?.amount).toBe(99);
		expect(SheetService.upsertRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			expect.objectContaining({ id: "tx-1", amount: 99 }),
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});

	it("applies a queued delete instead of resurrecting the cloud row", async () => {
		await renderProvider();
		SyncQueue.enqueueSyncJob({
			sheet: "Transactions",
			op: "delete",
			itemId: "tx-9",
		});

		const cloudTx: Transaction = {
			...tx({ id: "tx-9" }),
			userId: "test-user",
			updatedAt: new Date().toISOString(),
		} as Transaction;
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ transactions: [cloudTx] }),
		);
		await act(async () => {
			await data.syncData();
		});

		expect(data.transactions.map((t) => t.id)).not.toContain("tx-9");
		const savedTxs = vi.mocked(SheetService.syncWithGoogleSheets).mock
			.calls[0][1] as Transaction[];
		expect(savedTxs.map((t) => t.id)).not.toContain("tx-9");
		expect(SheetService.deleteRow).toHaveBeenCalledWith("Transactions", "tx-9");
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});
});