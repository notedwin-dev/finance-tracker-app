import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as StorageService from "../../../../../services/storage.services";
import * as SheetService from "../../../../../services/sheets.services";
import { useSyncStore } from "../../../../stores/sync.store";
import { syncData, resetAndSync } from "../sync";

vi.mock("../../../../../services/storage.services");
vi.mock("../../../../../services/sheets.services");

const baseProfile = {
  id: "u1",
  name: "Edwin",
  email: "e@e.com",
  isLoggedIn: true,
};

describe("syncData error handling", () => {
let testTime = 0;
beforeEach(() => {
  testTime += 10_000;
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

describe("resetAndSync 401 handling", () => {
  let testTime = 0;
  beforeEach(() => {
    testTime += 10_000;
    vi.setSystemTime(new Date(testTime));
    vi.clearAllMocks();
    vi.stubGlobal("confirm", () => true);
    useSyncStore.getState().reset();
    vi.mocked(StorageService.getStoredProfile).mockReturnValue({
      ...baseProfile,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cleans up isSyncing and preserves keep-list on 401 from loadFromGoogleSheets", async () => {
    const err401 = Object.assign(new Error("Unauthorized"), { status: 401 });
    vi.mocked(SheetService.loadFromGoogleSheets).mockRejectedValue(err401);

    // Set up localStorage with both keys to keep and keys to clear
    localStorage.setItem("google_access_token", "test_token");
    localStorage.setItem("google_token_expiry", "123456789");
    localStorage.setItem("google_refresh_token", "test_refresh");
    localStorage.setItem("encrypted_vault_key", "test_vault_key");
    localStorage.setItem("device_id", "test_device");
    localStorage.setItem("zenfinance_selected_sheet_id", "test_sheet_id");
    localStorage.setItem(StorageService.KEYS.PROFILE, JSON.stringify(baseProfile));
    localStorage.setItem("some_random_key", "should_be_cleared");
    localStorage.setItem("another_key", "also_cleared");

    const updateProfile = vi.fn();
    const loginWithGoogle = vi.fn();

    await resetAndSync({ ...baseProfile } as any, updateProfile, loginWithGoogle);

    const state = useSyncStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.toast?.message).toBe("Session expired. Please sign in again.");
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);

    // Verify keep-list keys are preserved
    expect(localStorage.getItem("google_access_token")).toBe("test_token");
    expect(localStorage.getItem("google_token_expiry")).toBe("123456789");
    expect(localStorage.getItem("google_refresh_token")).toBe("test_refresh");
    expect(localStorage.getItem("encrypted_vault_key")).toBe("test_vault_key");
    expect(localStorage.getItem("device_id")).toBe("test_device");
    expect(localStorage.getItem("zenfinance_selected_sheet_id")).toBe("test_sheet_id");
    expect(localStorage.getItem(StorageService.KEYS.PROFILE)).toBe(JSON.stringify(baseProfile));

    // Verify non-kept keys were removed
    expect(localStorage.getItem("some_random_key")).toBeNull();
    expect(localStorage.getItem("another_key")).toBeNull();
  });
});
