import { describe, expect, it, vi } from "vitest";
import { reconcileFullSave } from "../services/full-save-reconcile.services";

const deps = (
	overrides: Partial<Parameters<typeof reconcileFullSave>[1]> = {},
) => ({
	upsert: vi.fn(async () => {}),
	remove: vi.fn(async () => {}),
	queue: vi.fn(),
	...overrides,
});

describe("reconcileFullSave", () => {
	it("re-applies changed rows, removes deleted rows, and skips unchanged ones", async () => {
		const d = deps();
		const repaired = await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [
						{ id: "a", amount: 1 },
						{ id: "b", amount: 2 },
						{ id: "c", amount: 3 },
					],
					current: () => [
						{ id: "a", amount: 1 },
						{ id: "b", amount: 9 },
					],
				},
			],
			d,
		);

		expect(repaired).toBe(2);
		expect(d.upsert).toHaveBeenCalledTimes(1);
		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "b", amount: 9 });
		expect(d.remove).toHaveBeenCalledTimes(1);
		expect(d.remove).toHaveBeenCalledWith("Transactions", "c");
		expect(d.queue).not.toHaveBeenCalled();
	});

	it("clears a field the local row dropped instead of leaving the snapshot value", async () => {
		const d = deps();
		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "a", amount: 5, potId: "pot-1" }],
					current: () => [{ id: "a", amount: 5 }],
				},
			],
			d,
		);

		expect(d.upsert).toHaveBeenCalledTimes(1);
		expect(d.upsert).toHaveBeenCalledWith("Transactions", {
			id: "a",
			amount: 5,
			potId: "",
		});
	});

	it("does not delete a row that was restored while an earlier repair was in flight", async () => {
		let stored = [{ id: "b", amount: 2 }];
		const d = deps({
			upsert: vi.fn(async () => {
				stored = [...stored, { id: "c", amount: 3 }];
			}),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [
						{ id: "b", amount: 1 },
						{ id: "c", amount: 3 },
					],
					current: () => stored,
				},
			],
			d,
		);

		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "b", amount: 2 });
		expect(d.remove).not.toHaveBeenCalled();
	});

	it("re-applies a newer intent delivered while its deletion was in flight", async () => {
		let delivered:
			| { version: number; op: "update"; payload: { id: string; amount: number } }
			| undefined;
		const d = deps({
			remove: vi.fn(async () => {
				delivered = { version: 1, op: "update", payload: { id: "c", amount: 9 } };
			}),
			latestIntent: vi.fn(() => delivered),
		});

		await reconcileFullSave(
			[{ sheet: "Transactions", rows: [{ id: "c", amount: 3 }], current: () => [] }],
			d,
		);

		expect(d.remove).toHaveBeenCalledTimes(1);
		expect(d.upsert).toHaveBeenCalledTimes(1);
		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "c", amount: 9 });
	});

	it("leaves no repair behind when no newer intent arrives", async () => {
		const d = deps({ latestIntent: vi.fn(() => undefined) });

		await reconcileFullSave(
			[{ sheet: "Transactions", rows: [{ id: "c", amount: 3 }], current: () => [] }],
			d,
		);

		expect(d.remove).toHaveBeenCalledTimes(1);
		expect(d.upsert).not.toHaveBeenCalled();
	});

	it("queues a repair that could not be delivered instead of dropping it", async () => {
		const d = deps({
			upsert: vi.fn(async () => {
				throw new Error("offline");
			}),
			remove: vi.fn(async () => {
				throw new Error("offline");
			}),
		});
		const repaired = await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "b", amount: 2 }, { id: "c", amount: 3 }],
					current: () => [{ id: "b", amount: 9 }],
				},
			],
			d,
		);

		expect(repaired).toBe(0);
		expect(d.queue).toHaveBeenCalledWith(
			"Transactions",
			"update",
			"b",
			{ id: "b", amount: 9 },
			0,
		);
		expect(d.queue).toHaveBeenCalledWith(
			"Transactions",
			"delete",
			"c",
			undefined,
			0,
		);
	});

	it("re-applies an intent delivered while an earlier row's repair was in flight", async () => {
		let delivered:
			| { version: number; op: "update"; payload: { id: string; amount: number } }
			| undefined;
		const d = deps({
			upsert: vi.fn(async (_sheet: string, item: { id: string }) => {
				if (item.id === "a")
					delivered = {
						version: 1,
						op: "update",
						payload: { id: "b", amount: 99 },
					};
			}),
			latestIntent: vi.fn((_sheet: string, itemId: string) =>
				itemId === "b" ? delivered : undefined,
			),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "a", amount: 1 }, { id: "b", amount: 2 }],
					current: () => [{ id: "a", amount: 5 }, { id: "b", amount: 4 }],
				},
			],
			d,
		);

		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "a", amount: 5 });
		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "b", amount: 4 });
		// The newer intent landed under the repair and must be re-applied.
		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "b", amount: 99 });
	});

	it("re-inserts a row added after the full-save snapshot", async () => {
		const d = deps();

		const repaired = await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "a", amount: 1 }],
					current: () => [{ id: "a", amount: 1 }, { id: "b", amount: 2 }],
				},
			],
			d,
		);

		expect(repaired).toBe(1);
		expect(d.upsert).toHaveBeenCalledTimes(1);
		expect(d.upsert).toHaveBeenCalledWith("Transactions", { id: "b", amount: 2 });
	});

	it("does not queue a failed repair when a newer write is already pending", async () => {
		const d = deps({
			upsert: vi.fn(async () => {
				throw new Error("offline");
			}),
			pendingVersion: vi.fn(() => 2),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "b", amount: 2 }],
					current: () => [{ id: "b", amount: 9 }],
				},
			],
			d,
		);

		expect(d.queue).not.toHaveBeenCalled();
	});

	it("does not queue a stale repair when a newer intent was delivered while it failed", async () => {
		let delivered:
			| { version: number; op: "update"; payload: { id: string; amount: number } }
			| undefined;
		const d = deps({
			upsert: vi.fn(async () => {
				delivered = {
					version: 1,
					op: "update",
					payload: { id: "b", amount: 99 },
				};
				throw new Error("offline");
			}),
			latestIntent: vi.fn(() => delivered),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "b", amount: 2 }],
					current: () => [{ id: "b", amount: 9 }],
				},
			],
			d,
		);

		expect(d.queue).not.toHaveBeenCalled();
	});

	it("queues a failed repair under the version it was based on", async () => {
		const d = deps({
			upsert: vi.fn(async () => {
				throw new Error("offline");
			}),
			latestIntent: vi.fn(() => ({
				version: 4,
				op: "update" as const,
				payload: { id: "b", amount: 9 },
			})),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "b", amount: 2 }],
					current: () => [{ id: "b", amount: 9 }],
				},
			],
			d,
		);

		expect(d.queue).toHaveBeenCalledWith(
			"Transactions",
			"update",
			"b",
			{ id: "b", amount: 9 },
			4,
		);
	});

	it("queues a newer-intent re-delivery that could not be sent", async () => {
		let delivered:
			| { version: number; op: "update"; payload: { id: string; amount: number } }
			| undefined;
		const d = deps({
			remove: vi.fn(async () => {
				delivered = {
					version: 3,
					op: "update",
					payload: { id: "c", amount: 9 },
				};
			}),
			upsert: vi.fn(async () => {
				throw new Error("offline");
			}),
			latestIntent: vi.fn(() => delivered),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "c", amount: 3 }],
					current: () => [],
				},
			],
			d,
		);

		expect(d.queue).toHaveBeenCalledWith(
			"Transactions",
			"update",
			"c",
			{ id: "c", amount: 9 },
			3,
		);
	});

	it("does not queue a re-delivery older than a newer pending write", async () => {
		let delivered:
			| { version: number; op: "update"; payload: { id: string; amount: number } }
			| undefined;
		const d = deps({
			remove: vi.fn(async () => {
				delivered = {
					version: 1,
					op: "update",
					payload: { id: "c", amount: 9 },
				};
			}),
			upsert: vi.fn(async () => {
				throw new Error("offline");
			}),
			latestIntent: vi.fn(() => delivered),
			pendingVersion: vi.fn(() => 2),
		});

		await reconcileFullSave(
			[
				{
					sheet: "Transactions",
					rows: [{ id: "c", amount: 3 }],
					current: () => [],
				},
			],
			d,
		);

		expect(d.remove).toHaveBeenCalledTimes(1);
		expect(d.queue).not.toHaveBeenCalled();
	});
});
