import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as StorageService from "../../../../../services/storage.services";
import * as SheetService from "../../../../../services/sheets.services";
import { useSyncStore } from "../../../../stores/sync.store";
import { syncData } from "../sync";

vi.mock("../../../../../services/storage.services");
vi.mock("../../../../../services/sheets.services");

const baseProfile = {
  id: "u1",
  name: "Edwin",
  email: "e@e.com",
  isLoggedIn: true,
};

describe("syncData error handling", () => {
  let testTime: number;
  beforeEach(() => {
    vi.useFakeTimers();
    testTime = (testTime ?? 0) + 10_000;
    vi.setSystemTime(new Date(testTime));
    vi.clearAllMocks();
    useSyncStore.getState().reset();
    vi.mocked(StorageService.getStoredProfile).mockReturnValue({
      ...baseProfile,
    } as any);
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the stuck 'Syncing' toast when loadFromGoogleSheets throws", async () => {
    vi.mocked(SheetService.loadFromGoogleSheets).mockRejectedValue(
      new Error("network down"),
    );

    const updateProfile = vi.fn();
    const loginWithGoogle = vi.fn();

    await syncData({ ...baseProfile } as any, updateProfile, loginWithGoogle);

    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.toast).not.toBeNull();
    expect(state.toast?.message).not.toBe("Syncing with Google Sheets...");
    expect(state.toast?.message).toBe("Cloud sync failed. Working offline.");
  });

  it("shows 'Session expired' toast and triggers re-login on 401", async () => {
    const err401 = Object.assign(new Error("Unauthorized"), { status: 401 });
    vi.mocked(SheetService.loadFromGoogleSheets).mockRejectedValue(err401);

    const updateProfile = vi.fn();
    const loginWithGoogle = vi.fn();

    await syncData({ ...baseProfile } as any, updateProfile, loginWithGoogle);

    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.toast?.message).toBe(
      "Session expired. Please sign in again.",
    );
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("dismisses the stuck 'Syncing' toast when loadFromGoogleSheets returns null (no spreadsheet linked)", async () => {
    vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(null as any);

    const updateProfile = vi.fn();
    const loginWithGoogle = vi.fn();

    await syncData({ ...baseProfile } as any, updateProfile, loginWithGoogle);

    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.toast).toBeNull();
  });
});
