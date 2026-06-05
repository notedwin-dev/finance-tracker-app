import { ChatSession } from "../../../../types";
import * as StorageService from "../../../../services/storage.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";

export async function saveChatSession(
  session: ChatSession,
  existingSessions: ChatSession[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const isEdit = existingSessions.some((s) => s.id === session.id);
  const updated = isEdit
    ? existingSessions.map((s) => (s.id === session.id ? session : s))
    : [...existingSessions, session];
  await StorageService.saveChatSessions(updated);
  store.setChatSessions(updated);
  showToast(isEdit ? "Chat session updated" : "Chat session saved", "success");
}

export async function deleteChatSession(
  sessionId: string,
  existingSessions: ChatSession[],
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const updated = existingSessions.filter((s) => s.id !== sessionId);
  await StorageService.saveChatSessions(updated);
  store.setChatSessions(updated);
  showToast("Chat session deleted", "success");
}
