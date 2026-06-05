import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import type { UserProfile, Account, Transaction, Subscription } from "../../../../types";
import { TransactionType } from "../../../../types";
import { normalizeDate, parseDateSafe } from "../../../../helpers/transactions.helper";
import { stripVaultFromAccount } from "../../domain/migration";
import {
  computeNextOccurrences,
  buildSubscriptionTransaction,
  convertTransactionAmountForAccount,
  dedupeTransactions,
} from "../../domain/subscriptions";
import { logger } from "../logger";

export async function migrateData(): Promise<void> {
  const { showToast } = useSyncStore.getState();
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
}

export async function resetAndSync(
  profile: UserProfile,
  onProfileUpdate?: (updates: Partial<UserProfile>) => void,
  loginWithGoogle?: () => void,
): Promise<void> {
  const { showToast, setIsSyncing } = useSyncStore.getState();

  if (!confirm("Reset local cache?")) return;

  setIsSyncing(true);

  const keysToKeep = [
    "google_access_token",
    "google_token_expiry",
    "google_refresh_token",
    "encrypted_vault_key",
    "device_id",
    "zenfinance_selected_sheet_id",
    StorageService.KEYS.PROFILE,
  ];
  const saved: Record<string, string | null> = {};
  keysToKeep.forEach((k) => (saved[k] = localStorage.getItem(k)));
  localStorage.clear();
  keysToKeep.forEach((k) => saved[k] && localStorage.setItem(k, saved[k]));

  try {
    const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
    if (!cloudData || !cloudData.accounts) {
      showToast("No cloud data found. Cannot reset.", "alert");
      return;
    }

    if (cloudData.profile) {
      const mergedProfile = { ...profile, ...cloudData.profile };
      StorageService.saveProfile(mergedProfile);
      if (onProfileUpdate) onProfileUpdate(cloudData.profile);
    }
    StorageService.saveAccounts(cloudData.accounts);
    StorageService.saveTransactions(cloudData.transactions);
    StorageService.saveCategories(cloudData.categories);
    StorageService.saveGoals(cloudData.goals);
    StorageService.saveSubscriptions(cloudData.subscriptions || []);
    StorageService.savePots(cloudData.pots || []);
    StorageService.savePockets(cloudData.pockets || []);
    StorageService.saveChatSessions(cloudData.chatSessions || []);
    showToast("Sync reset complete", "success");
  } catch (e: any) {
    if (e?.status === 401) {
      showToast("Session expired. Please sign in again.", "info");
      if (loginWithGoogle) loginWithGoogle();
    } else {
      showToast("Reset failed. Working offline.", "info");
    }
  } finally {
    setIsSyncing(false);
  }
}

export async function selectExistingSheet(
  fileId?: string,
  onSync?: () => Promise<void>,
): Promise<void> {
  const { showToast } = useSyncStore.getState();

  try {
    let selectedFileId = fileId;
    if (!selectedFileId) {
      selectedFileId = await SheetService.selectSpreadsheetWithPicker();
    }
    if (selectedFileId) {
      localStorage.setItem("zenfinance_selected_sheet_id", selectedFileId);
      SheetService.clearSheetNameCache();
      showToast("Spreadsheet linked! Synchronizing...", "success");
      if (onSync) await onSync();
    }
  } catch (e) {
    logger.error("Failed to select sheet", e);
    showToast("Could not link spreadsheet.", "alert");
  }
}

let syncInProgress = false;
let lastSyncTime = 0;
let loadDataToken = 0;

export async function loadData(profile: any, _forceUnlock?: boolean): Promise<void> {
  const myToken = ++loadDataToken;
  const storedAccounts = StorageService.getStoredAccounts();

  if (myToken !== loadDataToken) return;

  const loadedTxs = StorageService.getStoredTransactions();
  const storedCategories = StorageService.getStoredCategories();
  const storedGoals = StorageService.getStoredGoals();
  const storedPots = StorageService.getStoredPots();
  const storedPockets = StorageService.getStoredPockets();
  const storedChatSessions = StorageService.getStoredChatSessions();
  const storedSubs = StorageService.getStoredSubscriptions();

  if (myToken !== loadDataToken) return;

  const store = useFinanceStore.getState();
  store.setAccounts(storedAccounts);
  store.setTransactions(loadedTxs);
  store.setCategories(storedCategories);
  store.setGoals(storedGoals);
  store.setPots(storedPots);
  store.setPockets(storedPockets);
  store.setChatSessions(storedChatSessions);
  store.setSubscriptions(storedSubs);
}

export function processSubscriptions(
  accounts: Account[],
  usdRate: number,
  options: { persist?: boolean } = { persist: true },
) {
  const { persist = true } = options;
  const subs = StorageService.getStoredSubscriptions();
  const currentTxs = StorageService.getStoredTransactions();
  const today = new Date().toLocaleDateString("en-CA");
  let newTxs: Transaction[] = [];
  let updatedSubs = [...subs];
  let processedCount = 0;
  let bailedSubIds = new Set<string>();
  const storedProfile = StorageService.getStoredProfile();
  const currentUserId = storedProfile.id || "guest";

  const rateValid = usdRate > 0 && isFinite(usdRate);
  if (!rateValid) {
    logger.warn(
      "processSubscriptions: usdRate invalid, cross-currency subs will be skipped to avoid silent balance corruption",
    );
  }

  updatedSubs = updatedSubs.map((sub) => {
    if (!sub.active) return sub;
    const { nextDateStr, generatedTxDates, bailed } = computeNextOccurrences(sub, today);
    if (!nextDateStr) {
      logger.warn(`processSubscriptions: invalid nextPaymentDate for sub ${sub.id}, skipping`);
      return sub;
    }
    const newSubTxs = generatedTxDates.map((d) => buildSubscriptionTransaction(sub, d, currentUserId));
    newTxs.push(...newSubTxs);
    if (bailed) {
      logger.warn(
        `processSubscriptions: sub ${sub.id} hit iteration cap; nextPaymentDate may be corrupted`,
        sub.nextPaymentDate,
      );
      bailedSubIds.add(sub.id);
      return { ...sub, nextPaymentDate: nextDateStr };
    }
    if (newSubTxs.length > 0) {
      processedCount++;
      return {
        ...sub,
        nextPaymentDate: nextDateStr,
        updatedAt: new Date().toISOString(),
      };
    }
    return { ...sub, nextPaymentDate: nextDateStr };
  });

  if (newTxs.length === 0) return;

  const dedupedNewTxs = dedupeTransactions(currentTxs, newTxs);
  if (dedupedNewTxs.length === 0) {
    if (persist) {
      StorageService.saveSubscriptions(updatedSubs);
    }
    useFinanceStore.getState().setSubscriptions(updatedSubs);
    useSyncStore.getState().showToast(
      "No new subscription payments to apply.",
      "info",
    );
    return;
  }

  const allTxs = [...currentTxs, ...dedupedNewTxs];
  const accUpdates = new Map<string, number>();
  dedupedNewTxs.forEach((t) => {
    const acc = accounts.find((a) => a.id === t.accountId);
    if (!acc) return;
    if (t.currency !== acc.currency && !rateValid) {
      logger.warn(
        `processSubscriptions: skipping cross-currency sub for ${t.id} due to invalid usdRate`,
      );
      return;
    }
    const amount = convertTransactionAmountForAccount(t, acc, usdRate, rateValid);
    accUpdates.set(t.accountId, (accUpdates.get(t.accountId) || 0) + amount);
  });

  const updatedAccounts = accounts.map((a) => {
    if (accUpdates.has(a.id))
      return {
        ...a,
        balance: a.balance - (accUpdates.get(a.id) || 0),
        updatedAt: new Date().toISOString(),
      };
    return a;
  });

  const store = useFinanceStore.getState();
  store.setTransactions(allTxs);
  store.setSubscriptions(updatedSubs);
  store.setAccounts(updatedAccounts);

  if (persist) {
    StorageService.saveTransactions(allTxs);
    StorageService.saveSubscriptions(updatedSubs);
    StorageService.saveAccounts(updatedAccounts);
  }

  useSyncStore.getState().showToast(
    `Processed ${processedCount} subscription payments, ${dedupedNewTxs.length} new transactions applied.`,
    "success",
  );
}

export async function syncData(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loginWithGoogle: () => void,
): Promise<void> {
  if (syncInProgress || profile.offlineMode) return;

  const now = Date.now();
  const MIN_SYNC_INTERVAL = 5000;
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
    logger.log(
      `⏱️ Sync throttled (last sync ${Math.round((now - lastSyncTime) / 1000)}s ago)`,
    );
    return;
  }

  syncInProgress = true;
  lastSyncTime = now;
  useSyncStore.getState().setIsSyncing(true);

  const currentProfile = StorageService.getStoredProfile();
  const userId = currentProfile.id || profile.id;
  if (userId) SheetService.setSheetUser(userId);

  try {
    if (!SheetService.isClientReady()) {
      try {
        await SheetService.initGapiClient();
      } catch (e) {
        logger.warn("GAPI init failed, likely offline.");
        syncInProgress = false;
        useSyncStore.getState().setIsSyncing(false);
        return;
      }
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
      if (!navigator.onLine) {
        syncInProgress = false;
        useSyncStore.getState().setIsSyncing(false);
        return;
      }
      useSyncStore.getState().showToast("Session expired. Please sign in again.", "info");
      loginWithGoogle();
      syncInProgress = false;
      useSyncStore.getState().setIsSyncing(false);
      return;
    }

    useSyncStore.getState().showToast("Syncing with Google Sheets...", "info");
    const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
    if (cloudData) {
      const hasCloudData =
        (cloudData.accounts && cloudData.accounts.length > 0) ||
        (cloudData.transactions && cloudData.transactions.length > 0) ||
        (cloudData.categories && cloudData.categories.length > 0);

      const hasLocalData =
        StorageService.getStoredAccounts().length > 0 ||
        StorageService.getStoredTransactions().length > 0 ||
        StorageService.getStoredCategories().length > 0;

      let useCloudAsAuthority = true;

      if (hasCloudData && hasLocalData && cloudData.profile) {
        const toTimestamp = (value: any): number => {
          if (!value) return 0;
          if (typeof value === "number") return value;
          if (typeof value === "string") return new Date(value).getTime();
          return 0;
        };

        const cloudLastUpdated = toTimestamp(cloudData.profile.lastUpdatedAt);
        const localLastSynced = toTimestamp(profile.lastSyncAt);

        if (localLastSynced > cloudLastUpdated) {
          logger.log("Re-linking: Local data is newer than cloud. Local will update cloud.");
          useCloudAsAuthority = false;
        } else {
          logger.log("Re-linking: Cloud data is newer or equal. Cloud is authoritative.");
          useCloudAsAuthority = true;
        }
      }

      let activeProfile = { ...profile };
      if (cloudData.profile) {
        const updates: any = {};

        if (cloudData.profile.name && cloudData.profile.name !== profile.name) {
          updates.name = cloudData.profile.name;
        }

        if (
          cloudData.profile.maskMode !== undefined &&
          cloudData.profile.maskMode !== profile.maskMode
        ) {
          updates.maskMode = cloudData.profile.maskMode;
        }

        if (
          cloudData.profile.showAIAssistant !== undefined &&
          cloudData.profile.showAIAssistant !== profile.showAIAssistant
        ) {
          updates.showAIAssistant = cloudData.profile.showAIAssistant;
        }

        if (
          cloudData.profile.syncChatToSheets !== undefined &&
          cloudData.profile.syncChatToSheets !== profile.syncChatToSheets
        ) {
          updates.syncChatToSheets = cloudData.profile.syncChatToSheets;
        }

        if (Object.keys(updates).length > 0) {
          logger.log("Updating local profile from cloud merge", updates);
          activeProfile = { ...activeProfile, ...updates };
        }
      }

      const merge = <T extends { id: string; updatedAt?: any }>(
        local: T[],
        cloud: T[],
        trustCloud: boolean = true,
      ): T[] => {
        const map = new Map<string, T>();
        const now = new Date().toISOString();

        const toTimestamp = (value: any): number => {
          if (!value) return 0;
          if (typeof value === "number") return value;
          if (typeof value === "string") return new Date(value).getTime();
          return 0;
        };

        if (trustCloud) {
          cloud.forEach((i) => {
            if (i.id) {
              map.set(String(i.id), { ...i, updatedAt: i.updatedAt || now });
            }
          });
          local.forEach((i) => {
            const id = String(i.id);
            if (map.has(id)) {
              const cloudItem = map.get(id)!;
              if (toTimestamp(i.updatedAt) > toTimestamp(cloudItem.updatedAt)) {
                map.set(id, { ...i, updatedAt: i.updatedAt || now });
              }
            } else if (i.id) {
              map.set(id, { ...i, updatedAt: i.updatedAt || now });
            }
          });
        } else {
          local.forEach((i) => {
            if (i.id) {
              map.set(String(i.id), { ...i, updatedAt: i.updatedAt || now });
            }
          });
          cloud.forEach((i) => {
            const id = String(i.id);
            if (map.has(id)) {
              const localItem = map.get(id)!;
              if (toTimestamp(i.updatedAt) > toTimestamp(localItem.updatedAt)) {
                map.set(id, { ...i, updatedAt: i.updatedAt || now });
              }
            } else if (i.id) {
              map.set(id, { ...i, updatedAt: i.updatedAt || now });
            }
          });
        }

        return Array.from(map.values());
      };

      const cloudAccounts: Account[] = cloudData.accounts || [];
      const localAccounts: Account[] = StorageService.getStoredAccounts();

      const mergedAccounts = merge(localAccounts, cloudAccounts, useCloudAsAuthority)
        .map(stripVaultFromAccount);
      const store = useFinanceStore.getState();
      store.setAccounts(mergedAccounts);
      await StorageService.saveAccounts(mergedAccounts);

      const mergedCategories = merge(
        StorageService.getStoredCategories(),
        cloudData.categories,
        useCloudAsAuthority,
      );
      store.setCategories(mergedCategories);
      StorageService.saveCategories(mergedCategories);

      const mergedTransactions = merge(
        StorageService.getStoredTransactions(),
        cloudData.transactions,
        useCloudAsAuthority,
      );
      store.setTransactions(mergedTransactions);
      StorageService.saveTransactions(mergedTransactions);

      const mergedGoals = merge(
        StorageService.getStoredGoals(),
        cloudData.goals,
        useCloudAsAuthority,
      );
      store.setGoals(mergedGoals);
      StorageService.saveGoals(mergedGoals);

      const mergedSubs = merge(
        StorageService.getStoredSubscriptions(),
        cloudData.subscriptions || [],
        useCloudAsAuthority,
      );
      store.setSubscriptions(mergedSubs);
      StorageService.saveSubscriptions(mergedSubs);

      const mergedPots = merge(
        StorageService.getStoredPots(),
        cloudData.pots || [],
        useCloudAsAuthority,
      );
      store.setPots(mergedPots);
      StorageService.savePots(mergedPots);

      const mergedPockets = merge(
        StorageService.getStoredPockets(),
        cloudData.pockets || [],
        useCloudAsAuthority,
      );
      store.setPockets(mergedPockets);
      StorageService.savePockets(mergedPockets);

      const mergedChatSessions = merge(
        StorageService.getStoredChatSessions(),
        cloudData.chatSessions || [],
        useCloudAsAuthority,
      );
      store.setChatSessions(mergedChatSessions);
      StorageService.saveChatSessions(mergedChatSessions);

      const syncTimestamp = new Date().toISOString();

      processSubscriptions(store.accounts, store.usdRate, { persist: false });

      const storeAfterSubs = useFinanceStore.getState();
      const postSubAccounts = storeAfterSubs.accounts.map(stripVaultFromAccount);
      const postSubTxs = storeAfterSubs.transactions;
      const postSubSubs = storeAfterSubs.subscriptions;

      await StorageService.saveAccounts(postSubAccounts);
      await StorageService.saveTransactions(postSubTxs);
      await StorageService.saveSubscriptions(postSubSubs);

      await SheetService.syncWithGoogleSheets(
        postSubAccounts,
        postSubTxs,
        mergedCategories,
        mergedGoals,
        postSubSubs,
        mergedPots,
        mergedPockets,
        activeProfile.syncChatToSheets ? mergedChatSessions : undefined,
        {
          ...activeProfile,
          lastSyncAt: syncTimestamp,
          lastUpdatedAt: syncTimestamp,
        },
      );

      updateProfile(
        {
          ...activeProfile,
          lastSyncAt: syncTimestamp,
          updatedAt: syncTimestamp,
        },
        true,
      );

      useSyncStore.getState().showToast("Cloud sync complete", "success");
    } else {
      useSyncStore.getState().dismissToast();
    }
  } catch (e: any) {
    logger.error("Sync failed", e);
    if (e?.status === 401) {
      useSyncStore.getState().showToast("Session expired. Please sign in again.", "info");
      loginWithGoogle();
    } else {
      useSyncStore.getState().showToast("Cloud sync failed. Working offline.", "info");
    }
  } finally {
    useSyncStore.getState().setIsSyncing(false);
    syncInProgress = false;
  }
}
