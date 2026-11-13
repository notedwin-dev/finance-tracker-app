import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider } from "../context/DataProvider";
import { useData } from "../context/DataContext";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import * as SyncQueue from "../services/sync-queue.services";
import * as WriteIntent from "../services/write-intent.services";
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
	withSessionRefresh: vi.fn(async (fn: any) => fn()),
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
	WriteIntent.resetWriteIntents();
	vi.mocked(SheetService.isClientReady).mockReturnValue(true);
	vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-id");
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
			"sheet-id",
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
			"sheet-id",
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
		expect(SheetService.deleteRow).toHaveBeenCalledWith("Transactions", "tx-9", "sheet-id");
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
			"sheet-id",
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

	it("does not enqueue a stale failure or commit its older local value after a newer edit succeeded", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		await renderProvider();

		// Edit A (amount 10) hangs in the cloud; edit B (amount 20) succeeds.
		// When A finally fails it must NOT enqueue its older payload over B's
		// delivered version, nor commit amount 10 locally after B's amount 20.
		let rejectA: (err: any) => void = () => {};
		const deferredA = new Promise<void>((_, rej) => {
			rejectA = rej;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.resolve(),
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});

		await act(async () => {
			rejectA({ status: 401 });
			await promiseA;
		});

		expect(SyncQueue.getSyncQueue()).toHaveLength(0);
		const stored = StorageService.getStoredTransactions().find(
			(t) => t.id === "tx-1",
		);
		expect(stored?.amount).toBe(20);
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
		vi.mocked(SheetService.syncWithGoogleSheets).mockClear();
		await act(async () => {
			await data.syncData();
		});

		// The sheet-A job must not be replayed into sheet-B, and stays queued.
		expect(SheetService.upsertRow).not.toHaveBeenCalled();
		expect(SyncQueue.getSyncQueue().map((j) => j.itemId)).toEqual(["tx-1"]);
		// Nor may it leak into sheet-B's full save: the merge for sheet-B must
		// exclude the row still pending for sheet-A.
		const savedTxs = vi.mocked(SheetService.syncWithGoogleSheets).mock
			.calls[0][1] as Transaction[];
		expect(savedTxs.map((t) => t.id)).not.toContain("tx-1");
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
			"sheet-A",
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});

	it("stops replay when the selection changes mid-sync, keeping the job queued", async () => {
		vi.mocked(SheetService.insertOne).mockRejectedValue({ status: 401 });
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});
		expect(SyncQueue.getSyncQueue()).toHaveLength(1);

		// The sync loaded sheet-id, but the user has since selected another
		// spreadsheet. Replay must stop, not redirect the job to the new sheet.
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-other");
		vi.mocked(SheetService.upsertRow).mockClear();
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.upsertRow).not.toHaveBeenCalled();
		expect(SyncQueue.getSyncQueue().map((j) => j.itemId)).toEqual(["tx-1"]);
	});
});

describe("cloud writes recover through session refresh", () => {
	it("routes the write through withSessionRefresh and delivers without queuing", async () => {
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(SheetService.withSessionRefresh).toHaveBeenCalled();
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});
});

describe("live writes carry the captured spreadsheet target", () => {
	it("pins the insert to the target captured before the write, not the live selection", async () => {
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		// The selection flips to sheet-B after the target is captured but before
		// the write body runs (as it would on a 401 refresh-and-retry). The write
		// must still use sheet-A.
		vi.mocked(SheetService.withSessionRefresh).mockImplementationOnce(
			async (fn: any) => {
				vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
				return fn();
			},
		);
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx());
		});

		expect(SheetService.insertOne).toHaveBeenCalledWith(
			"Transactions",
			expect.objectContaining({ id: "tx-1" }),
			"sheet-A",
		);
	});

	it("pins an edit's upsert to the captured target", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 99 }));
		});

		expect(SheetService.upsertRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			expect.objectContaining({ id: "tx-1", amount: 99 }),
			"sheet-A",
		);
	});

	it("pins a delete to the captured target", async () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		await renderProvider();
		await act(async () => {
			await data.handleTransactionDelete("tx-1");
		});

		expect(SheetService.deleteRow).toHaveBeenCalledWith(
			"Transactions",
			"tx-1",
			"sheet-A",
		);
	});
});

describe("the full save is guarded by the replay target", () => {
	it("does not run the full save when the selection changed mid-sync", async () => {
		await renderProvider();
		// Load resolved sheet-id, but the user has since selected another sheet.
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-other");
		vi.mocked(SheetService.syncWithGoogleSheets).mockClear();
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
	});
});

describe("a selection change during an active sync schedules a follow-up", () => {
	it("re-syncs the newly selected spreadsheet after the active sync finishes", async () => {
		let releaseFirstLoad!: (value: any) => void;
		const firstLoad = new Promise((resolve) => {
			releaseFirstLoad = resolve;
		});
		vi.mocked(SheetService.loadFromGoogleSheets)
			.mockImplementationOnce(() => firstLoad as any)
			.mockResolvedValue(cloudData({ spreadsheetId: "sheet-B" }));

		await renderProvider();

		// Sync #1 starts and blocks on the cloud load.
		let firstSync!: Promise<void>;
		await act(async () => {
			firstSync = data.syncData();
		});

		// The user selects another spreadsheet while #1 is still in flight.
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
		await act(async () => {
			await data.syncData();
		});

		// Let #1 finish; the deferred request must trigger sync #2.
		await act(async () => {
			releaseFirstLoad(cloudData({ spreadsheetId: "sheet-id" }));
			await firstSync;
		});
		await act(async () => {});

		expect(SheetService.loadFromGoogleSheets).toHaveBeenCalledTimes(2);
	});
});

describe("the deferred follow-up sync respects offline mode", () => {
	it("does not re-sync when offline mode was enabled mid-sync", async () => {
		let releaseFirstLoad!: (value: any) => void;
		const firstLoad = new Promise((resolve) => {
			releaseFirstLoad = resolve;
		});
		vi.mocked(SheetService.loadFromGoogleSheets)
			.mockImplementationOnce(() => firstLoad as any)
			.mockResolvedValue(cloudData());

		await renderProvider();

		// Sync #1 starts and blocks on the cloud load.
		let firstSync!: Promise<void>;
		await act(async () => {
			firstSync = data.syncData();
		});

		// A follow-up is requested while #1 is still in flight...
		await act(async () => {
			await data.syncData();
		});
		// ...then the user unlinks cloud (offline mode) before #1 finishes.
		auth.profile = { ...auth.profile, offlineMode: true };
		StorageService.saveProfile(auth.profile);

		await act(async () => {
			releaseFirstLoad(cloudData());
			await firstSync;
		});
		await act(async () => {});

		// The deferred follow-up must not make cloud requests in offline mode.
		expect(SheetService.loadFromGoogleSheets).toHaveBeenCalledTimes(1);
	});
});

describe("transfer legs share one captured spreadsheet target", () => {
	it("pins both legs to the target captured before the first write", async () => {
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		// The selection flips to sheet-B while the first leg's write is in
		// flight. The partner leg must still use sheet-A, not re-capture.
		vi.mocked(SheetService.withSessionRefresh).mockImplementationOnce(
			async (fn: any) => {
				vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
				return fn();
			},
		);
		await renderProvider();
		await act(async () => {
			await data.handleTransactionSubmit(
				tx({ type: TransactionType.TRANSFER, toAccountId: "acc-2" }),
			);
		});

		const txInserts = vi
			.mocked(SheetService.insertOne)
			.mock.calls.filter(([sheet]) => sheet === "Transactions");
		expect(txInserts).toHaveLength(2);
		expect(txInserts[0][2]).toBe("sheet-A");
		expect(txInserts[1][2]).toBe("sheet-A");
	});
});

describe("delete loops share one captured spreadsheet target", () => {
	const seedTwo = () => {
		const seed = [tx(), tx({ id: "tx-2" })].map((t) => ({
			...t,
			userId: "test-user",
		}));
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify(seed),
		);
	};

	it("pins every batch deletion to the target captured before the loop", async () => {
		seedTwo();
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		// The selection flips to sheet-B while the first deletion is in flight.
		vi.mocked(SheetService.withSessionRefresh).mockImplementationOnce(
			async (fn: any) => {
				vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
				return fn();
			},
		);
		await renderProvider();
		await act(async () => {
			await data.handleBatchTransactionDelete(["tx-1", "tx-2"]);
		});

		const deletes = vi
			.mocked(SheetService.deleteRow)
			.mock.calls.filter(([sheet]) => sheet === "Transactions");
		expect(deletes).toHaveLength(2);
		expect(deletes[0][2]).toBe("sheet-A");
		expect(deletes[1][2]).toBe("sheet-A");
	});

	it("pins both legs of a single transfer delete to one captured target", async () => {
		const main = { ...tx({ type: TransactionType.TRANSFER, toAccountId: "acc-2", linkedTransactionId: "tx-2" }), userId: "test-user" };
		const partner = { ...tx({ id: "tx-2", type: TransactionType.TRANSFER, linkedTransactionId: "tx-1" }), userId: "test-user" };
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([main, partner]),
		);
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-A");
		vi.mocked(SheetService.withSessionRefresh).mockImplementationOnce(
			async (fn: any) => {
				vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-B");
				return fn();
			},
		);
		await renderProvider();
		await act(async () => {
			await data.handleTransactionDelete("tx-1");
		});

		const deletes = vi
			.mocked(SheetService.deleteRow)
			.mock.calls.filter(([sheet]) => sheet === "Transactions");
		expect(deletes).toHaveLength(2);
		expect(deletes[0][2]).toBe("sheet-A");
		expect(deletes[1][2]).toBe("sheet-A");
	});
});

describe("a stale older write that succeeds last is reconciled", () => {
	const seedExisting = () => {
		const existing: Transaction = { ...tx(), userId: "test-user" } as Transaction;
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([existing]),
		);
	};

	it("re-delivers the newer payload after the stale success overwrites it", async () => {
		seedExisting();
		await renderProvider();

		// Edit A (amount 10) hangs in the cloud; edit B (amount 20) is delivered.
		// When A finally succeeds it overwrites B's row in Sheets — the flow must
		// re-deliver the latest intent so the cloud does not keep amount 10.
		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.resolve(),
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});

		await act(async () => {
			resolveA();
			await promiseA;
		});

		const writes = vi
			.mocked(SheetService.upsertRow)
			.mock.calls.filter(
				([sheet, id]) => sheet === "Transactions" && id === "tx-1",
			);
		// B delivered, then the stale A landed, then reconciliation re-delivered
		// B. Without the reconcile step the stale write is the last one.
		expect(writes).toHaveLength(3);
		expect(writes[writes.length - 1][2].amount).toBe(20);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
		expect(
			StorageService.getStoredTransactions().find((t) => t.id === "tx-1")
				?.amount,
		).toBe(20);
	});

	it("re-deletes the row when a stale upsert succeeds after a delivered delete", async () => {
		seedExisting();
		await renderProvider();

		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.resolve(),
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionDelete("tx-1");
		});

		await act(async () => {
			resolveA();
			await promiseA;
		});

		// The stale upsert resurrected the row; reconciliation must delete it
		// again so the delivered delete stays effective in the cloud.
		expect(SheetService.deleteRow).toHaveBeenCalledTimes(2);
		expect(SheetService.deleteRow).toHaveBeenLastCalledWith(
			"Transactions",
			"tx-1",
			"sheet-id",
		);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
		expect(StorageService.getStoredTransactions()).toEqual([]);
	});

	it("queues the latest intent when the reconciliation write fails", async () => {
		seedExisting();
		await renderProvider();

		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.resolve(),
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});

		// Cloud dies again before the stale write lands: the reconciliation
		// must fall back to the queue with the NEWER payload, not the stale one.
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.reject({ status: 401 }),
		);
		await act(async () => {
			resolveA();
			await promiseA;
		});

		const jobs = SyncQueue.getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			sheet: "Transactions",
			op: "update",
			itemId: "tx-1",
		});
		expect(jobs[0].payload.amount).toBe(20);
	});

	it("re-delivers a newer intent that lands while the reconciliation is in flight", async () => {
		seedExisting();
		await renderProvider();

		// A (10) hangs; B (20) is delivered; A lands stale and starts reconciling
		// B, but that reconciliation write hangs too. C (30) is delivered while
		// the reconciliation is in flight. When the stale reconciliation finally
		// completes it must not leave B's 20 over C's newer 30 in the cloud.
		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		let resolveReconcile: () => void = () => {};
		const deferredReconcile = new Promise<void>((res) => {
			resolveReconcile = res;
		});

		const completions: number[] = [];
		let amount20Calls = 0;
		vi.mocked(SheetService.upsertRow).mockImplementation(
			async (_sheet: string, _id: string, item: any) => {
				if (item.amount === 10) await deferredA;
				else if (item.amount === 20) {
					amount20Calls += 1;
					// The second amount-20 write is the reconciliation re-delivery.
					if (amount20Calls === 2) await deferredReconcile;
				}
				completions.push(item.amount);
			},
		);

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(tx({ amount: 10 }));
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 20 }));
		});
		await act(async () => {
			resolveA();
		});
		await act(async () => {
			await data.handleTransactionSubmit(tx({ amount: 30 }));
		});
		await act(async () => {
			resolveReconcile();
			await promiseA;
		});

		// Completion order: B(20), stale A(10), C(30), stale reconcile(20),
		// re-reconcile(30). The cloud must end on C's 30, not the reconcile's 20.
		expect(completions).toHaveLength(5);
		expect(completions[completions.length - 1]).toBe(30);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
		expect(
			StorageService.getStoredTransactions().find((t) => t.id === "tx-1")
				?.amount,
		).toBe(30);
	});
});

describe("a superseded submit does not write a stale partner leg", () => {
	const seedTransfer = () => {
		const main = {
			...tx({
				type: TransactionType.TRANSFER,
				toAccountId: "acc-2",
				linkedTransactionId: "tx-2",
			}),
			userId: "test-user",
		};
		const partner = {
			...tx({
				id: "tx-2",
				type: TransactionType.TRANSFER,
				accountId: "acc-2",
				toAccountId: "acc-1",
				linkedTransactionId: "tx-1",
				transferDirection: "IN",
			}),
			userId: "test-user",
		};
		localStorage.setItem(
			`${StorageService.KEYS.TRANSACTIONS}_test-user`,
			JSON.stringify([main, partner]),
		);
	};

	it("skips the stale partner cloud write when the main submit is superseded", async () => {
		seedTransfer();
		await renderProvider();

		// Edit A (10) hangs on the main leg; edit B (20) delivers both legs.
		// When A's main finally lands it is superseded, so A's partner leg must
		// not overwrite B's newer partner row in the cloud.
		let resolveA: () => void = () => {};
		const deferredA = new Promise<void>((res) => {
			resolveA = res;
		});
		vi.mocked(SheetService.upsertRow).mockImplementation(
			(_sheet: string, _id: string, item: any) =>
				item.amount === 10 ? deferredA : Promise.resolve(),
		);

		const edit = (amount: number) =>
			tx({
				amount,
				type: TransactionType.TRANSFER,
				toAccountId: "acc-2",
				linkedTransactionId: "tx-2",
			});

		let promiseA: Promise<void>;
		await act(async () => {
			promiseA = data.handleTransactionSubmit(edit(10));
		});
		await act(async () => {
			await data.handleTransactionSubmit(edit(20));
		});
		await act(async () => {
			resolveA();
			await promiseA;
		});

		const partnerWrites = vi
			.mocked(SheetService.upsertRow)
			.mock.calls.filter(
				([sheet, id]) => sheet === "Transactions" && id === "tx-2",
			);
		// Only B's partner leg (20) reaches the cloud; A's stale partner (10)
		// is abandoned because the main submit was superseded.
		expect(partnerWrites).toHaveLength(1);
		expect(partnerWrites[0][2].amount).toBe(20);
		expect(SyncQueue.getSyncQueue()).toEqual([]);
	});
});