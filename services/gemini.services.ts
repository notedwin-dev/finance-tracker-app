import { GoogleGenAI, Type } from "@google/genai";
import {
	Account,
	Transaction,
	Category,
	ChatMessage,
	Pot,
	Goal,
	Subscription,
	TransactionType,
} from "../types";

const BACKEND_URL =
	import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001";

const getClient = (apiKey?: string) => {
	const finalKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
	if (!finalKey) {
		throw new Error("No Gemini API key provided.");
	}
	return new GoogleGenAI({ apiKey: finalKey });
};

const historicalTransactionsTool = {
	functionDeclarations: [
		{
			name: "get_historical_transactions",
			description:
				"Query all historical transactions (beyond the recent 50 provided in context). Use this to answer questions about past spending, trends, or specific shops not in the recent list.",
			parameters: {
				type: Type.OBJECT,
				properties: {
					searchKeyword: {
						type: Type.STRING,
						description: "Shop name or description to filter by",
					},
					startDate: {
						type: Type.STRING,
						description: "Start date in YYYY-MM-DD format",
					},
					endDate: {
						type: Type.STRING,
						description: "End date in YYYY-MM-DD format",
					},
					categoryName: {
						type: Type.STRING,
						description: "The name of the category to filter by",
					},
				},
			},
		},
	],
};

const prepareContext = (
	accounts: Account[],
	transactions: Transaction[],
	categories: Category[],
	pots: Pot[],
	goals: Goal[],
	subscriptions: Subscription[],
) => {
	return {
		snapshotDate: new Date().toISOString(),
		accounts: accounts.map((a) => ({
			name: a.name,
			balance: a.balance,
			type: a.type,
			currency: a.currency,
			updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : "Unknown",
		})),
		categories: categories.map((c) => ({
			name: c.name,
			limit: c.budgetLimit,
			period: c.budgetPeriod,
			updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : "Unknown",
		})),
		recentTransactions: transactions.slice(0, 50).map((t) => ({
			date: t.date,
			shop: t.shopName,
			amount: t.amount,
			type: t.type,
			category:
				categories.find((c) => c.id === t.categoryId)?.name || "Uncategorized",
			note: t.note,
		})),
		spendingLimits: pots.map((p) => ({
			name: p.name,
			totalBudgetLimit: p.limitAmount,
			remainingAvailableBudget: p.amountLeft,
			amountUsed: p.usedAmount,
			linkedAccount: accounts.find((a) => a.id === p.accountId)?.name,
			updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : "Unknown",
		})),
		goals: goals.map((g) => ({
			name: g.name,
			targetAmount: g.targetAmount,
			currentAmount: g.linkedAccountId
				? accounts.find((a) => a.id === g.linkedAccountId)?.balance
				: g.currentAmount,
			deadline: g.deadline,
			type: g.type,
			updatedAt: g.updatedAt ? new Date(g.updatedAt).toISOString() : "Unknown",
		})),
		subscriptions: subscriptions.map((s) => ({
			name: s.name,
			amount: s.amount,
			frequency: s.frequency,
			nextPayment: s.nextPaymentDate,
			active: s.active,
			category: categories.find((c) => c.id === s.categoryId)?.name,
		})),
	};
};

export const streamFinancialAdvice = async (
	apiKey: string,
	accounts: Account[],
	transactions: Transaction[],
	categories: Category[],
	pots: Pot[],
	goals: Goal[],
	subscriptions: Subscription[],
	history: ChatMessage[],
	onChunk: (chunk: string) => void,
): Promise<{ text: string; functionCall?: any }> => {
	const contextData = prepareContext(
		accounts,
		transactions,
		categories,
		pots,
		goals,
		subscriptions,
	);

	// IF NO API KEY PROVIDED, USE BACKEND PROXY
	if (!apiKey) {
		try {
			const response = await fetch(`${BACKEND_URL}/ai/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ history, context: contextData }),
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				if (response.status === 429) {
					throw new Error(
						"Gemini API Quota Exceeded (Free Tier is limited to a few requests per minute/day). Please try again in a moment.",
					);
				}
				throw new Error(err.error || "Failed to get AI advice");
			}

			// Check if it's a function call (non-streaming JSON)
			const contentType = response.headers.get("Content-Type");
			if (contentType?.includes("application/json")) {
				return await response.json();
			}

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			let fullText = "";

			if (!reader) throw new Error("Failed to read response stream");

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				fullText += chunk;
				onChunk(chunk);
			}

			return { text: fullText };
		} catch (error) {
			console.error("Proxy AI Error:", error);
			throw error;
		}
	}

	try {
		const ai = getClient(apiKey);

		const systemInstruction = `
      You are ZenFinance AI, a helpful and minimalist financial assistant. 
      Your goal is to provide clear, actionable financial advice based on the user's data.
      
      CRITICAL: Always prioritize the "Current Financial Context" provided below over any data mentioned in previous messages. 
      The user's financial state (balances, goals, pots, subscriptions) may have changed since earlier in the conversation.
      
      "updatedAt" timestamps are provided for accounts, goals, and pots. Use these to determine how recently the data was modified.
      
      "Spending Limits" (pots):
      - "totalBudgetLimit" is the total budget for the period.
      - "remainingAvailableBudget" is how much the user has LEFT to spend.
      - Money Spent = totalBudgetLimit - remainingAvailableBudget.
      - Spent Percentage = (Money Spent / totalBudgetLimit) * 100.
      
      Current Financial Context (Snapshot Date/Time: ${new Date().toLocaleString()}):
      ${JSON.stringify(contextData, null, 2)}
      
      Rules:
      1. Be concise and friendly.
      2. Use Markdown for formatting. Use headers (###), bold text, and bullet points to make info digestible.
      3. Use double newlines between paragraphs and headers to ensure proper spacing.
      4. If asked about spending, reference their specific categories and limits.
      5. Never give professional investment advice; always include a disclaimer if needed but keep it brief.
      6. Always respond in the language the user is using.
      7. Follow-up Suggestions (UI Elements):
         At the very end of your response, provide 3-4 follow-up suggestions for the user.
         These will be rendered as clickable UI buttons to help the user continue the conversation.
         The suggestions MUST be phrased from the USER'S perspective.
         Format:
         <suggestion>User Command 1</suggestion>
         <suggestion>User Command 2</suggestion>
      
      TOOLS & SECURITY:
      - You have access to tools to query historical transactions.
      - When you use a tool, the user will be asked to APPROVE or REJECT the data access.
      - If historical context for goals or pots is needed, look at related transactions using the tool.
    `;

		// Map history to Google GenAI SDK format
		const contents: any[] = history.map((m) => {
			const parts: any[] = [];

			if (m.functionResponse) {
				return {
					role: "function",
					parts: [
						{
							functionResponse: {
								name: m.functionResponse.name,
								response: m.functionResponse.response,
							},
						},
					],
				};
			}

			if (m.content) parts.push({ text: m.content });
			if (m.functionCall) parts.push({ functionCall: m.functionCall });

			return {
				role: m.role === "user" ? "user" : "model",
				parts,
			};
		});

		const chat = ai.chats.create({
			model: "gemini-2.5-flash",
			history: contents.slice(0, -1),
			config: {
				systemInstruction: systemInstruction,
				tools: [historicalTransactionsTool],
			},
		});

		const lastTurn = contents[contents.length - 1];
		const message = lastTurn.parts[0]?.text || "";
		const response = await chat.sendMessageStream(message);

		let fullText = "";
		let functionCall: any = null;

		for await (const chunk of response) {
			if (chunk.text) {
				fullText += chunk.text;
				onChunk(chunk.text);
			}

			// In the new SDK, functionCalls are collected on the response/chunk
			if (chunk.functionCalls && chunk.functionCalls.length > 0) {
				functionCall = chunk.functionCalls[0];
			}
		}

		return { text: fullText, functionCall };
	} catch (error: any) {
		console.error("Gemini Streaming Error:", error);
		if (error?.status === 429) {
			throw new Error(
				"Gemini API Quota Exceeded. You have reached the limit for the Free Tier (usually 20-50 requests per day). Please check your Google AI Studio dashboard or try again later.",
			);
		}
		throw error;
	}
};

export const generateChatTitle = async (
	apiKey: string,
	firstQuestion: string,
	firstAnswer: string,
): Promise<string> => {
	if (!apiKey) {
		try {
			const response = await fetch(`${BACKEND_URL}/ai/title`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: firstQuestion,
					answer: firstAnswer,
				}),
			});

			if (!response.ok) {
				return "New Financial Chat";
			}

			const data = await response.json();
			return data.title || "New Financial Chat";
		} catch (e) {
			console.error("Proxy Title Error:", e);
			return "New Financial Chat";
		}
	}

	try {
		const ai = getClient(apiKey);
		const prompt = `
      Based on this first exchange in a financial chat, generate a very short (max 4 words) title.
      Question: "${firstQuestion}"
      Answer: "${firstAnswer.slice(0, 100)}..."
      
      Title:
    `;

		const result = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: prompt,
		});
		const text = result.text;
		return text.replace(/"/g, "").trim() || "New Chat";
	} catch (e) {
		console.error("Title Generation Error:", e);
		return "New Financial Chat";
	}
};

/**
 * Parses a bank statement (PDF, Image or CSV) and returns structured transactions.
 */
export const parseBankStatement = async (
	apiKey: string,
	fileBase64: string,
	mimeType: string,
): Promise<Partial<Transaction>[]> => {
	try {
		const ai = getClient(apiKey);
		const isText = mimeType.includes("text") || mimeType.includes("csv");

		const prompt = `
      Extract all transactions from this ${isText ? "CSV file" : "bank statement"}. 
      Analyze the data thoroughly and find every single transaction record.
      
      Return a JSON array of objects with the following keys:
      - date: string (YYYY-MM-DD)
      - amount: number (positive for both income and expense)
      - type: string (one of: "EXPENSE", "INCOME", "TRANSFER")
      - shopName: string (clean merchant name)
      - note: string (original description)
      - currency: string (e.g. "MYR", "USD")
      
      Business Rules:
      1. Dates must be converted to YYYY-MM-DD.
      2. Type should be "INCOME" if money is entering the account, "EXPENSE" if leaving.
      3. CLEAN the shopName. Remove garbage codes (e.g. T42256, dates, reference numbers).
      4. If it looks like a Transfer between own accounts (e.g. "To Savings"), use "TRANSFER".
    `;

		let parts: any[] = [{ text: prompt }];

		if (isText) {
			// For CSV/Text, we decode and send as part of the prompt text for better accuracy
			const textContent = atob(fileBase64);
			parts.push({ text: `DATA CONTENT:\n${textContent}` });
		} else {
			parts.push({ inlineData: { data: fileBase64, mimeType } });
		}

		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [
				{
					role: "user",
					parts,
				},
			],
			config: {
				responseMimeType: "application/json",
			},
		});

		const text = response.text;
		if (!text) throw new Error("No data extracted from statement");

		// The new SDK might already parse this if responseMimeType is application/json
		// but usually it returns a string in .text.
		const parsed = typeof text === "string" ? JSON.parse(text) : text;
		return Array.isArray(parsed) ? parsed : parsed.transactions || [];
	} catch (error) {
		console.error("Bank Statement Parsing Error:", error);
		throw new Error(
			"Failed to parse bank statement. Please ensure the file is clear and supported.",
		);
	}
};
