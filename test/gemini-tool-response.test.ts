/**
 * Spec for the outbound Gemini payload on a tool-approval turn.
 *
 * Derived from the requirement, not from any implementation:
 *
 *   R1. After the user approves a Data Access Request, the tool's actual
 *       result must be delivered to the model as a `functionResponse` that
 *       pairs with the originating `functionCall`.
 *   R2. After the user rejects a Data Access Request, the model must receive a
 *       `functionResponse` carrying the rejection.
 *   R4. The model must never be asked to answer a `functionCall` that has no
 *       matching `functionResponse`.
 *   R5. Ordinary (non-tool) turns are unaffected.
 *
 * The Gemini API rejects a history whose model turn contains a `functionCall`
 * that is not answered by a user turn containing the matching
 * `functionResponse`. That is what makes "Approve" fail for the user.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const capture: {
	chatsCreateArgs: any[];
	sendMessageArgs: any[];
} = { chatsCreateArgs: [], sendMessageArgs: [] };

vi.mock("@google/genai", () => ({
	GoogleGenAI: class {
		chats = {
			create: (args: any) => {
				capture.chatsCreateArgs.push(args);
				return {
					sendMessageStream: (params: any) => {
						capture.sendMessageArgs.push(params);
						return (async function* () {
							yield { text: "answer" };
						})();
					},
				};
			},
		};
	},
	Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER" },
	Tool: {},
}));

import { streamFinancialAdvice } from "../services/gemini.services";
import { ChatMessage } from "../types";

type Turn = { role: string; parts: any[] };

/**
 * Normalize everything the SDK was handed into the ordered list of turns the
 * model actually receives. Deliberately tolerant of the transport (history
 * array vs. message argument) so the assertions describe what the MODEL
 * receives rather than how it is carried.
 */
const outboundTurns = (): Turn[] => {
	const turns: Turn[] = [];

	for (const content of capture.chatsCreateArgs[0]?.history ?? []) {
		turns.push({ role: content.role, parts: content.parts ?? [] });
	}

	const message = capture.sendMessageArgs[0]?.message;
	if (typeof message === "string") {
		turns.push({ role: "user", parts: [{ text: message }] });
	} else if (Array.isArray(message)) {
		turns.push({ role: "user", parts: message });
	} else if (message?.parts) {
		turns.push({ role: message.role ?? "user", parts: message.parts });
	} else if (message) {
		turns.push({ role: "user", parts: [message] });
	}

	return turns;
};

const callTurns = () =>
	outboundTurns().filter((t) => t.parts.some((p) => p.functionCall));

const responseTurns = () =>
	outboundTurns().filter((t) => t.parts.some((p) => p.functionResponse));

const toolResult = {
	totalMatches: 2,
	appliedFilters: { searchKeyword: "coffee" },
	transactions: [
		{ id: "t1", shopName: "Coffee Bean", amount: 12 },
		{ id: "t2", shopName: "Coffee Toasted", amount: 9 },
	],
};

const approvalHistory: ChatMessage[] = [
	{
		role: "user",
		content: "what did I spend on coffee",
		timestamp: "2026-01-01T00:00:00.000Z",
	},
	{
		role: "model",
		content: "",
		timestamp: "2026-01-01T00:00:01.000Z",
		functionCall: {
			name: "get_historical_transactions",
			args: { searchKeyword: "coffee" },
		},
		status: "approved",
	},
	{
		role: "system",
		content: "",
		timestamp: "2026-01-01T00:00:02.000Z",
		functionResponse: {
			name: "get_historical_transactions",
			response: toolResult,
		},
	},
];

const rejectionHistory: ChatMessage[] = [
	{
		role: "user",
		content: "what did I spend on coffee",
		timestamp: "2026-01-01T00:00:00.000Z",
	},
	{
		role: "model",
		content: "",
		timestamp: "2026-01-01T00:00:01.000Z",
		functionCall: {
			name: "get_historical_transactions",
			args: { searchKeyword: "coffee" },
		},
		status: "rejected",
	},
	{
		role: "system",
		content: "",
		timestamp: "2026-01-01T00:00:02.000Z",
		functionResponse: {
			name: "get_historical_transactions",
			response: { error: "User rejected the request" },
		},
	},
];

const ask = async (history: ChatMessage[]) => {
	await streamFinancialAdvice(
		"test-api-key",
		[],
		[],
		[],
		[],
		[],
		[],
		history,
		() => {},
	);
};

beforeEach(() => {
	capture.chatsCreateArgs = [];
	capture.sendMessageArgs = [];
});

describe("outbound Gemini payload on a tool turn", () => {
	it("R1: delivers the approved tool result to the model", async () => {
		await ask(approvalHistory);

		const responses = responseTurns();
		expect(responses).toHaveLength(1);

		const part = responses[0].parts.find((p) => p.functionResponse);
		expect(part.functionResponse.name).toBe("get_historical_transactions");
		expect(part.functionResponse.response).toEqual(toolResult);
	});

	it("R4: every functionCall turn is answered by a matching functionResponse turn", async () => {
		await ask(approvalHistory);

		const turns = outboundTurns();
		const callIndex = turns.findIndex((t) =>
			t.parts.some((p) => p.functionCall),
		);

		expect(callIndex).toBeGreaterThanOrEqual(0);

		const answer = turns[callIndex + 1];
		expect(answer).toBeDefined();
		expect(answer.role).toBe("user");

		const part = answer.parts.find((p) => p.functionResponse);
		expect(part).toBeDefined();
		expect(part.functionResponse.name).toBe(
			turns[callIndex].parts.find((p) => p.functionCall).functionCall.name,
		);
	});

	it("R2: delivers the rejection to the model", async () => {
		await ask(rejectionHistory);

		const responses = responseTurns();
		expect(responses).toHaveLength(1);

		const part = responses[0].parts.find((p) => p.functionResponse);
		expect(part.functionResponse.name).toBe("get_historical_transactions");
		expect(part.functionResponse.response).toEqual({
			error: "User rejected the request",
		});
	});

	it("R4: does not ask the model to answer a functionCall without a response", async () => {
		await ask(approvalHistory);

		expect(callTurns().length).toBe(responseTurns().length);
	});

	it("R5: leaves an ordinary conversation turn untouched", async () => {
		// The shape the app actually sends for a plain question: the history
		// ends with the user's message.
		await ask([
			{
				role: "user",
				content: "hello",
				timestamp: "2026-01-01T00:00:00.000Z",
			},
			{
				role: "model",
				content: "Hi! How can I help?",
				timestamp: "2026-01-01T00:00:01.000Z",
			},
			{
				role: "user",
				content: "how much did I spend this week",
				timestamp: "2026-01-01T00:00:02.000Z",
			},
		]);

		expect(callTurns()).toHaveLength(0);
		expect(responseTurns()).toHaveLength(0);

		const turns = outboundTurns();
		expect(turns).toHaveLength(3);
		expect(turns[0].parts[0].text).toBe("hello");
		expect(turns[1].role).toBe("model");
		expect(turns[1].parts[0].text).toBe("Hi! How can I help?");
		expect(turns[2].role).toBe("user");
		expect(turns[2].parts[0].text).toBe("how much did I spend this week");
	});
});
