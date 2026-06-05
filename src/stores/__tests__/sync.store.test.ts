import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  describe("showToast auto-dismiss", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("auto-dismisses after 3 seconds", () => {
      useSyncStore.getState().showToast("Hello", "success");
      expect(useSyncStore.getState().toast).not.toBeNull();
      vi.advanceTimersByTime(3000);
      expect(useSyncStore.getState().toast).toBeNull();
    });

    it("does not auto-dismiss before 3 seconds", () => {
      useSyncStore.getState().showToast("Hello", "success");
      vi.advanceTimersByTime(2999);
      expect(useSyncStore.getState().toast).not.toBeNull();
    });

    it("resets the timer when a new toast is shown", () => {
      useSyncStore.getState().showToast("First", "info");
      vi.advanceTimersByTime(2000);
      useSyncStore.getState().showToast("Second", "info");
      vi.advanceTimersByTime(2000);
      expect(useSyncStore.getState().toast).toEqual({ message: "Second", type: "info" });
      vi.advanceTimersByTime(1000);
      expect(useSyncStore.getState().toast).toBeNull();
    });

    it("clears the timer when dismissToast is called manually", () => {
      useSyncStore.getState().showToast("Hello", "success");
      useSyncStore.getState().dismissToast();
      vi.advanceTimersByTime(3000);
      expect(useSyncStore.getState().toast).toBeNull();
    });

    it("clears the timer when reset is called", () => {
      useSyncStore.getState().showToast("Hello", "success");
      useSyncStore.getState().reset();
      vi.advanceTimersByTime(3000);
      expect(useSyncStore.getState().toast).toBeNull();
    });
  });
});
