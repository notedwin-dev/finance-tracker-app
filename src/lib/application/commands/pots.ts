import { Pot } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function savePot(
  pot: Omit<Pot, "userId">,
  existingPots: Pot[],
  userId: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isEdit = existingPots.some((p) => p.id === pot.id);
  const amountLeft = pot.limitAmount - pot.usedAmount;
  const potWithUser = {
    ...pot,
    amountLeft,
    userId: userId || "local",
    updatedAt: new Date().toISOString(),
  } as Pot;
  const updated = isEdit
    ? existingPots.map((p) => (p.id === pot.id ? potWithUser : p))
    : [...existingPots, potWithUser];
  await StorageService.savePots(updated);
  store.setPots(updated);
  showToast(isEdit ? "Pot updated" : "Pot saved", "success");
}

export async function deletePot(
  potId: string,
  existingPots: Pot[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingPots.filter((p) => p.id !== potId);
  await StorageService.savePots(updated);
  store.setPots(updated);
  showToast("Pot deleted", "success");
}
