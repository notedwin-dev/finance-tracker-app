import { GoogleGenerativeAI, Content, SchemaType } from "@google/generative-ai";
import {
  Account,
  Transaction,
  Category,
  ChatMessage,
  Pot,
  Goal,
  Subscription,
} from "../types";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001";

const getModel = (apiKey?: string) => {
  const finalKey = apiKey || import.meta.env.VITE_GOOGLE_API_KEY;
  if (!finalKey) {
    throw new Error("No Gemini API key provided.");
  }

  const genAI = new GoogleGenerativeAI(finalKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [
      {
        functionDeclarations: [
          {
            name: "get_historical_transactions",
            description:
              "Query all historical transactions (beyond the recent 50 provided in context). Use this to answer questions about past spending, trends, or specific shops not in the recent list.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                searchKeyword: {
                  type: SchemaType.STRING,
                  description: "Shop name or description to filter by",
                },
                startDate: {
                  type: SchemaType.STRING,
                  description: "Start date in YYYY-MM-DD format",
                },
                endDate: {
                  type: SchemaType.STRING,
                  description: "End date in YYYY-MM-DD format",
                },
                categoryName: {
                  type: SchemaType.STRING,
                  description: "The name of the category to filter by",
                },
              },
            },
          },
        ],
      },
    ],
  });
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
      totalBudgetLimit: p.targetAmount,
      remainingAvailableBudget: p.currentAmount,
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
    const model = getModel(apiKey);

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

    // Map history to Google's format
    const contents: any[] = history.map((m) => {
      if (m.functionResponse) {
        return {
          role: "function",
          parts: [{ functionResponse: m.functionResponse }],
        };
      }
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.functionCall) parts.push({ functionCall: m.functionCall });

      return {
        role: m.role === "user" ? "user" : "model",
        parts,
      };
    });

    const chat = model.startChat({
      history: contents.slice(0, -1),
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
    });

    const lastTurn = contents[contents.length - 1];
    const result = await chat.sendMessageStream(lastTurn.parts);

    let fullText = "";
    let functionCall: any = null;

    for await (const chunk of result.stream) {
      const parts = chunk.candidates[0].content.parts;
      for (const part of parts) {
        if (part.text) {
          fullText += part.text;
          onChunk(part.text);
        }
        if (part.functionCall) {
          functionCall = part.functionCall;
        }
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
    const model = getModel(apiKey);
    const prompt = `
      Based on this first exchange in a financial chat, generate a very short (max 4 words) title.
      Question: "${firstQuestion}"
      Answer: "${firstAnswer.slice(0, 100)}..."
      
      Title:
    `;

    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    return text.replace(/"/g, "").trim() || "New Chat";
  } catch (e) {
    console.error("Title Generation Error:", e);
    return "New Financial Chat";
  }
};
