import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { usePrivacyStore } from "../../../stores/privacy.store";
import type { UserProfile, Account, Transaction, Subscription } from "../../../../types";
import { TransactionType } from "../../../../types";
import { decryptAccount, normalizeAccount, encryptAccount } from "./privacy";
import { normalizeDate, parseDateSafe } from "../../../../helpers/transactions.helper";

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
    StorageService.KEYS.PROFILE,
  ];
  const saved: Record<string, string | null> = {};
  keysToKeep.forEach((k) => (saved[k] = localStorage.getItem(k)));
  localStorage.clear();
  keysToKeep.forEach((k) => saved[k] && localStorage.setItem(k, saved[k]));

  const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
  if (cloudData) {
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
  }

  setIsSyncing(false);
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
    console.error("Failed to select sheet", e);
    showToast("Could not link spreadsheet.", "alert");
  }
}

// Module-level refs for sync debouncing (replaces React useRef)
let syncInProgress = false;
let lastSyncTime = 0;

export async function loadData(profile: any, forceUnlock: boolean = false): Promise<void> {
  const storedAccounts = StorageService.getStoredAccounts();
  const decryptedAccounts = await Promise.all(
    storedAccounts.map(async (a) => {
      const decrypted = await decryptAccount(a, profile, forceUnlock);
      return normalizeAccount(decrypted);
    }),
  );

  const loadedTxs = StorageService.getStoredTransactions();
  const storedCategories = StorageService.getStoredCategories();
  const storedGoals = StorageService.getStoredGoals();
  const storedPots = StorageService.getStoredPots();
  const storedPockets = StorageService.getStoredPockets();
  const storedChatSessions = StorageService.getStoredChatSessions();
  const storedSubs = StorageService.getStoredSubscriptions();

  const store = useFinanceStore.getState();
  store.setAccounts(decryptedAccounts);
  store.setTransactions(loadedTxs);
  store.setCategories(storedCategories);
  store.setGoals(storedGoals);
  store.setPots(storedPots);
  store.setPockets(storedPockets);
  store.setChatSessions(storedChatSessions);
  store.setSubscriptions(storedSubs);
}

export function processSubscriptions(accounts: Account[], usdRate: number) {
  const subs = StorageService.getStoredSubscriptions();
  const currentTxs = StorageService.getStoredTransactions();
  const today = new Date().toLocaleDateString("en-CA");
  let newTxs: Transaction[] = [];
  let updatedSubs = [...subs];
  let processedCount = 0;
  const storedProfile = StorageService.getStoredProfile();
  const currentUserId = storedProfile.id || "guest";

  updatedSubs = updatedSubs.map((sub) => {
    if (!sub.active) return sub;
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
        subscriptionId: sub.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
      return {
        ...sub,
        nextPaymentDate: nextDateStr,
        updatedAt: new Date().toISOString(),
      };
    }
    return { ...sub, nextPaymentDate: nextDateStr };
  });

  if (newTxs.length > 0) {
    const allTxs = [...currentTxs, ...newTxs];
    StorageService.saveTransactions(allTxs);
    StorageService.saveSubscriptions(updatedSubs);
    const store = useFinanceStore.getState();
    store.setTransactions(allTxs);
    store.setSubscriptions(updatedSubs);

    const accUpdates = new Map<string, number>();
    newTxs.forEach((t) => {
      const acc = accounts.find((a) => a.id === t.accountId);
      let amount = t.amount;
      if (acc && t.currency !== acc.currency) {
        if (t.currency === "USD") amount *= usdRate;
        else if (t.currency === "MYR") amount /= usdRate;
      }
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
    StorageService.saveAccounts(updatedAccounts);
    store.setAccounts(updatedAccounts);

    useSyncStore.getState().showToast(
      `Processed ${processedCount} subscription payments.`,
      "success",
    );
  }
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
    console.log(
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
        console.warn("GAPI init failed, likely offline.");
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
          console.log("Re-linking: Local data is newer than cloud. Local will update cloud.");
          useCloudAsAuthority = false;
        } else {
          console.log("Re-linking: Cloud data is newer or equal. Cloud is authoritative.");
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
          cloudData.profile.isSecurityEnabled !== undefined &&
          cloudData.profile.isSecurityEnabled !== profile.isSecurityEnabled
        ) {
          updates.isSecurityEnabled = cloudData.profile.isSecurityEnabled;
        }

        if (cloudData.profile.totpSecret && cloudData.profile.totpSecret !== profile.totpSecret) {
          updates.totpSecret = cloudData.profile.totpSecret;
        }

        if (
          cloudData.profile.totpEnabled !== undefined &&
          cloudData.profile.totpEnabled !== profile.totpEnabled
        ) {
          updates.totpEnabled = cloudData.profile.totpEnabled;
        }

        if (
          cloudData.profile.isSecurityEnabled === undefined &&
          cloudData.profile.isVaultEnabled !== undefined
        ) {
          updates.isSecurityEnabled = cloudData.profile.isVaultEnabled;
        }

        if (
          cloudData.profile.vaultSalt &&
          cloudData.profile.vaultSalt !== profile.vaultSalt
        ) {
          updates.vaultSalt = cloudData.profile.vaultSalt;
        }

        if (
          cloudData.profile.isVaultLocked !== undefined &&
          cloudData.profile.isVaultLocked !== profile.isVaultLocked
        ) {
          const isActuallyUnlocked = usePrivacyStore.getState().isVaultUnlocked;
          if (!(cloudData.profile.isVaultLocked && isActuallyUnlocked)) {
            updates.isVaultLocked = cloudData.profile.isVaultLocked;
          }
        }

        if (
          cloudData.profile.privacyMode !== undefined &&
          cloudData.profile.privacyMode !== profile.privacyMode
        ) {
          updates.privacyMode = cloudData.profile.privacyMode;
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

        const flatten = (arr: any[]): string[] => {
          let result: string[] = [];
          if (!Array.isArray(arr)) return typeof arr === "string" ? [arr] : [];
          arr.forEach((item) => {
            if (Array.isArray(item)) result = result.concat(flatten(item));
            else if (typeof item === "string" && item) result.push(item);
          });
          return result;
        };

        const existingIds = flatten(profile.biometricCredIds || []);
        const cloudIds = flatten(cloudData.profile.biometricCredIds || []);

        if (profile.biometricCredId && typeof profile.biometricCredId === "string")
          existingIds.push(profile.biometricCredId);
        else if (Array.isArray(profile.biometricCredId))
          existingIds.push(...flatten(profile.biometricCredId));

        if (cloudData.profile.biometricCredId && typeof cloudData.profile.biometricCredId === "string")
          cloudIds.push(cloudData.profile.biometricCredId);
        else if (Array.isArray(cloudData.profile.biometricCredId))
          cloudIds.push(...flatten(cloudData.profile.biometricCredId));

        const mergedBio = Array.from(
          new Set([...existingIds, ...cloudIds]),
        ).filter(Boolean);

        if (
          mergedBio.length !== existingIds.length ||
          !mergedBio.every((id) => existingIds.includes(id))
        ) {
          updates.biometricCredIds = mergedBio;
        }

        const existingDevices = profile.devices || [];
        const cloudDevices = cloudData.profile.devices || [];
        const mergedDevices = Array.from(
          new Set([...existingDevices, ...cloudDevices]),
        );

        if (
          mergedDevices.length !== existingDevices.length ||
          !mergedDevices.every((d) => existingDevices.includes(d))
        ) {
          updates.devices = mergedDevices;
        }

        if (Object.keys(updates).length > 0) {
          console.log("Updating local profile from cloud merge", updates);
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

      const cloudAccounts = await Promise.all(
        (cloudData.accounts || []).map(async (a: Account) => {
          const decrypted = await decryptAccount(a, profile);
          return normalizeAccount(decrypted);
        }),
      );

      const localAccountsRaw = StorageService.getStoredAccounts();
      const localAccounts = await Promise.all(
        localAccountsRaw.map(async (a) => {
          const decrypted = await decryptAccount(a, profile);
          return normalizeAccount(decrypted);
        }),
      );

      const mergedAccounts = merge(localAccounts, cloudAccounts, useCloudAsAuthority);
      const store = useFinanceStore.getState();
      store.setAccounts(mergedAccounts);

      const encryptedAccounts = await Promise.all(
        mergedAccounts.map((a) => encryptAccount(a, profile)),
      );
      StorageService.saveAccounts(encryptedAccounts);

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
      await SheetService.syncWithGoogleSheets(
        encryptedAccounts,
        mergedTransactions,
        mergedCategories,
        mergedGoals,
        mergedSubs,
        mergedPots,
        mergedPockets,
        profile.syncChatToSheets ? mergedChatSessions : undefined,
        {
          ...activeProfile,
          lastSyncAt: syncTimestamp,
          lastUpdatedAt: syncTimestamp,
        },
      );

      const storedAccounts = store.accounts;
      const storedUsdRate = store.usdRate;
      processSubscriptions(storedAccounts, storedUsdRate);

      updateProfile(
        {
          ...activeProfile,
          lastSyncAt: syncTimestamp,
          updatedAt: syncTimestamp,
        },
        true,
      );

      useSyncStore.getState().showToast("Cloud sync complete", "success");
    }
  } catch (e) {
    console.error("Sync failed", e);
    useSyncStore.getState().showToast("Cloud sync failed. Working offline.", "info");
    useSyncStore.getState().setIsSyncing(false);
  } finally {
    useSyncStore.getState().setIsSyncing(false);
    syncInProgress = false;
  }
}
