import React, { createContext, useContext, useState, useEffect } from "react";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import {
  Account,
  Category,
  Transaction,
  Goal,
  Subscription,
  Pot,
  ChatSession,
  TransactionType,
} from "../types";

interface DataContextType {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  subscriptions: Subscription[];
  pots: Pot[];
  chatSessions: ChatSession[];
  usdRate: number;
  isSyncing: boolean;
  toast: { message: string; type: "success" | "alert" | "info" } | null;
  showToast: (message: string, type: "success" | "alert" | "info") => void;
  syncData: () => Promise<void>;
  loadData: () => void;
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  setPots: React.Dispatch<React.SetStateAction<Pot[]>>;
  setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  handleAccountSave: (acc: Omit<Account, "userId">) => Promise<void>;
  handleAccountDelete: (id: string) => Promise<void>;
  handleTransactionSubmit: (tx: Transaction) => Promise<void>;
  handleTransactionDelete: (id: string) => Promise<void>;
  handleCategorySave: (cat: Category) => Promise<void>;
  handleCategoryDelete: (id: string) => Promise<void>;
  handleGoalUpdate: (goal: Goal) => Promise<void>;
  handleGoalDelete: (id: string) => Promise<void>;
  handlePotSave: (pot: Pot) => Promise<void>;
  handlePotDelete: (id: string) => Promise<void>;
  handleAddSubscription: (sub: Omit<Subscription, "userId">) => Promise<void>;
  handleDeleteSubscription: (id: string) => Promise<void>;
  handleSaveChatSession: (session: ChatSession) => void;
  handleDeleteChatSession: (id: string) => void;
  handleMigrateData: () => Promise<void>;
  handleResetAndSync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile, loginWithGoogle, isInitialized } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [usdRate, setUsdRate] = useState<number>(4.5);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "alert" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "alert" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = () => {
    setAccounts(StorageService.getStoredAccounts());
    const loadedTxs = StorageService.getStoredTransactions();
    setTransactions(loadedTxs);
    setCategories(StorageService.getStoredCategories());
    setGoals(StorageService.getStoredGoals());
    setPots(StorageService.getStoredPots());
    setChatSessions(StorageService.getStoredChatSessions());
    const storedSubs = StorageService.getStoredSubscriptions();
    setSubscriptions(storedSubs);
    processSubscriptions(storedSubs, loadedTxs);
  };

  useEffect(() => {
    loadData();
    getUSDToMYRRate().then(setUsdRate);
  }, [profile.id]);

  useEffect(() => {
    if (profile.isLoggedIn && isInitialized) {
      syncData();
    }
  }, [profile.isLoggedIn, isInitialized]);

  const processSubscriptions = (
    subs: Subscription[],
    currentTxs: Transaction[],
  ) => {
    const today = new Date().toISOString().split("T")[0];
    let newTxs: Transaction[] = [];
    let updatedSubs = [...subs];
    let processedCount = 0;
    const currentUserId = profile.id || "guest";

    updatedSubs = updatedSubs.map((sub) => {
      if (!sub.active) return sub;
      let nextDate = sub.nextPaymentDate;
      let hasProcessed = false;
      while (nextDate <= today) {
        hasProcessed = true;
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          accountId: sub.accountId,
          amount: sub.amount,
          currency: sub.currency,
          type: TransactionType.EXPENSE,
          categoryId: sub.categoryId,
          shopName: sub.name + " (Subscription)",
          date: nextDate,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        newTxs.push(newTx);
        const d = new Date(nextDate);
        if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
        else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
        else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + 1);
        nextDate = d.toISOString().split("T")[0];
      }
      if (hasProcessed) {
        processedCount++;
        return { ...sub, nextPaymentDate: nextDate };
      }
      return sub;
    });

    if (newTxs.length > 0) {
      const allTxs = [...currentTxs, ...newTxs];
      setTransactions(allTxs);
      StorageService.saveTransactions(allTxs);
      setSubscriptions(updatedSubs);
      StorageService.saveSubscriptions(updatedSubs);
      const accUpdates = new Map<string, number>();
      newTxs.forEach((t) =>
        accUpdates.set(
          t.accountId,
          (accUpdates.get(t.accountId) || 0) + t.amount,
        ),
      );
      setAccounts((prev) => {
        const updated = prev.map((a) => {
          if (accUpdates.has(a.id))
            return { ...a, balance: a.balance - (accUpdates.get(a.id) || 0) };
          return a;
        });
        StorageService.saveAccounts(updated);
        return updated;
      });
      showToast(
        `Processed ${processedCount} subscription payments.`,
        "success",
      );
    }
  };

  const syncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const currentProfile = StorageService.getStoredProfile();
    const userId = currentProfile.id || profile.id;
    if (userId) SheetService.setSheetUser(userId);

    try {
      if (!SheetService.isClientReady()) {
        await SheetService.initGapiClient();
        const savedToken = localStorage.getItem("google_access_token");
        const savedExpiry = localStorage.getItem("google_token_expiry");
        if (savedToken) {
          const expiresIn = savedExpiry
            ? (parseInt(savedExpiry) - Date.now()) / 1000
            : undefined;
          SheetService.setGapiAccessToken(savedToken, expiresIn);
        }
      }

      if (!SheetService.isClientReady()) {
        showToast("Session expired. Please sign in again.", "info");
        loginWithGoogle();
        setIsSyncing(false);
        return;
      }

      showToast("Syncing with Google Sheets...", "info");
      const cloudData = await SheetService.loadFromGoogleSheets();
      if (cloudData) {
        const merge = <T extends { id: string; updatedAt?: number }>(
          local: T[],
          cloud: T[],
        ): T[] => {
          const map = new Map<string, T>();
          cloud.forEach((i) => i.id && map.set(String(i.id), i));
          local.forEach((i) => {
            const id = String(i.id);
            if (map.has(id)) {
              if ((i.updatedAt || 0) > (map.get(id)!.updatedAt || 0))
                map.set(id, i);
            } else if (i.id) map.set(id, i);
          });
          return Array.from(map.values());
        };

        const mergedAccounts = merge(
          StorageService.getStoredAccounts(),
          cloudData.accounts,
        );
        setAccounts(mergedAccounts);
        StorageService.saveAccounts(mergedAccounts);

        const mergedCategories = merge(
          StorageService.getStoredCategories(),
          cloudData.categories,
        );
        setCategories(mergedCategories);
        StorageService.saveCategories(mergedCategories);

        const mergedTransactions = merge(
          StorageService.getStoredTransactions(),
          cloudData.transactions,
        );
        setTransactions(mergedTransactions);
        StorageService.saveTransactions(mergedTransactions);

        const mergedGoals = merge(
          StorageService.getStoredGoals(),
          cloudData.goals,
        );
        setGoals(mergedGoals);
        StorageService.saveGoals(mergedGoals);

        const mergedSubs = merge(
          StorageService.getStoredSubscriptions(),
          cloudData.subscriptions || [],
        );
        setSubscriptions(mergedSubs);
        StorageService.saveSubscriptions(mergedSubs);

        const mergedPots = merge(
          StorageService.getStoredPots(),
          cloudData.pots || [],
        );
        setPots(mergedPots);
        StorageService.savePots(mergedPots);

        await SheetService.syncWithGoogleSheets(
          mergedAccounts,
          mergedTransactions,
          mergedCategories,
          mergedGoals,
          mergedSubs,
          mergedPots,
        );
        processSubscriptions(mergedSubs, mergedTransactions);
        showToast("Cloud sync complete", "success");
      }
    } catch (e) {
      console.error("Sync failed", e);
      showToast("Cloud sync failed", "alert");
    }
    setIsSyncing(false);
  };

  const handleAccountSave = async (acc: Omit<Account, "userId">) => {
    const isNew = !accounts.some((a) => a.id === acc.id);
    const accountWithUser = {
      ...acc,
      userId: profile.id || "local",
    } as Account;
    let updated;
    if (isNew) {
      updated = [...accounts, accountWithUser];
      if (SheetService.isClientReady())
        await SheetService.insertOne("Accounts", accountWithUser);
    } else {
      updated = accounts.map((a) => (a.id === acc.id ? accountWithUser : a));
      if (SheetService.isClientReady())
        await SheetService.updateOne("Accounts", acc.id, accountWithUser);
    }
    setAccounts(updated);
    StorageService.saveAccounts(updated);
    showToast("Account saved", "success");
  };

  const handleAccountDelete = async (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    StorageService.saveAccounts(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Accounts", id);
    showToast("Account deleted", "success");
  };

  const handleTransactionSubmit = async (tx: Transaction) => {
    const isEdit = transactions.some((t) => t.id === tx.id);
    let updatedTransactions;
    if (isEdit) {
      updatedTransactions = transactions.map((t) => (t.id === tx.id ? tx : t));
      if (SheetService.isClientReady())
        await SheetService.updateOne("Transactions", tx.id, tx);
    } else {
      updatedTransactions = [...transactions, tx];
      if (SheetService.isClientReady())
        await SheetService.insertOne("Transactions", tx);
    }
    setTransactions(updatedTransactions);
    StorageService.saveTransactions(updatedTransactions);

    // Update balance
    const updatedAccounts = accounts.map((a) => {
      if (a.id === tx.accountId) {
        const diff = isEdit
          ? (transactions.find((t) => t.id === tx.id)?.amount || 0) - tx.amount
          : -tx.amount;
        return {
          ...a,
          balance:
            a.balance + (tx.type === TransactionType.INCOME ? -diff : diff),
        };
      }
      return a;
    });
    setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);
    showToast("Transaction saved", "success");
  };

  const handleTransactionDelete = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      const updatedAccounts = accounts.map((a) => {
        if (a.id === tx.accountId) {
          return {
            ...a,
            balance:
              a.balance +
              (tx.type === TransactionType.EXPENSE ? tx.amount : -tx.amount),
          };
        }
        return a;
      });
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    StorageService.saveTransactions(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Transactions", id);
    showToast("Transaction deleted", "success");
  };

  const handleCategorySave = async (cat: Category) => {
    const isEdit = categories.some((c) => c.id === cat.id);
    const updated = isEdit
      ? categories.map((c) => (c.id === cat.id ? cat : c))
      : [...categories, cat];
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (SheetService.isClientReady()) {
      if (isEdit) await SheetService.updateOne("Categories", cat.id, cat);
      else await SheetService.insertOne("Categories", cat);
    }
  };

  const handleCategoryDelete = async (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Categories", id);
  };

  const handleGoalUpdate = async (goal: Goal) => {
    const isEdit = goals.some((g) => g.id === goal.id);
    const updated = isEdit
      ? goals.map((g) => (g.id === goal.id ? goal : g))
      : [...goals, goal];
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (SheetService.isClientReady()) {
      if (isEdit) await SheetService.updateOne("Goals", goal.id, goal);
      else await SheetService.insertOne("Goals", goal);
    }
  };

  const handleGoalDelete = async (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (SheetService.isClientReady()) await SheetService.deleteOne("Goals", id);
  };

  const handlePotSave = async (pot: Pot) => {
    const isEdit = pots.some((p) => p.id === pot.id);
    const updated = isEdit
      ? pots.map((p) => (p.id === pot.id ? pot : p))
      : [...pots, pot];
    setPots(updated);
    StorageService.savePots(updated);
    if (SheetService.isClientReady()) {
      if (isEdit) await SheetService.updateOne("Pots", pot.id, pot);
      else await SheetService.insertOne("Pots", pot);
    }
  };

  const handlePotDelete = async (id: string) => {
    const updated = pots.filter((p) => p.id !== id);
    setPots(updated);
    StorageService.savePots(updated);
    if (SheetService.isClientReady()) await SheetService.deleteOne("Pots", id);
  };

  const handleAddSubscription = async (sub: Omit<Subscription, "userId">) => {
    const currentUserId = profile.id || "guest";
    const newSub: Subscription = { ...sub, userId: currentUserId };
    const updated = [...subscriptions, newSub];
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
    if (SheetService.isClientReady())
      await SheetService.insertOne("Subscriptions", newSub);
    showToast("Subscription added", "success");
  };

  const handleDeleteSubscription = async (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id);
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Subscriptions", id);
  };

  const handleSaveChatSession = (session: ChatSession) => {
    const updated = chatSessions.some((s) => s.id === session.id)
      ? chatSessions.map((s) => (s.id === session.id ? session : s))
      : [...chatSessions, session];
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
  };

  const handleDeleteChatSession = (id: string) => {
    const updated = chatSessions.filter((s) => s.id !== id);
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
  };

  const handleMigrateData = async () => {
    const findings = StorageService.rescueScatteredData();
    if (findings.length === 0) {
      showToast("No orphaned data found", "info");
      return;
    }
    if (!confirm(`Merge ${findings.length} orphaned records?`)) return;
    findings.forEach((f) => {
      const baseKey = Object.values(StorageService.KEYS).find((k) =>
        f.key.startsWith(k),
      );
      if (baseKey) {
        StorageService.importFromKey(f.key, baseKey as string);
        localStorage.removeItem(f.key);
      }
    });
    showToast("Data recovered!", "success");
    loadData();
  };

  const handleResetAndSync = async () => {
    if (!confirm("Reset local cache?")) return;
    setIsSyncing(true);
    const keysToKeep = [
      "google_access_token",
      "google_token_expiry",
      "google_refresh_token",
      StorageService.KEYS.PROFILE,
    ];
    const saved: any = {};
    keysToKeep.forEach((k) => (saved[k] = localStorage.getItem(k)));
    localStorage.clear();
    keysToKeep.forEach((k) => saved[k] && localStorage.setItem(k, saved[k]));
    const cloudData = await SheetService.loadFromGoogleSheets();
    if (cloudData) {
      StorageService.saveAccounts(cloudData.accounts);
      StorageService.saveTransactions(cloudData.transactions);
      StorageService.saveCategories(cloudData.categories);
      StorageService.saveGoals(cloudData.goals);
      StorageService.saveSubscriptions(cloudData.subscriptions || []);
      StorageService.savePots(cloudData.pots || []);
      loadData();
      showToast("Sync reset complete", "success");
    }
    setIsSyncing(false);
  };

  return (
    <DataContext.Provider
      value={{
        accounts,
        transactions,
        categories,
        goals,
        subscriptions,
        pots,
        chatSessions,
        usdRate,
        isSyncing,
        toast,
        showToast,
        syncData,
        loadData,
        setAccounts,
        setTransactions,
        setCategories,
        setGoals,
        setSubscriptions,
        setPots,
        setChatSessions,
        handleAccountSave,
        handleAccountDelete,
        handleTransactionSubmit,
        handleTransactionDelete,
        handleCategorySave,
        handleCategoryDelete,
        handleGoalUpdate,
        handleGoalDelete,
        handlePotSave,
        handlePotDelete,
        handleAddSubscription,
        handleDeleteSubscription,
        handleSaveChatSession,
        handleDeleteChatSession,
        handleMigrateData,
        handleResetAndSync,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
