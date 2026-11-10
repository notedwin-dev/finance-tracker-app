/**
 * End-to-end spec for deciding a Data Access Request.
 *
 * Derived from the requirement, not from any implementation:
 *
 *   R1/R6. Approving a Data Access Request delivers the tool's actual result
 *          to the model as a functionResponse paired with the functionCall.
 *   R2/R7. Rejecting delivers the rejection and runs no tool.
 *   R3.    The decision transitions the request's status and never mutates
 *          the caller's message objects.
 *
 * The Gemini SDK is mocked at the network boundary so the test can assert on
 * what the model actually receives. Everything between the click and the
 * outbound payload is production code.
 */

import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIInsights from "../components/AIInsights";
import { ChatMessage, ChatSession, Transaction, TransactionType } from "../types";

const capture: { chatsCreateArgs: any[]; sendMessageArgs: any[] } = {
	chatsCreateArgs: [],
	sendMessageArgs: [],
};

vi.mock("@google/genai", () => ({
	GoogleGenAI: class {
		chats = {
			create: (args: any) => {
				capture.chatsCreateArgs.push(args);
				return {
					sendMessageStream: (params: any) => {
						capture.sendMessageArgs.push(params);
						return (async function* () {
							yield { text: "Here is what I found." };
						})();
					},
				};
			},
		};
	},
	Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER" },
	Tool: {},
}));

const FIXED_NOW = "2026-01-01T00:00:00.000Z";

const transaction = (id: string, shopName: string): Transaction => ({
	id,
	userId: "u1",
	accountId: "a1",
	amount: 12,
	currency: "MYR",
	type: TransactionType.EXPENSE,
	shopName,
	date: "2026-01-01",
	createdAt: FIXED_NOW,
});

const buildSession = (): ChatSession => {
	const pending: ChatMessage = {
		role: "model",
		content: "I need to access your transaction history.",
		timestamp: FIXED_NOW,
		functionCall: {
			name: "get_historical_transactions",
			args: { searchKeyword: "coffee" },
		},
		status: "pending",
	};
	return {
		id: "chat-1",
		userId: "test-user",
		title: "Test Chat",
		messages: [pending],
		updatedAt: FIXED_NOW,
	};
};

/** Everything the model was handed, as an ordered list of turns. */
const outboundTurns = () => {
	const turns: { role: string; parts: any[] }[] = [];

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

const functionResponseParts = () =>
	outboundTurns().flatMap((t) => t.parts.filter((p) => p.functionResponse));

describe("AIInsights data access request decisions", () => {
	let root: Root;
	let host: HTMLDivElement;
	let onSaveSession: ReturnType<typeof vi.fn>;

	const render = async (
		session: ChatSession,
		transactions: Transaction[] = [],
	) => {
		await act(async () => {
			root.render(
				<AIInsights
					apiKey="test-api-key"
					accounts={[]}
					transactions={transactions}
					categories={[]}
					pots={[]}
					goals={[]}
					subscriptions={[]}
					sessions={[session]}
					activeSessionId={session.id}
					onClose={() => {}}
					onSaveSession={onSaveSession}
					onDeleteSession={() => {}}
					onSelectSession={() => {}}
					onNewChat={() => {}}
					isInline
				/>,
			);
		});
	};

	const clickButton = async (label: string) => {
		const button = Array.from(host.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === label,
		);
		expect(button, `expected a "${label}" button`).toBeTruthy();
		await act(async () => {
			button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
	};

	/** Let the deferred follow-up turn fire. */
	const settleFollowUp = async () => {
		await act(async () => {
			vi.advanceTimersByTime(200);
		});
	};

	beforeEach(() => {
		capture.chatsCreateArgs = [];
		capture.sendMessageArgs = [];
		onSaveSession = vi.fn();
		vi.useFakeTimers();
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
			value: vi.fn(),
			writable: true,
			configurable: true,
		});
		host = document.createElement("div");
		document.body.appendChild(host);
		root = createRoot(host);
	});

	afterEach(async () => {
		await act(async () => {
			root.unmount();
		});
		host.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("R1/R6: approving delivers the tool result to the model", async () => {
		const session = buildSession();
		await render(session, [transaction("t1", "Coffee Bean")]);

		await clickButton("Approve");

		const saved = onSaveSession.mock.calls[0][0];
		expect(saved.messages[0].status).toBe("approved");

		await settleFollowUp();

		const parts = functionResponseParts();
		expect(parts).toHaveLength(1);
		expect(parts[0].functionResponse.name).toBe(
			"get_historical_transactions",
		);
		expect(
			parts[0].functionResponse.response.transactions.map(
				(t: Transaction) => t.id,
			),
		).toEqual(["t1"]);
	});

	it("R1/R6: the functionCall is answered by the matching functionResponse", async () => {
		const session = buildSession();
		await render(session, [transaction("t1", "Coffee Bean")]);

		await clickButton("Approve");
		await settleFollowUp();

		const turns = outboundTurns();
		const callIndex = turns.findIndex((t) =>
			t.parts.some((p) => p.functionCall),
		);
		expect(callIndex).toBeGreaterThanOrEqual(0);

		const answer = turns[callIndex + 1];
		expect(answer).toBeDefined();
		expect(answer.role).toBe("user");
		expect(answer.parts.some((p) => p.functionResponse)).toBe(true);
	});

	it("R2/R7: rejecting delivers the rejection and runs no tool", async () => {
		const session = buildSession();
		await render(session, [transaction("t1", "Coffee Bean")]);

		await clickButton("Reject");

		const saved = onSaveSession.mock.calls[0][0];
		expect(saved.messages[0].status).toBe("rejected");

		await settleFollowUp();

		const parts = functionResponseParts();
		expect(parts).toHaveLength(1);
		expect(parts[0].functionResponse.response).toEqual({
			error: "User rejected the request",
		});
	});

	it("R3: deciding a request does not mutate the caller's messages", async () => {
		const session = buildSession();
		const snapshot = structuredClone(session.messages);
		await render(session, [transaction("t1", "Coffee Bean")]);

		await clickButton("Approve");

		expect(session.messages).toEqual(snapshot);
		expect(session.messages[0].status).toBe("pending");
	});
});
