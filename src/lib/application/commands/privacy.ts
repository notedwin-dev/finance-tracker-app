import * as SecurityService from "../../../../services/security.services";
import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";
import * as TwoFAService from "../../../../services/twofa.services";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { usePrivacyStore } from "../../../stores/privacy.store";
import type { Account } from "../../../../types";

function checkBool(val: any): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  return !!val;
}

function isCloudEnabled(profile: any): boolean {
  return !profile.offlineMode && SheetService.isClientReady();
}

export async function encryptAccount(acc: Account, profile: any): Promise<Account> {
  const vaultEnabled = checkBool(profile.isSecurityEnabled);

  if (!vaultEnabled || !acc.details || acc.isEncrypted) return acc;

  if (
    typeof acc.details === "string" &&
    (acc.details.startsWith("ENC:") || acc.details.startsWith("SEC:"))
  ) {
    return { ...acc, isEncrypted: true };
  }

  if (!profile.totpSecret) {
    console.warn("Vault is enabled but no TOTP secret found for encryption.");
    return acc;
  }

  try {
    const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);
    const encryptedDetails = await SecurityService.encryptWithKey(
      JSON.stringify(acc.details),
      key,
    );
    return { ...acc, details: encryptedDetails as any, isEncrypted: true };
  } catch (e) {
    console.error("Encryption failed", e);
    return acc;
  }
}

export function normalizeAccount(acc: any): Account {
  if (typeof acc.details === "string" && acc.details.startsWith("ENC:")) {
    return acc;
  }

  if (typeof acc.details === "string" && acc.details.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(acc.details);
      return normalizeAccount({ ...acc, details: parsed });
    } catch (e) {
      console.warn("Failed to parse raw details JSON", e);
    }
  }

  const details = (
    typeof acc.details === "object" && acc.details !== null
      ? { ...acc.details }
      : {}
  ) as any;

  const sensitiveFields = [
    "accountNumber",
    "cardNumber",
    "cvv",
    "expiry",
    "holderName",
    "note",
  ];
  let hasSensitiveAtTop = false;

  sensitiveFields.forEach((f) => {
    if (acc[f]) {
      if (!details[f]) details[f] = acc[f];
      delete acc[f];
      hasSensitiveAtTop = true;
    }
  });

  if (hasSensitiveAtTop || typeof acc.details !== "object") {
    return { ...acc, details };
  }
  return acc;
}

export async function decryptAccount(
  acc: Account,
  profile: any,
  forceUnlock: boolean = false,
): Promise<Account> {
  if (!acc.details || typeof acc.details !== "string") return acc;

  const isEncrypted =
    acc.details.startsWith("ENC:") || acc.details.startsWith("SEC:");
  if (!isEncrypted) return acc;

  if (!usePrivacyStore.getState().isVaultUnlocked && !forceUnlock) {
    console.warn(
      `Account ${acc.id} is encrypted but vault is locked (forceUnlock=${forceUnlock})`,
    );
    return acc;
  }

  if (!profile.totpSecret) {
    console.warn(
      `Account ${acc.id} is encrypted but no TOTP secret found - resetting to empty`,
    );
    return { ...acc, details: {} };
  }

  try {
    if (acc.details.startsWith("ENC:")) {
      console.warn(
        `Account ${acc.id} uses old password-based encryption. Cannot decrypt.`,
      );
      return { ...acc, details: {} };
    }

    const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);
    const decryptedStr = await SecurityService.decryptWithKey(
      acc.details,
      key,
    );

    if (
      !decryptedStr ||
      decryptedStr.startsWith("SEC:") ||
      decryptedStr.startsWith("ENC:")
    ) {
      console.warn(`Failed to decrypt account ${acc.id}, returning encrypted`);
      return acc;
    }

    try {
      const parsed = JSON.parse(decryptedStr);
      return { ...acc, details: parsed };
    } catch (jsonErr) {
      console.warn("Decrypted string is not valid JSON:", decryptedStr);
      return acc;
    }
  } catch (e) {
    console.error("Decryption failed", e);
    return acc;
  }
}

export async function unlockVaultWithBiometrics(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loadData: (forceUnlock?: boolean) => Promise<void>,
): Promise<boolean> {
  try {
    const { showToast } = useSyncStore.getState();

    if (!(profile.biometricCredIds?.length || profile.biometricCredId)) {
      showToast("Biometrics not set up on this device", "alert");
      return false;
    }

    const credId = profile.biometricCredIds?.[0] || profile.biometricCredId;
    if (!credId || typeof credId !== "string") {
      showToast("Biometric credentials not found", "alert");
      return false;
    }

    const verified = await SecurityService.verifyWithBiometrics(credId);
    if (!verified) {
      showToast("Biometric verification failed", "alert");
      return false;
    }

    if (!profile.totpSecret) {
      showToast("2FA not set up - please set up TOTP first", "alert");
      return false;
    }

    usePrivacyStore.getState().setVaultUnlocked(true);
    updateProfile({ isVaultLocked: false } as any);

    await loadData(true);

    showToast("Vault unlocked with biometrics", "success");
    return true;
  } catch (error) {
    console.error("Biometric unlock failed:", error);
    useSyncStore.getState().showToast("Failed to unlock with biometrics", "alert");
    return false;
  }
}

export async function unlockVaultWithTOTP(
  totpCode: string,
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loadData: (forceUnlock?: boolean) => Promise<void>,
): Promise<boolean> {
  try {
    const { showToast } = useSyncStore.getState();

    if (!profile.totpSecret) {
      showToast("2FA not set up", "alert");
      return false;
    }

    const isValid = TwoFAService.verifyTOTP(profile.totpSecret, totpCode);
    if (!isValid) {
      showToast("Invalid 2FA code", "alert");
      return false;
    }

    usePrivacyStore.getState().setVaultUnlocked(true);
    updateProfile({ isVaultLocked: false } as any);

    await loadData(true);

    showToast("Vault unlocked with 2FA", "success");
    return true;
  } catch (error) {
    console.error("TOTP unlock failed:", error);
    useSyncStore.getState().showToast("Failed to unlock with 2FA", "alert");
    return false;
  }
}

export async function enableBiometricUnlock(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
): Promise<boolean> {
  try {
    const { showToast } = useSyncStore.getState();

    if (!profile.totpSecret) {
      showToast("Please set up 2FA first", "alert");
      return false;
    }

    const credId = await SecurityService.registerBiometrics(
      profile.email || "user",
      profile.biometricCredIds,
    );
    if (!credId) {
      showToast("Failed to register biometrics", "alert");
      return false;
    }

    const updatedCredIds = Array.from(
      new Set([...(profile.biometricCredIds || []), credId]),
    );

    await updateProfile({ biometricCredIds: updatedCredIds } as any);

    showToast("Biometric unlock enabled", "success");
    return true;
  } catch (error) {
    console.error("Failed to enable biometric unlock:", error);
    useSyncStore.getState().showToast("Failed to enable biometric unlock", "alert");
    return false;
  }
}

export async function enableVault(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loadData: (forceUnlock?: boolean) => Promise<void>,
): Promise<void> {
  const { showToast } = useSyncStore.getState();
  const {
    accounts,
    transactions,
    categories,
    goals,
    subscriptions,
    pots,
    pockets,
    chatSessions,
  } = useFinanceStore.getState();

  if (!profile.totpSecret) {
    showToast("Please set up 2FA first to enable vault", "alert");
    return;
  }

  usePrivacyStore.getState().setVaultUnlocked(true);
  updateProfile(
    {
      isSecurityEnabled: true,
      isVaultLocked: false,
    } as any,
    true,
  );

  const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);
  const encryptedAccounts = await Promise.all(
    accounts.map(async (acc) => {
      if (acc.details && typeof acc.details === "object") {
        const encryptedStr = await SecurityService.encryptWithKey(
          JSON.stringify(acc.details),
          key,
        );
        return { ...acc, details: encryptedStr as any, isEncrypted: true };
      }
      return acc;
    }),
  );
  StorageService.saveAccounts(encryptedAccounts);

  showToast(
    "Vault enabled! Your account details are now encrypted.",
    "success",
  );

  const cloudEnabled = isCloudEnabled(profile);
  if (cloudEnabled) {
    const updatedProfile = {
      ...profile,
      isSecurityEnabled: true,
      isVaultLocked: false,
    };

    await SheetService.syncWithGoogleSheets(
      encryptedAccounts,
      transactions,
      categories,
      goals,
      subscriptions,
      pots,
      pockets,
      profile.syncChatToSheets ? chatSessions : undefined,
      updatedProfile,
    );
  }
}

export function lockVault(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loadData: () => void,
): void {
  usePrivacyStore.getState().setVaultUnlocked(false);
  useSyncStore.getState().showToast("Vault locked", "info");
  updateProfile({ isVaultLocked: true } as any);
  loadData();
}

export async function disableVault(
  profile: any,
  updateProfile: (updates: any, skipCloud?: boolean) => void,
  loadData: (forceUnlock?: boolean) => Promise<void>,
): Promise<void> {
  const { showToast } = useSyncStore.getState();
  const {
    accounts,
    transactions,
    categories,
    goals,
    subscriptions,
    pots,
    pockets,
    chatSessions,
  } = useFinanceStore.getState();

  if (!profile.totpSecret) {
    showToast("TOTP secret not found", "alert");
    return;
  }

  try {
    const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);

    const decryptedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        if (
          acc.details &&
          typeof acc.details === "string" &&
          acc.details.startsWith("ENC:")
        ) {
          try {
            const decryptedStr = await SecurityService.decryptWithKey(
              acc.details,
              key,
            );
            return {
              ...acc,
              details: JSON.parse(decryptedStr),
              isEncrypted: false,
            };
          } catch (e) {
            console.error(
              `Failed to decrypt account ${acc.id} during disable:`,
              e,
            );
            return acc;
          }
        }
        return { ...acc, isEncrypted: false };
      }),
    );

    usePrivacyStore.getState().setVaultUnlocked(false);

    localStorage.removeItem("biometric_cred_id");
    localStorage.removeItem("biometric_cred_ids");

    useFinanceStore.getState().setAccounts(decryptedAccounts);
    StorageService.saveAccounts(decryptedAccounts);

    const cloudEnabled = isCloudEnabled(profile);
    if (cloudEnabled) {
      await SheetService.syncWithGoogleSheets(
        decryptedAccounts,
        transactions,
        categories,
        goals,
        subscriptions,
        pots,
        pockets,
        profile.syncChatToSheets ? chatSessions : undefined,
      );
    }
  } catch (err: any) {
    console.warn(err);
  }
}
