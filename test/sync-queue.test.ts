import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	enqueueSyncJob,
	getSyncQueue,
	clearSyncQueue,
	drainSyncQueue,
	applyPendingJobs,
	removeSyncJob,
	hasSyncJob,
	getSyncJob,
} from "../services/sync-queue.services";
import { KEYS } from "../services/storage.services";

const txPayload = (id: string, amount: number) => ({ id, amount });

beforeEach(() => {
	localStorage.clear();
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	localStorage.clear();
});

describe("sync queue persistence", () => {
	it("persists enqueued jobs for later reads", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});

		const jobs = getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0]).toMatchObject({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: { id: "t1", amount: 10 },
		});
		expect(jobs[0].createdAt).toBeGreaterThan(0);
	});

	it("scopes the queue to the logged-in user", () => {
		localStorage.setItem(
			KEYS.PROFILE,
			JSON.stringify({ id: "u1", isLoggedIn: true }),
		);

		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});

		expect(localStorage.getItem("zenfinance_sync_queue_v1_u1")).not.toBeNull();
		expect(getSyncQueue()).toHaveLength(1);
	});

	it("clears the queue", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		clearSyncQueue();
		expect(getSyncQueue()).toEqual([]);
	});
});

describe("sync queue coalescing", () => {
	it("keeps only the latest op and payload for the same item", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 20),
		});

		const jobs = getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].op).toBe("update");
		expect(jobs[0].payload.amount).toBe(20);
	});

	it("collapses an insert followed by a delete into a single delete", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		enqueueSyncJob({ sheet: "Transactions", op: "delete", itemId: "t1" });

		const jobs = getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].op).toBe("delete");
	});

	it("keeps distinct items in enqueue order", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t2",
			payload: txPayload("t2", 20),
		});

		expect(getSyncQueue().map((j) => j.itemId)).toEqual(["t1", "t2"]);
	});
});

describe("drainSyncQueue", () => {
	const seedThreeJobs = () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t2",
			payload: txPayload("t2", 20),
		});
		enqueueSyncJob({ sheet: "Transactions", op: "delete", itemId: "t3" });
	};

	it("replays every job in order and empties the queue", async () => {
		seedThreeJobs();
		const upsert = vi.fn(async () => {});
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove });

		expect(result).toEqual({ processed: 3, remaining: 0 });
		expect(upsert).toHaveBeenCalledTimes(2);
		expect(upsert).toHaveBeenNthCalledWith(1, "Transactions", {
			id: "t1",
			amount: 10,
		});
		expect(upsert).toHaveBeenNthCalledWith(2, "Transactions", {
			id: "t2",
			amount: 20,
		});
		expect(remove).toHaveBeenCalledWith("Transactions", "t3");
		expect(getSyncQueue()).toEqual([]);
	});

	it("keeps the failed job and everything behind it when a replay fails", async () => {
		seedThreeJobs();
		const upsert = vi.fn(async () => {
			throw { status: 401 };
		});
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove });

		expect(result).toEqual({ processed: 0, remaining: 3 });
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(remove).not.toHaveBeenCalled();
		expect(getSyncQueue().map((j) => j.itemId)).toEqual(["t1", "t2", "t3"]);
	});

	it("removes completed jobs before a later failure", async () => {
		seedThreeJobs();
		const upsert = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce({ status: 500 });
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove });

		expect(result).toEqual({ processed: 1, remaining: 2 });
		expect(getSyncQueue().map((j) => j.itemId)).toEqual(["t2", "t3"]);
	});

	it("does not clobber a job enqueued while a drain is in flight", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		const upsert = vi.fn(async (_sheet: string, item: any) => {
			if (item.id === "t1") {
				enqueueSyncJob({
					sheet: "Transactions",
					op: "insert",
					itemId: "t2",
					payload: txPayload("t2", 20),
				});
			}
		});
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove });

		expect(result).toEqual({ processed: 2, remaining: 0 });
		expect(upsert).toHaveBeenCalledWith("Transactions", {
			id: "t2",
			amount: 20,
		});
		expect(getSyncQueue()).toEqual([]);
	});

	it("is a no-op on an empty queue", async () => {
		const upsert = vi.fn(async () => {});
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove });

		expect(result).toEqual({ processed: 0, remaining: 0 });
		expect(upsert).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	});
});

describe("applyPendingJobs", () => {
	it("restores a pending insert the merge dropped as local-only", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});

		const merged = applyPendingJobs(
			[{ id: "t2", amount: 20 }],
			getSyncQueue(),
			"Transactions",
		);

		expect(merged).toEqual([
			{ id: "t2", amount: 20 },
			{ id: "t1", amount: 10 },
		]);
	});

	it("keeps a pending local edit over a newer cloud version", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: { id: "t1", amount: 10, updatedAt: "2026-11-01T00:00:00.000Z" },
		});

		const merged = applyPendingJobs(
			[{ id: "t1", amount: 99, updatedAt: "2026-11-11T00:00:00.000Z" }],
			getSyncQueue(),
			"Transactions",
		);

		expect(merged).toHaveLength(1);
		expect(merged[0].amount).toBe(10);
	});

	it("removes an item with a pending delete so the sync cannot resurrect it", () => {
		enqueueSyncJob({ sheet: "Transactions", op: "delete", itemId: "t1" });

		const merged = applyPendingJobs(
			[
				{ id: "t1", amount: 10 },
				{ id: "t2", amount: 20 },
			],
			getSyncQueue(),
			"Transactions",
		);

		expect(merged).toEqual([{ id: "t2", amount: 20 }]);
	});

	it("ignores jobs for other sheets", () => {
		enqueueSyncJob({
			sheet: "Subscriptions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 99),
		});

		const items = [{ id: "t1", amount: 10 }];
		expect(applyPendingJobs(items, getSyncQueue(), "Transactions")).toEqual(
			items,
		);
	});

	it("returns the merged list unchanged when nothing is pending", () => {
		const items = [{ id: "t1", amount: 10 }];
		expect(applyPendingJobs(items, [], "Transactions")).toEqual(items);
	});
});

describe("queue storage failures", () => {
	it("recovers from a corrupt queue payload", () => {
		localStorage.setItem("zenfinance_sync_queue_v1", "{}");

		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});

		expect(getSyncQueue()).toMatchObject([{ itemId: "t1" }]);
	});

	it("does not throw when the queue cannot be persisted", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});

		expect(
			enqueueSyncJob({
				sheet: "Transactions",
				op: "insert",
				itemId: "t1",
				payload: txPayload("t1", 10),
			}),
		).toBe(false);
	});

	it("stops a drain gracefully when the queue cannot be rewritten", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});
		const upsert = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove: vi.fn(async () => {}) });

		expect(result.remaining).toBe(1);
	});
});

describe("queue entry validation", () => {
	it("discards malformed entries but keeps valid jobs", () => {
		const valid = {
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
			createdAt: 1,
		};
		localStorage.setItem(
			"zenfinance_sync_queue_v1",
			JSON.stringify([null, valid, { sheet: 1 }, { itemId: "t2" }]),
		);

		expect(getSyncQueue()).toEqual([valid]);
		expect(() =>
			enqueueSyncJob({
				sheet: "Transactions",
				op: "update",
				itemId: "t1",
				payload: txPayload("t1", 20),
			}),
		).not.toThrow();
		expect(getSyncQueue()).toHaveLength(1);
		expect(getSyncQueue()[0].payload.amount).toBe(20);
	});
});

describe("replay identity", () => {
	it("keeps a same-millisecond replacement enqueued mid-drain", async () => {
		vi.spyOn(Date, "now").mockReturnValue(1000);
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		const upsert = vi.fn(async (_sheet: string, item: any) => {
			if (item.amount === 10) {
				enqueueSyncJob({
					sheet: "Transactions",
					op: "update",
					itemId: "t1",
					payload: txPayload("t1", 20),
				});
			}
		});

		const result = await drainSyncQueue({ upsert, remove: vi.fn(async () => {}) });

		expect(upsert).toHaveBeenCalledWith("Transactions", { id: "t1", amount: 20 });
		expect(result).toEqual({ processed: 2, remaining: 0 });
	});
});

describe("job reconciliation", () => {
	it("removeSyncJob acknowledges only the matching item", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t2",
			payload: txPayload("t2", 20),
		});

		expect(hasSyncJob("Transactions", "t1")).toBe(true);
		expect(removeSyncJob("Transactions", "t1")).toBe(true);

		expect(hasSyncJob("Transactions", "t1")).toBe(false);
		expect(getSyncQueue().map((j) => j.itemId)).toEqual(["t2"]);
	});

	it("removeSyncJob is a no-op for unknown items", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		expect(removeSyncJob("Transactions", "nope")).toBe(true);
		expect(getSyncQueue()).toHaveLength(1);
	});

	it("removeSyncJob reports failure when the queue cannot be rewritten", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});

		// The acknowledgement could not be persisted: the caller must learn
		// the stale job is still pending rather than assume it was cleared.
		expect(removeSyncJob("Transactions", "t1")).toBe(false);
		expect(hasSyncJob("Transactions", "t1")).toBe(true);
	});
});

describe("getSyncJob", () => {
	it("returns the pending job for an item", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});

		const job = getSyncJob("Transactions", "t1");
		expect(job).toMatchObject({ sheet: "Transactions", itemId: "t1", op: "update" });
		expect(job?.id).toBeTruthy();
	});

	it("returns undefined when no job is pending for the item", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		expect(getSyncJob("Transactions", "t2")).toBeUndefined();
		expect(getSyncJob("Subscriptions", "t1")).toBeUndefined();
	});
});

describe("spreadsheet binding", () => {
	it("applies a pending job only when its source spreadsheet matches the sync target", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
			spreadsheetId: "sheet-A",
		});
		const merged = [{ id: "t2", amount: 20 }];

		expect(
			applyPendingJobs(merged, getSyncQueue(), "Transactions", "sheet-A"),
		).toEqual([
			{ id: "t2", amount: 20 },
			{ id: "t1", amount: 10 },
		]);
		// A job queued for sheet-A must not enter sheet-B's merge.
		expect(
			applyPendingJobs(merged, getSyncQueue(), "Transactions", "sheet-B"),
		).toEqual(merged);
	});

	it("replays an untagged legacy job regardless of the target spreadsheet", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "t1",
			payload: txPayload("t1", 10),
		});
		const merged = [{ id: "t2", amount: 20 }];

		expect(
			applyPendingJobs(merged, getSyncQueue(), "Transactions", "sheet-B"),
		).toEqual([
			{ id: "t2", amount: 20 },
			{ id: "t1", amount: 10 },
		]);
	});

	it("drains only jobs bound to the target spreadsheet and keeps the rest", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "tA",
			payload: txPayload("tA", 10),
			spreadsheetId: "sheet-A",
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "tB",
			payload: txPayload("tB", 20),
			spreadsheetId: "sheet-B",
		});
		const upsert = vi.fn(async () => {});
		const remove = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove }, "sheet-B");

		expect(result).toEqual({ processed: 1, remaining: 1 });
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(upsert).toHaveBeenCalledWith("Transactions", { id: "tB", amount: 20 });
		expect(getSyncQueue().map((j) => j.itemId)).toEqual(["tA"]);
	});

	it("drains every job when no target spreadsheet is given", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "tA",
			payload: txPayload("tA", 10),
			spreadsheetId: "sheet-A",
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "insert",
			itemId: "tB",
			payload: txPayload("tB", 20),
		});
		const upsert = vi.fn(async () => {});

		const result = await drainSyncQueue({ upsert, remove: vi.fn(async () => {}) });

		expect(result).toEqual({ processed: 2, remaining: 0 });
	});
});

describe("spreadsheet-scoped job identity", () => {
	it("keeps jobs for the same item in different spreadsheets independently queued", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
			spreadsheetId: "sheet-A",
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 20),
			spreadsheetId: "sheet-B",
		});

		const jobs = getSyncQueue();
		expect(jobs).toHaveLength(2);
		expect(jobs.map((j) => j.spreadsheetId).sort()).toEqual([
			"sheet-A",
			"sheet-B",
		]);

		// Acknowledging sheet-A's delivery must leave sheet-B's write pending.
		expect(getSyncJob("Transactions", "t1", "sheet-A")?.payload).toEqual({
			id: "t1",
			amount: 10,
		});
		expect(removeSyncJob("Transactions", "t1", "sheet-A")).toBe(true);
		expect(hasSyncJob("Transactions", "t1", "sheet-A")).toBe(false);
		expect(hasSyncJob("Transactions", "t1", "sheet-B")).toBe(true);
		expect(getSyncQueue().map((j) => j.spreadsheetId)).toEqual(["sheet-B"]);
	});

	it("replays same-item jobs into their own spreadsheets", async () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
			spreadsheetId: "sheet-A",
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 20),
			spreadsheetId: "sheet-B",
		});
		const upsert = vi.fn(async () => {});
		const remove = vi.fn(async () => {});

		const resA = await drainSyncQueue({ upsert, remove }, "sheet-A");
		expect(resA).toEqual({ processed: 1, remaining: 1 });
		expect(upsert).toHaveBeenCalledWith("Transactions", { id: "t1", amount: 10 });

		const resB = await drainSyncQueue({ upsert, remove }, "sheet-B");
		expect(resB).toEqual({ processed: 1, remaining: 0 });
		expect(upsert).toHaveBeenCalledWith("Transactions", { id: "t1", amount: 20 });
	});

	it("still collapses latest-wins within the same spreadsheet", () => {
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 10),
			spreadsheetId: "sheet-A",
		});
		enqueueSyncJob({
			sheet: "Transactions",
			op: "update",
			itemId: "t1",
			payload: txPayload("t1", 30),
			spreadsheetId: "sheet-A",
		});

		const jobs = getSyncQueue();
		expect(jobs).toHaveLength(1);
		expect(jobs[0].payload).toEqual({ id: "t1", amount: 30 });
	});
});