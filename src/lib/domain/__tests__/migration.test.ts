import { describe, it, expect } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  migrateSchemaV1toV2,
  needsV1Migration,
  stripVaultFromAccount,
  stripVaultFromProfile,
} from "../migration";
import type { Account, UserProfile } from "../../../../types";

const baseAccount: Account = {
  id: "acc-1",
  name: "Maybank",
  balance: 1000,
  currency: "MYR",
  type: "BANK",
  color: "#fff",
  iconType: "EMOJI",
  iconValue: "M",
  userId: "u1",
};

const baseProfile: UserProfile = {
  id: "u1",
  name: "Edwin",
  email: "e@e.com",
  isLoggedIn: true,
};

const asAccount = (legacy: Record<string, unknown>): Account =>
  ({ ...baseAccount, ...legacy }) as unknown as Account;

const asProfile = (legacy: Record<string, unknown>): UserProfile =>
  ({ ...baseProfile, ...legacy }) as unknown as UserProfile;

describe("CURRENT_SCHEMA_VERSION", () => {
  it("is 2", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });
});

describe("stripVaultFromAccount", () => {
  it("strips plaintext details object", () => {
    const acc = asAccount({ details: { cardNumber: "NON_PAN_PLACEHOLDER", cvv: "123" } });
    const cleaned = stripVaultFromAccount(acc);
    expect((cleaned as unknown as Record<string, unknown>).details).toBeUndefined();
    expect((cleaned as unknown as Record<string, unknown>).isEncrypted).toBeUndefined();
  });

  it("strips ENC: prefixed encrypted blob", () => {
    const acc = asAccount({ details: "ENC:abc123", isEncrypted: true });
    const cleaned = stripVaultFromAccount(acc);
    expect((cleaned as unknown as Record<string, unknown>).details).toBeUndefined();
    expect((cleaned as unknown as Record<string, unknown>).isEncrypted).toBeUndefined();
  });

  it("strips SEC: prefixed blob", () => {
    const acc = asAccount({ details: "SEC:xyz", isEncrypted: true });
    const cleaned = stripVaultFromAccount(acc);
    expect((cleaned as unknown as Record<string, unknown>).details).toBeUndefined();
    expect((cleaned as unknown as Record<string, unknown>).isEncrypted).toBeUndefined();
  });

  it("strips top-level legacy sensitive fields", () => {
    const acc = asAccount({
      accountNumber: "12345",
      cardNumber: "4111",
      holderName: "Edwin",
      expiry: "12/29",
      cvv: "999",
    });
    const cleaned = stripVaultFromAccount(acc);
    const bag = cleaned as unknown as Record<string, unknown>;
    expect(bag.accountNumber).toBeUndefined();
    expect(bag.cardNumber).toBeUndefined();
    expect(bag.holderName).toBeUndefined();
    expect(bag.expiry).toBeUndefined();
    expect(bag.cvv).toBeUndefined();
  });

  it("preserves non-vault fields", () => {
    const acc = asAccount({
      providerId: "MAYBANK",
      details: { cardNumber: "x" },
    });
    const cleaned = stripVaultFromAccount(acc);
    expect(cleaned.id).toBe("acc-1");
    expect(cleaned.name).toBe("Maybank");
    expect(cleaned.balance).toBe(1000);
    expect(cleaned.providerId).toBe("MAYBANK");
  });

  it("is a no-op on a clean account", () => {
    const cleaned = stripVaultFromAccount(baseAccount);
    expect(cleaned).toEqual(baseAccount);
  });
});

describe("stripVaultFromProfile", () => {
  it("strips all vault-related fields", () => {
    const profile = asProfile({
      isSecurityEnabled: true,
      isVaultEnabled: true,
      isVaultCreated: true,
      isVaultLocked: false,
      vaultSalt: "salt",
      biometricCredId: "cred",
      biometricCredIds: ["cred1", "cred2"],
      totpSecret: "JBSWY3DPEHPK3PXP",
      totpEnabled: true,
      biometricEnabled: true,
      encryptionKey: "key",
      devices: ["d1"],
      privacyMode: true,
    });
    const cleaned = stripVaultFromProfile(profile);
    const bag = cleaned as unknown as Record<string, unknown>;
    expect(bag.isSecurityEnabled).toBeUndefined();
    expect(bag.isVaultEnabled).toBeUndefined();
    expect(bag.isVaultCreated).toBeUndefined();
    expect(bag.isVaultLocked).toBeUndefined();
    expect(bag.vaultSalt).toBeUndefined();
    expect(bag.biometricCredId).toBeUndefined();
    expect(bag.biometricCredIds).toBeUndefined();
    expect(bag.totpSecret).toBeUndefined();
    expect(bag.totpEnabled).toBeUndefined();
    expect(bag.biometricEnabled).toBeUndefined();
    expect(bag.encryptionKey).toBeUndefined();
    expect(bag.devices).toBeUndefined();
    expect(bag.privacyMode).toBeUndefined();
  });

  it("preserves non-vault profile fields", () => {
    const profile = asProfile({
      geminiApiKey: "k",
      showAIAssistant: true,
      syncChatToSheets: false,
      offlineMode: true,
      privacyMode: true,
    });
    const cleaned = stripVaultFromProfile(profile);
    expect(cleaned.id).toBe("u1");
    expect(cleaned.name).toBe("Edwin");
    expect(cleaned.email).toBe("e@e.com");
    expect(cleaned.geminiApiKey).toBe("k");
    expect(cleaned.showAIAssistant).toBe(true);
    expect(cleaned.syncChatToSheets).toBe(false);
    expect(cleaned.offlineMode).toBe(true);
    expect((cleaned as unknown as Record<string, unknown>).privacyMode).toBeUndefined();
  });

  it("adds maskMode: false when absent", () => {
    const cleaned = stripVaultFromProfile(baseProfile);
    expect(cleaned.maskMode).toBe(false);
  });

  it("preserves maskMode when present", () => {
    const cleaned = stripVaultFromProfile({ ...baseProfile, maskMode: true });
    expect(cleaned.maskMode).toBe(true);
  });

  it("falls back to privacyMode when maskMode is absent", () => {
    const cleaned = stripVaultFromProfile(
      asProfile({ privacyMode: true }),
    );
    expect(cleaned.maskMode).toBe(true);
  });

  it("prefers maskMode over privacyMode when both present", () => {
    const cleaned = stripVaultFromProfile(
      asProfile({ maskMode: false, privacyMode: true }),
    );
    expect(cleaned.maskMode).toBe(false);
  });
});

const FIXED_TS = "2026-06-04T00:00:00.000Z";

describe("migrateSchemaV1toV2", () => {
  it("sets schemaVersion to current", () => {
    const { profile } = migrateSchemaV1toV2([], baseProfile, FIXED_TS);
    expect(profile.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("sets profile.updatedAt to the provided timestamp", () => {
    const { profile } = migrateSchemaV1toV2([], baseProfile, FIXED_TS);
    expect(profile.updatedAt).toBe(FIXED_TS);
  });

  it("cleans accounts and profile in one pass", () => {
    const accounts: Account[] = [asAccount({ details: "ENC:abc", isEncrypted: true })];
    const profile = asProfile({ totpSecret: "x", privacyMode: true });
    const { accounts: cleanedAccs, profile: cleanedProf } = migrateSchemaV1toV2(
      accounts,
      profile,
      FIXED_TS,
    );
    const accBag = cleanedAccs[0] as unknown as Record<string, unknown>;
    const profBag = cleanedProf as unknown as Record<string, unknown>;
    expect(accBag.details).toBeUndefined();
    expect(accBag.isEncrypted).toBeUndefined();
    expect(profBag.totpSecret).toBeUndefined();
    expect(profBag.privacyMode).toBeUndefined();
    expect(cleanedProf.maskMode).toBe(true);
    expect(cleanedProf.schemaVersion).toBe(2);
  });

  it("is safe to run on already-clean v2 data (idempotent re-migration)", () => {
    const { profile, accounts } = migrateSchemaV1toV2([], {
      ...baseProfile,
      schemaVersion: 2,
    }, FIXED_TS);
    expect(profile.schemaVersion).toBe(2);
    expect(accounts).toEqual([]);
  });

  it("preserves unmigrated account shape", () => {
    const { accounts } = migrateSchemaV1toV2([baseAccount], baseProfile, FIXED_TS);
    expect(accounts[0]).toEqual(baseAccount);
  });
});

describe("needsV1Migration", () => {
  it("returns false for null profile", () => {
    expect(needsV1Migration(null, [])).toBe(false);
  });

  it("returns false for undefined profile", () => {
    expect(needsV1Migration(undefined, [])).toBe(false);
  });

  it("returns true when schemaVersion is missing (v1 user, no version set)", () => {
    expect(needsV1Migration(baseProfile, [])).toBe(true);
  });

  it("returns true when schemaVersion is 1", () => {
    expect(needsV1Migration({ ...baseProfile, schemaVersion: 1 }, [])).toBe(true);
  });

  it("returns false when schemaVersion is 2 and no legacy fields", () => {
    expect(
      needsV1Migration({ ...baseProfile, schemaVersion: 2 }, [baseAccount]),
    ).toBe(false);
  });

  it("returns true when v1 client re-introduces totpSecret on a v2 profile", () => {
    expect(
      needsV1Migration(
        asProfile({ schemaVersion: 2, totpSecret: "JBSWY3DPEHPK3PXP" }),
        [],
      ),
    ).toBe(true);
  });

  it("returns true when v1 client re-introduces biometricCredIds on a v2 profile", () => {
    expect(
      needsV1Migration(
        asProfile({ schemaVersion: 2, biometricCredIds: ["x"] }),
        [],
      ),
    ).toBe(true);
  });

  it("returns true when v1 client re-introduces privacyMode on a v2 profile", () => {
    expect(
      needsV1Migration(
        asProfile({ schemaVersion: 2, privacyMode: true }),
        [],
      ),
    ).toBe(true);
  });

  it("returns true when accounts have ENC: blob", () => {
    const acc = asAccount({ details: "ENC:abc" });
    expect(needsV1Migration({ ...baseProfile, schemaVersion: 2 }, [acc])).toBe(
      true,
    );
  });

  it("returns true when accounts have SEC: blob", () => {
    const acc = asAccount({ details: "SEC:abc" });
    expect(needsV1Migration({ ...baseProfile, schemaVersion: 2 }, [acc])).toBe(
      true,
    );
  });

  it("returns true when account has plaintext details object", () => {
    const acc = asAccount({ details: { cardNumber: "x" } });
    expect(needsV1Migration({ ...baseProfile, schemaVersion: 2 }, [acc])).toBe(
      true,
    );
  });

  it("returns true when account has top-level legacy sensitive field", () => {
    const acc = asAccount({ cardNumber: "4111" });
    expect(needsV1Migration({ ...baseProfile, schemaVersion: 2 }, [acc])).toBe(
      true,
    );
  });

  it("returns false when v1 user has plain empty array for biometricCredIds (treated as absent)", () => {
    expect(
      needsV1Migration(
        asProfile({ schemaVersion: 2, biometricCredIds: [] }),
        [],
      ),
    ).toBe(false);
  });

  it("returns true when v1 user has isSecurityEnabled set", () => {
    expect(
      needsV1Migration(
        asProfile({ schemaVersion: 2, isSecurityEnabled: true }),
        [],
      ),
    ).toBe(true);
  });
});
