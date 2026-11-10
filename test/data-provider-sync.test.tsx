import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider } from "../context/DataProvider";
import { useData } from "../context/DataContext";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import * as SecurityService from "../services/security.services";
import { decryptAccount, isCipherText } from "../services/account-crypto.services";
import { Account, UserProfile } from "../types";

const auth = vi.hoisted(() => ({
	profile: {} as UserProfile,
	isInitialized: false,
	updateProfile: vi.fn(),
	loginWithGoogle: vi.fn(),
}));

vi.mock("../services/auth.services", () => ({ useAuth: () => auth }));
vi.mock("../services/exchange.services", () => ({
	getUSDToMYRRate: async () => ({ rate: 4.45 }),
}));
vi.mock("../services/coin.services", () => ({
	getCryptoPrices: async () => ({ BTC: 65000, ETH: 3500 }),
}));
vi.mock("../services/sheets.services", () => ({
	isClientReady: () => true,
	setSheetUser: vi.fn(),
	loadFromGoogleSheets: vi.fn(),
	saveToSheet: vi.fn().mockResolvedValue(undefined),
	syncWithGoogleSheets: vi.fn().mockResolvedValue(undefined),
}));

const SECRET = "JBSWY3DPEHPK3PXP";
const details = { accountNumber: "1234567890", cvv: "123" };
const account = (id: string, overrides: Partial<Account> = {}): Account => ({
	id,
	name: id,
	balance: 100,
	currency: "MYR",
	type: "BANK",
	color: "#fff",
	iconType: "EMOJI",
	iconValue: "M",
	userId: "test-user",
	details: { ...details },
	updatedAt: "2026-01-01T00:00:00.000Z",
	...overrides,
});

let root: Root;
let data: ReturnType<typeof useData>;
const Capture = () => {
	data = useData();
	return null;
};

const sync = async (accounts: Account[], profile: Record<string, unknown>) => {
	vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue({
		accounts,
		profile,
		transactions: [],
		categories: [],
		goals: [],
		subscriptions: [],
		pots: [],
		pockets: [],
		chatSessions: [],
	});
	await act(async () => {
		root.render(<DataProvider><Capture /></DataProvider>);
	});
	await act(async () => {
		await data.syncData();
	});
	expect(SheetService.syncWithGoogleSheets).toHaveBeenCalledOnce();
	return vi.mocked(SheetService.syncWithGoogleSheets).mock.calls[0][0];
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(StorageService, "saveAccounts");
	vi.spyOn(StorageService, "saveAccountsLocal");
	localStorage.clear();
	auth.profile = {
		id: "test-user",
		name: "Test",
		email: "test@example.invalid",
		isLoggedIn: true,
		isSecurityEnabled: true,
		totpSecret: SECRET,
	};
	StorageService.saveProfile(auth.profile);
	root = createRoot(document.createElement("div"));
});

afterEach(async () => {
	await act(async () => {
		root.unmount();
	});
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("DataProvider account sync", () => {
	it.each([true, "true", false, "false"])("uses merged security setting %s and secret", async (enabled) => {
		const shouldEncrypt = enabled === true || enabled === "true";
		auth.profile = { ...auth.profile, isSecurityEnabled: !shouldEncrypt, totpSecret: undefined };
		StorageService.saveProfile(auth.profile);

		const payload = await sync([account("cloud")], {
			isSecurityEnabled: enabled, totpSecret: SECRET,
		});

		expect(StorageService.saveAccounts).toHaveBeenCalledWith(payload);
		expect(SheetService.saveToSheet).toHaveBeenCalledWith("Accounts", payload);
		expect(payload).toHaveLength(1);
		expect(isCipherText(payload[0].details)).toBe(shouldEncrypt);
		if (shouldEncrypt) {
			const decrypted = await decryptAccount(payload[0], {
				isVaultEnabled: true, isSecurityEnabled: true, totpSecret: SECRET,
			}, true);
			expect(decrypted.details).toEqual(details);
		} else {
			expect(payload[0].details).toEqual(details);
		}
	});

	it("skips both cloud account writes and keeps the complete local retry list when any account is omitted", async () => {
		const omitted = account("omitted", { details: { accountNumber: "9999" } });
		localStorage.setItem(`${StorageService.KEYS.ACCOUNTS}_test-user`, JSON.stringify([omitted]));
		const encryptWithKey = SecurityService.encryptWithKey;
		vi.spyOn(SecurityService, "encryptWithKey").mockImplementation(async (value, key) => {
			if (value.includes("9999")) throw new Error("encryption unavailable");
			return encryptWithKey(value, key);
		});

		const payload = await sync([account("ok"), omitted], {});

		expect(payload).toBeUndefined();
		expect(StorageService.saveAccounts).not.toHaveBeenCalled();
		expect(vi.mocked(SheetService.saveToSheet).mock.calls.some(([sheet]) => sheet === "Accounts")).toBe(false);
		const cached = StorageService.getStoredAccounts();
		expect(cached.map((acc) => acc.id)).toEqual(["ok", "omitted"]);
		expect(isCipherText(cached[0].details)).toBe(true);
		expect(cached[1]).toEqual(omitted);
		expect(StorageService.saveAccountsLocal).toHaveBeenCalledWith(cached);
		expect(data.accounts.map((acc) => acc.id)).toEqual(["ok", "omitted"]);
	});

	it("retains the complete local list when every account is omitted", async () => {
		auth.profile.totpSecret = undefined;
		StorageService.saveProfile(auth.profile);
		const accounts = [account("one"), account("two")];
		localStorage.setItem(`${StorageService.KEYS.ACCOUNTS}_test-user`, JSON.stringify(accounts));

		const payload = await sync(accounts, {});

		expect(payload).toBeUndefined();
		expect(StorageService.saveAccounts).not.toHaveBeenCalled();
		expect(vi.mocked(SheetService.saveToSheet).mock.calls.some(([sheet]) => sheet === "Accounts")).toBe(false);
		expect(StorageService.saveAccountsLocal).toHaveBeenCalledWith(accounts);
		expect(StorageService.getStoredAccounts()).toEqual(accounts);
	});

	it("writes an empty account list when no accounts were omitted", async () => {
		const payload = await sync([], {});

		expect(payload).toEqual([]);
		expect(StorageService.saveAccounts).toHaveBeenCalledWith([]);
		expect(SheetService.saveToSheet).toHaveBeenCalledWith("Accounts", []);
		expect(StorageService.getStoredAccounts()).toEqual([]);
	});
});
