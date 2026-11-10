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

/** Controllable stand-ins for the browser-bound location tools. */
const locationMock = vi.hoisted(() => ({
	getCurrentLocation: vi.fn(),
	fetchNearbyFood: vi.fn(),
}));

vi.mock("../services/location.services", async (importOriginal) => ({
	...(await importOriginal<typeof import("../services/location.services")>()),
	...locationMock,
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

const buildSession = (
	toolName = "get_historical_transactions",
	args: Record<string, unknown> = { searchKeyword: "coffee" },
): ChatSession => {
	const pending: ChatMessage = {
		role: "model",
		content: "I need to access your data.",
		timestamp: FIXED_NOW,
		functionCall: {
			name: toolName,
			args,
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
		await renderSessions([session], session.id, transactions);
	};

	const renderSessions = async (
		sessions: ChatSession[],
		activeSessionId: string,
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
					sessions={sessions}
					activeSessionId={activeSessionId}
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

	/** Flush pending microtasks without firing timers. */
	const flushMicrotasks = async () => {
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});
	};

	/**
	 * onSaveSession fires for every stage of a turn (decision, follow-up
	 * request, AI reply). Only the decision save ends with a functionResponse
	 * message, so that is what a decision is counted by.
	 */
	const decisionSaveCount = () =>
		onSaveSession.mock.calls.filter(([saved]: any[]) => {
			const last = saved.messages[saved.messages.length - 1];
			return Boolean(last?.functionResponse);
		}).length;

	beforeEach(() => {
		capture.chatsCreateArgs = [];
		capture.sendMessageArgs = [];
		onSaveSession = vi.fn();
		locationMock.getCurrentLocation.mockReset();
		locationMock.fetchNearbyFood.mockReset();
		locationMock.fetchNearbyFood.mockResolvedValue({ places: [] });
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

	it("R3: blocks a second decision while the first is still in flight", async () => {
		const pendingLookups: Array<(value: any) => void> = [];
		locationMock.getCurrentLocation.mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingLookups.push(resolve);
				}),
		);

		await render(buildSession("get_current_location"));

		// A slow location lookup leaves the request's status pending in the
		// rendered session, so the buttons stay clickable. A second click
		// must not start a second decision.
		await clickButton("Approve");
		await clickButton("Approve");

		pendingLookups.forEach((resolve) =>
			resolve({ latitude: 3, longitude: 4, accuracyMeters: 5 }),
		);
		await flushMicrotasks();

		expect(locationMock.getCurrentLocation).toHaveBeenCalledTimes(1);
		expect(decisionSaveCount()).toBe(1);
		const saved = onSaveSession.mock.calls[0][0];
		expect(saved.messages[0].status).toBe("approved");
		expect(
			saved.messages.filter((m: ChatMessage) => m.functionResponse),
		).toHaveLength(1);
	});

	it("R3: keeps messages sent during the decision in the saved session", async () => {
		const pendingLookups: Array<(value: any) => void> = [];
		locationMock.getCurrentLocation.mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingLookups.push(resolve);
				}),
		);

		const session = buildSession("get_current_location");
		await render(session);

		await clickButton("Approve");

		// The chat input stays enabled while the tool runs, so the user can
		// send a message mid-decision. The decision save must not drop it.
		const userMessage: ChatMessage = {
			role: "user",
			content: "and somewhere to eat?",
			timestamp: FIXED_NOW,
		};
		await render({
			...session,
			messages: [...session.messages, userMessage],
		});

		pendingLookups.forEach((resolve) =>
			resolve({ latitude: 3, longitude: 4, accuracyMeters: 5 }),
		);
		await flushMicrotasks();

		const decisionSave = onSaveSession.mock.calls[0][0];
		expect(decisionSave.messages[0].status).toBe("approved");
		expect(
			decisionSave.messages.some(
				(m: ChatMessage) => m.content === "and somewhere to eat?",
			),
		).toBe(true);
		const last = decisionSave.messages[decisionSave.messages.length - 1];
		expect(last.functionResponse).toBeTruthy();
	});

	it("R3: does not apply a decision after the user switches chats", async () => {
		const pendingLookups: Array<(value: any) => void> = [];
		locationMock.getCurrentLocation.mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingLookups.push(resolve);
				}),
		);

		const session = buildSession("get_current_location");
		const other: ChatSession = {
			id: "chat-2",
			userId: "test-user",
			title: "Other Chat",
			messages: [],
			updatedAt: FIXED_NOW,
		};
		await render(session);

		await clickButton("Approve");

		// The sidebar stays live while the tool runs; the user switches to
		// another chat. The tool result must not land in that chat.
		await renderSessions([session, other], "chat-2");

		pendingLookups.forEach((resolve) =>
			resolve({ latitude: 3, longitude: 4, accuracyMeters: 5 }),
		);
		await flushMicrotasks();

		expect(onSaveSession).not.toHaveBeenCalled();
	});

	it("R3: does not re-save a session that was deleted during the decision", async () => {
		const pendingLookups: Array<(value: any) => void> = [];
		locationMock.getCurrentLocation.mockImplementation(
			() =>
				new Promise((resolve) => {
					pendingLookups.push(resolve);
				}),
		);

		const session = buildSession("get_current_location");
		await render(session);

		await clickButton("Approve");

		// The user deletes the chat while the tool runs; the decision must
		// not resurrect it.
		await renderSessions([], "chat-1");

		pendingLookups.forEach((resolve) =>
			resolve({ latitude: 3, longitude: 4, accuracyMeters: 5 }),
		);
		await flushMicrotasks();

		expect(onSaveSession).not.toHaveBeenCalled();
	});

	it("R3: allows a further decision once the previous one has completed", async () => {
		const pendingLookups: Array<(value: any) => void> = [];
		locationMock.getCurrentLocation
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						pendingLookups.push(resolve);
					}),
			)
			.mockResolvedValue({ latitude: 1, longitude: 2, accuracyMeters: 3 });

		await render(buildSession("get_current_location"));

		await clickButton("Approve"); // hangs on the location lookup
		await clickButton("Approve"); // blocked by the in-flight guard

		pendingLookups.forEach((resolve) =>
			resolve({ latitude: 3, longitude: 4, accuracyMeters: 5 }),
		);
		await flushMicrotasks();
		expect(locationMock.getCurrentLocation).toHaveBeenCalledTimes(1);
		expect(decisionSaveCount()).toBe(1);

		// The parent still renders the pending request, so the buttons are
		// clickable again; the guard must have been cleared.
		await clickButton("Approve");
		await flushMicrotasks();

		expect(locationMock.getCurrentLocation).toHaveBeenCalledTimes(2);
		expect(decisionSaveCount()).toBe(2);
	});
});
