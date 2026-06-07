import type { ChatMessage, Transaction, Category, ChatSession } from "../../../types";

type ToolResult = Record<string, any>;

type ToolExecutionContext = {
  transactions: Transaction[];
  categories: Category[];
};

const filterTransactionsByArgs = (
  transactions: Transaction[],
  categories: Category[],
  args: { searchKeyword?: string; startDate?: string; endDate?: string; categoryName?: string },
): Transaction[] => {
  const searchKeyword = args.searchKeyword?.toLowerCase();
  const categoryId = args.categoryName
    ? categories.find((c) => c.name === args.categoryName)?.id
    : undefined;
  return transactions.filter((t) => {
    if (searchKeyword && !t.shopName.toLowerCase().includes(searchKeyword)) return false;
    if (args.startDate && t.date < args.startDate) return false;
    if (args.endDate && t.date > args.endDate) return false;
    if (categoryId && t.categoryId !== categoryId) return false;
    return true;
  });
};

const buildHistoricalSearchResult = (
  transactions: Transaction[],
  categories: Category[],
  args: Record<string, any>,
): ToolResult => {
  const matches = filterTransactionsByArgs(transactions, categories, args).slice(0, 50);
  return {
    totalMatches: matches.length,
    appliedFilters: args,
    transactions: matches,
  };
};

const resolveCoords = async (args: Record<string, any>): Promise<{ latitude: number; longitude: number }> => {
  const latitude = Number(args.latitude);
  const longitude = Number(args.longitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }
  const { getCurrentLocation } = await import("../../../services/location.services");
  return getCurrentLocation();
};

const executeGetNearbyFood = async (args: Record<string, any>): Promise<ToolResult> => {
  const { fetchNearbyFood } = await import("../../../services/location.services");
  try {
    const { latitude, longitude } = await resolveCoords(args);
    return await fetchNearbyFood(
      latitude,
      longitude,
      Number(args.radiusMeters) || 1200,
      Number(args.limit) || 10,
      args.cuisineKeyword,
    );
  } catch (err: any) {
    return { error: err?.message || "Unable to find nearby food places right now." };
  }
};

const executeGetCurrentLocation = async (): Promise<ToolResult> => {
  const { getCurrentLocation } = await import("../../../services/location.services");
  try {
    const location = await getCurrentLocation();
    return { ...location, retrievedAt: new Date().toISOString() };
  } catch (err: any) {
    return { error: err?.message || "Unable to retrieve current location." };
  }
};

export const runTool = async (
  toolName: string,
  args: Record<string, any>,
  ctx: ToolExecutionContext,
): Promise<ToolResult> => {
  switch (toolName) {
    case "get_historical_transactions":
      return buildHistoricalSearchResult(ctx.transactions, ctx.categories, args);
    case "get_current_location":
      return executeGetCurrentLocation();
    case "get_nearby_food":
      return executeGetNearbyFood(args);
    default:
      return { error: `Unsupported tool: ${toolName}` };
  }
};

export const buildFunctionResponseMessage = (
  functionName: string,
  response: ToolResult,
): ChatMessage => ({
  role: "system",
  content: "",
  timestamp: new Date().toISOString(),
  functionResponse: { name: functionName, response },
});

export const buildRejectionResponseMessage = (functionName: string): ChatMessage => ({
  role: "system",
  content: "",
  timestamp: new Date().toISOString(),
  functionResponse: { name: functionName, response: { error: "User rejected the request" } },
});

export const appendMessageToSession = <T extends Pick<ChatSession, "messages">>(
  session: T,
  message: ChatMessage,
): T => ({
  ...session,
  messages: [...session.messages, message],
  updatedAt: new Date().toISOString(),
});
