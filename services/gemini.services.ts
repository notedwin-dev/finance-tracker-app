import { GoogleGenAI } from "@google/genai";
import { Account, Transaction, Category } from "../types";

export const getFinancialAdvice = async (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  query: string,
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  // Prepare context data
  const contextData = {
    accounts: accounts.map((a) => ({
      name: a.name,
      balance: a.balance,
      type: a.type,
    })),
    categories: categories.map((c) => ({ name: c.name, limit: c.budgetLimit })),
    recentTransactions: transactions.slice(0, 50).map((t) => ({
      date: t.date,
      shop: t.shopName,
      amount: t.amount,
      type: t.type,
      category:
        categories.find((c) => c.id === t.categoryId)?.name || "Uncategorized",
    })),
  };

  const prompt = `
    You are a helpful financial assistant. 
    Here is the user's current financial data:
    ${JSON.stringify(contextData, null, 2)}
    
    User Query: "${query}"
    
    Provide a concise, helpful, and friendly answer. 
    If the user asks about overspending, check the recent transactions against category limits.
    Format the response in Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while analyzing your finances.";
  }
};
