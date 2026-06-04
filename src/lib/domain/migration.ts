// TEMPORARY: One-time v1 -> v2 schema cleanup. See CONTEXT.md and
// docs/adrs/002-drop-vault-data-minimization.md for removal criterion.

import type { Account, UserProfile } from "../../../types";

export const CURRENT_SCHEMA_VERSION = 2 as const;

const SENSITIVE_ACCOUNT_FIELDS = [
  "details",
  "isEncrypted",
  "accountNumber",
  "cardNumber",
  "holderName",
  "expiry",
  "cvv",
] as const;

const VAULT_PROFILE_FIELDS = [
  "isSecurityEnabled",
  "isVaultEnabled",
  "isVaultCreated",
  "isVaultLocked",
  "vaultSalt",
  "biometricCredId",
  "biometricCredIds",
  "totpSecret",
  "totpEnabled",
  "biometricEnabled",
  "encryptionKey",
  "devices",
  "privacyMode",
] as const;

function stripFields<T extends object>(obj: T, fields: readonly string[]): T {
  const bag = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    delete bag[field];
  }
  return bag as T;
}

export function stripVaultFromAccount(acc: Account): Account {
  return stripFields(acc, SENSITIVE_ACCOUNT_FIELDS);
}

export function stripVaultFromProfile(profile: UserProfile): UserProfile {
  const cleaned = stripFields(profile, VAULT_PROFILE_FIELDS);
  if (cleaned.maskMode === undefined) {
    const profileBag = profile as unknown as Record<string, unknown>;
    cleaned.maskMode = (profileBag.privacyMode as boolean | undefined) ?? false;
  }
  return cleaned;
}

export function migrateSchemaV1toV2(
  accounts: Account[],
  profile: UserProfile,
): { accounts: Account[]; profile: UserProfile } {
  const cleanedAccounts = accounts.map(stripVaultFromAccount);
  const cleanedProfile = stripVaultFromProfile(profile);
  cleanedProfile.schemaVersion = CURRENT_SCHEMA_VERSION;
  cleanedProfile.updatedAt = new Date().toISOString();
  return { accounts: cleanedAccounts, profile: cleanedProfile };
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function needsV1Migration(
  profile: UserProfile | null | undefined,
  accounts: Account[],
): boolean {
  if (!profile) return false;
  if (profile.schemaVersion !== CURRENT_SCHEMA_VERSION) return true;

  const profileBag = profile as unknown as Record<string, unknown>;
  for (const field of VAULT_PROFILE_FIELDS) {
    if (isPresent(profileBag[field])) return true;
  }

  return accounts.some((a) => {
    const accBag = a as unknown as Record<string, unknown>;
    if (isPresent(accBag.details)) return true;
    if (isPresent(accBag.isEncrypted)) return true;
    return SENSITIVE_ACCOUNT_FIELDS.some((f) => isPresent(accBag[f]));
  });
}
