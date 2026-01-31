import {
  Account,
  Category,
  Transaction,
  Goal,
  UserProfile,
  Subscription,
  Pot,
  ChatSession,
} from "../types";
import * as SheetService from "./sheets.services";
import { getKey as getBaseKey } from "../helpers/storage.helper";

export const KEYS = {
  ACCOUNTS: "zenfinance_accounts_v2",
  TRANSACTIONS: "zenfinance_transactions_v2",
  CATEGORIES: "zenfinance_categories_v2",
  GOALS: "zenfinance_goals_v2",
  PROFILE: "zenfinance_profile_v2",
  SUBSCRIPTIONS: "zenfinance_subscriptions_v2",
  POTS: "zenfinance_pots_v2",
  CHATS: "zenfinance_chats_v2",
};

const getKey = (baseKey: string) => getBaseKey(baseKey, KEYS.PROFILE);

export const hasLegacyData = (): boolean => {
  const checkKeys = [
    KEYS.ACCOUNTS,
    KEYS.TRANSACTIONS,
    KEYS.GOALS,
    KEYS.SUBSCRIPTIONS,
    KEYS.POTS,
  ];
  for (const key of checkKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) return true;
      } catch (e) {
        /* ignore */
      }
    }
  }
  return false;
};

export const migrateLegacyData = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  let hasChanges = false;

  const migrateCollection = (key: string, sheetName: string) => {
    try {
      // 1. Read Legacy Data (Raw Key / Guest Key)
      const legacyRaw = localStorage.getItem(key);
      if (!legacyRaw) return;

      const legacyData = JSON.parse(legacyRaw);
      if (!Array.isArray(legacyData) || legacyData.length === 0) return;

      // 2. Read Target Data (User Key)
      const targetKey = `${key}_${userId}`;
      const targetRaw = localStorage.getItem(targetKey);
      let targetData = targetRaw ? JSON.parse(targetRaw) : [];

      // 3. Merge (Avoid Duplicates by ID)
      const existingIds = new Set(targetData.map((d: any) => d.id));
      const itemsToMigrate = legacyData
        .filter((d: any) => !existingIds.has(d.id))
        .map((d: any) => ({ ...d, userId }));

      if (itemsToMigrate.length > 0) {
        targetData = [...targetData, ...itemsToMigrate];
        localStorage.setItem(targetKey, JSON.stringify(targetData));
        hasChanges = true;
        console.log(
          `Migrated ${itemsToMigrate.length} items from guest into account`,
        );
      }

      // Clear legacy key ONLY if migration succeeded or it was effectively merged
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error migrating ${sheetName}`, e);
    }
  };

  migrateCollection(KEYS.ACCOUNTS, "Accounts");
  migrateCollection(KEYS.TRANSACTIONS, "Transactions");
  migrateCollection(KEYS.CATEGORIES, "Categories");
  migrateCollection(KEYS.GOALS, "Goals");
  migrateCollection(KEYS.SUBSCRIPTIONS, "Subscriptions");
  migrateCollection(KEYS.POTS, "Pots");

  return hasChanges;
};

// Emergency Recovery: Scan ONLY for "Guest" records (data added while logged out)
// This excludes other users' partitioned data to ensure privacy and isolation.
export const rescueScatteredData = (): {
  type: string;
  count: number;
  key: string;
}[] => {
  const found: { type: string; count: number; key: string }[] = [];
  const basePatterns = Object.values(KEYS).filter((k) => k !== KEYS.PROFILE);
  const activeKeys = new Set(basePatterns.map((p) => getKey(p)));

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // ONLY look for the base Guest keys (no _userId suffix)
    const isGuestKey = basePatterns.includes(key);
    if (!isGuestKey) continue;

    // Skip keys that are currently active/loaded to avoid confusing the user
    if (activeKeys.has(key)) continue;

    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(data) && data.length > 0) {
        found.push({
          type: key.replace("zenfinance_", "").replace("_v2", ""),
          count: data.length,
          key: key,
        });
      }
    } catch (e) {
      /* ignore */
    }
  }
  return found;
};

export const importFromKey = (sourceKey: string, targetBaseKey: string) => {
  const userId = getStoredProfile().id;
  if (!userId) return;

  const targetKey = getKey(targetBaseKey);
  if (sourceKey === targetKey) return; // Already there

  try {
    const sourceData = JSON.parse(localStorage.getItem(sourceKey) || "[]");
    const targetRaw = localStorage.getItem(targetKey);
    let targetData = targetRaw ? JSON.parse(targetRaw) : [];

    const existingIds = new Set(targetData.map((d: any) => d.id));
    const toImport = sourceData
      .filter((d: any) => !existingIds.has(d.id))
      .map((d: any) => ({ ...d, userId }));

    if (toImport.length > 0) {
      const merged = [...targetData, ...toImport];
      localStorage.setItem(targetKey, JSON.stringify(merged));
      console.log(`Rescued ${toImport.length} items from ${sourceKey}`);
      return true;
    }
  } catch (e) {
    console.error("Rescue failed for key", sourceKey, e);
  }
  return false;
};

export const saveLocalData = (data: {
  accounts?: Account[];
  transactions?: Transaction[];
  categories?: Category[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  pots?: Pot[];
}) => {
  if (data.accounts)
    localStorage.setItem(getKey(KEYS.ACCOUNTS), JSON.stringify(data.accounts));
  if (data.transactions)
    localStorage.setItem(
      getKey(KEYS.TRANSACTIONS),
      JSON.stringify(data.transactions),
    );
  if (data.categories)
    localStorage.setItem(
      getKey(KEYS.CATEGORIES),
      JSON.stringify(data.categories),
    );
  if (data.goals)
    localStorage.setItem(getKey(KEYS.GOALS), JSON.stringify(data.goals));
  if (data.subscriptions)
    localStorage.setItem(
      getKey(KEYS.SUBSCRIPTIONS),
      JSON.stringify(data.subscriptions),
    );
  if (data.pots)
    localStorage.setItem(getKey(KEYS.POTS), JSON.stringify(data.pots));
};

// Initial Data Seeding
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "c1",
    name: "Food & Dining",
    icon: "🍔",
    budgetLimit: 0,
    color: "bg-orange-500",
    isDefault: true,
  },
  {
    id: "c2",
    name: "Transportation",
    icon: "🚗",
    budgetLimit: 0,
    color: "bg-blue-500",
    isDefault: true,
  },
  {
    id: "c3",
    name: "Shopping",
    icon: "🛍️",
    budgetLimit: 0,
    color: "bg-pink-500",
    isDefault: true,
  },
  {
    id: "c4",
    name: "Entertainment",
    icon: "🎬",
    budgetLimit: 0,
    color: "bg-purple-500",
    isDefault: true,
  },
  {
    id: "c5",
    name: "Bills",
    icon: "💡",
    budgetLimit: 0,
    color: "bg-yellow-500",
    isDefault: true,
  },
  {
    id: "c6",
    name: "Health",
    icon: "🏥",
    budgetLimit: 0,
    color: "bg-red-500",
    isDefault: true,
  },
  {
    id: "c7",
    name: "Salary",
    icon: "💰",
    budgetLimit: 0,
    color: "bg-green-500",
    isDefault: true,
  },
  {
    id: "c8",
    name: "Investment",
    icon: "📈",
    budgetLimit: 0,
    color: "bg-indigo-500",
    isDefault: true,
  },
];

const isLoggedIn = () => {
  const p = getStoredProfile();
  return p.isLoggedIn && SheetService.isClientReady();
};

export const getStoredTransactions = (): Transaction[] => {
  const stored = localStorage.getItem(getKey(KEYS.TRANSACTIONS));
  return stored ? JSON.parse(stored) : [];
};

export const saveTransactions = async (transactions: Transaction[]) => {
  localStorage.setItem(getKey(KEYS.TRANSACTIONS), JSON.stringify(transactions));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Transactions", transactions);
  }
};

export const insertOneTransaction = async (transaction: Transaction) => {
  const transactions = getStoredTransactions();
  const newTransactions = [...transactions, transaction];
  localStorage.setItem(
    getKey(KEYS.TRANSACTIONS),
    JSON.stringify(newTransactions),
  );
  if (isLoggedIn()) {
    await SheetService.insertOne("Transactions", transaction);
  }
};

export const insertManyTransactions = async (newItems: Transaction[]) => {
  const transactions = getStoredTransactions();
  const newTransactions = [...transactions, ...newItems];
  localStorage.setItem(
    getKey(KEYS.TRANSACTIONS),
    JSON.stringify(newTransactions),
  );

  if (isLoggedIn()) {
    // Insert purely new items one by one (or could optimize to append batch)
    for (const item of newItems) {
      await SheetService.insertOne("Transactions", item);
    }
  }
};

export const getStoredAccounts = (): Account[] => {
  const stored = localStorage.getItem(getKey(KEYS.ACCOUNTS));
  return stored ? JSON.parse(stored) : [];
};

export const saveAccounts = async (accounts: Account[]) => {
  localStorage.setItem(getKey(KEYS.ACCOUNTS), JSON.stringify(accounts));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Accounts", accounts);
  }
};

export const insertOneAccount = async (account: Account) => {
  const accounts = getStoredAccounts();
  const newAccounts = [...accounts, account];
  localStorage.setItem(getKey(KEYS.ACCOUNTS), JSON.stringify(newAccounts));
  if (isLoggedIn()) {
    await SheetService.insertOne("Accounts", account);
  }
};

export const getStoredCategories = (): Category[] => {
  const profile = getStoredProfile();
  const userId = profile.id || "guest";
  const stored = localStorage.getItem(getKey(KEYS.CATEGORIES));

  const savedCategories: Category[] = stored ? JSON.parse(stored) : [];

  // Merge: Start with Default Categories
  const categoryMap = new Map<string, Category>();
  DEFAULT_CATEGORIES.forEach((c) => categoryMap.set(c.id, c));

  // Overwrite with saved ones (preserves custom modifications and new ones)
  savedCategories.forEach((c) => categoryMap.set(c.id, c));

  return Array.from(categoryMap.values()).map((c) => {
    const isDefault = /^c\d+$/.test(c.id);
    return {
      ...c,
      // Default categories are global (no userId), others belong to user
      userId: isDefault ? undefined : c.userId || userId,
    };
  });
};

export const saveCategories = async (categories: Category[]) => {
  localStorage.setItem(getKey(KEYS.CATEGORIES), JSON.stringify(categories));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Categories", categories);
  }
};

export const insertOneCategory = async (category: Category) => {
  const categories = getStoredCategories();
  const newCategories = [...categories, category];
  localStorage.setItem(getKey(KEYS.CATEGORIES), JSON.stringify(newCategories));
  if (isLoggedIn()) {
    await SheetService.insertOne("Categories", category);
  }
};

export const getStoredGoals = (): Goal[] => {
  const stored = localStorage.getItem(getKey(KEYS.GOALS));
  return stored ? JSON.parse(stored) : [];
};

export const saveGoals = async (goals: Goal[]) => {
  localStorage.setItem(getKey(KEYS.GOALS), JSON.stringify(goals));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Goals", goals);
  }
};

export const insertOneGoal = async (goal: Goal) => {
  const goals = getStoredGoals();
  const newGoals = [...goals, goal];
  localStorage.setItem(getKey(KEYS.GOALS), JSON.stringify(newGoals));
  if (isLoggedIn()) {
    await SheetService.insertOne("Goals", goal);
  }
};

export const getStoredSubscriptions = (): Subscription[] => {
  const stored = localStorage.getItem(getKey(KEYS.SUBSCRIPTIONS));
  return stored ? JSON.parse(stored) : [];
};

export const saveSubscriptions = async (subscriptions: Subscription[]) => {
  localStorage.setItem(
    getKey(KEYS.SUBSCRIPTIONS),
    JSON.stringify(subscriptions),
  );
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Subscriptions", subscriptions);
  }
};

export const getStoredPots = (): Pot[] => {
  const stored = localStorage.getItem(getKey(KEYS.POTS));
  if (!stored) return [];

  const pots = JSON.parse(stored);
  return pots.map((p: any) => {
    // Migration logic for Pots
    const migratedPot = { ...p };
    if (
      migratedPot.limitAmount === undefined &&
      migratedPot.targetAmount !== undefined
    ) {
      migratedPot.limitAmount = Number(migratedPot.targetAmount);
    }
    if (
      migratedPot.amountLeft === undefined &&
      migratedPot.currentAmount !== undefined
    ) {
      migratedPot.amountLeft = Number(migratedPot.currentAmount);
    }
    if (migratedPot.usedAmount === undefined) {
      if (
        migratedPot.limitAmount !== undefined &&
        migratedPot.amountLeft !== undefined
      ) {
        migratedPot.usedAmount =
          migratedPot.limitAmount - migratedPot.amountLeft;
      } else {
        migratedPot.usedAmount = 0;
      }
    }
    return migratedPot;
  });
};

export const savePots = async (pots: Pot[]) => {
  localStorage.setItem(getKey(KEYS.POTS), JSON.stringify(pots));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Pots", pots);
  }
};

export const getStoredChatSessions = (): ChatSession[] => {
  const stored = localStorage.getItem(getKey(KEYS.CHATS));
  return stored ? JSON.parse(stored) : [];
};

export const saveChatSessions = (sessions: ChatSession[]) => {
  localStorage.setItem(getKey(KEYS.CHATS), JSON.stringify(sessions));
};

export const getStoredProfile = (): UserProfile => {
  const stored = localStorage.getItem(KEYS.PROFILE);
  const profile = stored
    ? JSON.parse(stored)
    : { name: "", email: "", isLoggedIn: false };

  // Set defaults for newly added fields
  if (profile.syncChatToSheets === undefined) {
    profile.syncChatToSheets = true;
  }
  if (profile.showAIAssistant === undefined) {
    profile.showAIAssistant = true;
  }

  return profile;
};

export const saveProfile = (profile: UserProfile) => {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
};

// Full Sync Operation
export const syncAllData = async (
  accounts: Account[],
  transactions: Transaction[],
  categories: Category[],
  goals: Goal[],
  subscriptions: Subscription[],
  pots: Pot[],
  chatSessions: ChatSession[],
  profile: UserProfile,
) => {
  if (isLoggedIn()) {
    await SheetService.syncWithGoogleSheets(
      accounts,
      transactions,
      categories,
      goals,
      subscriptions,
      pots,
      profile.syncChatToSheets ? chatSessions : undefined,
    );
  }
};
