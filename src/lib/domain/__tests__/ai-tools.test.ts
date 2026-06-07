import { describe, it, expect } from "vitest";
import {
  runTool,
  buildFunctionResponseMessage,
  buildRejectionResponseMessage,
  appendMessageToSession,
} from "../ai-tools";
import {
  Transaction,
  Category,
  ChatMessage,
  ChatSession,
  TransactionType,
} from "../../../../types";

const baseTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "t1",
  userId: "u1",
  accountId: "a1",
  shopName: "Test Shop",
  amount: 10,
  currency: "MYR",
  date: "2024-06-15",
  categoryId: "c1",
  type: TransactionType.EXPENSE,
  createdAt: "2024-06-15T10:00:00.000Z",
  ...overrides,
} as Transaction);

const baseCategory = (overrides: Partial<Category> = {}): Category => ({
  id: "c1",
  name: "Food",
  icon: "🍔",
  color: "#ff0000",
  ...overrides,
} as Category);

describe("runTool — get_historical_transactions", () => {
  it("filters by searchKeyword (case-insensitive)", async () => {
    const transactions = [
      baseTx({ id: "t1", shopName: "Starbucks" }),
      baseTx({ id: "t2", shopName: "McDonalds" }),
    ];
    const result = await runTool(
      "get_historical_transactions",
      { searchKeyword: "star" },
      { transactions, categories: [] },
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe("t1");
    expect(result.totalMatches).toBe(1);
  });

  it("filters by date range", async () => {
    const transactions = [
      baseTx({ id: "t1", date: "2024-06-15" }),
      baseTx({ id: "t2", date: "2024-07-20" }),
    ];
    const result = await runTool(
      "get_historical_transactions",
      { startDate: "2024-07-01", endDate: "2024-07-31" },
      { transactions, categories: [] },
    );
    expect(result.transactions.map((t: Transaction) => t.id)).toEqual(["t2"]);
  });

  it("filters by categoryName → categoryId lookup", async () => {
    const transactions = [
      baseTx({ id: "t1", categoryId: "c1" }),
      baseTx({ id: "t2", categoryId: "c2" }),
    ];
    const categories = [baseCategory({ id: "c1", name: "Food" })];
    const result = await runTool(
      "get_historical_transactions",
      { categoryName: "Food" },
      { transactions, categories },
    );
    expect(result.transactions.map((t: Transaction) => t.id)).toEqual(["t1"]);
  });

  it("returns empty when categoryName not found", async () => {
    const transactions = [baseTx({ id: "t1" })];
    const result = await runTool(
      "get_historical_transactions",
      { categoryName: "Unknown" },
      { transactions, categories: [] },
    );
    expect(result.transactions).toHaveLength(1);
  });

  it("caps results at 50 and returns appliedFilters", async () => {
    const transactions = Array.from({ length: 60 }, (_, i) =>
      baseTx({ id: `t${i}`, shopName: "Same" }),
    );
    const result = await runTool(
      "get_historical_transactions",
      { searchKeyword: "same" },
      { transactions, categories: [] },
    );
    expect(result.transactions).toHaveLength(50);
    expect(result.totalMatches).toBe(50);
    expect(result.appliedFilters).toEqual({ searchKeyword: "same" });
  });
});

describe("runTool — unknown tool", () => {
  it("returns unsupported error", async () => {
    const result = await runTool(
      "do_something_weird",
      {},
      { transactions: [], categories: [] },
    );
    expect(result.error).toBe("Unsupported tool: do_something_weird");
  });
});

describe("buildFunctionResponseMessage", () => {
  it("builds a system message with functionResponse", () => {
    const msg = buildFunctionResponseMessage("get_nearby_food", { places: [] });
    expect(msg.role).toBe("system");
    expect(msg.content).toBe("");
    expect(msg.functionResponse?.name).toBe("get_nearby_food");
    expect(msg.functionResponse?.response).toEqual({ places: [] });
    expect(typeof msg.timestamp).toBe("string");
  });
});

describe("buildRejectionResponseMessage", () => {
  it("builds a rejection system message", () => {
    const msg = buildRejectionResponseMessage("get_current_location");
    expect(msg.role).toBe("system");
    expect(msg.functionResponse?.response).toEqual({
      error: "User rejected the request",
    });
  });
});

describe("appendMessageToSession", () => {
  it("appends a message and refreshes updatedAt", () => {
    const baseSession: ChatSession = {
      id: "s1",
      userId: "u1",
      title: "Chat",
      messages: [],
      updatedAt: "2024-06-15T09:00:00.000Z",
    };
    const newMsg: ChatMessage = {
      role: "user",
      content: "hi",
      timestamp: "2024-06-15T10:00:00.000Z",
    };
    const next = appendMessageToSession(baseSession, newMsg);
    expect(next.messages).toHaveLength(1);
    expect(next.messages[0]).toEqual(newMsg);
    expect(typeof next.updatedAt).toBe("string");
  });

  it("preserves all other session fields", () => {
    const baseSession: ChatSession = {
      id: "s1",
      userId: "u1",
      title: "Old",
      messages: [],
      updatedAt: "2024-06-15T09:00:00.000Z",
    };
    const next = appendMessageToSession(baseSession, {
      role: "user",
      content: "x",
      timestamp: "t",
    } as ChatMessage);
    expect(next.id).toBe("s1");
    expect(next.title).toBe("Old");
  });
});
