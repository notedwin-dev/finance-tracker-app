import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import {
  Account,
  Transaction,
  Category,
  ChatMessage,
  Pot,
  Goal,
} from "../types";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001";

const getModel = (apiKey?: string) => {
  const finalKey = apiKey || import.meta.env.VITE_GOOGLE_API_KEY;
  if (!finalKey) {
    throw new Error("No Gemini API key provided.");
  }

  const genAI = new GoogleGenerativeAI(finalKey);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

const prepareContext = (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  pots: Pot[],
  goals: Goal[],
) => {
  return {
    accounts: accounts.map((a) => ({
      name: a.name,
      balance: a.balance,
      type: a.type,
      currency: a.currency,
    })),
    categories: categories.map((c) => ({
      name: c.name,
      limit: c.budgetLimit,
      period: c.budgetPeriod,
    })),
    recentTransactions: transactions.slice(0, 50).map((t) => ({
      date: t.date,
      shop: t.shopName,
      amount: t.amount,
      type: t.type,
      category:
        categories.find((c) => c.id === t.categoryId)?.name || "Uncategorized",
    })),
    savingPots: pots.map((p) => ({
      name: p.name,
      targetAmount: p.targetAmount,
      currentAmount: p.currentAmount,
      linkedAccount: p.accountId,
    })),
    goals: goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      deadline: g.deadline,
      type: g.type,
      linkedAccount: g.linkedAccountId,
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
  history: ChatMessage[],
  onChunk: (chunk: string) => void,
): Promise<string> => {
  const contextData = prepareContext(
    accounts,
    transactions,
    categories,
    pots,
    goals,
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
        const err = await response.json();
        throw new Error(err.error || "Failed to get AI advice");
      }

      const data = await response.json();
      onChunk(data.text);
      return data.text;
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
      
      Current Financial Context:
      ${JSON.stringify(contextData, null, 2)}
      
      Rules:
      1. Be concise and friendly.
      2. Use Markdown for formatting. Use headers (###), bold text, and bullet points to make info digestible.
      3. Use double newlines between paragraphs and headers to ensure proper spacing.
      4. If asked about spending, reference their specific categories and limits.
      5. Never give professional investment advice; always include a disclaimer if needed but keep it brief.
      6. Always respond in the language the user is using.
      7. At the end of your response, provide 2-3 brief follow-up suggestions in the format:
         <suggestion>Question 1?</suggestion>
         <suggestion>Question 2?</suggestion>
    `;

    // Map history to Google's format
    const contents: Content[] = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // Add system instruction as the first turn or prefix
    const chat = model.startChat({
      history: [
        ...contents.slice(0, -1), // Everything except the last message which is the current query
      ],
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
    });

    const lastMessage = contents[contents.length - 1].parts[0].text || "";
    const result = await chat.sendMessageStream(lastMessage);

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(chunkText);
    }

    return fullText;
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    throw error;
  }
};

export const generateChatTitle = async (
  apiKey: string,
  firstQuestion: string,
  firstAnswer: string,
): Promise<string> => {
  if (!apiKey) {
    // For simplicity, we can just return a generic title or reuse the proxy
    // but a generic one is safer and faster for free tier
    return "New Financial Chat";
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
