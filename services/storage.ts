import {
  Account,
  Category,
  Transaction,
  Goal,
  UserProfile,
  Subscription,
  Pot,
} from "../types";
import * as SheetService from "./sheets";

const KEYS = {
  ACCOUNTS: "zenfinance_accounts_v2",
  TRANSACTIONS: "zenfinance_transactions_v2",
  CATEGORIES: "zenfinance_categories_v2",
  GOALS: "zenfinance_goals_v2",
  PROFILE: "zenfinance_profile_v2",
  SUBSCRIPTIONS: "zenfinance_subscriptions_v2",
  POTS: "zenfinance_pots_v2",
};

const getKey = (baseKey: string) => {
  // PROFILE is always global in this context to determine the current user
  if (baseKey === KEYS.PROFILE) return baseKey;

  try {
    const profileStr = localStorage.getItem(KEYS.PROFILE);
    if (profileStr) {
      const profile = JSON.parse(profileStr);
      if (profile.id) {
        return `${baseKey}_${profile.id}`;
      }
    }
  } catch (e) {
    /* ignore */
  }
  return baseKey;
};

export const migrateLegacyData = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  let hasChanges = false;

  const migrateCollection = (key: string, sheetName: string) => {
    try {
      // 1. Read Legacy Data (Raw Key)
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
        console.log(`Migrated ${itemsToMigrate.length} items for ${sheetName}`);
      }
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
  },
  {
    id: "c2",
    name: "Transportation",
    icon: "🚗",
    budgetLimit: 0,
    color: "bg-blue-500",
  },
  {
    id: "c3",
    name: "Shopping",
    icon: "🛍️",
    budgetLimit: 0,
    color: "bg-pink-500",
  },
  {
    id: "c4",
    name: "Entertainment",
    icon: "🎬",
    budgetLimit: 0,
    color: "bg-purple-500",
  },
  {
    id: "c5",
    name: "Bills",
    icon: "💡",
    budgetLimit: 0,
    color: "bg-yellow-500",
  },
  { id: "c6", name: "Health", icon: "🏥", budgetLimit: 0, color: "bg-red-500" },
  {
    id: "c7",
    name: "Salary",
    icon: "💰",
    budgetLimit: 0,
    color: "bg-green-500",
  },
  {
    id: "c8",
    name: "Investment",
    icon: "📈",
    budgetLimit: 0,
    color: "bg-indigo-500",
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
  const newTransactions = [transaction, ...transactions];
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
  const newTransactions = [...newItems, ...transactions];
  localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(newTransactions));

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

  const categories = stored
    ? (JSON.parse(stored) as Category[])
    : DEFAULT_CATEGORIES;

  return categories.map((c) => {
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
  return stored ? JSON.parse(stored) : [];
};

export const savePots = async (pots: Pot[]) => {
  localStorage.setItem(getKey(KEYS.POTS), JSON.stringify(pots));
  if (isLoggedIn()) {
    await SheetService.saveToSheet("Pots", pots);
  }
};

export const getStoredProfile = (): UserProfile => {
  const stored = localStorage.getItem(KEYS.PROFILE);
  return stored
    ? JSON.parse(stored)
    : { name: "", email: "", isLoggedIn: false };
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
) => {
  if (isLoggedIn()) {
    await SheetService.syncWithGoogleSheets(
      accounts,
      transactions,
      categories,
      goals,
      subscriptions,
      pots,
    );
  }
};
