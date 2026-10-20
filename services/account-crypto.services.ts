/**
 * Account Crypto Service
 *
 * Pure, dependency-injected account detail encryption/decryption logic.
 * Extracted from DataProvider so it can be tested without rendering React.
 */

import { Account, UserProfile } from "../types";
import * as SecurityService from "./security.services";

/**
 * Ciphertext detection.
 *
 * The `isEncrypted` flag on an Account is NOT trustworthy on its own:
 * `decryptAccount` resets `details` to `{}` when the key is unavailable,
 * which historically left accounts flagged as encrypted while actually
 * holding plaintext. Details must always be inspected directly.
 */
export const isCipherText = (val: unknown): val is string =>
	typeof val === "string" && (val.startsWith("ENC:") || val.startsWith("SEC:"));

export interface AccountCryptoOptions {
	/** Mirrors the legacy `isVaultEnabled` shim (== isSecurityEnabled). */
	isVaultEnabled: boolean;
	/** Mirrors the legacy `isSecurityEnabled` profile flag. */
	isSecurityEnabled: boolean;
	/** TOTP secret used to derive the account encryption key. */
	totpSecret: string | undefined;
	/** Whether the security layer is currently unlocked. */
	isUnlocked?: () => boolean;
}

/** Resolve options from the captured profile and any updates merged during sync. */
export const resolveSyncCryptoOptions = (
	profile: Pick<UserProfile, "isSecurityEnabled" | "totpSecret">,
	updates: Partial<Pick<UserProfile, "isSecurityEnabled" | "totpSecret">> = {},
	isUnlocked?: () => boolean,
): AccountCryptoOptions => {
	const merged = { ...profile, ...updates };
	const isSecurityEnabled = !!merged.isSecurityEnabled;
	return {
		isVaultEnabled: isSecurityEnabled,
		isSecurityEnabled,
		totpSecret: merged.totpSecret,
		isUnlocked,
	};
};

/**
 * Encrypt an account's details if the vault is enabled.
 * Returns the account unchanged when encryption is not applicable or possible.
 */
export const encryptAccount = async (
	acc: Account,
	opts: AccountCryptoOptions,
): Promise<Account> => {
	const { isVaultEnabled, totpSecret } = opts;
	if (!isVaultEnabled || !acc.details) return acc;

	// Already ciphertext - never double encrypt
	if (isCipherText(acc.details)) {
		return { ...acc, isEncrypted: true };
	}

	if (!totpSecret) {
		console.warn("Vault is enabled but no TOTP secret found for encryption.");
		return acc;
	}

	try {
		const key = await SecurityService.deriveKeyFromTOTP(totpSecret);
		const encryptedDetails = await SecurityService.encryptWithKey(
			JSON.stringify(acc.details),
			key,
		);
		return { ...acc, details: encryptedDetails as any, isEncrypted: true };
	} catch (e) {
		console.error("Encryption failed", e);
		return acc;
	}
};

/**
 * Encrypt an account for outbound sync.
 *
 * Throws if encryption is required but could not be achieved, so plaintext
 * account details can never be written to the cloud. Callers are expected to
 * handle the throw per-account rather than aborting an entire sync.
 */
export const encryptAccountForCloud = async (
	acc: Account,
	opts: AccountCryptoOptions,
): Promise<Account> => {
	const { isSecurityEnabled } = opts;
	if (!isSecurityEnabled || !acc.details) return acc;
	if (isCipherText(acc.details)) return { ...acc, isEncrypted: true };

	const encrypted = await encryptAccount(acc, opts);
	if (!isCipherText(encrypted.details)) {
		throw new Error(
			`Refusing to sync plaintext details for account ${acc.id}. Unlock or configure encryption first.`,
		);
	}
	return encrypted;
};

/**
 * Encrypt a batch of accounts for outbound sync.
 *
 * Guarantees:
 *  - No plaintext `details` reaches the payload while the security layer is on.
 *  - A single unencryptable account never aborts the batch; it is dropped.
 *  - Relative order of surviving accounts is preserved.
 *  - Input accounts are not mutated.
 */
export const encryptAccountsForSync = async (
	accounts: Account[],
	opts: AccountCryptoOptions,
): Promise<Account[]> => {
	const results = await Promise.all(
		accounts.map(async (acc) => {
			try {
				return await encryptAccountForCloud(acc, opts);
			} catch (e) {
				console.warn(
					`Skipping cloud push for account ${acc.id}:`,
					(e as Error)?.message || e,
				);
				return null;
			}
		}),
	);
	return results.filter((a): a is Account => a !== null);
};

/**
 * Decrypt an account's details.
 *
 * When the vault is locked the ciphertext is returned untouched. When no TOTP
 * secret is available the details are unrecoverable, so they are reset to `{}`
 * and `isEncrypted` is cleared - otherwise the account would appear encrypted
 * while holding an empty plaintext object.
 */
export const decryptAccount = async (
	acc: Account,
	opts: AccountCryptoOptions & { forceUnlock?: boolean } = {
		isVaultEnabled: false,
		isSecurityEnabled: false,
		totpSecret: undefined,
	},
	forceUnlock: boolean = false,
): Promise<Account> => {
	const { totpSecret, isUnlocked } = opts;
	if (!acc.details || typeof acc.details !== "string") return acc;

	if (!isCipherText(acc.details)) return acc;

	// If vault is locked, cannot decrypt
	const unlocked = forceUnlock || isUnlocked?.() === true;
	if (!unlocked) {
		console.warn(
			`Account ${acc.id} is encrypted but vault is locked (forceUnlock=${forceUnlock}, isVaultUnlocked=${isUnlocked?.() === true})`,
		);
		return acc;
	}

	// Legacy password-based ciphertext cannot be decrypted with a TOTP key.
	// Preserve it even when no TOTP secret is available.
	if (acc.details.startsWith("ENC:")) {
		console.warn(
			`Account ${acc.id} uses old password-based encryption. Cannot decrypt without original password.`,
		);
		return { ...acc, isEncrypted: true };
	}

	// Check if TOTP secret is available for decryption
	if (!totpSecret) {
		console.warn(
			`Account ${acc.id} is encrypted but no TOTP secret found - resetting to empty`,
		);
		return {
			...acc,
			details: {}, // Reset to empty - old encrypted data unrecoverable
			isEncrypted: false,
		};
	}

	try {
		const key = await SecurityService.deriveKeyFromTOTP(totpSecret);
		const decryptedStr = await SecurityService.decryptWithKey(
			acc.details,
			key,
		);

		// Check if decryption actually worked
		if (
			!decryptedStr ||
			decryptedStr.startsWith("SEC:") ||
			decryptedStr.startsWith("ENC:")
		) {
			console.warn(
				`Failed to decrypt account ${acc.id}, returning encrypted`,
			);
			return acc;
		}

		try {
			const parsed = JSON.parse(decryptedStr);
			return { ...acc, details: parsed, isEncrypted: false };
		} catch (jsonErr) {
			console.warn("Decrypted string is not valid JSON for account:", acc.id);
			return acc;
		}
	} catch (e) {
		console.error("Decryption failed", e);
		return acc;
	}
};

/**
 * Normalize an account's `details` into a consistent plaintext object shape.
 *
 * Ciphertext is passed through untouched. Anything else is plaintext, so the
 * `isEncrypted` flag is always cleared on the way out.
 */
export const normalizeAccount = (acc: any): Account => {
	// 1. If details is ciphertext, don't touch it
	if (isCipherText(acc.details)) {
		return { ...acc, isEncrypted: true };
	}

	// 2. If details is a JSON string (unencrypted), parse it
	if (typeof acc.details === "string" && acc.details.trim().startsWith("{")) {
		try {
			const parsed = JSON.parse(acc.details);
			return normalizeAccount({ ...acc, details: parsed });
		} catch (e) {
			console.warn("Failed to parse raw details JSON", e);
		}
	}

	// 3. Ensure details is an object. Plaintext means the flag must be cleared,
	//    otherwise the account looks encrypted while holding readable data.
	const details = (
		typeof acc.details === "object" && acc.details !== null
			? { ...acc.details }
			: {}
	) as any;

	// 4. Migration: If sensitive fields are at top level, move them to details
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
		return { ...acc, details, isEncrypted: false };
	}
	return { ...acc, isEncrypted: false };
};
