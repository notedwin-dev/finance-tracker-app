import React, { useState, useEffect } from "react";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import { getCryptoPrices, CryptoPrices } from "../services/coin.services";
import { normalizeDate, parseDateSafe } from "../helpers/transactions.helper";
import {
  computeAccountTransactionAmount,
  computeBudgetConsumption,
  computeSavingsMovement,
} from "../src/lib/domain/balance.engine";
import {
	Account,
	Category,
	Transaction,
	Goal,
	Subscription,
	Pot,
	SavingPocket,
	ChatSession,
	TransactionType,
	ExchangeRateData,
	UserProfile,
} from "../types";
import { DataContext } from "./DataContext";
import * as SecurityService from "../services/security.services";
import { useFinanceStore } from "../src/stores/finance.store";
import { useUIStore } from "../src/stores/ui.store";
import { usePrivacyStore } from "../src/stores/privacy.store";
import { useSyncStore } from "../src/stores/sync.store";

// Legacy vault type for backward compatibility during migration
type LegacyVaultProfile = UserProfile & {
	isVaultEnabled?: boolean;
	isVaultCreated?: boolean;
	isVaultLocked?: boolean;
	vaultSalt?: string;
	encryptedVaultPassword?: string;
	biometricCredId?: string;
	biometricCredIds?: string[];
	devices?: any[];
};

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const {
		profile: rawProfile,
		loginWithGoogle,
		isInitialized,
		updateProfile,
	} = useAuth();
	// Cast to legacy type for backward compatibility
	const profile = rawProfile as LegacyVaultProfile;
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
	const [goals, setGoals] = useState<Goal[]>([]);
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [pots, setPots] = useState<Pot[]>([]);
	const [pockets, setPockets] = useState<SavingPocket[]>([]);
	const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
	const [usdRate, setUsdRate] = useState<number>(4.45);
	const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({
		BTC: 65000,
		ETH: 3500,
	});
	const [displayCurrency, setDisplayCurrencyState] = useState<"MYR" | "USD">("MYR");
	const setDisplayCurrency = (currency: "MYR" | "USD") => {
		setDisplayCurrencyState(currency);
		useUIStore.getState().setDisplayCurrency(currency);
	};
	const [exchangeRate, setExchangeRate] = useState<ExchangeRateData | null>(
		null,
	);
	const [isSyncing, setIsSyncing] = useState(false);
	const [hasSynced, setHasSynced] = useState(false);
	const syncInProgress = React.useRef(false);
	const lastSyncTime = React.useRef<number>(0);
	const [toast, setToast] = useState<{
		message: string;
		type: "success" | "alert" | "info";
	} | null>(null);

	// Security State (Biometric + 2FA)
	const [securityUnlocked, setSecurityUnlocked] = useState<boolean>(false);
	const securityUnlockedRef = React.useRef(false);

	const setSecurityUnlockedWithRef = (val: boolean) => {
		securityUnlockedRef.current = val;
		setSecurityUnlocked(val);
		usePrivacyStore.getState().setVaultUnlocked(val);
	};
	const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

	const checkBool = (val: any) => {
		if (typeof val === "boolean") return val;
		if (typeof val === "string") {
			const lower = val.toLowerCase();
			if (lower === "true") return true;
			if (lower === "false") return false;
		}
		return !!val;
	};

	const privacyMode = checkBool(profile.privacyMode);
	const isSecurityEnabled = checkBool(profile.isSecurityEnabled);

	// Legacy vault compatibility shims - TODO: Remove after full migration
	const isVaultEnabled = isSecurityEnabled;
	const isVaultCreated = isSecurityEnabled;
	const isVaultLockedSetting = !securityUnlocked;
	const vaultPassword = null; // No longer used
	const isVaultUnlocked = securityUnlocked || securityUnlockedRef.current;
	const setVaultPassword = (val: string | null) => {
		// No-op - vault password deprecated
	};

	const isCloudEnabled = !profile.offlineMode && SheetService.isClientReady();

	/**
	 * Storage Architecture:
	 * - When Google Sheets is linked: Sheets = source of truth, localStorage = Redis-like cache
	 * - When offline/not linked: localStorage = source of truth
	 */
	const shouldUseCloudAsSource = (): boolean => {
		return profile.isLoggedIn && !profile.offlineMode && isCloudEnabled;
	};

	/**
	 * Execute write operations with proper cloud-first strategy:
	 * - Cloud linked: Write to Sheets first, then cache to localStorage on success
	 * - Offline: Write to localStorage only
	 * - Network error: Abort operation, show error, don't modify state
	 */
	const executeWrite = async <T,>(operation: {
		cloudWrite: () => Promise<T>;
		localCache: () => void;
		onSuccess?: () => void;
		errorMessage?: string;
	}): Promise<boolean> => {
		const {
			cloudWrite,
			localCache,
			onSuccess,
			errorMessage = "Operation failed",
		} = operation;

		if (shouldUseCloudAsSource()) {
			try {
				await cloudWrite(); // Cloud first - throws on network error
				localCache(); // Cache successful write to localStorage
				onSuccess?.();
				return true;
			} catch (error) {
				console.error("Cloud write failed:", error);
				showToast(
					`${errorMessage}. Please check your connection and try again.`,
					"alert",
				);
				return false; // Abort - state not modified
			}
		} else {
			// Offline mode: localStorage is source of truth
			localCache();
			onSuccess?.();
			return true;
		}
	};

	/**
	 * Update lastUpdatedAt timestamp in cloud profile
	 * This tracks when data was last modified in Sheets
	 */
	const updateCloudTimestamp = async (): Promise<void> => {
		if (shouldUseCloudAsSource() && profile.id) {
			try {
				await SheetService.updateOne("Profile", profile.id, {
					...profile,
					lastUpdatedAt: new Date().toISOString(),
				});
			} catch (error) {
				console.warn("Failed to update cloud timestamp:", error);
				// Non-critical - don't throw
			}
		}
	};

	const setPrivacyMode = (value: boolean) => {
		updateProfile({ privacyMode: value });
	};

	const encryptAccount = async (acc: Account): Promise<Account> => {
		if (!isVaultEnabled || !acc.details || acc.isEncrypted) return acc;

		// If already encrypted, don't double encrypt
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
	};

	// isVaultUnlocked now defined in compatibility shims above

	const normalizeAccount = (acc: any): Account => {
		// 1. If details is an encrypted string, don't touch it
		if (typeof acc.details === "string" && acc.details.startsWith("ENC:")) {
			return acc;
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

		// 3. Ensure details is an object
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
			return { ...acc, details };
		}
		return acc;
	};

	/**
	 * Unlock vault with biometrics
	 * Uses WebAuthn to verify identity, then unlocks with stored encryption key
	 */
	const unlockVaultWithBiometrics = async (): Promise<boolean> => {
		try {
			// Check if biometrics are registered
			if (!(profile.biometricCredIds?.length || profile.biometricCredId)) {
				showToast("Biometrics not set up on this device", "alert");
				return false;
			}

			// Verify biometric authentication
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

			// Check if TOTP is set up (required for vault encryption)
			if (!profile.totpSecret) {
				showToast("2FA not set up - please set up TOTP first", "alert");
				return false;
			}

			// Biometric verification successful - unlock vault
			setSecurityUnlockedWithRef(true);
			updateProfile({ isVaultLocked: false } as any);

			// Load decrypted data using TOTP-derived key
			await loadData(true);

			showToast("Vault unlocked with biometrics", "success");
			return true;
		} catch (error) {
			console.error("Biometric unlock failed:", error);
			showToast("Failed to unlock with biometrics", "alert");
			return false;
		}
	};

	/**
	 * Unlock vault with TOTP code
	 * Verifies the code and unlocks if valid
	 */
	const unlockVaultWithTOTP = async (totpCode: string): Promise<boolean> => {
		try {
			if (!profile.totpSecret) {
				showToast("2FA not set up", "alert");
				return false;
			}

			// Verify TOTP code
			const isValid = await import("../services/twofa.services").then(
				(service) => service.verifyTOTP(profile.totpSecret!, totpCode),
			);

			if (!isValid) {
				showToast("Invalid 2FA code", "alert");
				return false;
			}

			// TOTP verification successful - unlock vault
			setSecurityUnlockedWithRef(true);
			updateProfile({ isVaultLocked: false } as any);

			// Load decrypted data using TOTP-derived key
			await loadData(true);

			showToast("Vault unlocked with 2FA", "success");
			return true;
		} catch (error) {
			console.error("TOTP unlock failed:", error);
			showToast("Failed to unlock with 2FA", "alert");
			return false;
		}
	};

	/**
	 * Enable biometric unlock on this device
	 * Requires existing TOTP setup
	 */
	const enableBiometricUnlock = async (): Promise<boolean> => {
		try {
			if (!profile.totpSecret) {
				showToast("Please set up 2FA first", "alert");
				return false;
			}

			// Register biometric credential
			const credId = await SecurityService.registerBiometrics(
				profile.email || "user",
				profile.biometricCredIds,
			);
			if (!credId) {
				showToast("Failed to register biometrics", "alert");
				return false;
			}

			// Update profile with new credential ID
			const updatedCredIds = Array.from(
				new Set([...(profile.biometricCredIds || []), credId]),
			);

			await updateProfile({ biometricCredIds: updatedCredIds } as any);

			showToast("Biometric unlock enabled", "success");
			return true;
		} catch (error) {
			console.error("Failed to enable biometric unlock:", error);
			showToast("Failed to enable biometric unlock", "alert");
			return false;
		}
	};

	const enableVault = async () => {
		// Check if TOTP is set up
		if (!profile.totpSecret) {
			showToast("Please set up 2FA first to enable vault", "alert");
			return;
		}

		// Update local state and profile to enable vault (skip cloud, will sync below)
		setSecurityUnlockedWithRef(true); // Vault starts unlocked when first enabled
		updateProfile(
			{
				isSecurityEnabled: true,
				isVaultLocked: false,
			} as any,
			true,
		); // skipCloud = true

		// Encrypt all current accounts with TOTP-derived key
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

		if (isCloudEnabled) {
			// Include updated profile in sync to avoid duplicate updateUser call
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
	};

	const lockVault = () => {
		setSecurityUnlockedWithRef(false);
		showToast("Vault locked", "info");
		updateProfile({ isVaultLocked: true } as any);
		loadData(); // Reload data
	};

	const disableVault = async () => {
		if (!profile.totpSecret) {
			showToast("TOTP secret not found", "alert");
			return;
		}

		try {
			const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);

			// Decrypt all before disabling
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

			setSecurityUnlockedWithRef(false);

			// Clean up biometric data from local storage
			localStorage.removeItem("biometric_cred_id");
			localStorage.removeItem("biometric_cred_ids");

			setAccounts(decryptedAccounts);
			StorageService.saveAccounts(decryptedAccounts);

			if (isCloudEnabled) {
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
	};

	const decryptAccount = async (
		acc: Account,
		forceUnlock: boolean = false,
	): Promise<Account> => {
		if (!acc.details || typeof acc.details !== "string") return acc;

		// Check if this is encrypted data
		const isEncrypted =
			acc.details.startsWith("ENC:") || acc.details.startsWith("SEC:");
		if (!isEncrypted) return acc;

		// If vault is locked, cannot decrypt
		// Use securityUnlockedRef (latest state) rather than profile.isVaultLocked to avoid stale state
		if (!securityUnlockedRef.current && !forceUnlock) {
			console.warn(
				`Account ${acc.id} is encrypted but vault is locked (forceUnlock=${forceUnlock}, isVaultUnlocked=${securityUnlockedRef.current})`,
			);
			return acc;
		}

		// Check if TOTP secret is available for decryption
		if (!profile.totpSecret) {
			console.warn(
				`Account ${acc.id} is encrypted but no TOTP secret found - resetting to empty`,
			);
			return {
				...acc,
				details: {}, // Reset to empty - old encrypted data unrecoverable
			};
		}

		try {
			// Check if this is old ENC: format (password-based) vs new SEC: format (TOTP-based)
			if (acc.details.startsWith("ENC:")) {
				console.warn(
					`Account ${acc.id} uses old password-based encryption. Cannot decrypt without original password. Resetting to empty.`,
				);
				return {
					...acc,
					details: {}, // Reset to empty - old encrypted data unrecoverable without migration password
				};
			}

			// Derive key from TOTP secret for SEC: encrypted data
			const key = await SecurityService.deriveKeyFromTOTP(profile.totpSecret);
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
				return { ...acc, details: parsed };
			} catch (jsonErr) {
				console.warn("Decrypted string is not valid JSON:", decryptedStr);
				return acc;
			}
		} catch (e) {
			console.error("Decryption failed", e);
			return acc;
		}
	};
	const maskAmount = (
		amount: number | string,
		currency?: string,
		isSensitive: boolean = false,
	) => {
		const formatted = `${currency ? currency + " " : ""}${amount}`;
		if (!privacyMode) return formatted;
		return (
			<span
				className="group/mask inline-flex cursor-pointer transition-all duration-300"
				onClick={async (e) => {
					e.stopPropagation();
					const target = e.currentTarget;
					const isRevealed = target.getAttribute("data-revealed") === "true";

					if (!isRevealed && isSensitive && isVaultEnabled) {
						// Trigger biometric check for truly sensitive data reveal
						const credId =
							profile.biometricCredIds?.[0] || profile.biometricCredId;
						if (!credId || typeof credId !== "string") return;
						const verified = await SecurityService.verifyWithBiometrics(credId);
						if (!verified) return;
					}

					target.setAttribute("data-revealed", isRevealed ? "false" : "true");
				}}
			>
				<span className="inline group-hover/mask:hidden group-data-[revealed=true]/mask:hidden whitespace-nowrap opacity-80">
					{currency ? currency + " " : ""}******
				</span>
				<span className="hidden group-hover/mask:inline group-data-[revealed=true]/mask:inline whitespace-nowrap animate-fadeIn">
					{formatted}
				</span>
			</span>
		);
	};

	const maskText = (
		text: string,
		isSensitive: boolean = false,
		permanentMask: boolean = false,
	) => {
		if (!text) return text;

		// Fixed mask for Bank/Card details (always show last 4 if long enough)
		const getPermanentMask = (val: string) => {
			if (val.length <= 4) return "****";
			return "****" + val.slice(-4);
		};

		const displayText = permanentMask ? getPermanentMask(text) : text;

		if (!privacyMode || !text) return displayText;

		return (
			<span
				className="group/mask inline-flex cursor-pointer transition-all duration-300"
				onClick={async (e) => {
					e.stopPropagation();
					const target = e.currentTarget;
					const isRevealed = target.getAttribute("data-revealed") === "true";

					if (!isRevealed && isSensitive && isVaultEnabled) {
						const credId =
							profile.biometricCredIds?.[0] || profile.biometricCredId;
						if (!credId || typeof credId !== "string") return;
						const verified = await SecurityService.verifyWithBiometrics(credId);
						if (!verified) return;
					}

					target.setAttribute("data-revealed", isRevealed ? "false" : "true");
				}}
			>
				<span className="inline group-hover/mask:hidden group-data-[revealed=true]/mask:hidden whitespace-nowrap opacity-80">
					{text.length > 8 ? text.slice(0, 2) + "********" : "******"}
				</span>
				<span className="hidden group-hover/mask:inline group-data-[revealed=true]/mask:inline whitespace-nowrap animate-fadeIn">
					{displayText}
				</span>
			</span>
		);
	};

	const showToast = (message: string, type: "success" | "alert" | "info") => {
		setToast({ message, type });
		useSyncStore.getState().showToast(message, type);
		setTimeout(() => setToast(null), 3000);
	};

	const loadData = async (forceUnlock: boolean = false) => {
		const storedAccounts = StorageService.getStoredAccounts();
		// Decrypt and normalize accounts
		const decryptedAccounts = await Promise.all(
			storedAccounts.map(async (a) => {
				const decrypted = await decryptAccount(a, forceUnlock);
				return normalizeAccount(decrypted);
			}),
		);
		setAccounts(decryptedAccounts);

		const loadedTxs = StorageService.getStoredTransactions();
		setTransactions(loadedTxs);
		setCategories(StorageService.getStoredCategories());
		setGoals(StorageService.getStoredGoals());
		setPots(StorageService.getStoredPots());
		setChatSessions(StorageService.getStoredChatSessions());
		const storedSubs = StorageService.getStoredSubscriptions();
		setSubscriptions(storedSubs);

		// Pipe loaded data into Zustand stores
		const store = useFinanceStore.getState();
		store.setAccounts(decryptedAccounts);
		store.setTransactions(loadedTxs);
		store.setCategories(StorageService.getStoredCategories());
		store.setGoals(StorageService.getStoredGoals());
		store.setPots(StorageService.getStoredPots());
		store.setChatSessions(StorageService.getStoredChatSessions());
		store.setSubscriptions(storedSubs);
	};

	useEffect(() => {
		setHasSynced(false);
		loadData();
		getUSDToMYRRate().then((data) => {
			setExchangeRate(data);
			setUsdRate(data.rate);
			useFinanceStore.getState().setUsdRate(data.rate);
			useFinanceStore.getState().setExchangeRate(data);
		});
		getCryptoPrices().then((prices) => {
			setCryptoPrices(prices);
			useFinanceStore.getState().setCryptoPrices(prices);
		});
	}, [profile.id]);

	useEffect(() => {
		if (!isInitialized) return;

		// Process subscriptions ONLY after initial sync is done, or if we are definitively offline
		// This prevents stale local data from generating duplicate/old transactions before syncing with cloud
		if (hasSynced || profile.offlineMode) {
			const currentTxs = StorageService.getStoredTransactions();
			const currentSubs = StorageService.getStoredSubscriptions();
			processSubscriptions(currentSubs, currentTxs);
		}
	}, [hasSynced, profile.offlineMode, isInitialized]);

	useEffect(() => {
		if (
			profile.isLoggedIn &&
			isInitialized &&
			!profile.offlineMode &&
			!hasSynced
		) {
			// Avoid double-triggering by checking syncInProgress.current
			if (!syncInProgress.current) {
				syncData();
			}
		}
	}, [profile.isLoggedIn, isInitialized, profile.offlineMode, hasSynced]);

	useEffect(() => {
		if (checkBool(profile.isVaultLocked) && securityUnlocked) {
			console.log("Vault locked from remote update/sync");
			setSecurityUnlockedWithRef(false);
			loadData();
		}
	}, [profile.isVaultLocked]);

	const processSubscriptions = (
		subs: Subscription[],
		currentTxs: Transaction[],
	) => {
		const today = new Date().toLocaleDateString("en-CA");
		let newTxs: Transaction[] = [];
		let updatedSubs = [...subs];
		let processedCount = 0;
		const currentUserId = profile.id || "guest";

		updatedSubs = updatedSubs.map((sub) => {
			if (!sub.active) return sub;
			let nextDateStr = normalizeDate(sub.nextPaymentDate);
			let hasProcessed = false;
			while (nextDateStr <= today) {
				hasProcessed = true;
				const newTx: Transaction = {
					id: crypto.randomUUID(),
					userId: currentUserId,
					accountId: sub.accountId,
					amount: sub.amount,
					currency: sub.currency,
					type: TransactionType.EXPENSE,
					categoryId: sub.categoryId,
					shopName: sub.name + " (Subscription)",
					date: nextDateStr,
					subscriptionId: sub.id,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				newTxs.push(newTx);
				const d = parseDateSafe(nextDateStr);
				if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
				else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
				else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
				else d.setDate(d.getDate() + 1);
				nextDateStr = d.toLocaleDateString("en-CA");
			}
			if (hasProcessed) {
				processedCount++;
				return {
					...sub,
					nextPaymentDate: nextDateStr,
					updatedAt: new Date().toISOString(),
				};
			}
			return { ...sub, nextPaymentDate: nextDateStr };
		});

		if (newTxs.length > 0) {
			const allTxs = [...currentTxs, ...newTxs];
			setTransactions(allTxs);
			StorageService.saveTransactions(allTxs);
			setSubscriptions(updatedSubs);
			StorageService.saveSubscriptions(updatedSubs);
			const accUpdates = new Map<string, number>();
			newTxs.forEach((t) => {
				const acc = accounts.find((a) => a.id === t.accountId);
				let amount = t.amount;
				if (acc && t.currency !== acc.currency) {
					if (t.currency === "USD") amount *= usdRate;
					else if (t.currency === "MYR") amount /= usdRate;
				}
				accUpdates.set(
					t.accountId,
					(accUpdates.get(t.accountId) || 0) + amount,
				);
			});
			setAccounts((prev) => {
				const updated = prev.map((a) => {
					if (accUpdates.has(a.id))
						return {
							...a,
							balance: a.balance - (accUpdates.get(a.id) || 0),
							updatedAt: new Date().toISOString(),
						};
					return a;
				});
				StorageService.saveAccounts(updated);
				return updated;
			});
			showToast(
				`Processed ${processedCount} subscription payments.`,
				"success",
			);
		}
	};

	const syncData = async () => {
		if (syncInProgress.current || profile.offlineMode) return;

		// Debounce: Prevent syncs within 5 seconds of last sync
		const now = Date.now();
		const MIN_SYNC_INTERVAL = 5000; // 5 seconds
		if (now - lastSyncTime.current < MIN_SYNC_INTERVAL) {
			console.log(
				`⏱️ Sync throttled (last sync ${Math.round((now - lastSyncTime.current) / 1000)}s ago)`,
			);
			return;
		}

		syncInProgress.current = true;
		lastSyncTime.current = now;
		setIsSyncing(true);
		const currentProfile = StorageService.getStoredProfile();
		const userId = currentProfile.id || profile.id;
		if (userId) SheetService.setSheetUser(userId);

		try {
			if (!SheetService.isClientReady()) {
				try {
					await SheetService.initGapiClient();
				} catch (e) {
					console.warn("GAPI init failed, likely offline.");
					syncInProgress.current = false;
					setIsSyncing(false);
					return;
				}
				const savedToken = localStorage.getItem("google_access_token");
				const savedExpiry = localStorage.getItem("google_token_expiry");
				if (savedToken) {
					const expiresIn = savedExpiry
						? (parseInt(savedExpiry) - Date.now()) / 1000
						: undefined;
					SheetService.setGapiAccessToken(savedToken, expiresIn);
				}
			}

			if (!SheetService.isClientReady()) {
				// If they had a token but still not ready, don't force login if they could be offline
				if (!navigator.onLine) {
					syncInProgress.current = false;
					setIsSyncing(false);
					return;
				}
				showToast("Session expired. Please sign in again.", "info");
				loginWithGoogle();
				syncInProgress.current = false;
				setIsSyncing(false);
				return;
			}

			showToast("Syncing with Google Sheets...", "info");
			const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
			if (cloudData) {
				// Re-linking detection: Check if Sheets has existing data
				const hasCloudData =
					(cloudData.accounts && cloudData.accounts.length > 0) ||
					(cloudData.transactions && cloudData.transactions.length > 0) ||
					(cloudData.categories && cloudData.categories.length > 0);

				const hasLocalData =
					StorageService.getStoredAccounts().length > 0 ||
					StorageService.getStoredTransactions().length > 0 ||
					StorageService.getStoredCategories().length > 0;

				let useCloudAsAuthority = true; // Default: trust cloud

				// Re-linking scenario: Both cloud and local have data
				if (hasCloudData && hasLocalData && cloudData.profile) {
					// Helper to normalize timestamp to comparable number
					const toTimestamp = (value: any): number => {
						if (!value) return 0;
						if (typeof value === "number") return value;
						if (typeof value === "string") return new Date(value).getTime();
						return 0;
					};

					const cloudLastUpdated = toTimestamp(cloudData.profile.lastUpdatedAt);
					const localLastSynced = toTimestamp(profile.lastSyncAt);

					if (localLastSynced > cloudLastUpdated) {
						// Local data is newer - this means user made changes locally after last cloud update
						console.log(
							"Re-linking: Local data is newer than cloud. Local will update cloud.",
						);
						useCloudAsAuthority = false;
					} else {
						console.log(
							"Re-linking: Cloud data is newer or equal. Cloud is authoritative.",
						);
						useCloudAsAuthority = true;
					}
				}

				// Sync Profile if available
				let activeProfile = { ...profile };
				if (cloudData.profile) {
					const updates: any = {};

					if (
						cloudData.profile.name &&
						cloudData.profile.name !== profile.name
					) {
						updates.name = cloudData.profile.name;
					}

					// Scalar fields - prefer Cloud
					if (
						cloudData.profile.isSecurityEnabled !== undefined &&
						cloudData.profile.isSecurityEnabled !== profile.isSecurityEnabled
					) {
						updates.isSecurityEnabled = cloudData.profile.isSecurityEnabled;
					}

					if (
						cloudData.profile.totpSecret &&
						cloudData.profile.totpSecret !== profile.totpSecret
					) {
						updates.totpSecret = cloudData.profile.totpSecret;
					}

					if (
						cloudData.profile.totpEnabled !== undefined &&
						cloudData.profile.totpEnabled !== profile.totpEnabled
					) {
						updates.totpEnabled = cloudData.profile.totpEnabled;
					}

					// Backward compatibility: migrate isVaultEnabled to isSecurityEnabled
					if (
						cloudData.profile.isSecurityEnabled === undefined &&
						cloudData.profile.isVaultEnabled !== undefined
					) {
						updates.isSecurityEnabled = cloudData.profile.isVaultEnabled;
					}

					// isVaultCreated is now derived from isSecurityEnabled, no separate sync needed
					if (false) {
						// Legacy code - kept for reference
						updates.isVaultCreated = cloudData.profile.isSecurityEnabled;
					}
					if (
						cloudData.profile.vaultSalt &&
						cloudData.profile.vaultSalt !== profile.vaultSalt
					) {
						updates.vaultSalt = cloudData.profile.vaultSalt;
					}
					if (
						cloudData.profile.isVaultLocked !== undefined &&
						cloudData.profile.isVaultLocked !== profile.isVaultLocked
					) {
						// Only accept a "locked" state from cloud if we aren't currently UNLOCKED locally.
						const isActuallyUnlocked = securityUnlocked;
						if (
							checkBool(cloudData.profile.isVaultLocked) &&
							isActuallyUnlocked
						) {
							console.log(
								"Ignoring cloud lock signal as vault is locally unlocked.",
							);
						} else {
							updates.isVaultLocked = cloudData.profile.isVaultLocked;
						}
					}
					if (
						cloudData.profile.privacyMode !== undefined &&
						cloudData.profile.privacyMode !== profile.privacyMode
					) {
						updates.privacyMode = cloudData.profile.privacyMode;
					}
					if (
						cloudData.profile.showAIAssistant !== undefined &&
						cloudData.profile.showAIAssistant !== profile.showAIAssistant
					) {
						updates.showAIAssistant = cloudData.profile.showAIAssistant;
					}
					if (
						cloudData.profile.syncChatToSheets !== undefined &&
						cloudData.profile.syncChatToSheets !== profile.syncChatToSheets
					) {
						updates.syncChatToSheets = cloudData.profile.syncChatToSheets;
					}

					// Array fields - Merge Cloud and Local
					const flatten = (arr: any[]): string[] => {
						let result: string[] = [];
						if (!Array.isArray(arr))
							return typeof arr === "string" ? [arr] : [];
						arr.forEach((item) => {
							if (Array.isArray(item)) result = result.concat(flatten(item));
							else if (typeof item === "string" && item) result.push(item);
						});
						return result;
					};

					const existingIds = flatten(profile.biometricCredIds || []);
					const cloudIds = flatten(cloudData.profile.biometricCredIds || []);

					// Include legacy singular IDs if they exist and are not already in arrays
					if (
						profile.biometricCredId &&
						typeof profile.biometricCredId === "string"
					)
						existingIds.push(profile.biometricCredId);
					else if (Array.isArray(profile.biometricCredId))
						existingIds.push(...flatten(profile.biometricCredId));

					if (
						cloudData.profile.biometricCredId &&
						typeof cloudData.profile.biometricCredId === "string"
					)
						cloudIds.push(cloudData.profile.biometricCredId);
					else if (Array.isArray(cloudData.profile.biometricCredId))
						cloudIds.push(...flatten(cloudData.profile.biometricCredId));

					const mergedBio = Array.from(
						new Set([...existingIds, ...cloudIds]),
					).filter(Boolean);

					if (
						mergedBio.length !== existingIds.length ||
						!mergedBio.every((id) => existingIds.includes(id))
					) {
						updates.biometricCredIds = mergedBio;
					}

					const existingDevices = profile.devices || [];
					const cloudDevices = cloudData.profile.devices || [];
					const mergedDevices = Array.from(
						new Set([...existingDevices, ...cloudDevices]),
					);

					if (
						mergedDevices.length !== existingDevices.length ||
						!mergedDevices.every((d) => existingDevices.includes(d))
					) {
						updates.devices = mergedDevices;
					}

					if (Object.keys(updates).length > 0) {
						console.log("Updating local profile from cloud merge", updates);
						activeProfile = { ...activeProfile, ...updates };
						// Skip calling updateProfile here, we'll do it once at the end
					}
				}

				const merge = <T extends { id: string; updatedAt?: any }>(
					local: T[],
					cloud: T[],
					trustCloud: boolean = true,
				): T[] => {
					const map = new Map<string, T>();
					const now = new Date().toISOString();

					// Helper to normalize timestamp to comparable number
					const toTimestamp = (value: any): number => {
						if (!value) return 0;
						if (typeof value === "number") return value;
						if (typeof value === "string") return new Date(value).getTime();
						return 0;
					};

					if (trustCloud) {
						// Cloud is authoritative - start with cloud data
						cloud.forEach((i) => {
							if (i.id) {
								const id = String(i.id);
								const cloudUpdated = toTimestamp(i.updatedAt);
								map.set(id, {
									...i,
									updatedAt: i.updatedAt || now,
								});
							}
						});

						// Only merge local items that exist in cloud (prevents resurrection of deletions)
						local.forEach((i) => {
							const id = String(i.id);
							const localUpdated = toTimestamp(i.updatedAt);

							if (map.has(id)) {
								const cloudItem = map.get(id)!;
								const cloudUpdated = toTimestamp(cloudItem.updatedAt);
								// Last Write Wins. On tie, prefer Cloud.
								if (localUpdated > cloudUpdated) {
									map.set(id, {
										...i,
										updatedAt: i.updatedAt || now,
									});
								}
							}
							// Deleted items (exist locally but not in cloud) are ignored
						});
					} else {
						// Local is newer (re-linking scenario) - start with local data
						local.forEach((i) => {
							if (i.id) {
								const id = String(i.id);
								const localUpdated = toTimestamp(i.updatedAt);
								map.set(id, {
									...i,
									updatedAt: i.updatedAt || now,
								});
							}
						});

						// Merge cloud items, but prefer local on conflicts
						cloud.forEach((i) => {
							const id = String(i.id);
							const cloudUpdated = toTimestamp(i.updatedAt);

							if (map.has(id)) {
								const localItem = map.get(id)!;
								const localUpdated = toTimestamp(localItem.updatedAt);
								// Last Write Wins. On tie, prefer Local.
								if (cloudUpdated > localUpdated) {
									map.set(id, {
										...i,
										updatedAt: i.updatedAt || now,
									});
								}
							} else if (i.id) {
								// Cloud-only item - add it
								map.set(id, {
									...i,
									updatedAt: i.updatedAt || now,
								});
							}
						});
					}

					return Array.from(map.values());
				};

				const cloudAccounts = await Promise.all(
					(cloudData.accounts || []).map(async (a: Account) => {
						const decrypted = await decryptAccount(a);
						return normalizeAccount(decrypted);
					}),
				);

				const localAccountsRaw = StorageService.getStoredAccounts();
				const localAccounts = await Promise.all(
					localAccountsRaw.map(async (a) => {
						const decrypted = await decryptAccount(a);
						return normalizeAccount(decrypted);
					}),
				);

				const mergedAccounts = merge(
					localAccounts,
					cloudAccounts,
					useCloudAsAuthority,
				);
				setAccounts(mergedAccounts);

				// Encrypt for storage (cache to localStorage)
				const encryptedAccounts = await Promise.all(
					mergedAccounts.map((a) => encryptAccount(a)),
				);
				StorageService.saveAccounts(encryptedAccounts);

				const mergedCategories = merge(
					StorageService.getStoredCategories(),
					cloudData.categories,
					useCloudAsAuthority,
				);
				setCategories(mergedCategories);
				StorageService.saveCategories(mergedCategories);

				const mergedTransactions = merge(
					StorageService.getStoredTransactions(),
					cloudData.transactions,
					useCloudAsAuthority,
				);
				setTransactions(mergedTransactions);
				StorageService.saveTransactions(mergedTransactions);

				const mergedGoals = merge(
					StorageService.getStoredGoals(),
					cloudData.goals,
					useCloudAsAuthority,
				);
				setGoals(mergedGoals);
				StorageService.saveGoals(mergedGoals);

				const mergedSubs = merge(
					StorageService.getStoredSubscriptions(),
					cloudData.subscriptions || [],
					useCloudAsAuthority,
				);
				setSubscriptions(mergedSubs);
				StorageService.saveSubscriptions(mergedSubs);

				const mergedPots = merge(
					StorageService.getStoredPots(),
					cloudData.pots || [],
					useCloudAsAuthority,
				);
				setPots(mergedPots);
				StorageService.savePots(mergedPots);

				const mergedPockets = merge(
					StorageService.getStoredPockets(),
					cloudData.pockets || [],
					useCloudAsAuthority,
				);
				setPockets(mergedPockets);
				StorageService.savePockets(mergedPockets);

				const mergedChatSessions = merge(
					StorageService.getStoredChatSessions(),
					cloudData.chatSessions || [],
					useCloudAsAuthority,
				);
				setChatSessions(mergedChatSessions);
				StorageService.saveChatSessions(mergedChatSessions);

				// Pipe merged data into Zustand stores
				const mergedStore = useFinanceStore.getState();
				mergedStore.setAccounts(mergedAccounts);
				mergedStore.setCategories(mergedCategories);
				mergedStore.setTransactions(mergedTransactions);
				mergedStore.setGoals(mergedGoals);
				mergedStore.setSubscriptions(mergedSubs);
				mergedStore.setPots(mergedPots);
				mergedStore.setPockets(mergedPockets);
				mergedStore.setChatSessions(mergedChatSessions);

				const syncTimestamp = new Date().toISOString();
				await SheetService.syncWithGoogleSheets(
					encryptedAccounts,
					mergedTransactions,
					mergedCategories,
					mergedGoals,
					mergedSubs,
					mergedPots,
					mergedPockets,
					profile.syncChatToSheets ? mergedChatSessions : undefined,
					{
						...activeProfile,
						lastSyncAt: syncTimestamp,
						lastUpdatedAt: syncTimestamp,
					},
				);
				processSubscriptions(mergedSubs, mergedTransactions);

				// Update sync status and timestamp (locally use updatedAt)
				// Skip cloud sync since we already synced the profile in syncWithGoogleSheets above
				// We use the full activeProfile to ensure all merged fields are preserved
				updateProfile(
					{
						...activeProfile,
						lastSyncAt: syncTimestamp,
						updatedAt: syncTimestamp,
					},
					true, // skipCloud = true to prevent duplicate sync
				);
				setHasSynced(true);

				showToast("Cloud sync complete", "success");
			}
		} catch (e) {
			console.error("Sync failed", e);
			showToast("Cloud sync failed. Working offline.", "info");
			// Allow local processing to proceed if sync attempt failed
			setHasSynced(true);
		} finally {
			setIsSyncing(false);
			syncInProgress.current = false;
		}
	};

	const handleBulkTransactionImport = async (
		newTxs: Partial<Transaction>[],
		accountId: string,
		options: { adjustBalance?: boolean; isHistorical?: boolean } = {},
	) => {
		const { adjustBalance = true, isHistorical = false } = options;
		const currentUserId = profile.id || "local";

		const transactionsToInsert: Transaction[] = [];

		newTxs.forEach((tx) => {
			const mainTx = {
				...tx,
				id: crypto.randomUUID(),
				userId: currentUserId,
				accountId,
				isHistorical,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				transferDirection:
					tx.type === TransactionType.TRANSFER ? "OUT" : undefined,
			} as Transaction;

			transactionsToInsert.push(mainTx);

			// If it's a transfer with a destination account, create the partner leg
			if (mainTx.type === TransactionType.TRANSFER && mainTx.toAccountId) {
				const partnerLeg: Transaction = {
					...mainTx,
					id: crypto.randomUUID(),
					accountId: mainTx.toAccountId,
					toAccountId: mainTx.accountId,
					transferDirection: "IN",
					linkedTransactionId: mainTx.id,
					// Reciprocal pockets
					savingPocketId: mainTx.toSavingPocketId,
					toSavingPocketId: mainTx.savingPocketId,
				};
				mainTx.linkedTransactionId = partnerLeg.id;
				transactionsToInsert.push(partnerLeg);
			}
		});

		const updatedTransactionsList = [...transactions, ...transactionsToInsert];
		setTransactions(updatedTransactionsList);
		StorageService.saveTransactions(updatedTransactionsList);

		if (isCloudEnabled) {
			SheetService.insertMany("Transactions", transactionsToInsert);
		}

		if (adjustBalance && !isHistorical) {
			const accountUpdates = new Map<string, number>();

			transactionsToInsert.forEach((tx) => {
				const acc = accounts.find((a) => a.id === tx.accountId);
				if (!acc) return;

				const amt =
					tx.currency === acc.currency
						? tx.amount
						: tx.currency === "USD"
							? tx.amount * usdRate
							: tx.amount / usdRate;

				const fee = tx.fee
					? tx.currency === acc.currency
						? tx.fee
						: tx.currency === "USD"
							? tx.fee * usdRate
							: tx.fee / usdRate
					: 0;

				const feeType = tx.feeType || "INCLUSIVE";

				if (
					tx.type === TransactionType.INCOME ||
					tx.type === TransactionType.ACCOUNT_OPENING ||
					(tx.type === TransactionType.ADJUSTMENT && tx.amount >= 0) ||
					(tx.type === TransactionType.TRANSFER &&
						tx.transferDirection === "IN")
				) {
					const addedAmount =
						tx.type === TransactionType.TRANSFER && feeType === "EXCLUSIVE"
							? amt - fee
							: amt;
					accountUpdates.set(
						tx.accountId,
						(accountUpdates.get(tx.accountId) || 0) + addedAmount,
					);
				} else {
					const removedAmount = feeType === "INCLUSIVE" ? amt + fee : amt;
					accountUpdates.set(
						tx.accountId,
						(accountUpdates.get(tx.accountId) || 0) - removedAmount,
					);
				}
			});

			if (accountUpdates.size > 0) {
				const updatedAccounts = accounts.map((a) => {
					if (accountUpdates.has(a.id)) {
						return {
							...a,
							balance: a.balance + (accountUpdates.get(a.id) || 0),
							updatedAt: new Date().toISOString(),
						};
					}
					return a;
				});
				setAccounts(updatedAccounts);
				StorageService.saveAccounts(updatedAccounts);
			}
		}

		showToast(
			`Imported ${transactionsToInsert.length} transactions`,
			"success",
		);
	};

	const handleTransactionSubmit = async (
		tx: Omit<Transaction, "userId">,
		newSubscription?: Omit<Subscription, "userId" | "id">,
		isDestHistorical?: boolean,
	) => {
		const oldTx = transactions.find((t) => t.id === tx.id);
		const isEdit = !!oldTx;
		const currentUserId = profile.id || "local";

		// 1. Prepare Main Transaction
		const txWithUser = {
			...tx,
			userId: currentUserId,
			updatedAt: new Date().toISOString(),
			transferDirection:
				tx.type === TransactionType.TRANSFER
					? tx.transferDirection || "OUT"
					: undefined,
		} as Transaction;

		// 2. Handle Linked Partner Leg for Transfers
		let partnerLeg: Transaction | null = null;
		let partnerIdToDelete: string | null = null;

		if (
			txWithUser.type === TransactionType.TRANSFER &&
			txWithUser.toAccountId
		) {
			// Find existing partner or create new one
			const existingPartner = txWithUser.linkedTransactionId
				? transactions.find((t) => t.id === txWithUser.linkedTransactionId)
				: transactions.find(
						(t) =>
							t.linkedTransactionId === txWithUser.id &&
							t.type === TransactionType.TRANSFER,
					);

			const partnerId = existingPartner?.id || crypto.randomUUID();
			txWithUser.linkedTransactionId = partnerId;

			partnerLeg = {
				...txWithUser,
				id: partnerId,
				accountId: txWithUser.toAccountId!,
				toAccountId: txWithUser.accountId,
				savingPocketId: txWithUser.toSavingPocketId, // Target leg uses the 'to' pocket
				toSavingPocketId: txWithUser.savingPocketId, // Reciprocal
				transferDirection:
					txWithUser.transferDirection === "OUT" ? "IN" : "OUT",
				linkedTransactionId: txWithUser.id,
				isHistorical: isDestHistorical ?? txWithUser.isHistorical,
				updatedAt: new Date().toISOString(),
			} as Transaction;
		} else if (oldTx?.linkedTransactionId) {
			// If it was a transfer but now it's not, delete the partner leg
			partnerIdToDelete = oldTx.linkedTransactionId;
		}

		// 3. Update Transactions List
		let updatedTransactions = [...transactions];
		if (isEdit) {
			updatedTransactions = updatedTransactions.map((t) =>
				t.id === tx.id ? txWithUser : t,
			);
			if (isCloudEnabled)
				await SheetService.updateOne("Transactions", tx.id, txWithUser);

			if (partnerLeg) {
				const hasPartnerInList = updatedTransactions.some(
					(t) => t.id === partnerLeg?.id,
				);
				if (hasPartnerInList) {
					updatedTransactions = updatedTransactions.map((t) =>
						t.id === partnerLeg?.id ? (partnerLeg as Transaction) : t,
					);
					if (isCloudEnabled)
						await SheetService.updateOne(
							"Transactions",
							partnerLeg.id,
							partnerLeg,
						);
				} else {
					updatedTransactions.push(partnerLeg);
					if (isCloudEnabled)
						await SheetService.insertOne("Transactions", partnerLeg);
				}
			}

			if (partnerIdToDelete) {
				updatedTransactions = updatedTransactions.filter(
					(t) => t.id !== partnerIdToDelete,
				);
				if (isCloudEnabled)
					await SheetService.deleteOne("Transactions", partnerIdToDelete);
			}
		} else {
			updatedTransactions.push(txWithUser);
			if (isCloudEnabled)
				await SheetService.insertOne("Transactions", txWithUser);

			if (partnerLeg) {
				updatedTransactions.push(partnerLeg);
				if (isCloudEnabled)
					await SheetService.insertOne("Transactions", partnerLeg);
			}
		}
		setTransactions(updatedTransactions);
		StorageService.saveTransactions(updatedTransactions);

		// Handle New Subscription
		if (newSubscription && !isEdit) {
			const sub: Subscription = {
				...newSubscription,
				id: crypto.randomUUID(),
				userId: currentUserId,
				updatedAt: new Date().toISOString(),
			};

			// Calculate next payment date based on frequency
			const d = parseDateSafe(sub.nextPaymentDate);
			if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
			else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
			else if (sub.frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
			else d.setDate(d.getDate() + 1);
			sub.nextPaymentDate = d.toLocaleDateString("en-CA");

			const updatedSubs = [...subscriptions, sub];
			setSubscriptions(updatedSubs);
			StorageService.saveSubscriptions(updatedSubs);
			if (isCloudEnabled) await SheetService.insertOne("Subscriptions", sub);
		}

		// Handle Link to Existing Subscription
		if (tx.subscriptionId && !newSubscription) {
			const sub = subscriptions.find((s) => s.id === tx.subscriptionId);
			if (sub) {
				let nextDateStr = normalizeDate(sub.nextPaymentDate);
				const txDate = normalizeDate(tx.date);

				// If the transaction date is equal to or later than the current nextPaymentDate,
				// we push the nextPaymentDate forward.
				if (txDate >= nextDateStr) {
					const d = parseDateSafe(txDate);
					if (sub.frequency === "WEEKLY") d.setDate(d.getDate() + 7);
					else if (sub.frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
					else if (sub.frequency === "YEARLY")
						d.setFullYear(d.getFullYear() + 1);
					else d.setDate(d.getDate() + 1);
					nextDateStr = d.toLocaleDateString("en-CA");

					const updatedSub = {
						...sub,
						nextPaymentDate: nextDateStr,
						updatedAt: new Date().toISOString(),
					};
					const updatedSubsList = subscriptions.map((s) =>
						s.id === sub.id ? updatedSub : s,
					);
					setSubscriptions(updatedSubsList);
					StorageService.saveSubscriptions(updatedSubsList);
					if (isCloudEnabled)
						await SheetService.updateOne("Subscriptions", sub.id, updatedSub);
				}
			}
		}

		const accountUpdates = new Map<string, number>();
		const potUpdates = new Map<string, number>();
		const pocketUpdates = new Map<string, number>();

		const applyDeltas = (tx: Transaction, factor: 1 | -1) => {
			for (const [id, delta] of computeAccountTransactionAmount(tx, factor, accounts, usdRate)) {
				accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
			}
			for (const [id, delta] of computeBudgetConsumption(tx, factor, pots)) {
				potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
			}
			for (const [id, delta] of computeSavingsMovement(tx, factor, pockets)) {
				pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
			}
		};

		// Calculate Partner for Restoration
		const oldPartner =
			oldTx && oldTx.linkedTransactionId
				? transactions.find((t) => t.id === oldTx.linkedTransactionId)
				: null;

		// Restore old impacts
		if (oldTx) applyDeltas(oldTx, -1);
		if (oldPartner) applyDeltas(oldPartner, -1);

		// Apply new impacts
		applyDeltas(txWithUser, 1);
		if (partnerLeg) applyDeltas(partnerLeg, 1);

		// Deletions
		if (partnerIdToDelete) {
			const p = transactions.find((t) => t.id === partnerIdToDelete);
			if (p) applyDeltas(p, -1);
		}

		// Commit Updates
		if (accountUpdates.size > 0) {
			const updatedAccountList = accounts.map((a) => {
				if (accountUpdates.has(a.id)) {
					return {
						...a,
						balance: a.balance + (accountUpdates.get(a.id) || 0),
						updatedAt: new Date().toISOString(),
					};
				}
				return a;
			});
			setAccounts(updatedAccountList);
			StorageService.saveAccounts(updatedAccountList);
		}

		if (potUpdates.size > 0) {
			const updatedPotList = pots.map((p) => {
				if (potUpdates.has(p.id)) {
					const newUsedAmount = Math.max(
						0,
						p.usedAmount + (potUpdates.get(p.id) || 0),
					);
					return {
						...p,
						usedAmount: newUsedAmount,
						amountLeft: p.limitAmount - newUsedAmount,
						updatedAt: new Date().toISOString(),
					};
				}
				return p;
			});
			setPots(updatedPotList);
			StorageService.savePots(updatedPotList);

			// Batch update affected pots to cloud
			if (isCloudEnabled) {
				const affectedPots = updatedPotList.filter((p) => potUpdates.has(p.id));
				if (affectedPots.length > 0) {
					await SheetService.updateMany("Pots", affectedPots);
				}
			}
		}

		if (pocketUpdates.size > 0) {
			const updatedPocketList = pockets.map((p) => {
				if (pocketUpdates.has(p.id)) {
					const newCurrentAmount = Math.max(
						0,
						p.currentAmount + (pocketUpdates.get(p.id) || 0),
					);
					return {
						...p,
						currentAmount: newCurrentAmount,
						updatedAt: new Date().toISOString(),
					};
				}
				return p;
			});
			setPockets(updatedPocketList);
			StorageService.savePockets(updatedPocketList);

			// Batch update affected pockets to cloud
			if (isCloudEnabled) {
				const affectedPockets = updatedPocketList.filter((p) =>
					pocketUpdates.has(p.id),
				);
				if (affectedPockets.length > 0) {
					await SheetService.updateMany("Pockets", affectedPockets);
				}
			}
		}

		showToast("Transaction saved", "success");
	};


	const handleBatchTransactionEdit = async (
		ids: string[],
		updates: Partial<Transaction>,
	) => {
		// 1. Identify all transactions to update, including partners
		const txMap = new Map<string, Transaction>();
		transactions.forEach((t) => txMap.set(t.id, t));

		const finalUpdatesMap = new Map<string, Partial<Transaction>>();
		const affectedTransactionIds = new Set<string>();

		// Separate updates into: explicit values (to apply) and nullified fields (to clear)
		const cleanUpdates = Object.fromEntries(
			Object.entries(updates).filter(([_, v]) => v !== undefined),
		) as Partial<Transaction>;

		const nullifiedFields = Object.keys(updates).filter(
			(k) =>
				updates[k as keyof Transaction] === undefined &&
				["potId", "savingPocketId", "toSavingPocketId"].includes(k),
		);

		ids.forEach((id) => {
			const tx = txMap.get(id);
			if (!tx) return;

			affectedTransactionIds.add(id);

			// Prepare updates for THIS transaction
			const thisUpdates: any = { ...cleanUpdates };
			delete thisUpdates.id;
			delete thisUpdates.userId;

			// Explicitly set nullified fields to undefined so they get cleared
			for (const field of nullifiedFields) {
				thisUpdates[field] = undefined;
			}

			thisUpdates.updatedAt = new Date().toISOString();

			finalUpdatesMap.set(id, thisUpdates);

			// Handle Partner Synchronization - only if linked transaction is in selection or affected
			if (tx.linkedTransactionId) {
				const partner = txMap.get(tx.linkedTransactionId);
				if (partner) {
					affectedTransactionIds.add(partner.id);
					const partnerUpdates: any = { ...cleanUpdates };
					delete partnerUpdates.id;
					delete partnerUpdates.userId;

					// Apply nullified fields to partner as well
					for (const field of nullifiedFields) {
						partnerUpdates[field] = undefined;
					}

					// Account synchronization - swap accounts for partner
					if (cleanUpdates.accountId !== undefined) {
						partnerUpdates.toAccountId = cleanUpdates.accountId;
						delete partnerUpdates.accountId;
					}
					if (cleanUpdates.toAccountId !== undefined) {
						partnerUpdates.accountId = cleanUpdates.toAccountId;
						delete partnerUpdates.toAccountId;
					}

					// Pocket synchronization is reciprocal - swap pockets for partner
					if (cleanUpdates.savingPocketId !== undefined) {
						partnerUpdates.toSavingPocketId = cleanUpdates.savingPocketId;
						delete partnerUpdates.savingPocketId;
					}
					if (cleanUpdates.toSavingPocketId !== undefined) {
						partnerUpdates.savingPocketId = cleanUpdates.toSavingPocketId;
						delete partnerUpdates.toSavingPocketId;
					}

					// Always set updatedAt for partner
					partnerUpdates.updatedAt = new Date().toISOString();
					finalUpdatesMap.set(partner.id, partnerUpdates);
				}
			}
		});

		const updatedTransactionsList = transactions.map((t) => {
			const txUpdates = finalUpdatesMap.get(t.id);
			if (txUpdates) {
				return { ...t, ...txUpdates };
			}
			return t;
		});

		setTransactions(updatedTransactionsList);
		StorageService.saveTransactions(updatedTransactionsList);

		// Update Cloud Transactions - only for affected transactions (batch update)
		// Send the FULL transaction object, not just the partial updates, to preserve all fields
		if (isCloudEnabled && affectedTransactionIds.size > 0) {
			const affectedTxs = Array.from(affectedTransactionIds)
				.map((id) => updatedTransactionsList.find((t) => t.id === id))
				.filter((tx) => tx !== undefined) as Transaction[];
			if (affectedTxs.length > 0) {
				await SheetService.updateMany("Transactions", affectedTxs);
			}
		}

		// Calculate pot and pocket updates ONLY for edited transactions
		const potUpdates = new Map<string, number>();
		const pocketUpdates = new Map<string, number>();
		const accountUpdates = new Map<string, number>();

		const applyLegToPotsPockets = (t: Transaction, factor: 1 | -1) => {
			if (t.isHistorical) return;

			// Handle Pots
			if (t.potId) {
				const potId = String(t.potId);
				const pot = pots.find((p) => p.id === potId);
				const txDateStr = normalizeDate(t.date);
				const isAfterPotReset =
					!pot?.resetDate || txDateStr >= normalizeDate(pot.resetDate);

				if (isAfterPotReset) {
					let potDelta = 0;
					if (
						t.type === TransactionType.INCOME ||
						t.type === TransactionType.ACCOUNT_OPENING
					) {
						potDelta = -t.amount;
					} else {
						potDelta = t.amount;
					}
					potUpdates.set(
						potId,
						(potUpdates.get(potId) || 0) + potDelta * factor,
					);
				}
			}

			// Handle Pockets
			if (t.savingPocketId) {
				const pocket = pockets.find((p) => p.id === t.savingPocketId);
				const txDateStr = normalizeDate(t.date);
				const isAfterPocketReset =
					!pocket?.resetDate || txDateStr >= normalizeDate(pocket.resetDate);

				if (isAfterPocketReset) {
					let pocketDelta = 0;
					if (
						t.type === TransactionType.INCOME ||
						t.type === TransactionType.ACCOUNT_OPENING
					) {
						pocketDelta = t.amount;
					} else {
						pocketDelta = -t.amount;
					}
					pocketUpdates.set(
						t.savingPocketId,
						(pocketUpdates.get(t.savingPocketId) || 0) + pocketDelta * factor,
					);
				}
			}
		};

		const applyLegToAccounts = (t: Transaction, factor: 1 | -1) => {
			if (t.isHistorical) return;

			const acc = accounts.find((a) => a.id === t.accountId);
			if (!acc) return;

			const amt =
				t.currency === acc.currency
					? t.amount
					: t.currency === "USD"
						? t.amount * usdRate
						: t.amount / usdRate;

			const fee = t.fee
				? t.currency === acc.currency
					? t.fee
					: t.currency === "USD"
						? t.fee * usdRate
						: t.fee / usdRate
				: 0;

			const feeType = t.feeType || "INCLUSIVE";

			let delta = 0;
			const isInflow =
				t.type === TransactionType.INCOME ||
				t.type === TransactionType.ACCOUNT_OPENING ||
				(t.type === TransactionType.ADJUSTMENT && t.amount >= 0) ||
				(t.type === TransactionType.TRANSFER && t.transferDirection === "IN");

			if (isInflow) {
				const addedAmount =
					t.type === TransactionType.TRANSFER && feeType === "EXCLUSIVE"
						? amt - fee
						: amt;
				delta = addedAmount * factor;
			} else {
				const removedAmount = feeType === "INCLUSIVE" ? amt + fee : amt;
				delta = -removedAmount * factor;
			}
			accountUpdates.set(
				t.accountId,
				(accountUpdates.get(t.accountId) || 0) + delta,
			);
		};

		// Only recalculate impacts for affected transactions (including pot removal)
		affectedTransactionIds.forEach((txId) => {
			const newTx = updatedTransactionsList.find((t) => t.id === txId);
			const oldTx = transactions.find((t) => t.id === txId);

			if (oldTx && newTx) {
				applyLegToPotsPockets(oldTx, -1);
				applyLegToPotsPockets(newTx, 1);

				// Only apply account impacts if account fields changed
				if (
					cleanUpdates.accountId !== undefined ||
					cleanUpdates.toAccountId !== undefined
				) {
					applyLegToAccounts(oldTx, -1);
					applyLegToAccounts(newTx, 1);
				}
			}
		});

		// Update Pots in Storage and Cloud - only affected pots (batch update)
		if (potUpdates.size > 0) {
			const updatedPotList = pots.map((p) => {
				if (potUpdates.has(p.id)) {
					const delta = potUpdates.get(p.id) || 0;
					const newUsedAmount = p.usedAmount + delta;
					return {
						...p,
						usedAmount: Math.max(0, newUsedAmount),
						amountLeft: p.limitAmount - Math.max(0, newUsedAmount),
						updatedAt: new Date().toISOString(),
					};
				}
				return p;
			});
			setPots(updatedPotList);

			// Only save affected pots to storage and cloud (batch)
			const affectedPots = updatedPotList.filter((p) => potUpdates.has(p.id));
			StorageService.savePots(updatedPotList); // Full list for local storage consistency
			if (isCloudEnabled && affectedPots.length > 0) {
				await SheetService.updateMany("Pots", affectedPots);
			}
		}

		// Update Pockets in Storage and Cloud - only affected pockets (batch update)
		if (pocketUpdates.size > 0) {
			const updatedPocketList = pockets.map((p) => {
				if (pocketUpdates.has(p.id)) {
					return {
						...p,
						currentAmount: Math.max(
							0,
							p.currentAmount + (pocketUpdates.get(p.id) || 0),
						),
						updatedAt: new Date().toISOString(),
					};
				}
				return p;
			});
			setPockets(updatedPocketList);

			// Only save affected pockets to storage and cloud (batch)
			const affectedPockets = updatedPocketList.filter((p) =>
				pocketUpdates.has(p.id),
			);
			StorageService.savePockets(updatedPocketList); // Full list for local storage consistency
			if (isCloudEnabled && affectedPockets.length > 0) {
				await SheetService.updateMany("Pockets", affectedPockets);
			}
		}

		// Update Accounts - only if affected by balance changes (batch update)
		if (accountUpdates.size > 0) {
			const updatedAccountList = accounts.map((a) => {
				if (accountUpdates.has(a.id)) {
					return {
						...a,
						balance: a.balance + (accountUpdates.get(a.id) || 0),
						updatedAt: new Date().toISOString(),
					};
				}
				return a;
			});
			setAccounts(updatedAccountList);
			StorageService.saveAccounts(updatedAccountList);

			// Batch update affected accounts to cloud
			if (isCloudEnabled) {
				const affectedAccounts = updatedAccountList.filter((a) =>
					accountUpdates.has(a.id),
				);
				if (affectedAccounts.length > 0) {
					await SheetService.updateMany("Accounts", affectedAccounts);
				}
			}
		}

		showToast(`Updated ${finalUpdatesMap.size} transactions`, "success");
	};

	const handleSelectExistingSheet = async (fileId?: string) => {
		try {
			let selectedFileId = fileId;

			// If no fileId provided, fall back to old picker (deprecated)
			if (!selectedFileId) {
				selectedFileId = await SheetService.selectSpreadsheetWithPicker();
			}

			if (selectedFileId) {
				// Store selected file ID to skip search next time
				localStorage.setItem("zenfinance_selected_sheet_id", selectedFileId);
				// Clear cached sheet name when switching spreadsheets
				SheetService.clearSheetNameCache();

				showToast("Spreadsheet linked! Synchronizing...", "success");
				// Trigger a fresh sync with the newly linked file
				syncData();
			}
		} catch (e) {
			console.error("Failed to select sheet", e);
			showToast("Could not link spreadsheet.", "alert");
		}
	};

	const handleMigrateData = async () => {
		const findings = StorageService.rescueScatteredData();
		if (findings.length === 0) {
			showToast("No orphaned data found", "info");
			return;
		}
		if (!confirm(`Merge ${findings.length} orphaned records?`)) return;
		findings.forEach((f) => {
			const baseKey = Object.values(StorageService.KEYS).find((k) =>
				f.key.startsWith(k),
			);
			if (baseKey) {
				StorageService.importFromKey(f.key, baseKey as string);
				localStorage.removeItem(f.key);
			}
		});
		showToast("Data recovered!", "success");
		loadData();
	};

	const recalculateBalances = async (
		startDateArg?: string | any,
		endDateArg?: string | any,
	) => {
		// If called from onClick={recalculateBalances}, the first arg is a MouseEvent.
		// We only want to process if they are actual date strings.
		const startDate =
			typeof startDateArg === "string" ? startDateArg : undefined;
		const endDate = typeof endDateArg === "string" ? endDateArg : undefined;

		// PROTECTION: Do not recalculate if we haven't synced with cloud yet and expect to
		if (profile.isLoggedIn && !profile.offlineMode && !hasSynced) {
			showToast("Wait for initial sync before recalculating", "alert");
			return;
		}

		// PROTECTION: Prevent recalculating if we have no transactions but have accounts
		// This handles cases where transactions might have failed to load or were cleared accidentally.
		if (
			transactions.length === 0 &&
			accounts.length > 0 &&
			!confirm(
				"You have 0 transactions. Recalculating will reset all balances to 0. Continue?",
			)
		) {
			return;
		}

		setIsSyncing(true);
		showToast("Recalculating balances...", "info");

		try {
			const accountUpdates = new Map<string, number>();
			const potUpdates = new Map<string, number>();
			const pocketUpdates = new Map<string, number>();

			// Initialize all to 0
			accounts.forEach((a) => accountUpdates.set(a.id, 0));
			pots.forEach((p) => potUpdates.set(p.id, 0));
			pockets.forEach((p) => pocketUpdates.set(p.id, 0));

			console.log("=== RECALCULATE START ===");
			console.log("Total transactions:", transactions.length);
			console.log("Total pots:", pots.length);
			console.log(
				"Pot IDs:",
				pots.map((p) => p.id),
			);

			// Filter and apply all transactions
			transactions.forEach((t) => {
				const txDateStr = normalizeDate(t.date);
				if (startDate && txDateStr < normalizeDate(startDate)) return;
				if (endDate && txDateStr > normalizeDate(endDate)) return;

				for (const [id, delta] of computeAccountTransactionAmount(t, 1, accounts, usdRate)) {
					accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
				}
				for (const [id, delta] of computeBudgetConsumption(t, 1, pots)) {
					potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
				}
				for (const [id, delta] of computeSavingsMovement(t, 1, pockets)) {
					pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
				}
			});

			// Apply Updates
			const updatedAccounts = accounts.map((a) => ({
				...a,
				balance: accountUpdates.get(a.id) ?? 0,
				updatedAt: new Date().toISOString(),
			}));

			const updatedPots = pots.map((p) => {
				const used = potUpdates.get(p.id) ?? 0;
				return {
					...p,
					usedAmount: used,
					amountLeft: p.limitAmount - used,
					updatedAt: new Date().toISOString(),
				};
			});

			const updatedPockets = pockets.map((p) => ({
				...p,
				currentAmount: pocketUpdates.get(p.id) ?? 0,
				updatedAt: new Date().toISOString(),
			}));

			setAccounts(updatedAccounts);
			setPots(updatedPots);
			setPockets(updatedPockets);

			StorageService.saveAccounts(updatedAccounts);
			StorageService.savePots(updatedPots);
			StorageService.savePockets(updatedPockets);

			if (isCloudEnabled && !startDate && !endDate) {
				// Batch update only the affected columns to prevent overwriting other sheet data
				// We only sync to cloud if this was a full recalculation (no date filters)
				if (updatedAccounts.length > 0) {
					await SheetService.updateMany("Accounts", updatedAccounts, [
						"balance",
						"updatedAt",
					]);
				}
				// Batch update all pots
				if (updatedPots.length > 0) {
					await SheetService.updateMany("Pots", updatedPots, [
						"usedAmount",
						"amountLeft",
						"updatedAt",
					]);
				}
				// Batch update all pockets
				if (updatedPockets.length > 0) {
					await SheetService.updateMany("Pockets", updatedPockets, [
						"currentAmount",
						"updatedAt",
					]);
				}
			}

			showToast("Recalculation complete", "success");
		} catch (error) {
			console.error("Recalculation failed", error);
			showToast("Recalculation failed", "alert");
		} finally {
			setIsSyncing(false);
		}
	};

	const handleResetAndSync = async () => {
		if (!confirm("Reset local cache?")) return;
		setIsSyncing(true);
		const keysToKeep = [
			"google_access_token",
			"google_token_expiry",
			"google_refresh_token",
			"encrypted_vault_key",
			"device_id",
			StorageService.KEYS.PROFILE,
		];
		const saved: any = {};
		keysToKeep.forEach((k) => (saved[k] = localStorage.getItem(k)));
		localStorage.clear();
		keysToKeep.forEach((k) => saved[k] && localStorage.setItem(k, saved[k]));
		const cloudData = await SheetService.loadFromGoogleSheets(profile.email);
		if (cloudData) {
			if (cloudData.profile) {
				const mergedProfile = { ...profile, ...cloudData.profile };
				StorageService.saveProfile(mergedProfile);
				updateProfile(cloudData.profile);
			}
			// Note: we don't encrypt here because they are already encrypted in Sheets
			StorageService.saveAccounts(cloudData.accounts);
			StorageService.saveTransactions(cloudData.transactions);
			StorageService.saveCategories(cloudData.categories);
			StorageService.saveGoals(cloudData.goals);
			StorageService.saveSubscriptions(cloudData.subscriptions || []);
			StorageService.savePots(cloudData.pots || []);
			StorageService.savePockets(cloudData.pockets || []);
			StorageService.saveChatSessions(cloudData.chatSessions || []);
			loadData();
			showToast("Sync reset complete", "success");
		}
		setIsSyncing(false);
	};

	const getTotalValueReceived = (tx: Transaction) => {
		if (tx.isSubsidized && tx.marketValue) {
			return tx.marketValue;
		}
		return tx.amount;
	};

	const calculateGXBankInterest = (
		balance: number,
		pocketType: "SAVING_POCKET" | "BONUS_POCKET",
		tenureMonths?: 2 | 3,
	) => {
		if (balance < 500) return 0;
		const effectiveBalance = Math.min(balance, 25000);

		const baseRate = 0.02; // 2%
		let bonusRate = 0;

		if (pocketType === "BONUS_POCKET") {
			if (tenureMonths === 2)
				bonusRate = 0.0058; // 0.58%
			else if (tenureMonths === 3) bonusRate = 0.02; // 2%
		}

		const rate = baseRate + bonusRate;
		return (effectiveBalance * rate) / 365;
	};

	return (
		<DataContext.Provider
			value={{
				accounts,
				transactions,
				categories,
				goals,
				subscriptions,
				pots,
				pockets,
				chatSessions,
				usdRate,
				cryptoPrices,
				displayCurrency,
				setDisplayCurrency,
				privacyMode,
				setPrivacyMode,
				isVaultEnabled,
				isVaultCreated,
				isVaultUnlocked,
				unlockVaultWithTOTP,
				unlockVaultWithBiometrics,
				enableBiometricUnlock,
				lockVault,
				enableVault,
				disableVault,
				maskAmount,
				maskText,
				exchangeRate,
				isSyncing,
				toast,
				showToast,
				syncData,
				handleSelectExistingSheet,
				loadData,
				setAccounts,
				setTransactions,
				setCategories,
				setGoals,
				setSubscriptions,
				setPots,
				setPockets,
				setChatSessions,
				handleTransactionSubmit,
				handleBulkTransactionImport,
				handleBatchTransactionEdit,
				handleMigrateData,
				handleResetAndSync,
				getTotalValueReceived,
				calculateGXBankInterest,
				recalculateBalances,
			}}
		>
			{children}
		</DataContext.Provider>
	);
};
