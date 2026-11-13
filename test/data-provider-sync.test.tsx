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
	getCurrentSpreadsheetId: vi.fn(),
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
		spreadsheetId: "sheet-id",
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

		expect(StorageService.saveAccounts).toHaveBeenCalledWith(payload, "sheet-id");
		expect(SheetService.saveToSheet).toHaveBeenCalledWith("Accounts", payload, "sheet-id");
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
		expect(StorageService.saveAccounts).toHaveBeenCalledWith([], "sheet-id");
		expect(SheetService.saveToSheet).toHaveBeenCalledWith("Accounts", [], "sheet-id");
		expect(StorageService.getStoredAccounts()).toEqual([]);
	});

	it("pins the account cloud save to the loaded spreadsheet even if the selection changed", async () => {
		// The live selection differs from the spreadsheet this sync loaded (as
		// if the user switched files during encryption). The account write must
		// still target the loaded spreadsheet, not re-resolve the live selection.
		vi.mocked(SheetService.getCurrentSpreadsheetId).mockReturnValue("sheet-other");
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue({
			accounts: [account("cloud")],
			profile: { isSecurityEnabled: true, totpSecret: SECRET },
			transactions: [],
			categories: [],
			goals: [],
			subscriptions: [],
			pots: [],
			pockets: [],
			chatSessions: [],
			spreadsheetId: "sheet-id",
		});
		await act(async () => {
			root.render(<DataProvider><Capture /></DataProvider>);
		});
		await act(async () => {
			await data.syncData();
		});

		expect(SheetService.saveToSheet).toHaveBeenCalledWith(
			"Accounts",
			expect.any(Array),
			"sheet-id",
		);
	});

	it("passes the loaded spreadsheet id as the full-save replay target", async () => {
		await sync([account("cloud")], { isSecurityEnabled: true, totpSecret: SECRET });

		const args = vi.mocked(SheetService.syncWithGoogleSheets).mock.calls[0];
		expect(args[9]).toBe("sheet-id");
	});
});

const cloudData = (overrides: Record<string, unknown> = {}) => ({
	accounts: [],
	transactions: [],
	categories: [],
	goals: [],
	subscriptions: [],
	pots: [],
	pockets: [],
	chatSessions: [],
	spreadsheetId: "sheet-id",
	...overrides,
});

describe("DataProvider reset and sync", () => {
	beforeEach(() => {
		vi.spyOn(window, "confirm").mockReturnValue(true);
	});

	const renderProvider = async () => {
		await act(async () => {
			root.render(<DataProvider><Capture /></DataProvider>);
		});
	};

	it("keeps the token refreshed during the cloud load instead of restoring the stale one", async () => {
		localStorage.setItem("google_access_token", "old-token");
		localStorage.setItem("google_token_expiry", "1");
		localStorage.setItem("device_id", "device-1");
		vi.mocked(SheetService.loadFromGoogleSheets).mockImplementation(async () => {
			// Simulates the silent 401 -> refresh retry inside the real load.
			localStorage.setItem("google_access_token", "new-token");
			localStorage.setItem("google_token_expiry", "9999999999999");
			return cloudData();
		});

		await renderProvider();
		await act(async () => {
			await data.handleResetAndSync();
		});

		expect(localStorage.getItem("google_access_token")).toBe("new-token");
		expect(localStorage.getItem("google_token_expiry")).toBe("9999999999999");
		expect(localStorage.getItem("device_id")).toBe("device-1");
		expect(localStorage.getItem(StorageService.KEYS.PROFILE)).not.toBeNull();
	});

	it("keeps the selected sheet id across the reset so later writes target the chosen spreadsheet", async () => {
		localStorage.setItem("zenfinance_selected_sheet_id", "picked-file-id");
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ spreadsheetId: "picked-file-id" }),
		);

		await renderProvider();
		await act(async () => {
			await data.handleResetAndSync();
		});

		expect(localStorage.getItem("zenfinance_selected_sheet_id")).toBe("picked-file-id");
	});

	it("restores the cloud snapshot locally without writing it back to the spreadsheet", async () => {
		const accounts = [account("cloud")];
		const pockets = [{
			id: "p1", userId: "test-user", name: "Pocket",
			currentAmount: 5, currency: "MYR" as const, color: "#fff", icon: "P",
		}];
		const chatSessions = [{
			id: "chat1", userId: "test-user", title: "Chat",
			messages: [], updatedAt: "2026-01-01T00:00:00.000Z",
		}];
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(
			cloudData({ accounts, pockets, chatSessions }),
		);

		await renderProvider();
		await act(async () => {
			await data.handleResetAndSync();
		});

		expect(SheetService.saveToSheet).not.toHaveBeenCalled();
		expect(StorageService.getStoredAccounts()).toEqual(accounts);
		expect(StorageService.getStoredPockets()).toEqual(pockets);
		expect(StorageService.getStoredChatSessions()).toEqual(chatSessions);
	});

	it("aborts the reset when the spreadsheet selection changed during the load", async () => {
		const localAccounts = [account("local")];
		localStorage.setItem(`${StorageService.KEYS.ACCOUNTS}_test-user`, JSON.stringify(localAccounts));
		localStorage.setItem("zenfinance_selected_sheet_id", "old-file");
		vi.mocked(SheetService.loadFromGoogleSheets).mockImplementation(async () => {
			// The picker can change the selection while the reset load is in flight.
			localStorage.setItem("zenfinance_selected_sheet_id", "new-file");
			return cloudData({
				accounts: [account("old-file-data")],
				spreadsheetId: "old-file",
			});
		});

		await renderProvider();
		await act(async () => {
			await data.handleResetAndSync();
		});

		expect(StorageService.getStoredAccounts()).toEqual(localAccounts);
		expect(localStorage.getItem("zenfinance_selected_sheet_id")).toBe("new-file");
		expect(SheetService.saveToSheet).not.toHaveBeenCalled();
	});

	it("keeps local data and session when the cloud load is refused", async () => {
		const accounts = [account("local")];
		localStorage.setItem(`${StorageService.KEYS.ACCOUNTS}_test-user`, JSON.stringify(accounts));
		localStorage.setItem("google_access_token", "old-token");
		vi.mocked(SheetService.loadFromGoogleSheets).mockResolvedValue(null);

		await renderProvider();
		await act(async () => {
			await data.handleResetAndSync();
		});

		expect(StorageService.getStoredAccounts()).toEqual(accounts);
		expect(localStorage.getItem("google_access_token")).toBe("old-token");
		expect(localStorage.getItem(StorageService.KEYS.PROFILE)).not.toBeNull();
	});
});
