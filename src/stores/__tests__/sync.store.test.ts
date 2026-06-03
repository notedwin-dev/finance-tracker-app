import { describe, it, expect, beforeEach } from "vitest";
import { useSyncStore } from "../sync.store";

describe("sync.store", () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  it("starts with default values", () => {
    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.hasSynced).toBe(false);
    expect(state.toast).toBeNull();
    expect(state.lastSyncTime).toBe(0);
  });

  it("shows a toast message", () => {
    useSyncStore.getState().showToast("Hello", "success");
    expect(useSyncStore.getState().toast).toEqual({ message: "Hello", type: "success" });
  });

  it("dismisses a toast message", () => {
    useSyncStore.getState().showToast("Hello", "success");
    useSyncStore.getState().dismissToast();
    expect(useSyncStore.getState().toast).toBeNull();
  });

  it("tracks syncing state", () => {
    useSyncStore.getState().setIsSyncing(true);
    expect(useSyncStore.getState().isSyncing).toBe(true);
    useSyncStore.getState().setIsSyncing(false);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("tracks whether initial sync has completed", () => {
    useSyncStore.getState().setHasSynced(true);
    expect(useSyncStore.getState().hasSynced).toBe(true);
  });

  it("records the last sync timestamp", () => {
    const now = Date.now();
    useSyncStore.getState().setLastSyncTime(now);
    expect(useSyncStore.getState().lastSyncTime).toBe(now);
  });
});
