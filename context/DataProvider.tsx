import React, { useState, useEffect } from "react";
import * as StorageService from "../services/storage.services";
import * as SheetService from "../services/sheets.services";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import { getCryptoPrices, CryptoPrices } from "../services/coin.services";
import { normalizeDate, parseDateSafe } from "../helpers/transactions.helper";
import {
  Account,
  Category,
  Transaction,
  Goal,
  Subscription,
  Pot,
  ChatSession,
  TransactionType,
  ExchangeRateData,
} from "../types";
import { DataContext } from "./DataContext";
import * as SecurityService from "../services/security.services";

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile, loginWithGoogle, isInitialized, updateProfile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [usdRate, setUsdRate] = useState<number>(4.45);
  const [cryptoPrices, setCryptoPrices] = useState<CryptoPrices>({
    BTC: 65000,
    ETH: 3500,
  });
  const [displayCurrency, setDisplayCurrency] = useState<"MYR" | "USD">("MYR");
  const [exchangeRate, setExchangeRate] = useState<ExchangeRateData | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = React.useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "alert" | "info";
  } | null>(null);

  // Vault/Security State
  const [vaultPassword, setVaultPassword] = useState<string | null>(
    localStorage.getItem("vault_password_session") || null,
  );

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
  const isVaultEnabled = checkBool(profile.isVaultEnabled);
  const isVaultCreated = checkBool(profile.isVaultCreated);
  const isVaultLockedSetting = checkBool(profile.isVaultLocked);

  const isCloudEnabled = !profile.offlineMode && SheetService.isClientReady();

  const getVaultSalt = () => {
    if (profile.vaultSalt) return profile.vaultSalt;
    const newSalt = Math.random().toString(36).substring(2, 15);
    updateProfile({ vaultSalt: newSalt });
    return newSalt;
  };

  const setPrivacyMode = (value: boolean) => {
    updateProfile({ privacyMode: value });
  };

  const encryptAccount = async (
    acc: Account,
    customPass?: string,
    customSalt?: string,
  ): Promise<Account> => {
    if (!profile.isVaultEnabled || !acc.details) return acc;

    // If already encrypted, don't double encrypt
    if (typeof acc.details === "string" && acc.details.startsWith("ENC:")) {
      return acc;
    }

    const passToUse = customPass || vaultPassword;
    // If vault is enabled but we have no password, we are in a dangerous state.
    // If we have a plain object, we MUST NOT return it as is, otherwise it leaks to Sheets.
    if (!passToUse) {
      console.warn(
        "Vault is enabled but no password set. Preserving plain data locally only, but masking for sync safety.",
      );
      // For sync safety, if we're about to return this for a sheet save,
      // we might want to return something that isn't the full object if we can't encrypt it.
      // However, the real fix is to make sure we don't save to sheets if not encrypted.
      // For now, let's just return the object and we will handle the "isEncrypted" check in the save handlers.
      return acc;
    }

    const salt = customSalt || getVaultSalt();
    try {
      const encryptedDetails = await SecurityService.encryptData(
        JSON.stringify(acc.details),
        passToUse,
        salt,
      );
      return { ...acc, details: encryptedDetails as any };
    } catch (e) {
      console.error("Encryption failed", e);
      return acc;
    }
  };

  const isVaultUnlocked =
    !!vaultPassword && isVaultEnabled && !isVaultLockedSetting;

  const normalizeAccount = (acc: any): Account => {
    // If details is a string but not encrypted, parse it
    if (
      typeof acc.details === "string" &&
      acc.details.trim().startsWith("{") &&
      !acc.details.startsWith("ENC:")
    ) {
      try {
        acc = { ...acc, details: JSON.parse(acc.details) };
      } catch (e) {
        console.warn("Failed to parse raw details JSON", e);
      }
    }

    // Ensure details is either an object or an encrypted string
    if (
      acc.details &&
      typeof acc.details === "string" &&
      !acc.details.startsWith("ENC:")
    ) {
      acc.details = {};
    } else if (!acc.details) {
      acc.details = {};
    }

    // Migration: If sensitive fields are at top level, move them to details if details is empty
    const sensitiveFields = [
      "accountNumber",
      "cardNumber",
      "cvv",
      "expiry",
      "holderName",
      "note",
    ];
    let hasSensitiveAtTop = false;
    const details = (
      typeof acc.details === "object" ? { ...acc.details } : {}
    ) as any;

    sensitiveFields.forEach((f) => {
      if (acc[f]) {
        if (!details[f]) details[f] = acc[f];
        delete acc[f];
        hasSensitiveAtTop = true;
      }
    });

    if (hasSensitiveAtTop && Object.keys(details).length > 0) {
      return { ...acc, details };
    }
    return acc;
  };

  const encryptVaultPassword = async (password: string): Promise<string> => {
    const salt = getVaultSalt();
    return await SecurityService.encryptData(password, password, salt);
  };

  const unlockVault = async (password: string): Promise<boolean> => {
    try {
      const encryptedPassword = await encryptVaultPassword(password);

      // Find the first encrypted account to verify the password
      const firstEncryptedAccount = accounts.find(
        (acc) =>
          acc.details &&
          typeof acc.details === "string" &&
          acc.details.startsWith("ENC:"),
      );

      if (
        !firstEncryptedAccount ||
        typeof firstEncryptedAccount.details !== "string"
      ) {
        // If no encrypted accounts, we accept the password as is (first time or empty vault)
        setVaultPassword(encryptedPassword);
        localStorage.setItem("vault_password_session", encryptedPassword);
        // Also save to remembered if user chooses (this should be tied to a 'remember me' logic)
        // For now, we update it if it exists to keep it sync'd
        if (localStorage.getItem("vault_password_remembered")) {
          localStorage.setItem("vault_password_remembered", encryptedPassword);
        }
        updateProfile({ isVaultLocked: false });
        return true;
      }

      const decryptedDetails = await SecurityService.decryptData(
        firstEncryptedAccount.details,
        password,
        getVaultSalt(),
      );

      if (decryptedDetails) {
        setVaultPassword(encryptedPassword);
        localStorage.setItem("vault_password_session", encryptedPassword);
        if (localStorage.getItem("vault_password_remembered")) {
          localStorage.setItem("vault_password_remembered", encryptedPassword);
        }
        await loadData(encryptedPassword);
        updateProfile({ isVaultLocked: false });
        return true;
      }
    } catch (error) {
      console.error("Failed to unlock vault:", error);
    }
    return false;
  };

  const enableVault = async (password: string) => {
    const encryptedPassword = await encryptVaultPassword(password);
    setVaultPassword(encryptedPassword);
    localStorage.setItem("vault_password_session", encryptedPassword);
    const deviceId = StorageService.getDeviceId();
    const currentDevices = profile.devices || [];
    const newDevices = currentDevices.includes(deviceId)
      ? currentDevices
      : [...currentDevices, deviceId];

    updateProfile({
      isVaultEnabled: true,
      isVaultCreated: true,
      devices: newDevices,
    });

    // Encrypt all current accounts and save
    const encryptedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        if (acc.details && typeof acc.details === "object") {
          const salt = getVaultSalt();
          const encryptedStr = await SecurityService.encryptData(
            JSON.stringify(acc.details),
            password,
            salt,
          );
          return { ...acc, details: encryptedStr as any };
        }
        return acc;
      }),
    );
    StorageService.saveAccounts(encryptedAccounts);

    // RESTORE LOGIC: If we have credentials in cloud and we are trusted, restore local state
    if (
      (profile.biometricCredIds?.length || profile.biometricCredId) &&
      profile.devices?.includes(StorageService.getDeviceId())
    ) {
      if (!localStorage.getItem("biometric_cred_ids")) {
        const ids = profile.biometricCredIds?.length
          ? profile.biometricCredIds
          : profile.biometricCredId
            ? [profile.biometricCredId]
            : [];
        if (ids.length > 0) {
          localStorage.setItem("biometric_cred_ids", JSON.stringify(ids));
        }
      }
      // Since we just enabled (created a password), update the remembered password
      // This solves the issue of "First time login" message appearing on re-enable
      localStorage.setItem("vault_password_remembered", password);
    }

    // Register biometrics logic moved to UI components to allow meaningful Modals
    // instead of window.confirm blocking calls.
    if (await SecurityService.isBiometricRegistered()) {
      // If already registered (e.g. restored above), ensure password is updated
      localStorage.setItem("vault_password_remembered", password);
    }

    if (isCloudEnabled) {
      await SheetService.syncWithGoogleSheets(
        encryptedAccounts,
        transactions,
        categories,
        goals,
        subscriptions,
        pots,
        profile.syncChatToSheets ? chatSessions : undefined,
      );
    }
  };

  const lockVault = () => {
    setVaultPassword(null);
    localStorage.removeItem("vault_password_session");
    // We keep vault_password_remembered if they chose to "remember" for biometrics
    showToast("Vault locked", "info");
    updateProfile({ isVaultLocked: true });
    loadData(null); // Explicitly pass null to skip decryption
  };

  const disableVault = async () => {
    // Decrypt all before disabling
    const decryptedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        if (
          acc.details &&
          typeof acc.details === "string" &&
          acc.details.startsWith("ENC:")
        ) {
          const salt = getVaultSalt();
          try {
            const decryptedStr = await SecurityService.decryptData(
              acc.details,
              vaultPassword || "",
              salt,
            );
            return { ...acc, details: JSON.parse(decryptedStr) };
          } catch (e) {
            return acc;
          }
        }
        return acc;
      }),
    );
    updateProfile({ isVaultEnabled: false });
    setVaultPassword(null);
    localStorage.removeItem("vault_password_session");
    localStorage.removeItem("vault_password_remembered");
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
        profile.syncChatToSheets ? chatSessions : undefined,
      );
    }
  };

  const decryptAccount = async (
    acc: Account,
    customPass?: string | null,
    customSalt?: string,
  ): Promise<Account> => {
    if (
      !acc.details ||
      typeof acc.details !== "string" ||
      !acc.details.startsWith("ENC:")
    )
      return acc;

    const passToUse = customPass === null ? null : customPass || vaultPassword;
    if (!passToUse) return acc;

    const salt = customSalt || getVaultSalt();
    try {
      const decryptedStr = await SecurityService.decryptData(
        acc.details,
        passToUse,
        salt,
      );
      return { ...acc, details: JSON.parse(decryptedStr) };
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
            const verified = await SecurityService.verifyWithBiometrics(
              profile.biometricCredIds || profile.biometricCredId,
            );
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
            const verified = await SecurityService.verifyWithBiometrics(
              profile.biometricCredIds || profile.biometricCredId,
            );
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
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async (overridePass?: string | null) => {
    const storedAccounts = StorageService.getStoredAccounts();
    // Decrypt and normalize accounts
    const decryptedAccounts = await Promise.all(
      storedAccounts.map(async (a) => {
        const decrypted = await decryptAccount(a, overridePass);
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
    processSubscriptions(storedSubs, loadedTxs);
  };

  useEffect(() => {
    loadData();
    getUSDToMYRRate().then((data) => {
      setExchangeRate(data);
      setUsdRate(data.rate);
    });
    getCryptoPrices().then((prices) => {
      setCryptoPrices(prices);
    });
  }, [profile.id]);

  useEffect(() => {
    if (profile.isLoggedIn && isInitialized && !profile.offlineMode) {
      syncData();
    }
  }, [profile.isLoggedIn, isInitialized, profile.offlineMode]);

  useEffect(() => {
    if (checkBool(profile.isVaultLocked) && vaultPassword) {
      console.log("Vault locked from remote update/sync");
      setVaultPassword(null);
      localStorage.removeItem("vault_password_session");
      loadData(null);
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
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
        return { ...sub, nextPaymentDate: nextDateStr };
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
              updatedAt: Date.now(),
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
    syncInProgress.current = true;
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
        // Sync Profile if available
        let activeProfile = { ...profile };
        if (cloudData.profile) {
          const updates: any = {};

          // Scalar fields - prefer Cloud
          if (
            cloudData.profile.isVaultEnabled !== undefined &&
            cloudData.profile.isVaultEnabled !== profile.isVaultEnabled
          ) {
            updates.isVaultEnabled = cloudData.profile.isVaultEnabled;
          }
          if (
            cloudData.profile.isVaultCreated !== undefined &&
            cloudData.profile.isVaultCreated !== profile.isVaultCreated
          ) {
            updates.isVaultCreated = cloudData.profile.isVaultCreated;
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
            updates.isVaultLocked = cloudData.profile.isVaultLocked;
          }
          if (
            cloudData.profile.privacyMode !== undefined &&
            cloudData.profile.privacyMode !== profile.privacyMode
          ) {
            updates.privacyMode = cloudData.profile.privacyMode;
          }

          // Array fields - Merge Cloud and Local
          const existingIds = profile.biometricCredIds || [];
          const cloudIds = cloudData.profile.biometricCredIds || [];
          const mergedBio = Array.from(new Set([...existingIds, ...cloudIds]));

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
            activeProfile = { ...profile, ...updates };
            updateProfile(updates, true);
          }
        }

        const merge = <T extends { id: string; updatedAt?: number }>(
          local: T[],
          cloud: T[],
        ): T[] => {
          const map = new Map<string, T>();
          cloud.forEach((i) => i.id && map.set(String(i.id), i));
          local.forEach((i) => {
            const id = String(i.id);
            if (map.has(id)) {
              if ((i.updatedAt || 0) > (map.get(id)!.updatedAt || 0))
                map.set(id, i);
            } else if (i.id) map.set(id, i);
          });
          return Array.from(map.values());
        };

        const currentPass =
          vaultPassword || localStorage.getItem("vault_password_session");
        const currentSalt = activeProfile.vaultSalt;

        const cloudAccounts = await Promise.all(
          (cloudData.accounts || []).map(async (a: Account) => {
            const decrypted = await decryptAccount(
              a,
              currentPass || undefined,
              currentSalt,
            );
            return normalizeAccount(decrypted);
          }),
        );

        const localAccountsRaw = StorageService.getStoredAccounts();
        const localAccounts = await Promise.all(
          localAccountsRaw.map(async (a) => {
            const decrypted = await decryptAccount(
              a,
              currentPass || undefined,
              currentSalt,
            );
            return normalizeAccount(decrypted);
          }),
        );

        const mergedAccounts = merge(localAccounts, cloudAccounts);
        setAccounts(mergedAccounts);

        // Encrypt for storage
        const encryptedAccounts = await Promise.all(
          mergedAccounts.map((a) =>
            encryptAccount(a, currentPass || undefined, currentSalt),
          ),
        );
        StorageService.saveAccounts(encryptedAccounts);

        const mergedCategories = merge(
          StorageService.getStoredCategories(),
          cloudData.categories,
        );
        setCategories(mergedCategories);
        StorageService.saveCategories(mergedCategories);

        const mergedTransactions = merge(
          StorageService.getStoredTransactions(),
          cloudData.transactions,
        );
        setTransactions(mergedTransactions);
        StorageService.saveTransactions(mergedTransactions);

        const mergedGoals = merge(
          StorageService.getStoredGoals(),
          cloudData.goals,
        );
        setGoals(mergedGoals);
        StorageService.saveGoals(mergedGoals);

        const mergedSubs = merge(
          StorageService.getStoredSubscriptions(),
          cloudData.subscriptions || [],
        );
        setSubscriptions(mergedSubs);
        StorageService.saveSubscriptions(mergedSubs);

        const mergedPots = merge(
          StorageService.getStoredPots(),
          cloudData.pots || [],
        );
        setPots(mergedPots);
        StorageService.savePots(mergedPots);

        const mergedChatSessions = merge(
          StorageService.getStoredChatSessions(),
          cloudData.chatSessions || [],
        );
        setChatSessions(mergedChatSessions);
        StorageService.saveChatSessions(mergedChatSessions);

        await SheetService.syncWithGoogleSheets(
          encryptedAccounts,
          mergedTransactions,
          mergedCategories,
          mergedGoals,
          mergedSubs,
          mergedPots,
          profile.syncChatToSheets ? mergedChatSessions : undefined,
        );
        processSubscriptions(mergedSubs, mergedTransactions);
        showToast("Cloud sync complete", "success");
      }
    } catch (e) {
      console.error("Sync failed", e);
      showToast("Cloud sync failed. Working offline.", "info");
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  };

  const handleAccountSave = async (acc: Omit<Account, "userId">) => {
    const isNew = !accounts.some((a) => a.id === acc.id);
    const accountWithUser = {
      ...acc,
      userId: profile.id || "local",
    } as Account;

    // Encrypt for external storage
    const encryptedAccount = await encryptAccount(accountWithUser);

    // CRITICAL: Safety check. If vault is enabled, we should NOT save to Sheets
    // if the details are still in plain object form.
    const isActuallyEncrypted =
      !isVaultEnabled ||
      !encryptedAccount.details ||
      (typeof encryptedAccount.details === "string" &&
        encryptedAccount.details.startsWith("ENC:"));

    let updated;
    if (isNew) {
      updated = [...accounts, accountWithUser];
      if (isCloudEnabled && isActuallyEncrypted)
        await SheetService.insertOne("Accounts", encryptedAccount);
    } else {
      updated = accounts.map((a) => (a.id === acc.id ? accountWithUser : a));
      if (isCloudEnabled && isActuallyEncrypted)
        await SheetService.updateOne("Accounts", acc.id, encryptedAccount);
    }
    setAccounts(updated);

    // Save encrypted to local storage
    const encryptedAccounts = await Promise.all(
      updated.map((a) => encryptAccount(a)),
    );
    StorageService.saveAccounts(encryptedAccounts);
    showToast("Account saved", "success");
  };

  const handleAccountDelete = async (id: string) => {
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);

    const encryptedAccounts = await Promise.all(
      updated.map((a) => encryptAccount(a)),
    );
    StorageService.saveAccounts(encryptedAccounts);

    if (isCloudEnabled) await SheetService.deleteOne("Accounts", id);
    showToast("Account deleted", "success");
  };

  const handleTransactionSubmit = async (tx: Omit<Transaction, "userId">) => {
    const oldTx = transactions.find((t) => t.id === tx.id);
    const isEdit = !!oldTx;
    const txWithUser = { ...tx, userId: profile.id || "local" } as Transaction;

    let updatedTransactions;
    if (isEdit) {
      updatedTransactions = transactions.map((t) =>
        t.id === tx.id ? txWithUser : t,
      );
      if (isCloudEnabled)
        await SheetService.updateOne("Transactions", tx.id, txWithUser);
    } else {
      updatedTransactions = [...transactions, txWithUser];
      if (isCloudEnabled)
        await SheetService.insertOne("Transactions", txWithUser);
    }
    setTransactions(updatedTransactions);
    StorageService.saveTransactions(updatedTransactions);

    const updatedAccounts = accounts.map((a) => {
      let balance = a.balance;
      let isChanged = false;

      const getConvertedAmount = (
        amount: number,
        txCurrency: string,
        accCurrency: string,
      ) => {
        if (txCurrency === accCurrency) return amount;
        if (txCurrency === "USD" && accCurrency === "MYR")
          return amount * usdRate;
        if (txCurrency === "MYR" && accCurrency === "USD")
          return amount / usdRate;
        return amount;
      };

      if (isEdit && oldTx) {
        const oldAmount = getConvertedAmount(
          oldTx.amount,
          oldTx.currency,
          a.currency,
        );
        if (a.id === oldTx.accountId) {
          isChanged = true;
          if (
            oldTx.type === TransactionType.INCOME ||
            oldTx.type === TransactionType.ACCOUNT_OPENING
          )
            balance -= oldAmount;
          else balance += oldAmount;
        }
        if (
          oldTx.type === TransactionType.TRANSFER &&
          a.id === oldTx.toAccountId
        ) {
          isChanged = true;
          balance -= oldAmount;
        }
      }

      const newAmount = getConvertedAmount(tx.amount, tx.currency, a.currency);
      if (a.id === tx.accountId) {
        isChanged = true;
        if (
          tx.type === TransactionType.INCOME ||
          tx.type === TransactionType.ACCOUNT_OPENING
        )
          balance += newAmount;
        else balance -= newAmount;
      }
      if (tx.type === TransactionType.TRANSFER && a.id === tx.toAccountId) {
        isChanged = true;
        balance += newAmount;
      }

      return isChanged ? { ...a, balance, updatedAt: Date.now() } : a;
    });

    setAccounts(updatedAccounts);
    StorageService.saveAccounts(updatedAccounts);

    if (tx.potId || (isEdit && oldTx?.potId)) {
      const updatedPots = pots.map((p) => {
        let newUsedAmount = p.usedAmount;

        if (isEdit && oldTx?.potId === p.id) {
          if (oldTx.type === TransactionType.INCOME)
            newUsedAmount -= oldTx.amount;
          else newUsedAmount += oldTx.amount;
        }

        if (tx.potId === p.id) {
          if (tx.type === TransactionType.INCOME) newUsedAmount += tx.amount;
          else newUsedAmount -= tx.amount;
        }

        if (newUsedAmount !== p.usedAmount) {
          const updated = {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
          };
          if (isCloudEnabled) SheetService.updateOne("Pots", p.id, updated);
          return updated;
        }
        return p;
      });
      setPots(updatedPots);
      StorageService.savePots(updatedPots);
    }

    showToast("Transaction saved", "success");
  };

  const handleTransactionDelete = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      const updatedAccounts = accounts.map((a) => {
        const amount =
          tx.currency === a.currency
            ? tx.amount
            : tx.currency === "USD"
              ? tx.amount * usdRate
              : tx.amount / usdRate;

        if (a.id === tx.accountId) {
          let balanceRestore = 0;
          if (
            tx.type === TransactionType.INCOME ||
            tx.type === TransactionType.ACCOUNT_OPENING
          )
            balanceRestore = -amount;
          else balanceRestore = amount;
          return {
            ...a,
            balance: a.balance + balanceRestore,
            updatedAt: Date.now(),
          };
        }
        if (tx.type === TransactionType.TRANSFER && a.id === tx.toAccountId) {
          return { ...a, balance: a.balance - amount, updatedAt: Date.now() };
        }
        return a;
      });
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);

      if (tx.potId) {
        const updatedPots = pots.map((p) => {
          if (p.id === tx.potId) {
            let balanceRestore = 0;
            if (tx.type === TransactionType.INCOME) balanceRestore = -tx.amount;
            else balanceRestore = tx.amount;
            const newUsedAmount = p.usedAmount + balanceRestore;
            const updatedPot = {
              ...p,
              usedAmount: newUsedAmount,
              amountLeft: p.limitAmount - newUsedAmount,
            };
            if (isCloudEnabled)
              SheetService.updateOne("Pots", p.id, updatedPot);
            return updatedPot;
          }
          return p;
        });
        setPots(updatedPots);
        StorageService.savePots(updatedPots);
      }
    }
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    StorageService.saveTransactions(updated);
    if (isCloudEnabled) await SheetService.deleteOne("Transactions", id);
    showToast("Transaction deleted", "success");
  };

  const handleCategorySave = async (cat: Omit<Category, "userId">) => {
    const isEdit = categories.some((c) => c.id === cat.id);
    const catWithUser = { ...cat, userId: profile.id || "local" } as Category;
    const updated = isEdit
      ? categories.map((c) => (c.id === cat.id ? catWithUser : c))
      : [...categories, catWithUser];
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (isCloudEnabled) {
      if (isEdit)
        await SheetService.updateOne("Categories", cat.id, catWithUser);
      else await SheetService.insertOne("Categories", catWithUser);
    }
    showToast("Category saved", "success");
  };

  const handleCategoryDelete = async (id: string) => {
    const updated = categories.filter((c) => c.id !== id);
    setCategories(updated);
    StorageService.saveCategories(updated);
    if (isCloudEnabled) await SheetService.deleteOne("Categories", id);
    showToast("Category deleted", "success");
  };

  const handleGoalUpdate = async (goal: Omit<Goal, "userId">) => {
    const isEdit = goals.some((g) => g.id === goal.id);
    const goalWithUser = { ...goal, userId: profile.id || "local" } as Goal;
    const updated = isEdit
      ? goals.map((g) => (g.id === goal.id ? goalWithUser : g))
      : [...goals, goalWithUser];
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (isCloudEnabled) {
      if (isEdit) await SheetService.updateOne("Goals", goal.id, goalWithUser);
      else await SheetService.insertOne("Goals", goalWithUser);
    }
    showToast("Goal updated", "success");
  };

  const handleGoalDelete = async (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    StorageService.saveGoals(updated);
    if (isCloudEnabled) await SheetService.deleteOne("Goals", id);
    showToast("Goal deleted", "success");
  };

  const handlePotSave = async (pot: Omit<Pot, "userId">) => {
    const isEdit = pots.some((p) => p.id === pot.id);
    const amountLeft = pot.limitAmount - pot.usedAmount;
    const potWithUser = {
      ...pot,
      amountLeft,
      userId: profile.id || "local",
    } as Pot;
    const updated = isEdit
      ? pots.map((p) => (p.id === pot.id ? potWithUser : p))
      : [...pots, potWithUser];
    setPots(updated);
    StorageService.savePots(updated);
    if (isCloudEnabled) {
      if (isEdit) await SheetService.updateOne("Pots", pot.id, potWithUser);
      else await SheetService.insertOne("Pots", potWithUser);
    }
    showToast("Pot saved", "success");
  };

  const handlePotDelete = async (id: string) => {
    const updated = pots.filter((p) => p.id !== id);
    setPots(updated);
    StorageService.savePots(updated);
    if (isCloudEnabled) await SheetService.deleteOne("Pots", id);
    showToast("Pot deleted", "success");
  };

  const handleAddSubscription = async (sub: Omit<Subscription, "userId">) => {
    const currentUserId = profile.id || "guest";
    const newSub: Subscription = { ...sub, userId: currentUserId };
    const updated = [...subscriptions, newSub];
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
    if (isCloudEnabled) await SheetService.insertOne("Subscriptions", newSub);
    showToast("Subscription added", "success");
  };

  const handleDeleteSubscription = async (id: string) => {
    const updated = subscriptions.filter((s) => s.id !== id);
    setSubscriptions(updated);
    StorageService.saveSubscriptions(updated);
    if (isCloudEnabled) await SheetService.deleteOne("Subscriptions", id);
  };

  const handleSaveChatSession = async (session: ChatSession) => {
    const isEdit = chatSessions.some((s) => s.id === session.id);
    const updated = isEdit
      ? chatSessions.map((s) => (s.id === session.id ? session : s))
      : [...chatSessions, session];
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
    if (isCloudEnabled && profile.syncChatToSheets) {
      if (isEdit)
        await SheetService.updateOne("ChatSessions", session.id, session);
      else await SheetService.insertOne("ChatSessions", session);
    }
  };

  const handleDeleteChatSession = async (id: string) => {
    const updated = chatSessions.filter((s) => s.id !== id);
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
    if (isCloudEnabled && profile.syncChatToSheets) {
      await SheetService.deleteOne("ChatSessions", id);
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
      StorageService.saveChatSessions(cloudData.chatSessions || []);
      loadData();
      showToast("Sync reset complete", "success");
    }
    setIsSyncing(false);
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
        unlockVault,
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
        loadData,
        setAccounts,
        setTransactions,
        setCategories,
        setGoals,
        setSubscriptions,
        setPots,
        setChatSessions,
        handleAccountSave,
        handleAccountDelete,
        handleTransactionSubmit,
        handleTransactionDelete,
        handleCategorySave,
        handleCategoryDelete,
        handleGoalUpdate,
        handleGoalDelete,
        handlePotSave,
        handlePotDelete,
        handleAddSubscription,
        handleDeleteSubscription,
        handleSaveChatSession,
        handleDeleteChatSession,
        handleMigrateData,
        handleResetAndSync,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
