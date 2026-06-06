import { create } from "zustand";

export type ToastType = "success" | "alert" | "info";

export interface Toast {
  message: string;
  type: ToastType;
}

export interface SyncState {
  isSyncing: boolean;
  hasSynced: boolean;
  toast: Toast | null;
  lastSyncTime: number;
}

export interface SyncActions {
  setIsSyncing: (syncing: boolean) => void;
  setHasSynced: (synced: boolean) => void;
  showToast: (message: string, type: ToastType) => void;
  dismissToast: () => void;
  setLastSyncTime: (time: number) => void;
  reset: () => void;
}

const initialSyncState: SyncState = {
  isSyncing: false,
  hasSynced: false,
  toast: null,
  lastSyncTime: 0,
};

const TOAST_AUTO_DISMISS_MS = 3000;

export const useSyncStore = create<SyncState & SyncActions>((set) => {
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  const clearDismissTimer = () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };
  return {
    ...initialSyncState,

    setIsSyncing: (syncing) => set({ isSyncing: syncing }),
    setHasSynced: (synced) => set({ hasSynced: synced }),
    showToast: (message, type) => {
      clearDismissTimer();
      set({ toast: { message, type } });
      dismissTimer = setTimeout(() => {
        set({ toast: null });
        dismissTimer = null;
      }, TOAST_AUTO_DISMISS_MS);
    },
    dismissToast: () => {
      clearDismissTimer();
      set({ toast: null });
    },
    setLastSyncTime: (time) => set({ lastSyncTime: time }),
    reset: () => {
      clearDismissTimer();
      set(initialSyncState);
    },
  };
});
