import { describe, it, expect } from "vitest";
import { ChatSession, ChatMessage } from "../../../../types";
import {
	buildOfflineSession,
	buildCurrentSession,
	buildAiMessage,
	buildErrorMessage,
	isFirstExchange,
	appendModelResponse,
	appendErrorResponse,
} from "../ai-sessions";

const makeUserMessage = (content = "hi"): ChatMessage => ({
	role: "user",
	content,
	timestamp: "2026-01-01T00:00:00.000Z",
});

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
	id: "s1",
	userId: "u1",
	title: "New Chat",
	messages: [makeUserMessage()],
	updatedAt: "2026-01-01T00:00:00.000Z",
	...overrides,
});

describe("buildOfflineSession", () => {
	it("appends offline reply to existing session with user message", () => {
		const session = makeSession();
		const out = buildOfflineSession(session, "hi", true, "u1");
		expect(out.messages).toHaveLength(3);
		expect(out.messages[1]).toMatchObject({ role: "user", content: "hi" });
		expect(out.messages[2].role).toBe("model");
		expect(out.messages[2].content).toContain("No Internet Connection");
		expect(out.id).toBe("s1");
	});

	it("omits user message when includeUserMessage is false", () => {
		const session = makeSession();
		const out = buildOfflineSession(session, "hi", false, "u1");
		expect(out.messages).toHaveLength(2);
		expect(out.messages[0]).toMatchObject({ role: "user", content: "hi" });
		expect(out.messages[1].role).toBe("model");
	});

	it("creates new session when none exists, with user + offline reply", () => {
		const out = buildOfflineSession(null, "hi", true, "u9");
		expect(out.userId).toBe("u9");
		expect(out.title).toBe("Offline Request");
		expect(out.messages).toHaveLength(2);
		expect(out.id).toBeDefined();
	});

	it("creates new session with offline reply only when includeUserMessage is false", () => {
		const out = buildOfflineSession(null, "hi", false, undefined);
		expect(out.userId).toBe("local");
		expect(out.messages).toHaveLength(1);
		expect(out.messages[0].role).toBe("model");
	});
});

describe("buildCurrentSession", () => {
	it("creates new session when none exists, including user message", () => {
		const out = buildCurrentSession(null, makeUserMessage("yo"), "u1");
		expect(out.userId).toBe("u1");
		expect(out.title).toBe("New Chat");
		expect(out.messages).toEqual([makeUserMessage("yo")]);
		expect(out.id).toBeDefined();
	});

	it("creates new session with empty messages when no user message", () => {
		const out = buildCurrentSession(null, null, "u1");
		expect(out.messages).toEqual([]);
	});

	it("defaults userId to 'guest' when none provided", () => {
		const out = buildCurrentSession(null, makeUserMessage(), undefined);
		expect(out.userId).toBe("guest");
	});

	it("appends user message to existing session", () => {
		const session = makeSession();
		const out = buildCurrentSession(session, makeUserMessage("next"), "u1");
		expect(out.id).toBe("s1");
		expect(out.messages).toHaveLength(2);
		expect(out.messages[1]).toMatchObject({ role: "user", content: "next" });
	});

	it("returns existing session unchanged when no user message", () => {
		const session = makeSession();
		const out = buildCurrentSession(session, null, "u1");
		expect(out.messages).toHaveLength(1);
	});
});

describe("buildAiMessage", () => {
	it("builds a model message with text and pending status when functionCall present", () => {
		const fnCall = { name: "foo", args: {} };
		const msg = buildAiMessage({ text: "ok", functionCall: fnCall }, "2026-01-01T00:00:00.000Z");
		expect(msg).toEqual({
			role: "model",
			content: "ok",
			timestamp: "2026-01-01T00:00:00.000Z",
			functionCall: fnCall,
			status: "pending",
		});
	});

	it("builds a model message with no status when no functionCall", () => {
		const msg = buildAiMessage({ text: "ok" }, "t");
		expect(msg.role).toBe("model");
		expect(msg.content).toBe("ok");
		expect(msg.status).toBeUndefined();
		expect(msg.functionCall).toBeUndefined();
	});
});

describe("buildErrorMessage", () => {
	it("includes err.message in the formatted error", () => {
		const msg = buildErrorMessage({ message: "boom" }, "t");
		expect(msg.content).toContain("boom");
		expect(msg.content).toContain("AI Error");
	});

	it("falls back to generic message when err has no message", () => {
		const msg = buildErrorMessage({}, "t");
		expect(msg.content).toContain("unexpected issue");
	});

	it("falls back when err is null/undefined", () => {
		const msg = buildErrorMessage(null, "t");
		expect(msg.content).toContain("unexpected issue");
	});
});

describe("isFirstExchange", () => {
	it("returns true for new chat with one user message and includeUserMessage true", () => {
		const session = makeSession({ title: "New Chat", messages: [makeUserMessage()] });
		expect(isFirstExchange(session, true)).toBe(true);
	});

	it("returns false when title is not 'New Chat'", () => {
		const session = makeSession({ title: "Hello", messages: [makeUserMessage()] });
		expect(isFirstExchange(session, true)).toBe(false);
	});

	it("returns false when more than one message", () => {
		const session = makeSession({
			title: "New Chat",
			messages: [makeUserMessage(), { role: "model", content: "ok", timestamp: "t" }],
		});
		expect(isFirstExchange(session, true)).toBe(false);
	});

	it("returns false when includeUserMessage is false", () => {
		const session = makeSession({ title: "New Chat", messages: [makeUserMessage()] });
		expect(isFirstExchange(session, false)).toBe(false);
	});
});

describe("appendModelResponse", () => {
	it("appends AI message and updates updatedAt", () => {
		const session = makeSession();
		const out = appendModelResponse(session, { text: "reply" });
		expect(out.messages).toHaveLength(2);
		expect(out.messages[1]).toMatchObject({ role: "model", content: "reply" });
		expect(out.updatedAt).not.toBe(session.updatedAt);
	});
});

describe("appendErrorResponse", () => {
	it("appends error message and updates updatedAt", () => {
		const session = makeSession();
		const out = appendErrorResponse(session, { message: "fail" });
		expect(out.messages).toHaveLength(2);
		expect(out.messages[1].content).toContain("AI Error");
		expect(out.messages[1].content).toContain("fail");
		expect(out.updatedAt).not.toBe(session.updatedAt);
	});
});
