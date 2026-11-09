import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AIInsights from "../components/AIInsights";
import { ChatMessage, ChatSession } from "../types";

vi.mock("../services/gemini.services", () => ({
	streamFinancialAdvice: vi.fn().mockResolvedValue({
		text: "Handled",
		functionCall: null,
	}),
	generateChatTitle: vi.fn().mockResolvedValue("Chat"),
}));

describe("AIInsights tool approval actions", () => {
	let root: Root;
	let host: HTMLDivElement;

	beforeEach(() => {
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

	it("rejects a data access request without mutating existing message objects", async () => {
		const pending: ChatMessage = Object.freeze({
			role: "model",
			content: "I need to access your transaction history.",
			timestamp: "2026-01-01T00:00:00.000Z",
			functionCall: Object.freeze({
				name: "get_historical_transactions",
				args: Object.freeze({ searchKeyword: "coffee" }),
			}),
			status: "pending",
		});
		const session: ChatSession = {
			id: "chat-1",
			userId: "test-user",
			title: "Test Chat",
			messages: [pending],
			updatedAt: "2026-01-01T00:00:00.000Z",
		};
		const onSaveSession = vi.fn();

		await act(async () => {
			root.render(
				<AIInsights
					accounts={[]}
					transactions={[]}
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

		const rejectButton = Array.from(host.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Reject",
		);
		expect(rejectButton).toBeTruthy();

		await act(async () => {
			rejectButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});

		expect(onSaveSession).toHaveBeenCalledTimes(1);
		expect(onSaveSession.mock.calls[0][0].messages[0].status).toBe("rejected");
	});
});
