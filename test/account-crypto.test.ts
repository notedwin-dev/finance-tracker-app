import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	isCipherText,
	encryptAccount,
	encryptAccountForCloud,
	encryptAccountsForSync,
	decryptAccount,
	normalizeAccount,
	AccountCryptoOptions,
	resolveSyncCryptoOptions,
} from "../services/account-crypto.services";
import { Account } from "../types";
import * as SecurityService from "../services/security.services";

const SECRET = "JBSWY3DPEHPK3PXP";

let unlocked = true;

const opts = (over: Partial<AccountCryptoOptions> = {}): AccountCryptoOptions => ({
	isVaultEnabled: true,
	isSecurityEnabled: true,
	totpSecret: SECRET,
	isUnlocked: () => unlocked,
	...over,
});

const account = (over: Partial<Account> = {}): Account => ({
	id: "0f4cb2a4-f8c8-4cc4-87d4-6a318a0d2838",
	name: "Maybank",
	balance: 100,
	currency: "MYR",
	type: "BANK",
	color: "#fff",
	iconType: "EMOJI",
	iconValue: "M",
	userId: "local",
	...over,
});

const plaintext = { accountNumber: "1234567890", cvv: "123" };

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	unlocked = true;
	warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	error = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("isCipherText", () => {
	it("recognises SEC: and ENC: payloads", () => {
		expect(isCipherText("SEC:abc")).toBe(true);
		expect(isCipherText("ENC:abc")).toBe(true);
	});

	it("rejects plaintext objects and unrelated strings", () => {
		expect(isCipherText({ accountNumber: "1" })).toBe(false);
		expect(isCipherText('{"accountNumber":"1"}')).toBe(false);
		expect(isCipherText("SECRET-value")).toBe(false);
		expect(isCipherText(undefined)).toBe(false);
		expect(isCipherText(null)).toBe(false);
	});
});

/*
 * Regression suite for:
 *   "Refusing to sync plaintext details for account <id>. Unlock or configure
 *    encryption first."
 *
 * Root cause was encryptAccount() trusting the `isEncrypted` flag instead of
 * inspecting `details`, combined with the sync loop reading a stale
 * `profile.totpSecret` before the cloud merge was committed.
 */
describe("encryptAccountForCloud - regression", () => {
	it("encrypts an account flagged isEncrypted but holding plaintext", async () => {
		// This is the exact shape decryptAccount used to produce: it reset
		// details to {} while leaving isEncrypted: true behind.
		const acc = account({ details: { ...plaintext }, isEncrypted: true });

		const result = await encryptAccountForCloud(acc, opts());

		expect(isCipherText(result.details)).toBe(true);
		expect(result.isEncrypted).toBe(true);
	});

	it("encrypts a poisoned account with empty details instead of throwing", async () => {
		const acc = account({ details: {}, isEncrypted: true });

		const result = await encryptAccountForCloud(acc, opts());

		expect(isCipherText(result.details)).toBe(true);
		expect(result.isEncrypted).toBe(true);
	});

	it("encrypts using a merged cloud secret supplied by the caller", async () => {
		const acc = account({ details: { ...plaintext } });

		// Models the sync ordering bug: the merged secret lives on
		// activeProfile, while the captured profile.totpSecret is still empty
		// for this render. The caller must pass the merged value explicitly.
		const mergedProfileOpts = resolveSyncCryptoOptions(
			{ isSecurityEnabled: false, totpSecret: undefined },
			{ isSecurityEnabled: true, totpSecret: SECRET },
		);

		expect(mergedProfileOpts.totpSecret).toBe(SECRET);
		expect(mergedProfileOpts.isVaultEnabled).toBe(true);
		expect(mergedProfileOpts.isSecurityEnabled).toBe(true);

		const result = await encryptAccountForCloud(acc, mergedProfileOpts);
		expect(isCipherText(result.details)).toBe(true);

		// Round-trips under the merged secret.
		const decrypted = await decryptAccount(result, mergedProfileOpts, true);
		expect(decrypted.details).toEqual(plaintext);
	});

	it("still refuses genuine plaintext when no secret is available anywhere", async () => {
		const acc = account({ details: { ...plaintext } });

		await expect(
			encryptAccountForCloud(acc, opts({ totpSecret: undefined })),
		).rejects.toThrow(/Refusing to sync plaintext details/);
	});

	it("refuses when the poisoned account has no secret available", async () => {
		const acc = account({ details: { ...plaintext }, isEncrypted: true });

		await expect(
			encryptAccountForCloud(acc, opts({ totpSecret: undefined })),
		).rejects.toThrow(/Refusing to sync plaintext details/);
	});
});

describe("resolveSyncCryptoOptions", () => {
	it("uses captured settings when there are no merged updates", () => {
		const isUnlocked = () => true;
		expect(resolveSyncCryptoOptions(
			{ isSecurityEnabled: true, totpSecret: SECRET }, {}, isUnlocked,
		)).toEqual(opts({ isUnlocked }));
	});

	it("honors an explicit merged disabled flag", () => {
		const resolved = resolveSyncCryptoOptions(
			{ isSecurityEnabled: true, totpSecret: SECRET },
			{ isSecurityEnabled: false },
		);
		expect(resolved.isSecurityEnabled).toBe(false);
		expect(resolved.isVaultEnabled).toBe(false);
		expect(resolved.totpSecret).toBe(SECRET);
	});
});

describe("encryptAccount", () => {
	it("passes ciphertext through without double-encrypting", async () => {
		const once = await encryptAccount(account({ details: { ...plaintext } }), opts());
		const twice = await encryptAccount(once, opts());

		expect(twice.details).toBe(once.details);
	});

	it("is a no-op when the vault is disabled", async () => {
		const acc = account({ details: { ...plaintext } });
		const result = await encryptAccount(acc, opts({ isVaultEnabled: false }));

		expect(result.details).toEqual(plaintext);
	});

	it("returns plaintext untouched when encryption throws", async () => {
		const spy = vi
			.spyOn(SecurityService, "encryptWithKey")
			.mockRejectedValueOnce(new Error("boom"));

		const acc = account({ details: { ...plaintext } });
		const result = await encryptAccount(acc, opts());

		expect(result.details).toEqual(plaintext);
		expect(result.isEncrypted).toBeUndefined();
		spy.mockRestore();
	});
});

describe("decryptAccount", () => {
	it("clears isEncrypted when details are unrecoverable", async () => {
		const acc = account({ details: "SEC:ciphertext", isEncrypted: true });

		const result = await decryptAccount(acc, opts({ totpSecret: undefined }), true);

		expect(result.details).toEqual({});
		expect(result.isEncrypted).toBe(false);
	});

	it.each([SECRET, undefined])("retains legacy ENC: ciphertext with secret %s", async (totpSecret) => {
		const acc = account({ details: "ENC:old", isEncrypted: false });

		const result = await decryptAccount(acc, opts({ totpSecret }), true);
		const normalized = normalizeAccount(result);
		const payload = await encryptAccountsForSync([normalized], opts({ totpSecret }));

		expect(result.details).toBe("ENC:old");
		expect(result.isEncrypted).toBe(true);
		expect(payload[0].details).toBe("ENC:old");
	});

	it("logs only the account identifier when decrypted content is not JSON", async () => {
		const invalidJson = "sensitive account details, invalid JSON";
		const encryptedDetails = await SecurityService.encryptWithKey(
			invalidJson,
			await SecurityService.deriveKeyFromTOTP(SECRET),
		);
		const acc = account({ details: encryptedDetails, isEncrypted: true });

		const result = await decryptAccount(acc, opts(), true);

		expect(result).toBe(acc);
		expect(warn).toHaveBeenCalledWith("Decrypted string is not valid JSON for account:", acc.id);
		expect(JSON.stringify(warn.mock.calls)).not.toContain(invalidJson);
	});

	it("returns ciphertext untouched while the vault is locked", async () => {
		unlocked = false;
		const acc = account({ details: "SEC:ciphertext", isEncrypted: true });

		const result = await decryptAccount(acc, opts(), false);

		expect(result.details).toBe("SEC:ciphertext");
		expect(result.isEncrypted).toBe(true);
	});

	it("round-trips real ciphertext and clears the flag", async () => {
		const encrypted = await encryptAccount(account({ details: { ...plaintext } }), opts());

		const result = await decryptAccount(encrypted, opts(), true);

		expect(result.details).toEqual(plaintext);
		expect(result.isEncrypted).toBe(false);
	});

	it("keeps ciphertext when decryption fails", async () => {
		const spy = vi
			.spyOn(SecurityService, "decryptWithKey")
			.mockResolvedValueOnce(null);

		const acc = account({ details: "SEC:ciphertext", isEncrypted: true });
		const result = await decryptAccount(acc, opts(), true);

		expect(result.details).toBe("SEC:ciphertext");
		expect(result.isEncrypted).toBe(true);
		spy.mockRestore();
	});
});

describe("normalizeAccount", () => {
	it("clears isEncrypted on plaintext objects", () => {
		const result = normalizeAccount({
			...account(),
			details: { ...plaintext },
			isEncrypted: true,
		});

		expect(result.isEncrypted).toBe(false);
		expect(result.details).toEqual(plaintext);
	});

	it("keeps isEncrypted for ciphertext", () => {
		const result = normalizeAccount({
			...account(),
			details: "SEC:ciphertext",
			isEncrypted: false,
		});

		expect(result.isEncrypted).toBe(true);
		expect(result.details).toBe("SEC:ciphertext");
	});

	it("clears isEncrypted after parsing a plaintext JSON string", () => {
		const result = normalizeAccount({
			...account(),
			details: JSON.stringify(plaintext),
			isEncrypted: true,
		});

		expect(result.details).toEqual(plaintext);
		expect(result.isEncrypted).toBe(false);
	});

	it("migrates sensitive top-level fields into details and clears the flag", () => {
		const result = normalizeAccount({
			...account(),
			accountNumber: "999",
			isEncrypted: true,
		});

		expect((result.details as any).accountNumber).toBe("999");
		expect((result as any).accountNumber).toBeUndefined();
		expect(result.isEncrypted).toBe(false);
	});

	it("normalizes missing details to an empty object with the flag cleared", () => {
		const result = normalizeAccount({ ...account(), isEncrypted: true });

		expect(result.details).toEqual({});
		expect(result.isEncrypted).toBe(false);
	});
});
/**
 * Spec for the sync batch helper, derived from the requirement rather than
 * from any implementation:
 *
 *   1. When the security layer is on, no plaintext `details` may ever reach
 *      the outbound cloud payload.
 *   2. One unencryptable account must not abort the batch.
 *   3. Relative order of the surviving accounts is preserved.
 *   4. Input accounts are never mutated.
 */
describe("encryptAccountsForSync", () => {
	it("emits only ciphertext when a secret is present", async () => {
		const accounts = [
			account({ id: "a", details: { ...plaintext } }),
			account({ id: "b", details: { ...plaintext }, isEncrypted: true }),
			account({ id: "c", details: {} }),
		];

		const payload = await encryptAccountsForSync(accounts, opts());

		expect(payload).toHaveLength(3);
		payload.forEach((a) => expect(isCipherText(a.details)).toBe(true));
	});

	it("never emits a plaintext account even under mixed failure", async () => {
		// Fail by payload content rather than call order - accounts are
		// processed concurrently, so "which call goes first" is not stable.
		const spy = vi
			.spyOn(SecurityService, "encryptWithKey")
			.mockImplementation(async (data: string) => {
				if (data.includes("9999")) throw new Error("boom");
				return "SEC:" + btoa(data);
			});

		const accounts = [
			account({ id: "ok", details: { ...plaintext } }),
			account({ id: "boom", details: { accountNumber: "9999" } }),
		];

		const payload = await encryptAccountsForSync(accounts, opts());

		expect(payload.map((a) => a.id)).toEqual(["ok"]);
		expect(isCipherText(payload[0].details)).toBe(true);
		spy.mockRestore();
	});

	it("drops every account when encryption is impossible", async () => {
		const accounts = [
			account({ id: "good", details: { ...plaintext } }),
			account({ id: "bad", details: { ...plaintext } }),
		];

		const payload = await encryptAccountsForSync(
			accounts,
			opts({ totpSecret: undefined }),
		);

		expect(payload).toEqual([]);
	});

	it("preserves the relative order of surviving accounts", async () => {
const accounts = [
			account({ id: "a", details: { accountNumber: "1" } }),
			account({ id: "skip", details: { accountNumber: "9999" } }),
			account({ id: "b", details: { accountNumber: "2" } }),
		];
		const spy = vi
			.spyOn(SecurityService, "encryptWithKey")
			.mockImplementation(async (data: string) => {
				if (data.includes("9999")) throw new Error("boom");
				return "SEC:" + btoa(data);
			});

		const payload = await encryptAccountsForSync(accounts, opts());

		expect(payload.map((a) => a.id)).toEqual(["a", "b"]);
		spy.mockRestore();
	});

	it("passes plaintext through untouched when security is disabled", async () => {
		const accounts = [account({ id: "a", details: { ...plaintext } })];

		const payload = await encryptAccountsForSync(
			accounts,
			opts({ isSecurityEnabled: false, isVaultEnabled: false }),
		);

		expect(payload).toHaveLength(1);
		expect(payload[0].details).toEqual(plaintext);
	});

	it("does not mutate the input accounts", async () => {
		const acc = account({ id: "a", details: { ...plaintext } });
		const snapshot = structuredClone(acc);

		await encryptAccountsForSync([acc], opts());

		expect(acc).toEqual(snapshot);
	});

	it("returns an empty array for no input", async () => {
		expect(await encryptAccountsForSync([], opts())).toEqual([]);
	});
});
