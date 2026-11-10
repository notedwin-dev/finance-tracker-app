/**
 * AI Tool Action Service
 *
 * Pure, dependency-injected handling of Data Access Request decisions.
 * Extracted from AIInsights so it can be tested without rendering React.
 *
 * A Data Access Request is a model message carrying a `functionCall`. The user
 * approves or rejects it, and the decision has three consequences:
 *
 *   1. the request's status transitions to `approved` / `rejected`;
 *   2. a function-response message is produced for the model;
 *   3. the caller's message objects are never mutated.
 */

import { Category, ChatMessage, Transaction } from "../types";

export type ToolDecision = "approved" | "rejected";

export interface ToolLocation {
	latitude: number;
	longitude: number;
	accuracyMeters: number;
}

export interface ToolActionContext {
	/** Transactions the `get_historical_transactions` tool may query. */
	transactions: Transaction[];
	/** Categories the `get_historical_transactions` tool filters by name. */
	categories: Category[];
	/** Resolves the device's current position. */
	getCurrentLocation: () => Promise<ToolLocation>;
	/** Resolves nearby food places for the `get_nearby_food` tool. */
	fetchNearbyFood: (
		latitude: number,
		longitude: number,
		radiusMeters: number,
		limit: number,
		cuisineKeyword?: string,
	) => Promise<any>;
	/** Clock, injected so timestamps are deterministic under test. */
	now: () => string;
}

export interface ToolActionResult {
	/** The message list to persist, with the decision applied. */
	messages: ChatMessage[];
	/** The tool the request asked for. */
	toolName: string;
	/** The function-response message to append to the conversation. */
	response: ChatMessage;
}

export const TOOL_HISTORICAL_TRANSACTIONS = "get_historical_transactions";
export const TOOL_CURRENT_LOCATION = "get_current_location";
export const TOOL_NEARBY_FOOD = "get_nearby_food";

/** Upper bound on the transactions handed back to the model in one response. */
export const MAX_HISTORICAL_TRANSACTIONS = 50;

const DEFAULT_RADIUS_METERS = 1200;
const DEFAULT_NEARBY_LIMIT = 10;

/**
 * Apply a decision to the request at `msgIndex`.
 *
 * Returns a new list holding a new request object; the input list and its
 * message objects are left untouched so React state is never mutated in place.
 */
export const applyToolDecision = (
	messages: ChatMessage[],
	msgIndex: number,
	decision: ToolDecision,
): ChatMessage[] =>
	messages.map((message, index) =>
		index === msgIndex ? { ...message, status: decision } : message,
	);

/** The request at `msgIndex`, or null when it is not a tool request. */
export const findToolRequest = (
	messages: ChatMessage[],
	msgIndex: number,
): ChatMessage | null => {
	const message = messages[msgIndex];
	return message?.functionCall ? message : null;
};

/** Query historical transactions with the filters the model asked for. */
export const queryHistoricalTransactions = (
	transactions: Transaction[],
	categories: Category[],
	args: Record<string, any>,
) => {
	const { searchKeyword, startDate, endDate, categoryName } = args ?? {};

	/** `date` may be a plain day or a full ISO timestamp; compare days only. */
	const dayOf = (value: unknown) => String(value).slice(0, 10);

	const matches = transactions.filter((t) => {
		if (
			searchKeyword &&
			!t.shopName
				.toLowerCase()
				.includes(String(searchKeyword).toLowerCase())
		)
			return false;
		if (startDate && dayOf(t.date) < dayOf(startDate)) return false;
		if (endDate && dayOf(t.date) > dayOf(endDate)) return false;
		if (categoryName) {
			const cat = categories.find((c) => c.name === categoryName);
			// A category the user does not have yields no matches; silently
			// skipping the filter would hand the model everything.
			if (!cat || t.categoryId !== cat.id) return false;
		}
		return true;
	});

	return {
		totalMatches: matches.length,
		appliedFilters: args,
		transactions: matches.slice(0, MAX_HISTORICAL_TRANSACTIONS),
	};
};

/**
 * Execute an approved tool and return the payload for the model.
 *
 * A tool that fails reports the failure as a payload; it never throws, so one
 * bad tool cannot abort the decision.
 */
export const runTool = async (
	toolName: string,
	args: Record<string, any>,
	ctx: ToolActionContext,
): Promise<any> => {
	switch (toolName) {
		case TOOL_HISTORICAL_TRANSACTIONS:
			try {
				return queryHistoricalTransactions(
					ctx.transactions,
					ctx.categories,
					args,
				);
			} catch (err: any) {
				return {
					error: err?.message || "Unable to search transaction history.",
				};
			}

		case TOOL_CURRENT_LOCATION:
			try {
				const location = await ctx.getCurrentLocation();
				return { ...location, retrievedAt: ctx.now() };
			} catch (err: any) {
				return {
					error: err?.message || "Unable to retrieve current location.",
				};
			}

		case TOOL_NEARBY_FOOD:
			try {
				let latitude = Number(args?.latitude);
				let longitude = Number(args?.longitude);

				if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
					const location = await ctx.getCurrentLocation();
					latitude = location.latitude;
					longitude = location.longitude;
				}

				return await ctx.fetchNearbyFood(
					latitude,
					longitude,
					Number(args?.radiusMeters) || DEFAULT_RADIUS_METERS,
					Number(args?.limit) || DEFAULT_NEARBY_LIMIT,
					args?.cuisineKeyword,
				);
			} catch (err: any) {
				return {
					error: err?.message || "Unable to find nearby food places right now.",
				};
			}

		default:
			return { error: `Unsupported tool: ${toolName}` };
	}
};

/**
 * Apply the user's decision to the Data Access Request at `msgIndex`.
 *
 * Returns null when there is no tool request at that index, so the caller can
 * treat "nothing to decide" as a no-op.
 */
export const resolveToolAction = async (
	messages: ChatMessage[],
	msgIndex: number,
	decision: ToolDecision,
	ctx: ToolActionContext,
): Promise<ToolActionResult | null> => {
	const request = findToolRequest(messages, msgIndex);
	if (!request) return null;

	const toolName = request.functionCall!.name;
	const args = request.functionCall!.args || {};

	const payload =
		decision === "rejected"
			? { error: "User rejected the request" }
			: await runTool(toolName, args, ctx);

	const response: ChatMessage = {
		role: "system",
		content: "",
		timestamp: ctx.now(),
		functionResponse: {
			name: toolName,
			response: payload,
		},
	};

	return {
		messages: [...applyToolDecision(messages, msgIndex, decision), response],
		toolName,
		response,
	};
};
