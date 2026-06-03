import { Category } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function saveCategory(
  cat: Omit<Category, "userId">,
  existingCategories: Category[],
  userId: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isEdit = existingCategories.some((c) => c.id === cat.id);
  const catWithUser: Category = {
    ...cat,
    userId: userId || "local",
    updatedAt: new Date().toISOString(),
  };
  const updated = isEdit
    ? existingCategories.map((c) => (c.id === cat.id ? catWithUser : c))
    : [...existingCategories, catWithUser];

  store.setCategories(updated);
  await StorageService.saveCategories(updated);
  showToast("Category saved", "success");
}

export async function deleteCategory(
  categoryId: string,
  existingCategories: Category[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingCategories.filter((c) => c.id !== categoryId);
  store.setCategories(updated);
  await StorageService.saveCategories(updated);
  showToast("Category deleted", "success");
}
