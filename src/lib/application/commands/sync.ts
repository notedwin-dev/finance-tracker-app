import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import type { UserProfile, Account, Transaction, Subscription } from "../../../../types";
import { TransactionType } from "../../../../types";
import { normalizeDate, parseDateSafe } from "../../../../helpers/transactions.helper";
import { stripVaultFromAccount } from "../../domain/migration";
import { mergeEntities, mergeProfile, toTimestamp } from "../../domain/sync";
import {
  computeNextOccurrences,
  buildSubscriptionTransaction,
  convertTransactionAmountForAccount,
  dedupeTransactions,
} from "../../domain/subscriptions";
import { logger } from "../../infrastructure/logger";

type SyncEntity = "categories" | "transactions" | "goals" | "subscriptions" | "pots" | "pockets" | "chatSessions";

const STORAGE_SAVERS: Record<SyncEntity, (data: any) => Promise<void> | void> = {
  categories: (d) => StorageService.saveCategories(d),
  transactions: (d) => StorageService.saveTransactions(d),
  goals: (d) => StorageService.saveGoals(d),
  subscriptions: (d) => StorageService.saveSubscriptions(d),
  pots: (d) => StorageService.savePots(d),
  pockets: (d) => StorageService.savePockets(d),
  chatSessions: (d) => StorageService.saveChatSessions(d),
};

const STORE_SETTERS: Record<SyncEntity, (state: any, data: any) => void> = {
  categories: (s, d) => s.setCategories(d),
  transactions: (s, d) => s.setTransactions(d),
  goals: (s, d) => s.setGoals(d),
  subscriptions: (s, d) => s.setSubscriptions(d),
  pots: (s, d) => s.setPots(d),
  pockets: (s, d) => s.setPockets(d),
  chatSessions: (s, d) => s.setChatSessions(d),
};

const mergeAndPersist = <T extends { id: string; updatedAt?: any }>(
  local: T[],
  cloud: T[] | undefined,
  trustCloud: boolean,
  entity: SyncEntity,
  store: ReturnType<typeof useFinanceStore.getState>,
): T[] => {
  const merged = mergeEntities(local, cloud ?? [], trustCloud);
  STORE_SETTERS[entity](store, merged);
  STORAGE_SAVERS[entity](merged);
  return merged;
};

const mergeStandardEntities = (
  cloudData: Awaited<ReturnType<typeof SheetService.loadFromGoogleSheets>>,
  useCloudAsAuthority: boolean,
  store: ReturnType<typeof useFinanceStore.getState>,
) => {
  const categories = mergeAndPersist(
    StorageService.getStoredCategories(),
    cloudData.categories,
    useCloudAsAuthority,
    "categories",
    store,
  );
  const transactions = mergeAndPersist(
    StorageService.getStoredTransactions(),
    cloudData.transactions,
    useCloudAsAuthority,
    "transactions",
    store,
  );
  const goals = mergeAndPersist(
    StorageService.getStoredGoals(),
    cloudData.goals,
    useCloudAsAuthority,
    "goals",
    store,
  );
  const subscriptions = mergeAndPersist(
    StorageService.getStoredSubscriptions(),
    cloudData.subscriptions || [],
    useCloudAsAuthority,
    "subscriptions",
    store,
  );
  const pots = mergeAndPersist(
    StorageService.getStoredPots(),
    cloudData.pots || [],
    useCloudAsAuthority,
    "pots",
    store,
  );
  const pockets = mergeAndPersist(
    StorageService.getStoredPockets(),
    cloudData.pockets || [],
    useCloudAsAuthority,
    "pockets",
    store,
  );
  const chatSessions = mergeAndPersist(
    StorageService.getStoredChatSessions(),
    cloudData.chatSessions || [],
    useCloudAsAuthority,
    "chatSessions",
    store,
  );
  return { categories, transactions, goals, subscriptions, pots, pockets, chatSessions };
};

const mergeAccounts = async (
  cloudAccounts: Account[] | undefined,
  useCloudAsAuthority: boolean,
  store: ReturnType<typeof useFinanceStore.getState>,
): Promise<Account[]> => {
  const localAccounts: Account[] = StorageService.getStoredAccounts();
  const merged = mergeEntities(
    localAccounts,
    cloudAccounts || [],
    useCloudAsAuthority,
  ).map(stripVaultFromAccount);
  store.setAccounts(merged);
  await StorageService.saveAccounts(merged);
  return merged;
};

const finishSync = (): void => {
  syncInProgress = false;
  useSyncStore.getState().setIsSyncing(false);
};

const ensureGapiReady = async (): Promise<boolean> => {
  try {
    await SheetService.initGapiClient();
  } catch (e) {
    logger.warn("GAPI init failed, likely offline.");
    finishSync();
    return false;
  }
  const savedToken = localStorage.getItem("google_access_token");
  const savedExpiry = localStorage.getItem("google_token_expiry");
  if (savedToken) {
    const expiresIn = savedExpiry
      ? (parseInt(savedExpiry) - Date.now()) / 1000
      : undefined;
    SheetService.setGapiAccessToken(savedToken, expiresIn);
  }
  return true;
};

const persistPostSubscriptionState = async (): Promise<{
  accounts: Account[];
  transactions: Transaction[];
  subscriptions: Subscription[];
}> => {
  const storeAfterSubs = useFinanceStore.getState();
  const accounts = storeAfterSubs.accounts.map(stripVaultFromAccount);
  await StorageService.saveAccounts(accounts);
  await StorageService.saveTransactions(storeAfterSubs.transactions);
  await StorageService.saveSubscriptions(storeAfterSubs.subscriptions);
  return {
    accounts,
    transactions: storeAfterSubs.transactions,
    subscriptions: storeAfterSubs.subscriptions,
  };
};

const hasAnyData = (...counts: number[]): boolean => counts.some((c) => c > 0);

const decideMergeAuthority = (
  cloudData: Awaited<ReturnType<typeof SheetService.loadFromGoogleSheets>>,
  profile: UserProfile,
): boolean => {
  const hasCloudData = hasAnyData(
    cloudData.accounts?.length || 0,
    cloudData.transactions?.length || 0,
    cloudData.categories?.length || 0,
  );
  const hasLocalData = hasAnyData(
    StorageService.getStoredAccounts().length,
    StorageService.getStoredTransactions().length,
    StorageService.getStoredCategories().length,
  );

  if (!hasCloudData || !hasLocalData || !cloudData.profile) return true;

  const cloudLastUpdated = toTimestamp(cloudData.profile.lastUpdatedAt);
  const localLastSynced = toTimestamp(profile.lastSyncAt);

  if (localLastSynced > cloudLastUpdated) {
    logger.log("Re-linking: Local data is newer than cloud. Local will update cloud.");
    return false;
  }
  logger.log("Re-linking: Cloud data is newer or equal. Cloud is authoritative.");
  return true;
};

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
      if (onProfileUpdate) onProfileUpdate(mergedProfile);
    }
    StorageService.saveAccounts(cloudData.accounts || []);
    StorageService.saveTransactions(cloudData.transactions || []);
    StorageService.saveCategories(cloudData.categories || []);
    StorageService.saveGoals(cloudData.goals || []);
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
    const newSubTxs = generatedTxDates.map((d) => buildSubscriptionTransaction(sub, d, currentUserId, new Date().toISOString()));
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

  const accUpdates = new Map<string, number>();
  const appliedTxs: Transaction[] = [];
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
    appliedTxs.push(t);
  });

  if (appliedTxs.length === 0) {
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

  const persistedTxs = [...currentTxs, ...appliedTxs];

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
  store.setTransactions(persistedTxs);
  store.setSubscriptions(updatedSubs);
  store.setAccounts(updatedAccounts);

  if (persist) {
    StorageService.saveTransactions(persistedTxs);
    StorageService.saveSubscriptions(updatedSubs);
    StorageService.saveAccounts(updatedAccounts);
  }

  useSyncStore.getState().showToast(
    `Processed ${processedCount} subscription payments, ${appliedTxs.length} new transactions applied.`,
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
      const ok = await ensureGapiReady();
      if (!ok) return;
    }

    if (!SheetService.isClientReady()) {
      if (!navigator.onLine) {
        finishSync();
        return;
      }
      useSyncStore.getState().showToast("Session expired. Please sign in again.", "info");
      loginWithGoogle();
      finishSync();
      return;
    }

    useSyncStore.getState().showToast("Syncing with Google Sheets...", "info");
    const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
    if (!cloudData) {
      useSyncStore.getState().dismissToast();
      return;
    }

    const useCloudAsAuthority = decideMergeAuthority(cloudData, profile);

    const activeProfile = mergeProfile({ ...profile }, cloudData.profile);
    if (cloudData.profile && activeProfile !== profile) {
      logger.log("Updating local profile from cloud merge", activeProfile);
    }

    const store = useFinanceStore.getState();

    await mergeAccounts(cloudData.accounts, useCloudAsAuthority, store);

    const {
      categories: mergedCategories,
      goals: mergedGoals,
      pots: mergedPots,
      pockets: mergedPockets,
      chatSessions: mergedChatSessions,
    } = mergeStandardEntities(cloudData, useCloudAsAuthority, store);

    const syncTimestamp = new Date().toISOString();
    processSubscriptions(store.accounts, store.usdRate, { persist: false });

    const postSub = await persistPostSubscriptionState();

    await SheetService.syncWithGoogleSheets(
      postSub.accounts,
      postSub.transactions,
      mergedCategories,
      mergedGoals,
      postSub.subscriptions,
      mergedPots,
      mergedPockets,
      activeProfile.syncChatToSheets ? mergedChatSessions : undefined,
      { ...activeProfile, lastSyncAt: syncTimestamp, lastUpdatedAt: syncTimestamp },
    );

    updateProfile({ ...activeProfile, lastSyncAt: syncTimestamp, updatedAt: syncTimestamp }, true);
    useSyncStore.getState().showToast("Cloud sync complete", "success");
  } catch (e: any) {
    logger.error("Sync failed", e);
    if (e?.status === 401) {
      useSyncStore.getState().showToast("Session expired. Please sign in again.", "info");
      loginWithGoogle();
    } else {
      useSyncStore.getState().showToast("Cloud sync failed. Working offline.", "info");
    }
  } finally {
    finishSync();
  }
}
