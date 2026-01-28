import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { Account, Transaction, Category, ChatMessage } from "../types";

const getModel = (apiKey?: string) => {
  const genAI = new GoogleGenerativeAI(
    apiKey || import.meta.env.VITE_GOOGLE_API_KEY,
  );
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};

const prepareContext = (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
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
  };
};

export const streamFinancialAdvice = async (
  apiKey: string,
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  history: ChatMessage[],
  onChunk: (chunk: string) => void,
): Promise<string> => {
  try {
    const model = getModel(apiKey);
    const contextData = prepareContext(accounts, transactions, categories);

    const systemInstruction = `
      You are ZenFinance AI, a helpful and minimalist financial assistant. 
      Your goal is to provide clear, actionable financial advice based on the user's data.
      
      Current Financial Context:
      ${JSON.stringify(contextData, null, 2)}
      
      Rules:
      1. Be concise and friendly.
      2. Use Markdown for formatting.
      3. If asked about spending, reference their specific categories and limits.
      4. Never give professional investment advice; always include a disclaimer if needed but keep it brief.
      5. Always respond in the language the user is using.
    `;

    // Map history to Google's format
    const contents: Content[] = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    // Add system instruction as the first turn or prefix
    const chat = model.startChat({
      history: [
        {
          role: "system",
          parts: [{ text: systemInstruction }],
        },
        {
          role: "model",
          parts: [
            {
              text: "Understood. I am now ZenFinance AI, your minimalist financial assistant. How can I help you today?",
            },
          ],
        },
        ...contents.slice(0, -1), // Everything except the last message which is the current query
      ],
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
