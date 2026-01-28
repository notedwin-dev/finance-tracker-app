import React, { useState, useEffect } from "react";
import {
  HomeIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  ClockIcon as ClockIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserIcon as UserIconSolid,
} from "@heroicons/react/24/solid";
import * as StorageService from "./services/storage";
import * as SheetService from "./services/sheets";
import { useAuth } from "./services/auth";
import {
  Account,
  Category,
  Transaction,
  TransactionType,
  Goal,
  Subscription,
  Pot,
} from "./types";
import AccountCard from "./components/AccountCard";
import AccountForm from "./components/AccountForm";
import AccountDetailModal from "./components/AccountDetailModal";
import TransactionForm from "./components/TransactionForm";
import SubscriptionManager from "./components/SubscriptionManager"; // Import
import History from "./components/History";
import Goals from "./components/Goals";
import Profile from "./components/Profile";
import CategoryManager from "./components/CategoryManager";
import {
  RevenueChart,
  GoalProgressCard,
  NetWorthChart,
} from "./components/Charts";
import { groupTransactions, normalizeDate } from "./utils/transactions";

type Tab = "DASHBOARD" | "HISTORY" | "GOALS" | "PROFILE";

const App: React.FC = () => {
  const { profile, login, logout, updateProfile, isInitialized } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("DASHBOARD");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<
    Transaction | undefined
  >();
  const [viewAccount, setViewAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>(
    undefined,
  );

  // Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]); // Added Subscriptions State
  const [pots, setPots] = useState<Pot[]>([]);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "alert" | "info";
  } | null>(null);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = () => {
    setAccounts(StorageService.getStoredAccounts());

    // MIGRATION: Update legacy system transactions to new Types
    const loadedTxs = StorageService.getStoredTransactions();
    let migrationNeeded = false;
    const migratedTxs = loadedTxs.map((t) => {
      // Migrate Initial Balances
      if (
        t.categoryId === "system-init" &&
        t.type !== TransactionType.ACCOUNT_OPENING
      ) {
        migrationNeeded = true;
        return { ...t, type: TransactionType.ACCOUNT_OPENING };
      }
      // Migrate Deletions
      if (
        t.categoryId === "system-deletion" &&
        t.type !== TransactionType.ACCOUNT_DELETE
      ) {
        migrationNeeded = true;
        return { ...t, type: TransactionType.ACCOUNT_DELETE };
      }
      return t;
    });

    if (migrationNeeded) {
      setTransactions(migratedTxs);
      StorageService.saveTransactions(migratedTxs);
      console.log("Migrated system transactions to new enum types");
    } else {
      setTransactions(loadedTxs);
    }

    setCategories(StorageService.getStoredCategories());
    setGoals(StorageService.getStoredGoals());
    setPots(StorageService.getStoredPots());

    // Load and Process Subscriptions
    const storedSubs = StorageService.getStoredSubscriptions();
    setSubscriptions(storedSubs);

    // Check for due subscriptions
    processSubscriptions(storedSubs, migratedTxs || loadedTxs);
  };

  useEffect(() => {
    loadData();
  }, [profile.id]);

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

      // While nextDate is today or in the past
      while (nextDate <= today) {
        hasProcessed = true;
        const txDate = nextDate;

        // Generate Transaction
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          accountId: sub.accountId,
          amount: sub.amount,
          currency: sub.currency,
          type: TransactionType.EXPENSE,
          categoryId: sub.categoryId,
          shopName: sub.name + " (Subscription)",
          date: txDate,
          updatedAt: Date.now(),
        };
        newTxs.push(newTx);

        // Advance Date
        const d = new Date(nextDate);
        if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
        else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
        else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + 1); // fallback daily

        nextDate = d.toISOString().split("T")[0];
      }

      if (hasProcessed) {
        processedCount++;
        return { ...sub, nextPaymentDate: nextDate };
      }
      return sub;
    });

    if (newTxs.length > 0) {
      const allTxs = [...currentTxs, ...newTxs]; // Append new
      // Note: We should probably prepend or sort, but History sorts them.
      setTransactions(allTxs);
      StorageService.saveTransactions(allTxs);

      setSubscriptions(updatedSubs);
      StorageService.saveSubscriptions(updatedSubs);

      // Update Accounts Balance
      const accUpdates = new Map<string, number>();
      newTxs.forEach((t) => {
        accUpdates.set(
          t.accountId,
          (accUpdates.get(t.accountId) || 0) + t.amount,
        );
      });

      setAccounts((prev) => {
        const updated = prev.map((a) => {
          if (accUpdates.has(a.id)) {
            return {
              ...a,
              balance: a.balance - (accUpdates.get(a.id) || 0),
            };
          }
          return a;
        });
        StorageService.saveAccounts(updated);
        return updated;
      });

      setToast({
        message: `Processed ${processedCount} subscription payments.`,
        type: "success",
      });
    }
  };

  const handleAddSubscription = (sub: Omit<Subscription, "userId">) => {
    const currentUserId = profile.id || "guest";
    const newSub: Subscription = { ...sub, userId: currentUserId };
    const updated = [...subscriptions, newSub];
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
    setToast({ message: "Subscription added", type: "success" });
  };

  const handleDeleteSubscription = (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id);
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
  };

  // Sync when profile changes (logged in) and auth is initialized
  useEffect(() => {
    if (profile.isLoggedIn && isInitialized) {
      syncData();
    }
  }, [profile.isLoggedIn, isInitialized]);

  const syncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    console.log("Starting sync sequence...");

    // Refetch profile from storage to ensure we have the absolute latest ID
    const currentProfile = StorageService.getStoredProfile();
    const userId = currentProfile.id || profile.id;

    // Ensure SheetService knows who the current user is
    if (userId) {
      SheetService.setSheetUser(userId);
    }

    try {
      // Final attempt to initialize GAPI if it's not ready
      if (!SheetService.isClientReady()) {
        console.log("GAPI Client not ready, attempting late initialization...");
        await SheetService.initGapiClient();
        const savedToken = localStorage.getItem("google_access_token");
        if (savedToken) {
          SheetService.setGapiAccessToken(savedToken);
        }
      }

      if (!SheetService.isClientReady()) {
        console.warn("Sync skipped: GAPI client still not ready");
        showToast("Please sign in to Google to sync", "info");
        setIsSyncing(false);
        return;
      }

      showToast("Syncing with Google Sheets...", "info");

      const cloudData = await SheetService.loadFromGoogleSheets();
      if (cloudData) {
        // Pull current local data from Storage to ensure we aren't using stale state
        const localAccounts = StorageService.getStoredAccounts();
        const localTransactions = StorageService.getStoredTransactions();
        const localCategories = StorageService.getStoredCategories();
        const localGoals = StorageService.getStoredGoals();
        const localSubs = StorageService.getStoredSubscriptions();
        const localPots = StorageService.getStoredPots();

        // Merge Logic: Conflict resolution based on updatedAt timestamp
        const merge = <T extends { id: string; updatedAt?: number }>(
          local: T[],
          cloud: T[],
        ): T[] => {
          const map = new Map<string, T>();
          // Initialize with cloud data
          cloud.forEach((i) => map.set(i.id, i));

          // Merge local data
          local.forEach((i) => {
            if (map.has(i.id)) {
              const cloudItem = map.get(i.id)!;
              const localTime = i.updatedAt || 0;
              const cloudTime = cloudItem.updatedAt || 0;

              if (localTime > cloudTime) {
                map.set(i.id, i);
              }
            } else {
              map.set(i.id, i);
            }
          });
          return Array.from(map.values());
        };

        const mergedAccounts = merge(localAccounts, cloudData.accounts);
        if (mergedAccounts.length > 0 || localAccounts.length > 0) {
          setAccounts(mergedAccounts);
          StorageService.saveAccounts(mergedAccounts);
        }

        const mergedCategories = merge(localCategories, cloudData.categories);

        // MIGRATION: Deduplicate categories by name and restore "Default" IDs
        const categoryIdMap = new Map<string, string>();
        const dedupByName = (cats: Category[]) => {
          const nameMap = new Map<string, Category>();
          cats.forEach((c) => {
            const nameKey = c.name.toLowerCase().trim();
            const existing = nameMap.get(nameKey);
            if (!existing) {
              nameMap.set(nameKey, c);
            } else {
              const isDefault = (id: string) => /^c\d+$/.test(id);
              let keep = existing;
              let discard = c;
              if (isDefault(c.id) && !isDefault(existing.id)) {
                keep = c;
                discard = existing;
              } else if (!isDefault(c.id) && isDefault(existing.id)) {
                keep = existing;
                discard = c;
              } else if ((c.updatedAt || 0) > (existing.updatedAt || 0)) {
                keep = c;
                discard = existing;
              }
              nameMap.set(nameKey, keep);
              categoryIdMap.set(discard.id, keep.id);
            }
          });
          return Array.from(nameMap.values());
        };
        const finalCategories = dedupByName(mergedCategories);

        if (finalCategories.length > 0 || localCategories.length > 0) {
          setCategories(finalCategories);
          StorageService.saveCategories(finalCategories);
        }

        const mergedTransactions = merge(
          localTransactions,
          cloudData.transactions,
        );
        // Apply category ID migration to transactions
        const finalTransactions = mergedTransactions.map((t) => {
          if (t.categoryId && categoryIdMap.has(t.categoryId)) {
            return {
              ...t,
              categoryId: categoryIdMap.get(t.categoryId)!,
              updatedAt: Date.now(),
            };
          }
          return t;
        });

        if (finalTransactions.length > 0 || localTransactions.length > 0) {
          setTransactions(finalTransactions);
          StorageService.saveTransactions(finalTransactions);
        }

        const mergedGoals = merge(localGoals, cloudData.goals);
        if (mergedGoals.length > 0 || localGoals.length > 0) {
          setGoals(mergedGoals);
          StorageService.saveGoals(mergedGoals);
        }

        const mergedSubs = merge(localSubs, cloudData.subscriptions || []);
        if (mergedSubs.length > 0 || localSubs.length > 0) {
          setSubscriptions(mergedSubs);
          StorageService.saveSubscriptions(mergedSubs);
        }

        const mergedPots = merge(localPots, cloudData.pots || []);
        if (mergedPots.length > 0 || localPots.length > 0) {
          setPots(mergedPots);
          StorageService.savePots(mergedPots);
        }

        // 3. PUSH the merged state back to cloud to ensure consistency
        // This ensures that new local records (e.g., added while offline or on mobile)
        // actually reach Google Sheets.
        await SheetService.syncWithGoogleSheets(
          mergedAccounts,
          mergedTransactions,
          mergedCategories,
          mergedGoals,
          mergedSubs,
          mergedPots,
        );

        // Post-Sync processing
        processSubscriptions(mergedSubs, mergedTransactions);

        showToast("Cloud sync complete", "success");
      } else {
        // If cloudData is null, it could be that auth expired or Sheets API is not ready
        console.warn("Sync returned no data from cloud.");
        if (!SheetService.isClientReady()) {
          showToast("Session expired, please sign in", "info");
        } else {
          showToast(
            "Google Settings Error: Ensure Drive & Sheets API are enabled",
            "alert",
          );
        }
      }
    } catch (e) {
      console.error("Sync failed", e);
      showToast("Cloud sync failed", "alert");
    }
    setIsSyncing(false);
  };

  const handleAccountSave = async (acc: Omit<Account, "userId">) => {
    const currentUserId = profile.id || "guest";
    // Ensure we preserve userId if it existed in 'acc' (though we typed it as Omit)
    // Actually we should reconstruct it.
    const accountWithTimestamp: Account = {
      ...acc,
      userId: (acc as any).userId || currentUserId,
      updatedAt: Date.now(),
    };

    let newAccounts;
    const exists = accounts.find((a) => a.id === acc.id);

    // Auto-create transaction for balance adjustment
    let adjustmentTx: Transaction | undefined;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (exists) {
      newAccounts = accounts.map((a) =>
        a.id === acc.id ? accountWithTimestamp : a,
      );

      const diff = acc.balance - exists.balance;
      if (Math.abs(diff) > 0.001) {
        // Floating point check
        adjustmentTx = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          accountId: acc.id,
          amount: Math.abs(diff),
          currency: acc.currency,
          type: diff > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
          shopName: "Balance Adjustment",
          date: todayStr,
          updatedAt: Date.now(),
          categoryId: "system-adjustment", // Special marker
        };
        showToast("Holding updated & record added", "success");
      } else {
        showToast("Holding updated", "success");
      }
    } else {
      newAccounts = [...accounts, accountWithTimestamp];

      if (acc.balance > 0) {
        adjustmentTx = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          accountId: acc.id,
          amount: acc.balance,
          currency: acc.currency,
          type: TransactionType.ACCOUNT_OPENING,
          shopName: acc.name,
          date: todayStr,
          updatedAt: Date.now(),
          categoryId: "system-init", // We might map this to a real category ID or leave it
        };
      }
      showToast("New holding added", "success");
    }

    if (exists) {
      setAccounts(newAccounts);
      await StorageService.saveAccounts(newAccounts);
    } else {
      // Optimized Insert for New Account
      setAccounts(newAccounts);
      // We pass the new object to insertOne
      await StorageService.insertOneAccount(accountWithTimestamp);
    }

    let finalTransactions = transactions;
    if (adjustmentTx) {
      const newTxList = [adjustmentTx, ...transactions];
      setTransactions(newTxList);
      // Optimized insert
      await StorageService.insertOneTransaction(adjustmentTx);
      finalTransactions = newTxList;
    }

    if (viewAccount && viewAccount.id === acc.id) {
      setViewAccount(accountWithTimestamp);
    }

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        newAccounts,
        finalTransactions,
        categories,
        goals,
        subscriptions,
        pots,
      );
    }

    setShowAccountForm(false);
    setEditingAccount(undefined);
  };

  const handleAccountDelete = async (id: string, name: string) => {
    // 1. Remove from Accounts List
    const newAccounts = accounts.filter((a) => a.id !== id);
    setAccounts(newAccounts);
    await StorageService.saveAccounts(newAccounts);

    // 2. Add "Deletion" transaction to zero out the history gracefully
    const acc = accounts.find((a) => a.id === id);
    let finalTransactions = transactions;
    const currentUserId = profile.id || "guest";

    if (acc && Math.abs(acc.balance) > 0.001) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const deleteTx: Transaction = {
        id: crypto.randomUUID(),
        userId: currentUserId,
        accountId: id, // We keep the ID for history reference even if account is gone from active list
        amount: acc.balance,
        currency: acc.currency,
        type: TransactionType.ACCOUNT_DELETE,
        shopName: `${name} (Deleted)`,
        date: todayStr,
        updatedAt: Date.now(),
        categoryId: "system-deletion",
      };

      const newTxList = [deleteTx, ...transactions];
      setTransactions(newTxList);
      // Optimized insert
      await StorageService.insertOneTransaction(deleteTx);
      finalTransactions = newTxList;
    }

    if (viewAccount && viewAccount.id === id) {
      setViewAccount(null);
    }

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        newAccounts,
        finalTransactions,
        categories,
        goals,
        subscriptions,
        pots,
      );
    }

    showToast("Holding removed", "success");
  };

  const handleTransactionSubmit = async (
    formData: Omit<Transaction, "id" | "userId">,
  ) => {
    let currentTransactions = [...transactions];
    // Deep copy accounts to avoid state mutation
    let currentAccounts = accounts.map((a) => ({ ...a }));
    let currentPots = pots.map((p) => ({ ...p }));
    const currentUserId = profile.id || "guest";

    const isEdit = !!editingTransaction;

    // If Editing, Delete original first
    if (editingTransaction) {
      const idsToDelete = [editingTransaction.id];
      if (editingTransaction.linkedTransactionId)
        idsToDelete.push(editingTransaction.linkedTransactionId);

      // Revert Balances
      idsToDelete.forEach((delId) => {
        const tx = currentTransactions.find((t) => t.id === delId);
        if (tx) {
          const idx = currentAccounts.findIndex((a) => a.id === tx.accountId);
          if (idx !== -1) {
            const isPositive =
              tx.type === TransactionType.INCOME ||
              (tx.type === TransactionType.TRANSFER &&
                tx.transferDirection === "IN");
            if (isPositive) currentAccounts[idx].balance -= tx.amount;
            else currentAccounts[idx].balance += tx.amount;
            currentAccounts[idx].updatedAt = Date.now();
          }
          // Revert Pot Balance
          if (tx.potId) {
            const pIdx = currentPots.findIndex((p) => p.id === tx.potId);
            if (pIdx !== -1) {
              const isPositive = tx.type === TransactionType.INCOME;
              if (isPositive) currentPots[pIdx].currentAmount -= tx.amount;
              else currentPots[pIdx].currentAmount += tx.amount;
              currentPots[pIdx].updatedAt = Date.now();
            }
          }
        }
      });
      // Remove from list
      currentTransactions = currentTransactions.filter(
        (t) => !idsToDelete.includes(t.id),
      );
    }

    // CREATE NEW
    let newTxItems: Transaction[] = [];

    if (formData.type === TransactionType.TRANSFER && formData.toAccountId) {
      const outgoingId = crypto.randomUUID();
      const incomingId = crypto.randomUUID();
      const now = Date.now();

      const outgoingTx: Transaction = {
        ...formData,
        userId: currentUserId,
        id: outgoingId,
        linkedTransactionId: incomingId,
        transferDirection: "OUT",
        updatedAt: now,
      };

      const incomingTx: Transaction = {
        ...formData,
        userId: currentUserId,
        id: incomingId,
        accountId: formData.toAccountId,
        toAccountId: formData.accountId,
        linkedTransactionId: outgoingId,
        transferDirection: "IN",
        updatedAt: now,
      };

      newTxItems = [outgoingTx, incomingTx];
    } else {
      newTxItems = [
        {
          ...formData,
          userId: currentUserId,
          id: crypto.randomUUID(),
          updatedAt: Date.now(),
        },
      ];
    }

    const newTransactionsList = [...newTxItems, ...currentTransactions];
    setTransactions(newTransactionsList);

    // Update Balance (New)
    const newAccounts = [...currentAccounts];
    const newPots = [...currentPots];

    newTxItems.forEach((tx) => {
      const idx = newAccounts.findIndex((a) => a.id === tx.accountId);
      if (idx !== -1) {
        newAccounts[idx] = {
          ...newAccounts[idx],
          updatedAt: Date.now(),
        };

        if (tx.type === TransactionType.EXPENSE) {
          newAccounts[idx].balance -= tx.amount;
        } else if (tx.type === TransactionType.INCOME) {
          newAccounts[idx].balance += tx.amount;
        } else if (tx.type === TransactionType.TRANSFER) {
          if (tx.transferDirection === "OUT") {
            newAccounts[idx].balance -= tx.amount;
          } else if (tx.transferDirection === "IN") {
            newAccounts[idx].balance += tx.amount;
          }
        }
      }

      // Pot Update
      if (tx.potId) {
        const pIdx = newPots.findIndex((p) => p.id === tx.potId);
        if (pIdx !== -1) {
          if (tx.type === TransactionType.EXPENSE) {
            newPots[pIdx].currentAmount -= tx.amount;
          } else if (tx.type === TransactionType.INCOME) {
            newPots[pIdx].currentAmount += tx.amount;
          }
          newPots[pIdx].updatedAt = Date.now();
        }
      }
    });

    setAccounts(newAccounts);
    setPots(newPots);
    await StorageService.saveAccounts(newAccounts);
    await StorageService.savePots(newPots);

    // Sync Transactions: Full Save if Edit, Optimized Insert if New
    if (isEdit) {
      await StorageService.saveTransactions(newTransactionsList);
    } else {
      if (newTxItems.length === 1) {
        await StorageService.insertOneTransaction(newTxItems[0]);
      } else {
        await StorageService.insertManyTransactions(newTxItems);
      }
    }

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        newAccounts,
        newTransactionsList,
        categories,
        goals,
        subscriptions,
        newPots,
      );
    }

    // Sync viewAccount if currently viewing one
    if (viewAccount) {
      const updated = newAccounts.find((a) => a.id === viewAccount.id);
      if (updated) setViewAccount(updated);
    }

    setShowAddModal(false);
    setEditingTransaction(undefined);
    showToast(
      editingTransaction ? "Record updated" : "Record added",
      "success",
    );
  };

  const handleTransactionDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    let currentTransactions = [...transactions];
    // Deep copy accounts
    let currentAccounts = accounts.map((a) => ({ ...a }));
    let currentPots = pots.map((p) => ({ ...p }));

    const txToDelete = currentTransactions.find((t) => t.id === id);
    if (!txToDelete) return;

    const idsToDelete = [id];
    if (txToDelete.linkedTransactionId)
      idsToDelete.push(txToDelete.linkedTransactionId);

    // Revert Balances
    idsToDelete.forEach((delId) => {
      const tx = currentTransactions.find((t) => t.id === delId);
      if (tx) {
        const idx = currentAccounts.findIndex((a) => a.id === tx.accountId);
        if (idx !== -1) {
          const isPositive =
            tx.type === TransactionType.INCOME ||
            (tx.type === TransactionType.TRANSFER &&
              tx.transferDirection === "IN");
          if (isPositive) currentAccounts[idx].balance -= tx.amount;
          else currentAccounts[idx].balance += tx.amount;
          currentAccounts[idx].updatedAt = Date.now();
        }

        // Revert Pot Balance
        if (tx.potId) {
          const pIdx = currentPots.findIndex((p) => p.id === tx.potId);
          if (pIdx !== -1) {
            const isPositive = tx.type === TransactionType.INCOME;
            if (isPositive) currentPots[pIdx].currentAmount -= tx.amount;
            else currentPots[pIdx].currentAmount += tx.amount;
            currentPots[pIdx].updatedAt = Date.now();
          }
        }
      }
    });

    // Remove
    const newTransactionsList = currentTransactions.filter(
      (t) => !idsToDelete.includes(t.id),
    );

    setTransactions(newTransactionsList);
    setAccounts(currentAccounts);
    setPots(currentPots);

    await StorageService.saveTransactions(newTransactionsList);
    await StorageService.saveAccounts(currentAccounts);
    await StorageService.savePots(currentPots);

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        currentAccounts,
        newTransactionsList,
        categories,
        goals,
        subscriptions,
        currentPots,
      );
    }

    // Sync viewAccount if currently viewing one
    if (viewAccount) {
      const updated = currentAccounts.find((a) => a.id === viewAccount.id);
      if (updated) setViewAccount(updated);
    }

    showToast("Record deleted", "success");
  };

  const handleGoalUpdate = async (g: Omit<Goal, "userId">) => {
    const currentUserId = profile.id || "guest";
    // Ensure userId is present
    const newGoal: Goal = {
      ...g,
      userId: currentUserId,
      updatedAt: Date.now(),
    };
    const exists = goals.find((g2) => g2.id === g.id);

    if (exists) {
      const newGoals = goals.map((Existing) =>
        Existing.id === g.id ? newGoal : Existing,
      );
      setGoals(newGoals);
      await StorageService.saveGoals(newGoals);

      if (SheetService.isClientReady()) {
        await SheetService.syncWithGoogleSheets(
          accounts,
          transactions,
          categories,
          newGoals,
          subscriptions,
          pots,
        );
      }
    } else {
      const newGoals = [...goals, newGoal];
      setGoals(newGoals);
      await StorageService.insertOneGoal(newGoal);

      if (SheetService.isClientReady()) {
        await SheetService.syncWithGoogleSheets(
          accounts,
          transactions,
          categories,
          newGoals,
          subscriptions,
          pots,
        );
      }
    }
  };

  const handleGoalDelete = async (id: string) => {
    const newGoals = goals.filter((g) => g.id !== id);
    setGoals(newGoals);
    await StorageService.saveGoals(newGoals);

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        accounts,
        transactions,
        categories,
        newGoals,
        subscriptions,
        pots,
      );
    }
  };

  const handlePotSave = async (pot: Omit<Pot, "userId">) => {
    const currentUserId = profile.id || "guest";
    const potWithTimestamp: Pot = {
      ...pot,
      userId: currentUserId,
      updatedAt: Date.now(),
    };
    const exists = pots.find((p) => p.id === pot.id);
    let newPots;

    if (exists) {
      newPots = pots.map((p) => (p.id === pot.id ? potWithTimestamp : p));
      setPots(newPots);
      await StorageService.savePots(newPots);
      showToast("Pot updated", "success");
    } else {
      newPots = [potWithTimestamp, ...pots];
      setPots(newPots);
      await StorageService.savePots(newPots);
      showToast("Pot created", "success");
    }

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        accounts,
        transactions,
        categories,
        goals,
        subscriptions,
        newPots,
      );
    }
  };

  const handlePotDelete = async (id: string) => {
    if (!confirm("Delete this pot? Unused funds will stay in your account."))
      return;
    const newPots = pots.filter((p) => p.id !== id);
    setPots(newPots);
    await StorageService.savePots(newPots);

    if (SheetService.isClientReady()) {
      await SheetService.syncWithGoogleSheets(
        accounts,
        transactions,
        categories,
        goals,
        subscriptions,
        newPots,
      );
    }
    showToast("Pot deleted", "success");
  };

  const handleCategorySave = async (cat: Omit<Category, "userId">) => {
    const currentUserId = profile.id || "guest";
    const catWithTimestamp: Category = {
      ...cat,
      userId: currentUserId,
      updatedAt: Date.now(),
    };
    const exists = categories.find((c) => c.id === cat.id);
    let newCategories;

    if (exists) {
      newCategories = categories.map((c) =>
        c.id === cat.id ? catWithTimestamp : c,
      );
      setCategories(newCategories);
      await StorageService.saveCategories(newCategories);
      showToast("Category updated", "success");
    } else {
      newCategories = [...categories, catWithTimestamp];
      setCategories(newCategories);
      await StorageService.insertOneCategory(catWithTimestamp);
      showToast("Category added", "success");
    }
  };

  const handleCategoryDelete = async (id: string) => {
    const newCategories = categories.filter((c) => c.id !== id);
    setCategories(newCategories);
    await StorageService.saveCategories(newCategories);
    showToast("Category deleted", "success");
  };

  const handleMigrateData = async () => {
    if (!profile.id) return;

    // Check for any orphaned data first
    const findings = StorageService.rescueScatteredData();
    if (findings.length === 0) {
      showToast("No orphaned data found in this browser", "info");
      return;
    }

    const totalCount = findings.reduce((sum, f) => sum + f.count, 0);
    if (
      !confirm(
        `Found ${totalCount} records in ${findings.length} categories from other sessions/users. Merge them into your current account?`,
      )
    )
      return;

    let success = false;
    for (const item of findings) {
      // Find matching base key
      const baseKeyMatch = Object.values(StorageService.KEYS).find((k) =>
        item.key.startsWith(k),
      );
      if (baseKeyMatch) {
        const migrated = StorageService.importFromKey(
          item.key,
          baseKeyMatch as string,
        );
        if (migrated) {
          success = true;
          // Clear the source key to prevent garbage piling up
          localStorage.removeItem(item.key);
        }
      }
    }

    if (success) {
      showToast("Data recovered! Reloading app...", "success");
      // Short delay so they see the toast
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast("Selected data was already in your account", "info");
    }
  };

  const handleExportData = () => {
    const data = {
      profile,
      accounts,
      transactions,
      categories,
      goals,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenfinance_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Data exported", "success");
  };

  const handleLogout = async () => {
    if (profile.isLoggedIn) {
      showToast("Syncing data before logout...", "success");
      await StorageService.syncAllData(
        accounts,
        transactions,
        categories,
        goals,
        subscriptions,
        pots,
      );
    }
    logout();
  };

  const showToast = (message: string, type: "success" | "alert" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Calculations for Dashboard
  const totalBalanceMYR = accounts.reduce((sum, a) => {
    let val = a.balance;
    if (a.currency === "USD") val = val * 4.5;
    return sum + val;
  }, 0);

  // Goal Progress Calculations
  const totalGoalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalGoalSaved = goals.reduce((sum, g) => {
    if (g.linkedAccountId) {
      const acc = accounts.find((a) => a.id === g.linkedAccountId);
      return sum + (acc ? acc.balance : 0);
    }
    return sum + g.currentAmount;
  }, 0);

  return (
    <div className="min-h-screen bg-background text-gray-100 font-sans flex justify-center">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-surface border-r border-gray-800 p-6 fixed left-0 top-0 z-40">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-lg">Z</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            ZenFinance
          </h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarLink
            tab="DASHBOARD"
            icon={HomeIcon}
            label="Dashboard"
            active={activeTab === "DASHBOARD"}
            onClick={() => setActiveTab("DASHBOARD")}
          />
          <SidebarLink
            tab="HISTORY"
            icon={ClockIcon}
            label="Transactions"
            active={activeTab === "HISTORY"}
            onClick={() => setActiveTab("HISTORY")}
          />
          <SidebarLink
            tab="GOALS"
            icon={ChartBarIcon}
            label="Goals & Pots"
            active={activeTab === "GOALS"}
            onClick={() => setActiveTab("GOALS")}
          />
          <SidebarLink
            tab="PROFILE"
            icon={UserIcon}
            label="Profile"
            active={activeTab === "PROFILE"}
            onClick={() => setActiveTab("PROFILE")}
          />
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-7xl">
        {/* Mobile Header */}
        <header className="lg:hidden flex justify-between items-center p-6 bg-background/90 backdrop-blur-md sticky top-0 z-30 border-b border-gray-800">
          <h1 className="text-xl font-bold">
            Zen<span className="text-primary">Finance</span>
          </h1>
          <button onClick={() => setActiveTab("PROFILE")}>
            {profile.isLoggedIn && profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                className="w-8 h-8 rounded-full border border-gray-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-surface border border-gray-700 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </button>
        </header>

        <main className="flex-1 p-6 pb-28 lg:pb-8 overflow-y-auto w-full mx-auto">
          {activeTab === "DASHBOARD" && (
            <div className="animate-fadeIn space-y-6">
              {/* Data Recovery Banner */}
              {profile.isLoggedIn && (
                <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📥</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Data Recovery
                      </h4>
                      <p className="text-[10px] text-gray-400">
                        Click to scan for records added while logged out.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleMigrateData}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap"
                  >
                    Recover Now
                  </button>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Welcome, {profile.name || "User"}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    Overview of your wealth.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="hidden lg:flex items-center gap-2 bg-primary hover:bg-primaryDark text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:scale-105"
                >
                  <PlusIcon className="w-5 h-5" /> Add Record
                </button>
              </div>

              {/* Top Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Net Worth Card */}
                <div className="col-span-1 md:col-span-1 bg-gradient-to-br from-primary to-purple-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between h-64 border border-white/10">
                  <div className="relative z-10">
                    <p className="text-indigo-200 text-sm font-medium mb-1">
                      Total Balance
                    </p>
                    <h3 className="text-4xl font-black tracking-tight">
                      RM{" "}
                      {totalBalanceMYR.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </h3>
                  </div>
                  <div className="relative z-10 flex gap-2">
                    <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full text-xs border border-white/10">
                      {accounts.length} Assets
                    </div>
                    <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full text-xs border border-white/10">
                      {transactions.length} Records
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                </div>

                {/* Recent Activity Mini List */}
                <div className="col-span-1 md:col-span-2 bg-card rounded-3xl p-6 border border-gray-800 h-64 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-200">Recent Activity</h3>
                    <button
                      onClick={() => setActiveTab("HISTORY")}
                      className="text-xs text-primary hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 relative">
                    {transactions.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-500 text-sm">
                          No recent transactions.
                        </p>
                      </div>
                    )}
                    {groupTransactions(transactions)
                      .slice(0, 5)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between items-center text-sm p-2 hover:bg-surface rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-lg bg-surface w-8 h-8 rounded-full flex items-center justify-center border border-gray-700">
                              {t.type === TransactionType.TRANSFER
                                ? "↔️"
                                : t.type === TransactionType.INCOME
                                  ? "💰"
                                  : "🛒"}
                            </div>
                            <div>
                              <p className="font-bold text-gray-200">
                                {t.shopName ||
                                  (t.type === TransactionType.TRANSFER
                                    ? "Transfer"
                                    : "Untitled")}
                              </p>
                              <div className="flex flex-col">
                                <p className="text-[10px] text-gray-500">
                                  {normalizeDate(t.date)}
                                </p>
                                {t.linkedTransaction && (
                                  <p className="text-[10px] text-gray-400">
                                    {accounts.find((a) => a.id === t.accountId)
                                      ?.name || "Unknown"}{" "}
                                    ➔{" "}
                                    {accounts.find(
                                      (a) => a.id === t.toAccountId,
                                    )?.name || "Unknown"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            {t.linkedTransaction ? (
                              <>
                                <span className="text-success">
                                  {t.linkedTransaction.amount.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}{" "}
                                  <span className="text-[10px] text-gray-500">
                                    {t.currency}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span
                                className={
                                  t.type === TransactionType.EXPENSE
                                    ? "text-white"
                                    : "text-success"
                                }
                              >
                                {t.type === TransactionType.EXPENSE ? "-" : "+"}
                                {t.amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                <span className="text-[10px] text-gray-500">
                                  {t.currency}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Analytics & Goals Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-2">
                  <NetWorthChart
                    transactions={transactions}
                    currentTotal={totalBalanceMYR}
                  />
                </div>
                <div className="col-span-1 h-80">
                  <GoalProgressCard
                    achieved={totalGoalSaved}
                    target={totalGoalTarget}
                  />
                </div>
              </div>

              {/* Holdings Grid */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">My Holdings</h3>
                  <button
                    onClick={() => {
                      setViewAccount(null);
                      setEditingAccount(undefined);
                      setShowAccountForm(true);
                    }}
                    className="text-xs bg-surface hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full transition-colors text-white"
                  >
                    + Add Asset
                  </button>
                </div>

                {accounts.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl">
                    <p className="text-gray-500">No assets tracked yet.</p>
                    <button
                      onClick={() => setShowAccountForm(true)}
                      className="mt-2 text-primary text-sm font-bold"
                    >
                      Add your first bank
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {accounts.map((acc) => (
                    <AccountCard
                      key={acc.id}
                      account={acc}
                      pots={pots}
                      onClick={(a) => setViewAccount(a)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "HISTORY" && (
            <div className="animate-fadeIn max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Transaction History
              </h2>
              <History
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                onAddTransaction={() => setShowAddModal(true)}
                onEditTransaction={(t) => {
                  setEditingTransaction(t);
                  setShowAddModal(true);
                }}
                onDeleteTransaction={handleTransactionDelete}
              />
            </div>
          )}

          {activeTab === "GOALS" && (
            <div className="animate-fadeIn max-w-4xl mx-auto">
              <Goals
                goals={goals}
                pots={pots}
                accounts={accounts}
                onAddGoal={handleGoalUpdate}
                onDeleteGoal={handleGoalDelete}
                onSavePot={handlePotSave}
                onDeletePot={handlePotDelete}
              />
            </div>
          )}

          {activeTab === "PROFILE" && (
            <Profile
              profile={profile}
              onLogin={login}
              onLogout={handleLogout}
              onUpdate={updateProfile}
              onManageCategories={() => setShowCategoryManager(true)}
              onManageSubscriptions={() => setShowSubscriptionManager(true)}
              onExport={handleExportData}
              onMigrate={handleMigrateData}
              onSync={syncData}
              isSyncing={isSyncing}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 w-full z-20">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <button
            onClick={() => setShowAddModal(true)}
            className="pointer-events-auto w-14 h-14 bg-primary rounded-full shadow-lg shadow-indigo-500/50 flex items-center justify-center text-white border-[4px] border-background transform transition-transform active:scale-95 hover:scale-105"
          >
            <PlusIcon className="w-7 h-7" />
          </button>
        </div>

        <nav className="bg-surface/90 backdrop-blur-xl border-t border-gray-800 pb-safe pt-2 px-6 h-20 shadow-2xl">
          <div className="flex justify-between items-start h-full">
            <MobileNavLink
              tab="DASHBOARD"
              icon={HomeIcon}
              iconSolid={HomeIconSolid}
              label="Home"
              active={activeTab}
              setActive={setActiveTab}
            />
            <MobileNavLink
              tab="HISTORY"
              icon={ClockIcon}
              iconSolid={ClockIconSolid}
              label="History"
              active={activeTab}
              setActive={setActiveTab}
            />
            <div className="w-12"></div> {/* Spacer for FAB */}
            <MobileNavLink
              tab="GOALS"
              icon={ChartBarIcon}
              iconSolid={ChartBarIconSolid}
              label="Goals"
              active={activeTab}
              setActive={setActiveTab}
            />
            <MobileNavLink
              tab="PROFILE"
              icon={UserIcon}
              iconSolid={UserIconSolid}
              label="Profile"
              active={activeTab}
              setActive={setActiveTab}
            />
          </div>
        </nav>
      </div>

      {/* Modals */}
      {showAddModal && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          pots={pots}
          initialTransaction={editingTransaction}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(undefined);
          }}
          onSubmit={handleTransactionSubmit}
          onManageCategories={() => setShowCategoryManager(true)}
        />
      )}

      {showAccountForm && (
        <AccountForm
          initialAccount={editingAccount}
          accounts={accounts}
          onSave={handleAccountSave}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(undefined);
          }}
          onDelete={handleAccountDelete}
        />
      )}

      {viewAccount && (
        <AccountDetailModal
          account={viewAccount}
          transactions={transactions}
          pots={pots}
          onClose={() => setViewAccount(null)}
          onEdit={(acc) => {
            setViewAccount(null);
            setEditingAccount(acc);
            setShowAccountForm(true);
          }}
        />
      )}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onSave={handleCategorySave}
          onDelete={handleCategoryDelete}
        />
      )}

      {showSubscriptionManager && (
        <SubscriptionManager
          subscriptions={subscriptions}
          accounts={accounts}
          categories={categories}
          onAdd={handleAddSubscription}
          onDelete={handleDeleteSubscription}
          onClose={() => setShowSubscriptionManager(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 lg:left-auto lg:translate-x-0 left-1/2 -translate-x-1/2 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-[100] animate-fadeIn border border-white/10 backdrop-blur-md ${toast.type === "alert" ? "bg-red-500/90 text-white" : "bg-primary/90 text-white"}`}
        >
          <span className="font-bold tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

const SidebarLink = ({ tab, icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all font-medium ${active ? "bg-primary text-white shadow-lg shadow-indigo-900/30" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const MobileNavLink = ({
  tab,
  icon: Icon,
  iconSolid: IconSolid,
  label,
  active,
  setActive,
}: any) => (
  <button
    onClick={() => setActive(tab)}
    className={`flex flex-col items-center justify-center w-14 pt-1 transition-colors ${active === tab ? "text-primary" : "text-gray-500"}`}
  >
    {active === tab ? (
      <IconSolid className="w-6 h-6" />
    ) : (
      <Icon className="w-6 h-6" />
    )}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </button>
);

export default App;
