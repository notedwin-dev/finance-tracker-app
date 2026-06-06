import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { migrateSchemaV1toV2, needsV1Migration } from "../../domain/migration";
import { logger } from "../../infrastructure/logger";

export async function runVaultSchemaMigration(): Promise<void> {
  const profile = StorageService.getStoredProfile();
  if (!profile) return;

  const store = useFinanceStore.getState();
  if (!needsV1Migration(profile, store.accounts)) return;

  const { accounts: cleanedAccounts, profile: cleanedProfile } =
    migrateSchemaV1toV2(store.accounts, profile, new Date().toISOString());

  await StorageService.saveAccounts(cleanedAccounts);
  try {
    await StorageService.saveProfile(cleanedProfile);
  } catch (e) {
    logger.error("Vault migration: saveProfile failed, aborting migration", e);
    throw e;
  }
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
