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
		expect(d.queue).toHaveBeenCalledWith("Transactions", "update", "b", {
			id: "b",
			amount: 9,
		});
		expect(d.queue).toHaveBeenCalledWith("Transactions", "delete", "c", undefined);
	});
});
