// TEMPORARY: One-time v1 -> v2 schema cleanup orchestrator. See CONTEXT.md and
// docs/adrs/002-drop-vault-data-minimization.md for removal criterion.

import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { migrateSchemaV1toV2, needsV1Migration } from "../../domain/migration";
import { logger } from "../logger";

export async function runVaultSchemaMigration(): Promise<void> {
  const profile = StorageService.getStoredProfile();
  if (!profile) return;

  const store = useFinanceStore.getState();
  if (!needsV1Migration(profile, store.accounts)) return;

  const { accounts: cleanedAccounts, profile: cleanedProfile } =
    migrateSchemaV1toV2(store.accounts, profile, new Date().toISOString());

  await StorageService.saveAccounts(cleanedAccounts);
  StorageService.saveProfile(cleanedProfile);
  store.setAccounts(cleanedAccounts);

  if (cleanedProfile.offlineMode || !SheetService.isClientReady()) return;

  try {
    await SheetService.syncWithGoogleSheets(
      cleanedAccounts,
      store.transactions,
      store.categories,
      store.goals,
      store.subscriptions,
      store.pots,
      store.pockets,
      cleanedProfile.syncChatToSheets ? store.chatSessions : undefined,
      cleanedProfile,
    );
  } catch (e) {
    logger.warn(
      "Vault migration cloud push failed; will retry on next sync:",
      e,
    );
  }
}
