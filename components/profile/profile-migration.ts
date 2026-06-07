import { useSyncStore } from "../../src/stores/sync.store";
import { runVaultSchemaMigration } from "../../src/lib/application/commands/migration";
import { logger } from "../../src/lib/infrastructure/logger";

export const runProfileMigration = (): void => {
	runVaultSchemaMigration()
		.then(() => useSyncStore.getState().showToast("Migration complete", "success"))
		.catch((e) => {
			logger.error("Migration error:", e);
			useSyncStore.getState().showToast("Migration failed. Check console.", "alert");
		});
};
