import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	Account,
	Transaction,
	Category,
	ChatSession,
	ChatMessage,
	Pot,
	Goal,
	Subscription,
} from "../types";
import {
	streamFinancialAdvice,
	generateChatTitle,
} from "../services/gemini.services";
import { logger } from "../src/lib/infrastructure/logger";
import { MessageBubble } from "./ai-insights/MessageBubble";
import {
	runTool,
	buildFunctionResponseMessage,
	buildRejectionResponseMessage,
	appendMessageToSession,
} from "../src/lib/domain/ai-tools";
import {
	buildOfflineSession,
	buildCurrentSession,
	buildAiMessage,
	buildErrorMessage,
	isFirstExchange,
	appendModelResponse,
	appendErrorResponse,
} from "../src/lib/domain/ai-sessions";
import { ChatSidebar } from "./ai-insights/chat-sidebar";
import { ChatHeader } from "./ai-insights/chat-header";
import { ChatInput } from "./ai-insights/chat-input";
import { EmptyChatState, ChatLoadingBubble } from "./ai-insights/chat-empty-state";

const neuralVault = "/images/neural-vault.png";

interface Props {
	accounts: Account[];
	transactions: Transaction[];
	categories: Category[];
	pots: Pot[];
	goals: Goal[];
	subscriptions: Subscription[];
	sessions: ChatSession[];
	activeSessionId?: string;
	apiKey: string;
	isInline?: boolean;
	onClose: () => void;
	onSaveSession: (session: ChatSession) => void;
	onDeleteSession: (id: string) => void;
	onSelectSession: (id: string) => void;
	onNewChat: () => void;
}

const isErrorMessage = (m: ChatMessage) =>
	m.role === "model" && m.content.includes("🚨 **AI Error**");

const AIInsights: React.FC<Props> = ({
	accounts,
	transactions,
	categories,
	pots,
	goals,
	subscriptions,
	sessions,
	activeSessionId,
	apiKey,
	isInline = false,
	onClose,
	onSaveSession,
	onDeleteSession,
	onSelectSession,
	onNewChat,
}) => {
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [showSidebar, setShowSidebar] = useState(false);

	const activeSession = sessions.find((s) => s.id === activeSessionId);
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [activeSession?.messages, streamingText]);

	const handleOfflineAsk = (userQuery: string, includeUserMessage: boolean) => {
		const offlineSession = buildOfflineSession(
			activeSession,
			userQuery,
			includeUserMessage,
			accounts[0]?.userId,
		);
		onSaveSession(offlineSession);
		if (!activeSession) onSelectSession(offlineSession.id);
	};

	const prepareAskSession = (
		userQuery: string,
		sessionOverride: ChatSession | undefined,
		includeUserMessage: boolean,
	): ChatSession => {
		const userMessage: ChatMessage | null = includeUserMessage
			? { role: "user", content: userQuery, timestamp: new Date().toISOString() }
			: null;
		const sessionForTurn = sessionOverride || activeSession;
		return buildCurrentSession(sessionForTurn ?? null, userMessage, accounts[0]?.userId);
	};

	const streamAndPersistResponse = async (
		currentSession: ChatSession,
		userQuery: string,
	): Promise<ChatSession> => {
		const result = await streamFinancialAdvice(
			apiKey || "",
			accounts,
			transactions,
			categories,
			pots,
			goals,
			subscriptions,
			currentSession.messages,
			(chunk) => setStreamingText((prev) => prev + chunk),
		);
		const updatedSession = appendModelResponse(currentSession, result);
		if (isFirstExchange(currentSession, true) && result.text) {
			updatedSession.title = await generateChatTitle(
				apiKey || "",
				userQuery,
				result.text,
			);
		}
		return updatedSession;
	};

	const handleAsk = async (
		e?: React.FormEvent,
		overrideQuery?: string,
		sessionOverride?: ChatSession,
		includeUserMessage: boolean = true,
	) => {
		e?.preventDefault();
		const activeQuery = overrideQuery || query;
		if ((includeUserMessage && !activeQuery.trim()) || loading) return;

		const userQuery = activeQuery.trim();
		if (includeUserMessage) setQuery("");

		if (!navigator.onLine) {
			handleOfflineAsk(userQuery, includeUserMessage);
			return;
		}

		setLoading(true);
		setStreamingText("");

		const currentSession = prepareAskSession(userQuery, sessionOverride, includeUserMessage);
		onSaveSession(currentSession);
		if (!sessionOverride) onSelectSession(currentSession.id);

		try {
			const updatedSession = await streamAndPersistResponse(currentSession, userQuery);
			onSaveSession(updatedSession);
			setStreamingText("");
		} catch (err: any) {
			logger.error(err);
			onSaveSession(appendErrorResponse(currentSession, err));
		} finally {
			setLoading(false);
		}
	};

	const handleToolAction = async (msgIndex: number, approved: boolean) => {
		if (!activeSession) return;

		const messages = [...activeSession.messages];
		const msg = messages[msgIndex];
		if (!msg.functionCall) return;

		if (!approved) {
			msg.status = "rejected";
			const updatedSession = appendMessageToSession(
				activeSession,
				buildRejectionResponseMessage(msg.functionCall.name),
			);
			onSaveSession(updatedSession);
			setTimeout(() => {
				handleAsk(undefined, "", updatedSession, false);
			}, 100);
			return;
		}

		msg.status = "approved";
		const responsePayload = await runTool(msg.functionCall.name, msg.functionCall.args || {}, {
			transactions,
			categories,
		});

		const nextSession = appendMessageToSession(
			activeSession,
			buildFunctionResponseMessage(msg.functionCall.name, responsePayload),
		);
		onSaveSession(nextSession);

		setTimeout(() => {
			handleAsk(undefined, "", nextSession, false);
		}, 100);
	};

	const handleSuggestionClick = (suggestion: string) => {
		setQuery(suggestion);
		const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
		handleAsk(fakeEvent, suggestion);
	};

	const suggestions = [
		"How much did I spend this week?",
		"Am I staying within my spending limits?",
		"Analyze my biggest expense category.",
		"Help me create a budget for next month.",
	];

	return (
		<div
			className={
				isInline
					? "flex w-full h-full bg-transparent relative overflow-hidden"
					: "fixed inset-0 bg-background z-100 flex animate-fadeIn"
			}
		>
			<ChatSidebar
				isOpen={showSidebar}
				isInline={isInline}
				sessions={sessions}
				activeSessionId={activeSessionId}
				onNewChat={onNewChat}
				onSelectSession={onSelectSession}
				onDeleteSession={onDeleteSession}
				onClose={() => setShowSidebar(false)}
			/>

			<div className="flex-1 flex flex-col relative h-full overflow-hidden">
				<ChatHeader
					isInline={isInline}
					title={activeSession?.title || "AI Assistant"}
					onOpenSidebar={() => setShowSidebar(true)}
					onClose={onClose}
				/>

				<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
					{!activeSession && !loading && (
						<EmptyChatState
							neuralVault={neuralVault}
							suggestions={suggestions}
							onSelectSuggestion={handleSuggestionClick}
						/>
					)}

					{activeSession?.messages.map((m, i) => {
						if (m.functionResponse && !m.content.trim()) return null;
						const { cleanText, suggestions: aiSuggestions } = parseMessage(
							m.content,
						);
						return (
							<MessageBubble
								key={i}
								message={m}
								isError={isErrorMessage(m)}
								cleanText={cleanText}
								suggestions={aiSuggestions}
								onApproveTool={() => handleToolAction(i, true)}
								onRejectTool={() => handleToolAction(i, false)}
								onSuggestionClick={(suggestion) =>
									handleAsk(undefined, suggestion)
								}
							/>
						);
					})}

					{loading && !streamingText && <ChatLoadingBubble />}

					{streamingText && (
						<div className="flex justify-start">
							<div className="max-w-[85%] sm:max-w-[75%] bg-surface border border-gray-800 text-gray-200 rounded-2xl rounded-tl-none p-4 sm:p-5">
								<div className="prose prose-invert prose-sm max-w-none wrap-break-word prose-p:leading-relaxed prose-headings:text-white prose-headings:font-black prose-strong:text-primary">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{parseMessage(streamingText).cleanText}
									</ReactMarkdown>
								</div>
								<div className="mt-2 flex items-center gap-1">
									<div className="w-1 h-1 bg-primary rounded-full animate-bounce" />
									<div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
									<div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
								</div>
							</div>
						</div>
					)}

					<div ref={chatEndRef} />
				</div>

				<ChatInput
					query={query}
					loading={loading}
					onQueryChange={setQuery}
					onSubmit={handleAsk}
				/>
			</div>
		</div>
	);
};

const parseMessage = (raw: string): { cleanText: string; suggestions: string[] } => {
	const suggestionRegex = /\[\[SUGGESTION:\s*(.*?)\]\]/g;
	const suggestions: string[] = [];
	const cleanText = raw.replace(suggestionRegex, (_, text) => {
		suggestions.push(text.trim());
		return "";
	});
	return { cleanText, suggestions };
};

export default AIInsights;
