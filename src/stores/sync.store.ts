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

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  ...initialSyncState,

  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setHasSynced: (synced) => set({ hasSynced: synced }),
  showToast: (message, type) => set({ toast: { message, type } }),
  dismissToast: () => set({ toast: null }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  reset: () => set(initialSyncState),
}));
