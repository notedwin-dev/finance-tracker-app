import { Goal } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function saveGoal(
  goal: Omit<Goal, "userId">,
  existingGoals: Goal[],
  userId: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isEdit = existingGoals.some((g) => g.id === goal.id);
  const goalWithUser: Goal = {
    ...goal,
    userId: userId || "local",
    updatedAt: new Date().toISOString(),
  };
  const updated = isEdit
    ? existingGoals.map((g) => (g.id === goal.id ? goalWithUser : g))
    : [...existingGoals, goalWithUser];
  store.setGoals(updated);
  await StorageService.saveGoals(updated);
  showToast(isEdit ? "Goal updated" : "Goal created", "success");
}

export async function deleteGoal(
  goalId: string,
  existingGoals: Goal[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingGoals.filter((g) => g.id !== goalId);
  store.setGoals(updated);
  await StorageService.saveGoals(updated);
  showToast("Goal deleted", "success");
}
