import { ChatSession, ChatMessage } from "../../../types";
import { appendMessageToSession } from "./ai-tools";

export const buildOfflineSession = (
	session: ChatSession | null,
	userQuery: string,
	includeUserMessage: boolean,
	userId: string | undefined,
): ChatSession => {
	const now = new Date().toISOString();
	const offlineMsg: ChatMessage = {
		role: "model",
		content:
			"🚫 **No Internet Connection**\n\nI need an active internet connection to process your request. Please check your connection and try again.",
		timestamp: now,
	};
	if (session) {
		return {
			...session,
			messages: includeUserMessage
				? [
						...session.messages,
						{ role: "user", content: userQuery, timestamp: now } as ChatMessage,
						offlineMsg,
					]
				: [...session.messages, offlineMsg],
			updatedAt: now,
		};
	}
	return {
		id: crypto.randomUUID(),
		userId: userId || "local",
		title: "Offline Request",
		messages: includeUserMessage
			? [
					{ role: "user", content: userQuery, timestamp: now } as ChatMessage,
					offlineMsg,
				]
			: [offlineMsg],
		updatedAt: now,
	};
};

export const buildCurrentSession = (
	session: ChatSession | null,
	userMessage: ChatMessage | null,
	userId: string | undefined,
): ChatSession => {
	const now = new Date().toISOString();
	if (!session) {
		return {
			id: crypto.randomUUID(),
			userId: userId || "guest",
			title: "New Chat",
			messages: userMessage ? [userMessage] : [],
			updatedAt: now,
		};
	}
	return {
		...session,
		messages: userMessage ? [...session.messages, userMessage] : [...session.messages],
		updatedAt: now,
	};
};

export const buildAiMessage = (
	result: { text: string; functionCall?: any },
	timestamp: string,
): ChatMessage => ({
	role: "model",
	content: result.text,
	timestamp,
	functionCall: result.functionCall,
	status: result.functionCall ? "pending" : undefined,
});

export const buildErrorMessage = (err: any, timestamp: string): ChatMessage => ({
	role: "model",
	content: `🚨 **AI Error**\n\n${
		err?.message || "I encountered an unexpected issue."
	}\n\n*Please ensure your API Key is correct or try again in a few moments.*`,
	timestamp,
});

export const isFirstExchange = (
	session: ChatSession,
	includeUserMessage: boolean,
): boolean =>
	includeUserMessage &&
	session.title === "New Chat" &&
	session.messages.length === 1;

export const appendModelResponse = (
	session: ChatSession,
	result: { text: string; functionCall?: any },
): ChatSession =>
	appendMessageToSession(session, buildAiMessage(result, new Date().toISOString()));

export const appendErrorResponse = (
	session: ChatSession,
	err: any,
): ChatSession =>
	appendMessageToSession(session, buildErrorMessage(err, new Date().toISOString()));
