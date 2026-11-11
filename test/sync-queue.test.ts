import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	enqueueSyncJob,
	getSyncQueue,
	clearSyncQueue,
	drainSyncQueue,
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