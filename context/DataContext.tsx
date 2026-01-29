import React, { createContext, useContext, useState, useEffect } from "react";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import { normalizeDate, parseDateSafe } from "../helpers/transactions.helper";
import {
  Account,
  Category,
  Transaction,
  Goal,
  Subscription,
  Pot,
  ChatSession,
  TransactionType,
  ExchangeRateData,
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
  exchangeRate: ExchangeRateData | null;
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
  handleTransactionSubmit: (tx: Omit<Transaction, "userId">) => Promise<void>;
  handleTransactionDelete: (id: string) => Promise<void>;
  handleCategorySave: (cat: Omit<Category, "userId">) => Promise<void>;
  handleCategoryDelete: (id: string) => Promise<void>;
  handleGoalUpdate: (goal: Omit<Goal, "userId">) => Promise<void>;
  handleGoalDelete: (id: string) => Promise<void>;
  handlePotSave: (pot: Omit<Pot, "userId">) => Promise<void>;
  handlePotDelete: (id: string) => Promise<void>;
  handleAddSubscription: (sub: Omit<Subscription, "userId">) => Promise<void>;
  handleDeleteSubscription: (id: string) => Promise<void>;
  handleSaveChatSession: (session: ChatSession) => void;
  handleDeleteChatSession: (id: string) => void;
  handleMigrateData: () => Promise<void>;
  handleResetAndSync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { profile, loginWithGoogle, isInitialized } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [usdRate, setUsdRate] = useState<number>(4.45);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateData | null>(
    null,
  );
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
    getUSDToMYRRate().then((data) => {
      setExchangeRate(data);
      setUsdRate(data.rate);
    });
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
    const today = new Date().toLocaleDateString("en-CA");
    let newTxs: Transaction[] = [];
    let updatedSubs = [...subs];
    let processedCount = 0;
    const currentUserId = profile.id || "guest";

    updatedSubs = updatedSubs.map((sub) => {
      if (!sub.active) return sub;
      // Use normalizeDate to ensure internal nextPaymentDate is always YYYY-MM-DD local
      let nextDateStr = normalizeDate(sub.nextPaymentDate);
      let hasProcessed = false;
      while (nextDateStr <= today) {
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
          date: nextDateStr,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        newTxs.push(newTx);
        const d = parseDateSafe(nextDateStr);
        if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
        else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
        else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + 1);
        nextDateStr = d.toLocaleDateString("en-CA");
      }
      if (hasProcessed) {
        processedCount++;
        return { ...sub, nextPaymentDate: nextDateStr };
      }
      return { ...sub, nextPaymentDate: nextDateStr }; // Always normalize
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

        const mergedChatSessions = merge(
          StorageService.getStoredChatSessions(),
          cloudData.chatSessions || [],
        );
        setChatSessions(mergedChatSessions);
        StorageService.saveChatSessions(mergedChatSessions);

        await SheetService.syncWithGoogleSheets(
          mergedAccounts,
          mergedTransactions,
          mergedCategories,
          mergedGoals,
          mergedSubs,
          mergedPots,
          profile.syncChatToSheets ? mergedChatSessions : undefined,
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

  const handleTransactionSubmit = async (tx: Omit<Transaction, "userId">) => {
    const oldTx = transactions.find((t) => t.id === tx.id);
    const isEdit = !!oldTx;
    const txWithUser = { ...tx, userId: profile.id || "local" } as Transaction;

    // 1. Update Transactions State & Storage
    let updatedTransactions;
    if (isEdit) {
      updatedTransactions = transactions.map((t) =>
        t.id === tx.id ? txWithUser : t,
      );
      if (SheetService.isClientReady())
        await SheetService.updateOne("Transactions", tx.id, txWithUser);
    } else {
      updatedTransactions = [...transactions, txWithUser];
      if (SheetService.isClientReady())
        await SheetService.insertOne("Transactions", txWithUser);
    }
    setTransactions(updatedTransactions);
    StorageService.saveTransactions(updatedTransactions);

    // 2. Update Accounts Balance
    const updatedAccounts = accounts.map((a) => {
      let balance = a.balance;

      // Revert old transaction impacts
      if (isEdit && oldTx) {
        if (a.id === oldTx.accountId) {
          if (oldTx.type === TransactionType.INCOME) balance -= oldTx.amount;
          else balance += oldTx.amount; // Expense, Transfer, Adjustment
        }
        if (
          oldTx.type === TransactionType.TRANSFER &&
          a.id === oldTx.toAccountId
        ) {
          balance -= oldTx.amount;
        }
      }

      // Apply new transaction impacts
      if (a.id === tx.accountId) {
        if (tx.type === TransactionType.INCOME) balance += tx.amount;
        else balance -= tx.amount;
      }
      if (tx.type === TransactionType.TRANSFER && a.id === tx.toAccountId) {
        balance += tx.amount;
      }

      return balance !== a.balance ? { ...a, balance } : a;
    });

    setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);

    // 3. Update Pot balance if linked
    if (tx.potId || (isEdit && oldTx?.potId)) {
      const updatedPots = pots.map((p) => {
        let newAmount = p.currentAmount;

        // Revert old Pot impact
        if (isEdit && oldTx?.potId === p.id) {
          if (oldTx.type === TransactionType.INCOME) newAmount -= oldTx.amount;
          else newAmount += oldTx.amount;
        }

        // Apply new Pot impact
        if (tx.potId === p.id) {
          if (tx.type === TransactionType.INCOME) newAmount += tx.amount;
          else newAmount -= tx.amount;
        }

        if (newAmount !== p.currentAmount) {
          const updated = { ...p, currentAmount: newAmount };
          if (SheetService.isClientReady())
            SheetService.updateOne("Pots", p.id, updated);
          return updated;
        }
        return p;
      });
      setPots(updatedPots);
      StorageService.savePots(updatedPots);
    }

    showToast("Transaction saved", "success");
  };

  const handleTransactionDelete = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      const updatedAccounts = accounts.map((a) => {
        if (a.id === tx.accountId) {
          let balanceRestore = 0;
          if (tx.type === TransactionType.INCOME) balanceRestore = -tx.amount;
          else balanceRestore = tx.amount;
          return { ...a, balance: a.balance + balanceRestore };
        }
        if (tx.type === TransactionType.TRANSFER && a.id === tx.toAccountId) {
          return { ...a, balance: a.balance - tx.amount };
        }
        return a;
      });
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);

      // Restore Pot balance if linked
      if (tx.potId) {
        const updatedPots = pots.map((p) => {
          if (p.id === tx.potId) {
            let balanceRestore = 0;
            if (tx.type === TransactionType.INCOME) balanceRestore = -tx.amount;
            else balanceRestore = tx.amount;
            const updatedPot = {
              ...p,
              currentAmount: p.currentAmount + balanceRestore,
            };
            if (SheetService.isClientReady())
              SheetService.updateOne("Pots", p.id, updatedPot);
            return updatedPot;
          }
          return p;
        });
        setPots(updatedPots);
        StorageService.savePots(updatedPots);
      }
    }
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    StorageService.saveTransactions(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Transactions", id);
    showToast("Transaction deleted", "success");
  };

  const handleCategorySave = async (cat: Omit<Category, "userId">) => {
    const isEdit = categories.some((c) => c.id === cat.id);
    const catWithUser = { ...cat, userId: profile.id || "local" } as Category;
    const updated = isEdit
      ? categories.map((c) => (c.id === cat.id ? catWithUser : c))
      : [...categories, catWithUser];
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (SheetService.isClientReady()) {
      if (isEdit)
        await SheetService.updateOne("Categories", cat.id, catWithUser);
      else await SheetService.insertOne("Categories", catWithUser);
    }
    showToast("Category saved", "success");
  };

  const handleCategoryDelete = async (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (SheetService.isClientReady())
      await SheetService.deleteOne("Categories", id);
    showToast("Category deleted", "success");
  };

  const handleGoalUpdate = async (goal: Omit<Goal, "userId">) => {
    const isEdit = goals.some((g) => g.id === goal.id);
    const goalWithUser = { ...goal, userId: profile.id || "local" } as Goal;
    const updated = isEdit
      ? goals.map((g) => (g.id === goal.id ? goalWithUser : g))
      : [...goals, goalWithUser];
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (SheetService.isClientReady()) {
      if (isEdit) await SheetService.updateOne("Goals", goal.id, goalWithUser);
      else await SheetService.insertOne("Goals", goalWithUser);
    }
    showToast("Goal updated", "success");
  };

  const handleGoalDelete = async (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (SheetService.isClientReady()) await SheetService.deleteOne("Goals", id);
    showToast("Goal deleted", "success");
  };

  const handlePotSave = async (pot: Omit<Pot, "userId">) => {
    const isEdit = pots.some((p) => p.id === pot.id);
    const potWithUser = { ...pot, userId: profile.id || "local" } as Pot;
    const updated = isEdit
      ? pots.map((p) => (p.id === pot.id ? potWithUser : p))
      : [...pots, potWithUser];
    setPots(updated);
    StorageService.savePots(updated);
    if (SheetService.isClientReady()) {
      if (isEdit) await SheetService.updateOne("Pots", pot.id, potWithUser);
      else await SheetService.insertOne("Pots", potWithUser);
    }
    showToast("Pot saved", "success");
  };

  const handlePotDelete = async (id: string) => {
    const updated = pots.filter((p) => p.id !== id);
    setPots(updated);
    StorageService.savePots(updated);
    if (SheetService.isClientReady()) await SheetService.deleteOne("Pots", id);
    showToast("Pot deleted", "success");
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

  const handleSaveChatSession = async (session: ChatSession) => {
    const isEdit = chatSessions.some((s) => s.id === session.id);
    const updated = isEdit
      ? chatSessions.map((s) => (s.id === session.id ? session : s))
      : [...chatSessions, session];
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
    if (SheetService.isClientReady() && profile.syncChatToSheets) {
      if (isEdit)
        await SheetService.updateOne("ChatSessions", session.id, session);
      else await SheetService.insertOne("ChatSessions", session);
    }
  };

  const handleDeleteChatSession = async (id: string) => {
    const updated = chatSessions.filter((s) => s.id !== id);
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
    if (SheetService.isClientReady() && profile.syncChatToSheets) {
      await SheetService.deleteOne("ChatSessions", id);
    }
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
      StorageService.saveChatSessions(cloudData.chatSessions || []);
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
        exchangeRate,
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
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
}
