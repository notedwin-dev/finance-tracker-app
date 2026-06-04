import { describe, it, expect, beforeEach, vi } from "vitest";
import * as StorageService from "../../../../../services/storage.services";
import * as SheetService from "../../../../../services/sheets.services";
import { useFinanceStore } from "../../../../stores/finance.store";
import { runVaultSchemaMigration } from "../migration";

vi.mock("../../../../../services/storage.services");
vi.mock("../../../../../services/sheets.services");

const baseAccount = {
  id: "acc-1",
  name: "Maybank",
  balance: 1000,
  currency: "MYR",
  type: "BANK" as const,
  color: "#fff",
  iconType: "EMOJI" as const,
  iconValue: "M",
  userId: "u1",
};

const baseProfile = {
  id: "u1",
  name: "Edwin",
  email: "e@e.com",
  isLoggedIn: true,
};

const v1Profile = {
  ...baseProfile,
  totpSecret: "JBSWY3DPEHPK3PXP",
  isVaultLocked: false,
  isSecurityEnabled: true,
  biometricCredIds: ["cred-1"],
};

const v1Accounts = [
  {
    ...baseAccount,
    details: "ENC:abc",
    isEncrypted: true,
    cardNumber: "4111",
    cvv: "999",
  },
];

describe("runVaultSchemaMigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFinanceStore.setState({
      accounts: [],
      transactions: [],
      categories: [],
      goals: [],
      subscriptions: [],
      pots: [],
      pockets: [],
      chatSessions: [],
    });
  });

  it("returns early when no profile is stored", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(null as any);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).not.toHaveBeenCalled();
    expect(StorageService.saveProfile).not.toHaveBeenCalled();
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("returns early when migration is not needed (clean v2 profile)", async () => {
    const cleanProfile = { ...baseProfile, schemaVersion: 2 };
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(cleanProfile as any);
    useFinanceStore.setState({ accounts: [baseAccount] });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).not.toHaveBeenCalled();
    expect(StorageService.saveProfile).not.toHaveBeenCalled();
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("strips vault fields, saves locally, then pushes to cloud", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    const savedAccounts = vi.mocked(StorageService.saveAccounts).mock.calls[0][0];
    expect(savedAccounts[0]).not.toHaveProperty("details");
    expect(savedAccounts[0]).not.toHaveProperty("isEncrypted");
    expect(savedAccounts[0]).not.toHaveProperty("cardNumber");
    expect(savedAccounts[0]).not.toHaveProperty("cvv");

    expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
    const savedProfile = vi.mocked(StorageService.saveProfile).mock.calls[0][0];
    expect(savedProfile.schemaVersion).toBe(2);
    expect((savedProfile as any).totpSecret).toBeUndefined();
    expect((savedProfile as any).isVaultLocked).toBeUndefined();
    expect((savedProfile as any).isSecurityEnabled).toBeUndefined();
    expect((savedProfile as any).biometricCredIds).toBeUndefined();

    expect(SheetService.syncWithGoogleSheets).toHaveBeenCalledTimes(1);
    const syncArgs = vi.mocked(SheetService.syncWithGoogleSheets).mock.calls[0];
    expect(syncArgs[0]).toEqual(savedAccounts);
    expect((syncArgs[8] as any).schemaVersion).toBe(2);
  });

  it("saves locally before pushing to cloud (recoverable on Sheets failure)", async () => {
    const callOrder: string[] = [];
    vi.mocked(StorageService.saveAccounts).mockImplementation(() => {
      callOrder.push("saveAccounts");
      return Promise.resolve();
    });
    vi.mocked(StorageService.saveProfile).mockImplementation(() => {
      callOrder.push("saveProfile");
      return Promise.resolve();
    });
    vi.mocked(SheetService.syncWithGoogleSheets).mockImplementation(() => {
      callOrder.push("sync");
      return Promise.resolve();
    });

    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    const saveIdx = callOrder.indexOf("saveAccounts");
    const syncIdx = callOrder.indexOf("sync");
    expect(saveIdx).toBeGreaterThanOrEqual(0);
    expect(syncIdx).toBeGreaterThanOrEqual(0);
    expect(saveIdx).toBeLessThan(syncIdx);
  });

  it("self-heals: cleans cloud pollution re-introduced after first run", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    expect(SheetService.syncWithGoogleSheets).toHaveBeenCalledTimes(1);

    const pollutedProfile = {
      ...baseProfile,
      schemaVersion: 2,
      totpSecret: "NEW_TOTP",
    };
    const pollutedAccounts = [{ ...baseAccount, cardNumber: "9999" }];
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(
      pollutedProfile as any,
    );
    useFinanceStore.setState({ accounts: pollutedAccounts });
    vi.clearAllMocks();
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    const savedAccounts2 = vi.mocked(StorageService.saveAccounts).mock
      .calls[0][0];
    expect(savedAccounts2[0]).not.toHaveProperty("cardNumber");

    expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
    const savedProfile2 = vi.mocked(StorageService.saveProfile).mock
      .calls[0][0];
    expect((savedProfile2 as any).totpSecret).toBeUndefined();
    expect(savedProfile2.schemaVersion).toBe(2);
  });

  it("skips cloud push when profile is offlineMode", async () => {
    const offlineProfile = { ...v1Profile, offlineMode: true };
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(
      offlineProfile as any,
    );
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("skips cloud push when Sheets client is not ready", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(false);

    await runVaultSchemaMigration();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("does not throw when cloud push rejects (local state is preserved)", async () => {
    vi.mocked(SheetService.syncWithGoogleSheets).mockRejectedValue(
      new Error("network"),
    );
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await expect(runVaultSchemaMigration()).resolves.toBeUndefined();

    expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
    expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
  });

  it("updates the in-memory store with cleaned accounts", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    useFinanceStore.setState({ accounts: v1Accounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    const store = useFinanceStore.getState();
    expect(store.accounts[0]).not.toHaveProperty("cardNumber");
    expect(store.accounts[0]).not.toHaveProperty("details");
    expect(store.accounts[0]).toHaveProperty("id", "acc-1");
  });

  it("reads source data from the store, not from storage (store is authoritative)", async () => {
    vi.mocked(StorageService.getStoredProfile).mockReturnValue(v1Profile as any);
    const storeAccounts = [
      { ...baseAccount, id: "store-id", cardNumber: "7777" },
    ];
    useFinanceStore.setState({ accounts: storeAccounts });
    vi.mocked(SheetService.isClientReady).mockReturnValue(true);

    await runVaultSchemaMigration();

    const savedAccounts = vi.mocked(StorageService.saveAccounts).mock
      .calls[0][0];
    expect(savedAccounts[0].id).toBe("store-id");
    expect(savedAccounts[0]).not.toHaveProperty("cardNumber");
  });
});
