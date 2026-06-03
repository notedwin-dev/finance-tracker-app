import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useSyncStore } from "../../../stores/sync.store";
import type { UserProfile } from "../../../../types";

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
