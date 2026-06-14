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

const prepareMigration = (
  profile: unknown = v1Profile,
  accounts: unknown[] = v1Accounts,
  clientReady = true,
) => {
  vi.mocked(StorageService.getStoredProfile).mockReturnValue(profile as any);
  useFinanceStore.setState({ accounts: accounts as any });
  vi.mocked(SheetService.isClientReady).mockReturnValue(clientReady);
};

const expectNoMigrationWrites = () => {
  expect(StorageService.saveAccounts).not.toHaveBeenCalled();
  expect(StorageService.saveProfile).not.toHaveBeenCalled();
  expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
};

const expectLocalMigrationSaved = () => {
  expect(StorageService.saveAccounts).toHaveBeenCalledTimes(1);
  expect(StorageService.saveProfile).toHaveBeenCalledTimes(1);
};

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

    expectNoMigrationWrites();
  });

  it("returns early when migration is not needed (clean v2 profile)", async () => {
    const cleanProfile = { ...baseProfile, schemaVersion: 2 };
    prepareMigration(cleanProfile, [baseAccount]);

    await runVaultSchemaMigration();

    expectNoMigrationWrites();
  });

  it("strips vault fields, saves locally, then pushes to cloud", async () => {
    prepareMigration();

    await runVaultSchemaMigration();

    expectLocalMigrationSaved();
    const savedAccounts = vi.mocked(StorageService.saveAccounts).mock.calls[0][0];
    expect(savedAccounts[0]).not.toHaveProperty("details");
    expect(savedAccounts[0]).not.toHaveProperty("isEncrypted");
    expect(savedAccounts[0]).not.toHaveProperty("cardNumber");
    expect(savedAccounts[0]).not.toHaveProperty("cvv");

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

    prepareMigration();

    await runVaultSchemaMigration();

    const saveIdx = callOrder.indexOf("saveAccounts");
    const syncIdx = callOrder.indexOf("sync");
    expect(saveIdx).toBeGreaterThanOrEqual(0);
    expect(syncIdx).toBeGreaterThanOrEqual(0);
    expect(saveIdx).toBeLessThan(syncIdx);
  });

  it("self-heals: cleans cloud pollution re-introduced after first run", async () => {
    prepareMigration();

    await runVaultSchemaMigration();

    expectLocalMigrationSaved();
    expect(SheetService.syncWithGoogleSheets).toHaveBeenCalledTimes(1);

    const pollutedProfile = {
      ...baseProfile,
      schemaVersion: 2,
      totpSecret: "NEW_TOTP",
    };
    const pollutedAccounts = [{ ...baseAccount, cardNumber: "9999" }];
    prepareMigration(pollutedProfile, pollutedAccounts);
    vi.clearAllMocks();

    await runVaultSchemaMigration();

    expectLocalMigrationSaved();
    const savedAccounts2 = vi.mocked(StorageService.saveAccounts).mock
      .calls[0][0];
    expect(savedAccounts2[0]).not.toHaveProperty("cardNumber");

    const savedProfile2 = vi.mocked(StorageService.saveProfile).mock
      .calls[0][0];
    expect((savedProfile2 as any).totpSecret).toBeUndefined();
    expect(savedProfile2.schemaVersion).toBe(2);
  });

  it("skips cloud push when profile is offlineMode", async () => {
    const offlineProfile = { ...v1Profile, offlineMode: true };
    prepareMigration(offlineProfile);

    await runVaultSchemaMigration();

    expectLocalMigrationSaved();
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("skips cloud push when Sheets client is not ready", async () => {
    prepareMigration(v1Profile, v1Accounts, false);

    await runVaultSchemaMigration();

    expectLocalMigrationSaved();
    expect(SheetService.syncWithGoogleSheets).not.toHaveBeenCalled();
  });

  it("does not throw when cloud push rejects (local state is preserved)", async () => {
    vi.mocked(SheetService.syncWithGoogleSheets).mockRejectedValue(
      new Error("network"),
    );
    prepareMigration();

    await expect(runVaultSchemaMigration()).resolves.toBeUndefined();

    expectLocalMigrationSaved();
  });

  it("updates the in-memory store with cleaned accounts", async () => {
    prepareMigration();

    await runVaultSchemaMigration();

    const store = useFinanceStore.getState();
    expect(store.accounts[0]).not.toHaveProperty("cardNumber");
    expect(store.accounts[0]).not.toHaveProperty("details");
    expect(store.accounts[0]).toHaveProperty("id", "acc-1");
  });

  it("reads source data from the store, not from storage (store is authoritative)", async () => {
    const storeAccounts = [
      { ...baseAccount, id: "store-id", cardNumber: "7777" },
    ];
    prepareMigration(v1Profile, storeAccounts);

    await runVaultSchemaMigration();

    const savedAccounts = vi.mocked(StorageService.saveAccounts).mock
      .calls[0][0];
    expect(savedAccounts[0].id).toBe("store-id");
    expect(savedAccounts[0]).not.toHaveProperty("cardNumber");
  });
});
