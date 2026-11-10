/**
 * Spec for the Data Access Request decision flow.
 *
 * Derived from the requirement, not from any implementation:
 *
 *   R3. Deciding a Data Access Request transitions that request's status to
 *       `approved` or `rejected`, and never mutates the caller's messages.
 *   R6. An approved request executes its tool and reports the result.
 *   R7. A rejected request reports the rejection and runs no tool.
 *   R8. A tool that fails reports the failure instead of aborting the flow.
 *   R9. An index that is not a pending tool request is a no-op.
 *
 * The logic lives in a service module with injected dependencies so it is
 * reachable from tests, per AGENTS.md.
 */

import { describe, it, expect, vi } from "vitest";
import {
	resolveToolAction,
	ToolActionContext,
} from "../services/ai-tool-action.services";
import { ChatMessage, Transaction, TransactionType, Category } from "../types";

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

const transaction = (
	id: string,
	over: Partial<Transaction> = {},
): Transaction => ({
	id,
	userId: "u1",
	accountId: "a1",
	amount: 10,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	shopName: "Shop",
	date: "2026-01-01",
	createdAt: "2026-01-01T00:00:00.000Z",
	...over,
});

const category = (id: string, name: string): Category => ({
	id,
	name,
	icon: "🍜",
	budgetLimit: 500,
	color: "#fff",
	userId: "u1",
});

const pendingRequest = (
	name = "get_historical_transactions",
	args: Record<string, unknown> = {},
): ChatMessage => ({
	role: "model",
	content: "",
	timestamp: FIXED_NOW,
	functionCall: { name, args },
	status: "pending",
});

const context = (over: Partial<ToolActionContext> = {}): ToolActionContext => ({
	transactions: [],
	categories: [],
	getCurrentLocation: vi.fn().mockResolvedValue({
		latitude: 3.1,
		longitude: 101.7,
		accuracyMeters: 12,
	}),
	fetchNearbyFood: vi.fn().mockResolvedValue({ places: [] }),
	now: () => FIXED_NOW,
	...over,
});

describe("resolveToolAction", () => {
	describe("R3: status transition", () => {
		it("marks the request rejected and appends the rejection response", async () => {
			const messages = [pendingRequest()];

			const result = await resolveToolAction(
				messages,
				0,
				"rejected",
				context(),
			);

			expect(result).not.toBeNull();
			expect(result!.messages[0].status).toBe("rejected");
			expect(result!.messages[0].functionCall).toEqual({
				name: "get_historical_transactions",
				args: {},
			});
		});

		it("marks the request approved and appends the tool response", async () => {
			const messages = [pendingRequest()];

			const result = await resolveToolAction(
				messages,
				0,
				"approved",
				context(),
			);

			expect(result).not.toBeNull();
			expect(result!.messages[0].status).toBe("approved");
		});

		it("leaves every other message untouched", async () => {
			const before = {
				role: "user" as const,
				content: "what did I spend on coffee",
				timestamp: FIXED_NOW,
			};
			const messages = [before, pendingRequest()];

			const result = await resolveToolAction(
				messages,
				1,
				"rejected",
				context(),
			);

			expect(result!.messages[0]).toEqual(before);
			expect(result!.messages[0]).toBe(before);
		});

		it("does not mutate the caller's messages", async () => {
			const messages = [pendingRequest()];
			const snapshot = structuredClone(messages);

			await resolveToolAction(messages, 0, "approved", context());

			expect(messages).toEqual(snapshot);
			expect(messages[0].status).toBe("pending");
		});
	});

	describe("R7: rejection", () => {
		it("reports the rejection without running any tool", async () => {
			const ctx = context();

			const result = await resolveToolAction(
				[pendingRequest()],
				0,
				"rejected",
				ctx,
			);

			expect(result!.response.functionResponse!.name).toBe(
				"get_historical_transactions",
			);
			expect(result!.response.functionResponse!.response).toEqual({
				error: "User rejected the request",
			});
			expect(ctx.getCurrentLocation).not.toHaveBeenCalled();
			expect(ctx.fetchNearbyFood).not.toHaveBeenCalled();
		});
	});

	describe("R6: get_historical_transactions", () => {
		it("returns the transactions matching the search keyword", async () => {
			const ctx = context({
				transactions: [
					transaction("t1", { shopName: "Coffee Bean" }),
					transaction("t2", { shopName: "Bread Talk" }),
					transaction("t3", { shopName: "Daily Coffee" }),
				],
			});

			const result = await resolveToolAction(
				[pendingRequest("get_historical_transactions", { searchKeyword: "coffee" })],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions.map((t: Transaction) => t.id)).toEqual([
				"t1",
				"t3",
			]);
			expect(response.totalMatches).toBe(2);
			expect(response.appliedFilters).toEqual({ searchKeyword: "coffee" });
		});

		it("matches the search keyword regardless of case", async () => {
			const ctx = context({
				transactions: [transaction("t1", { shopName: "COFFEE BEAN" })],
			});

			const result = await resolveToolAction(
				[pendingRequest("get_historical_transactions", { searchKeyword: "coffee" })],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions).toHaveLength(1);
		});

		it("applies the start and end date bounds", async () => {
			const ctx = context({
				transactions: [
					transaction("early", { date: "2025-12-01" }),
					transaction("inside", { date: "2026-01-15" }),
					transaction("late", { date: "2026-06-01" }),
				],
			});

			const result = await resolveToolAction(
				[
					pendingRequest("get_historical_transactions", {
						startDate: "2026-01-01",
						endDate: "2026-02-01",
					}),
				],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions.map((t: Transaction) => t.id)).toEqual([
				"inside",
			]);
		});

		it("applies the category name filter", async () => {
			const ctx = context({
				categories: [category("c-food", "Food")],
				transactions: [
					transaction("food", { categoryId: "c-food" }),
					transaction("fuel", { categoryId: "c-fuel" }),
					transaction("none", {}),
				],
			});

			const result = await resolveToolAction(
				[pendingRequest("get_historical_transactions", { categoryName: "Food" })],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions.map((t: Transaction) => t.id)).toEqual([
				"food",
			]);
		});

		it("keeps timestamped transactions that fall on the boundary dates", async () => {
			const ctx = context({
				transactions: [
					transaction("early", { date: "2025-12-31" }),
					transaction("start-boundary", { date: "2026-01-01T08:15:00" }),
					transaction("inside", { date: "2026-01-20" }),
					transaction("end-boundary", { date: "2026-02-01T23:59:59" }),
					transaction("late", { date: "2026-02-02" }),
				],
			});

			const result = await resolveToolAction(
				[
					pendingRequest("get_historical_transactions", {
						startDate: "2026-01-01",
						endDate: "2026-02-01",
					}),
				],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions.map((t: Transaction) => t.id)).toEqual([
				"start-boundary",
				"inside",
				"end-boundary",
			]);
		});

		it("returns no matches when the category name is unknown", async () => {
			const ctx = context({
				categories: [category("c-food", "Food")],
				transactions: [
					transaction("food", { categoryId: "c-food" }),
					transaction("fuel", { categoryId: "c-fuel" }),
				],
			});

			const result = await resolveToolAction(
				[
					pendingRequest("get_historical_transactions", {
						categoryName: "Dining Out",
					}),
				],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions).toEqual([]);
			expect(response.totalMatches).toBe(0);
		});

		it("caps the returned transactions at 50 but still reports the true total", async () => {
			const ctx = context({
				transactions: Array.from({ length: 60 }, (_, i) =>
					transaction(`t${i}`, { shopName: "Coffee" }),
				),
			});

			const result = await resolveToolAction(
				[pendingRequest("get_historical_transactions", { searchKeyword: "coffee" })],
				0,
				"approved",
				ctx,
			);

			const response = result!.response.functionResponse!.response;
			expect(response.transactions).toHaveLength(50);
			expect(response.totalMatches).toBe(60);
		});
	});

	describe("R6: get_current_location", () => {
		it("returns the current location and when it was retrieved", async () => {
			const ctx = context();

			const result = await resolveToolAction(
				[pendingRequest("get_current_location")],
				0,
				"approved",
				ctx,
			);

			expect(ctx.getCurrentLocation).toHaveBeenCalled();
			const response = result!.response.functionResponse!.response;
			expect(response.latitude).toBe(3.1);
			expect(response.longitude).toBe(101.7);
			expect(response.accuracyMeters).toBe(12);
			expect(response.retrievedAt).toBe(FIXED_NOW);
		});
	});

	describe("R6: get_nearby_food", () => {
		it("uses the coordinates given in the request", async () => {
			const ctx = context();

			const result = await resolveToolAction(
				[
					pendingRequest("get_nearby_food", {
						latitude: 1.5,
						longitude: 2.5,
						radiusMeters: 800,
						limit: 5,
						cuisineKeyword: "ramen",
					}),
				],
				0,
				"approved",
				ctx,
			);

			expect(ctx.getCurrentLocation).not.toHaveBeenCalled();
			expect(ctx.fetchNearbyFood).toHaveBeenCalledWith(
				1.5,
				2.5,
				800,
				5,
				"ramen",
			);
			expect(result!.response.functionResponse!.response).toEqual({
				places: [],
			});
		});

		it("falls back to the current location when coordinates are missing", async () => {
			const ctx = context();

			await resolveToolAction(
				[pendingRequest("get_nearby_food", {})],
				0,
				"approved",
				ctx,
			);

			expect(ctx.getCurrentLocation).toHaveBeenCalled();
			expect(ctx.fetchNearbyFood).toHaveBeenCalledWith(
				3.1,
				101.7,
				1200,
				10,
				undefined,
			);
		});
	});

	describe("R8: failure handling", () => {
		it("reports an unsupported tool instead of throwing", async () => {
			const result = await resolveToolAction(
				[pendingRequest("make_coffee")],
				0,
				"approved",
				context(),
			);

			expect(result!.response.functionResponse!.response).toEqual({
				error: "Unsupported tool: make_coffee",
			});
		});

		it("reports a historical-query failure instead of throwing", async () => {
			const ctx = context({
				transactions: [transaction("bad", { shopName: null as any })],
			});

			const result = await resolveToolAction(
				[
					pendingRequest("get_historical_transactions", {
						searchKeyword: "coffee",
					}),
				],
				0,
				"approved",
				ctx,
			);

			expect(result!.response.functionResponse!.response.error).toBeTruthy();
			expect(result!.messages[0].status).toBe("approved");
		});

		it("reports a geolocation failure instead of throwing", async () => {
			const ctx = context({
				getCurrentLocation: vi
					.fn()
					.mockRejectedValue(new Error("Permission denied")),
			});

			const result = await resolveToolAction(
				[pendingRequest("get_current_location")],
				0,
				"approved",
				ctx,
			);

			expect(result!.response.functionResponse!.response).toEqual({
				error: "Permission denied",
			});
			expect(result!.messages[0].status).toBe("approved");
		});

		it("reports a nearby-food failure instead of throwing", async () => {
			const ctx = context({
				fetchNearbyFood: vi.fn().mockRejectedValue(new Error("Overpass down")),
			});

			const result = await resolveToolAction(
				[pendingRequest("get_nearby_food", { latitude: 1, longitude: 2 })],
				0,
				"approved",
				ctx,
			);

			expect(result!.response.functionResponse!.response).toEqual({
				error: "Overpass down",
			});
		});
	});

	describe("R9: no-op cases", () => {
		it("returns null when the index holds no tool request", async () => {
			const result = await resolveToolAction(
				[
					{
						role: "user",
						content: "hello",
						timestamp: FIXED_NOW,
					},
				],
				0,
				"approved",
				context(),
			);

			expect(result).toBeNull();
		});

		it("returns null when the index is out of range", async () => {
			const result = await resolveToolAction(
				[pendingRequest()],
				7,
				"approved",
				context(),
			);

			expect(result).toBeNull();
		});
	});
});
