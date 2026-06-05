import { Subscription } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function addSubscription(
  sub: Omit<Subscription, "userId" | "id">,
  existingSubs: Subscription[],
  userId: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const newSub: Subscription = {
    ...sub,
    id: crypto.randomUUID(),
    userId: userId || "local",
    createdAt: new Date().toISOString(),
  };
  const updated = [...existingSubs, newSub];
  await StorageService.saveSubscriptions(updated);
  store.setSubscriptions(updated);
  showToast("Subscription added", "success");
}

export async function deleteSubscription(
  subId: string,
  existingSubs: Subscription[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingSubs.filter((s) => s.id !== subId);
  await StorageService.saveSubscriptions(updated);
  store.setSubscriptions(updated);
  showToast("Subscription deleted", "success");
}
