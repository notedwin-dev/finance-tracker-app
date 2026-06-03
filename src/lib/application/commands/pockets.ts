import { SavingPocket, Transaction } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function saveSavingPocket(
  pocket: Omit<SavingPocket, "userId">,
  existingPockets: SavingPocket[],
  userId: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isEdit = existingPockets.some((p) => p.id === pocket.id);
  const pocketWithUser: SavingPocket = {
    ...pocket,
    userId: userId || "local",
    updatedAt: new Date().toISOString(),
  };
  const updated = isEdit
    ? existingPockets.map((p) => (p.id === pocket.id ? pocketWithUser : p))
    : [...existingPockets, pocketWithUser];
  store.setPockets(updated);
  await StorageService.savePockets(updated);
  showToast(isEdit ? "Saving pocket updated" : "Saving pocket saved", "success");
}

export async function deleteSavingPocket(
  id: string,
  existingPockets: SavingPocket[],
  existingTransactions: Transaction[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updatedPockets = existingPockets.filter((p) => p.id !== id);
  await StorageService.savePockets(updatedPockets);
  store.setPockets(updatedPockets);

  const updatedTransactions = existingTransactions.map((t) =>
    t.savingPocketId === id ? { ...t, savingPocketId: null as string | null } : t,
  );
  await StorageService.saveTransactions(updatedTransactions);
  store.setTransactions(updatedTransactions);

  showToast("Saving pocket deleted", "success");
}
