import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider } from "../context/DataProvider";
import { useData } from "../context/DataContext";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import * as SyncQueue from "../services/sync-queue.services";
import { Subscription, Transaction, TransactionType, UserProfile } from "../types";

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
	isClientReady: vi.fn(() => true),
	isGapiInited: () => true,
	getCurrentSpreadsheetId: vi.fn(),
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
	vi.mocked(SheetService.isClientReady).mockReturnValue(true);
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

describe("cloud configured but unavailable", () => {
	it("queues the write without attempting it when the client is not ready", async () => {
		vi.mocked(SheetService.isClientReady).mockReturnValue(false);
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(SheetService.insertOne).not.toHaveBeenCalled();
		expect(
			StorageService.getStoredTransactions().map((t) => t.id),
		).toContain("tx-1");
		expect(SyncQueue.getSyncQueue()).toMatchObject([
			{ sheet: "Transactions", op: "insert", itemId: "tx-1" },
		]);

		// Token comes back: the next sync replays the queued write.
		vi.mocked(SheetService.isClientReady).mockReturnValue(true);
		await act(async () => {
			await data.syncData();
		});
		expect(SheetService.upsertRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			expect.objectContaining({ id: "tx-1", amount: 25 }),
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});

	it("stays local-only without queueing in offline mode", async () => {
		auth.profile = { ...auth.profile, offlineMode: true };
		StorageService.saveProfile(auth.profile);
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(SheetService.insertOne).not.toHaveBeenCalled();
		expect(
			StorageService.getStoredTransactions().map((t) => t.id),
		).toContain("tx-1");
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});
});

const sub = (overrides: Partial<Subscription> = {}): Subscription => ({
	id: "sub-1",
	userId: "test-user",
	name: "Streaming",
	amount: 15,
	currency: "MYR",
	accountId: "acc-1",
	categoryId: "c1",
	nextPaymentDate: "2026-12-01",
	frequency: "MONTHLY",
	active: true,
	...overrides,
});

describe("deletes and subscription writes under cloud failure", () => {
	it("queues a transaction delete when the cloud write fails", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		vi.mocked(SheetService.deleteRow).mockRejectedValue({ status: 401 });
		await renderProvider();

		await act(async () => {
			await data.handleTransactionDelete("tx-1");
		});

		expect(data.transactions.map((t) => t.id)).not.toContain("tx-1");
		expect(StorageService.getStoredTransactions()).toEqual([]);
		expect(SyncQueue.getSyncQueue()).toMatchObject([
			{ sheet: "Transactions", op: "delete", itemId: "tx-1" },
		]);
	});

	it("queues every leg of a batch delete when the client is not ready", async () => {
		const seed = [tx(), tx({ id: "tx-2" })].map((t) => ({
			...t,
			userId: "test-user",
		}));
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify(seed),
		);
		vi.mocked(SheetService.isClientReady).mockReturnValue(false);
		await renderProvider();

		await act(async () => {
			await data.handleBatchTransactionDelete(["tx-1", "tx-2"]);
		});

		expect(SheetService.deleteRow).not.toHaveBeenCalled();
		expect(data.transactions).toEqual([]);
		const jobs = SyncQueue.getSyncQueue();
		expect(jobs.map((j) => j.itemId).sort()).toEqual(["tx-1", "tx-2"]);
		expect(jobs.every((j) => j.op === "delete")).toBe(true);
	});

	it("queues a subscription delete when the cloud write fails", async () => {
		localStorage.setItem(
			`${StorageService.KEYS.SUBSCRIPTIONS}_test-user`,
			JSON.stringify([sub()]),
		);
		vi.mocked(SheetService.deleteRow).mockRejectedValue({ status: 401 });
		await renderProvider();

		await act(async () => {
			await data.handleDeleteSubscription("sub-1");
		});

		expect(data.subscriptions).toEqual([]);
		expect(SyncQueue.getSyncQueue()).toMatchObject([
			{ sheet: "Subscriptions", op: "delete", itemId: "sub-1" },
		]);
	});

	it("queues a manual subscription add when the client is not ready", async () => {
		vi.mocked(SheetService.isClientReady).mockReturnValue(false);
		await renderProvider();

		await act(async () => {
			await data.handleAddSubscription(sub());
		});

		expect(SheetService.insertOne).not.toHaveBeenCalled();
		expect(data.subscriptions.map((s) => s.id)).toContain("sub-1");
		expect(SyncQueue.getSyncQueue()).toMatchObject([
			{ sheet: "Subscriptions", op: "insert", itemId: "sub-1" },
		]);
	});
});

describe("local-first invariant under queue storage failure", () => {
	it("saves locally even when the queue cannot be persisted", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		const original = Storage.prototype.setItem;
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
			this: Storage,
			key: string,
			value: string,
		) {
			if (key.includes("sync_queue")) throw new Error("QuotaExceededError");
			return original.call(this, key, value);
		});
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(
			StorageService.getStoredTransactions().map((t) => t.id),
		).toContain("tx-1");
		expect(data.transactions.map((t) => t.id)).toContain("tx-1");
		expect(data.toast?.type).toBe("alert");
	});
});

describe("pending job reconciliation", () => {
	it("acknowledges the pending job when a later edit reaches the cloud", async () => {
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

		vi.mocked(SheetService.upsertRow).mockResolvedValue(undefined);
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 30 }));
		});

		expect(SyncQueue.getSyncQueue()).toEqual([]);
		expect(
			StorageService.getStoredTransactions().find((t) => t.id === "tx-1")
				?.amount,
		).toBe(30);
	});

	it("supersedes a pending payload with an offline-mode edit", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		SyncQueue.enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "tx-1",
			payload: { ...existing, amount: 10 },
		});
		auth.profile = { ...auth.profile, offlineMode: true };
		StorageService.saveProfile(auth.profile);
		await renderProvider();

		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});

		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].payload.amount).toBe(20);
	});

	it("supersedes a pending upsert with an offline-mode delete", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		SyncQueue.enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "tx-1",
			payload: existing,
		});
		auth.profile = { ...auth.profile, offlineMode: true };
		StorageService.saveProfile(auth.profile);
		await renderProvider();

		await act(async () => {
			await data.handleTransactionDelete("tx-1");
		});

		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].op).toBe("delete");
	});
});

describe("acknowledgement of a delivered write", () => {
	it("reports unprotected when a successful write cannot clear the stale job", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		await renderProvider();
		// A stale job is pending; the next edit reaches the cloud and must
		// clear it. If the queue cannot be rewritten, the job survives and the
		// user must be told the write is unprotected rather than "delivered".
		SyncQueue.enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "tx-1",
			payload: { ...existing, amount: 10 },
		});
		vi.mocked(SheetService.upsertRow).mockResolvedValue(undefined);
		const original = Storage.prototype.setItem;
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
			this: Storage,
			key: string,
			value: string,
		) {
			if (key.includes("sync_queue")) throw new Error("QuotaExceededError");
			return original.call(this, key, value);
		});

		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 99 }));
		});

		expect(data.toast?.type).toBe("alert");
		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].itemId).toBe("tx-1");
	});

	it("does not clear a newer intent queued while an older write was in flight", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		await renderProvider();

		// Edit A (amount 10) hangs in the cloud; edit B (amount 20) fails and
		// queues the newer intent. When A finally succeeds it must NOT ack away
		// B's newer job — replay still owes the cloud the amount-20 version.
		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.reject({ status: 401 }),
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});
		expect(SyncQueue.getSyncQueue()).toHaveLength(1);

		await act(async () => {
			resolveA();
			await promiseA;
		});

		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({ itemId: "tx-1", op: "update" });
		expect(jobs[0].payload.amount).toBe(20);
	});
});

describe("merged sync snapshot is a local-only cache write", () => {
	it("does not fire un-awaited full-sheet saves that race the sync and replay", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		const cloudTx: Transaction = {
			...tx({ id: "tx-2", amount: 70 }),
			userId: "test-user",
			updatedAt: new Date().toISOString(),
		} as Transaction;
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ transactions: [cloudTx] }),
		);
		// Isolate the sync phase: the submit path above legitimately full-saves
		// Transactions once. Finding B is about the merge block racing the drain.
		vi.mocked(SheetService.saveToSheet).mockClear();
		await act(async () => {
			await data.syncData();
		});

		// syncWithGoogleSheets is the single authoritative cloud save. The
		// merged snapshot must only update the local cache — the per-collection
		// saveX() calls used to fire un-awaited saveToSheet writes that raced
		// the awaited sync and the queue replay. Accounts keep their own
		// awaited save path, so no other sheet may be full-saved here.
		const fullSavedSheets = vi
			.mocked(SheetService.saveToSheet)
			.mock.calls.map(([sheet]) => sheet);
		expect(fullSavedSheets.every((sheet) => sheet === "Accounts")).toBe(true);

		expect(
			StorageService.getStoredTransactions().map((t) => t.id).sort(),
		).toEqual(["tx-1", "tx-2"]);
		const savedTxs = vi.mocked(SheetService.syncWithGoogleSheets).mock
			.calls[0][1] as Transaction[];
		expect(savedTxs.map((t) => t.id).sort()).toEqual(["tx-1", "tx-2"]);
	});
});

describe("queued writes are bound to their source spreadsheet", () => {
	it("tags a queued job with the spreadsheet the failed write targeted", async () => {
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(SyncQueue.getSyncQueue()[0].spreadsheetId).toBe("sheet-A");
	});

	it("does not replay a job queued for another spreadsheet", async () => {
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		// User switches spreadsheets; the next sync targets sheet-B.
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ spreadsheetId: "sheet-B" }),
		);
		vi.mocked(SheetService.upsertRow).mockClear();
		await act(async () => {
			await data.syncData();
		});

		// The sheet-A job must not be replayed into sheet-B, and stays queued.
		expect(SheetService.upsertRow).not.toHaveBeenCalled();
		expect(SyncQueue.getSyncQueue().map((j) => j.itemId)).toEqual(["tx-1"]);
	});

	it("replays a job when syncing its own spreadsheet", async () => {
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ spreadsheetId: "sheet-A" }),
		);
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.upsertRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			expect.objectContaining({ id: "tx-1", amount: 25 }),
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});
});