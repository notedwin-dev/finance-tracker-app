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
  SavingPocket,
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
  const [pockets, setPockets] = useState<SavingPocket[]>([]);
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
  const [hasSynced, setHasSynced] = useState(false);
  const syncInProgress = React.useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "alert" | "info";
  } | null>(null);

  // Vault/Security State
  const [vaultPassword, setVaultPassword] = useState<string | null>(() => {
    // Try sessionStorage first (active tab)
    let session = sessionStorage.getItem("vault_password_session");
    if (!session) {
      // Fallback to legacy localStorage session check for smoother migration
      session = localStorage.getItem("vault_password_session");
      if (session) {
        // Move to sessionStorage and clean up
        sessionStorage.setItem("vault_password_session", session);
        localStorage.removeItem("vault_password_session");
      }
    }
    return session;
  });

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
    if (!isVaultEnabled || !acc.details) return acc;

    // If already encrypted, don't double encrypt
    if (typeof acc.details === "string" && acc.details.startsWith("ENC:")) {
      return acc;
    }

    const passToUse =
      customPass ||
      vaultPassword ||
      sessionStorage.getItem("vault_password_session") ||
      localStorage.getItem("vault_password_remembered");

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

  const unlockVault = async (password: string): Promise<boolean> => {
    try {
      const trimmedPass = password?.trim();
      if (!trimmedPass) return false;

      const salt = getVaultSalt();
      const iterationTries = [
        100000, 1000000, 10000, 5000, 2048, 1024, 1000, 256, 128, 1,
      ];

      // Try to find encrypted accounts to test against
      const testAccounts = accounts
        .filter(
          (acc) =>
            acc.details &&
            typeof acc.details === "string" &&
            acc.details.startsWith("ENC:"),
        )
        .slice(0, 3); // Test against up to 3 accounts for robustness

      if (testAccounts.length === 0) {
        // No encrypted data, just accept the password (use default 100k iterations for session)
        const hashedPass = password.startsWith("HASHED:")
          ? password
          : await SecurityService.hashPassword(password, salt, 100000);
        setVaultPassword(hashedPass);
        sessionStorage.setItem("vault_password_session", hashedPass);
        if (localStorage.getItem("vault_password_remembered")) {
          localStorage.setItem("vault_password_remembered", hashedPass);
        }
        updateProfile({ isVaultLocked: false });
        return true;
      }

      // Test trials
      const saltsToTry = [salt, ""];
      const storedProfile = StorageService.getStoredProfile();
      if (
        storedProfile.vaultSalt &&
        !saltsToTry.includes(storedProfile.vaultSalt)
      ) {
        saltsToTry.push(storedProfile.vaultSalt);
      }
      for (const s of saltsToTry) {
        // Try different iteration counts for the hashing phase if a raw password was provided
        const passwordsToTry = password.startsWith("HASHED:")
          ? [password]
          : await Promise.all(
              iterationTries.map((iters) =>
                SecurityService.hashPassword(trimmedPass, s, iters),
              ),
            );

        // Also try the raw password itself
        if (!password.startsWith("HASHED:")) {
          passwordsToTry.push(trimmedPass);
        }

        for (let i = 0; i < passwordsToTry.length; i++) {
          const trialPass = passwordsToTry[i];
          const itersLabel =
            i < iterationTries.length ? iterationTries[i] : "raw";

          // Test trialPass against our set of encrypted accounts
          for (const testAcc of testAccounts) {
            const decryptedStr = await SecurityService.decryptData(
              testAcc.details as string,
              trialPass,
              s,
            );

            if (decryptedStr) {
              try {
                JSON.parse(decryptedStr);
                console.log(
                  `Vault unlocked using salt: "${s}" and iters: ${itersLabel}`,
                );

                // Successfully unlocked!
                const workingPass = trialPass;
                const workingSalt = s;
                const targetHashedPass = password.startsWith("HASHED:")
                  ? password
                  : passwordsToTry[0]; // 100k version with whatever salt worked

                setVaultPassword(targetHashedPass);
                sessionStorage.setItem(
                  "vault_password_session",
                  targetHashedPass,
                );
                if (localStorage.getItem("vault_password_remembered")) {
                  localStorage.setItem(
                    "vault_password_remembered",
                    targetHashedPass,
                  );
                }

                // Update profile if we found a better salt or need to persist this one
                if (s !== profile.vaultSalt) {
                  updateProfile({ vaultSalt: s });
                }

                await loadData(workingPass);

                // MIGRATION logic below...
                if (workingPass !== targetHashedPass) {
                  console.log(
                    "Migrating vault data to standard 100k iterations...",
                  );
                  const loadedAccounts = StorageService.getStoredAccounts();
                  const migratedAccounts = await Promise.all(
                    loadedAccounts.map(async (acc) => {
                      const decrypted = await decryptAccount(
                        acc,
                        workingPass,
                        workingSalt,
                      );
                      if (
                        decrypted.details &&
                        typeof decrypted.details === "object"
                      ) {
                        const reEncrypted = await SecurityService.encryptData(
                          JSON.stringify(decrypted.details),
                          targetHashedPass,
                          salt, // The target salt (standard one stored in profile)
                        );
                        return { ...acc, details: reEncrypted as any };
                      }
                      return acc;
                    }),
                  );
                  setAccounts(migratedAccounts);
                  StorageService.saveAccounts(migratedAccounts);
                  if (isCloudEnabled) {
                    await SheetService.syncWithGoogleSheets(
                      migratedAccounts,
                      transactions,
                      categories,
                      goals,
                      subscriptions,
                      pots,
                      pockets,
                      profile.syncChatToSheets ? chatSessions : undefined,
                    );
                  }
                }

                updateProfile({ isVaultLocked: false });
                return true;
              } catch (e) {
                continue;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to unlock vault:", error);
    }
    return false;
  };

  const enableVault = async (password: string) => {
    const salt = getVaultSalt();
    const hashedPass = await SecurityService.hashPassword(password, salt);

    setVaultPassword(hashedPass);
    sessionStorage.setItem("vault_password_session", hashedPass);
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
          const encryptedStr = await SecurityService.encryptData(
            JSON.stringify(acc.details),
            hashedPass,
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
      localStorage.setItem("vault_password_remembered", hashedPass);
    }

    // Register biometrics logic moved to UI components to allow meaningful Modals
    // instead of window.confirm blocking calls.
    if (await SecurityService.isBiometricRegistered()) {
      // If already registered (e.g. restored above), ensure password is updated
      localStorage.setItem("vault_password_remembered", hashedPass);
    }

    if (isCloudEnabled) {
      await SheetService.syncWithGoogleSheets(
        encryptedAccounts,
        transactions,
        categories,
        goals,
        subscriptions,
        pots,
        pockets,
        profile.syncChatToSheets ? chatSessions : undefined,
      );
    }
  };

  const lockVault = () => {
    setVaultPassword(null);
    localStorage.removeItem("vault_password_session");
    sessionStorage.removeItem("vault_password_session");
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
    sessionStorage.removeItem("vault_password_session");
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
        pockets,
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

    const passToUse =
      customPass === null
        ? null
        : customPass ||
          vaultPassword ||
          sessionStorage.getItem("vault_password_session") ||
          localStorage.getItem("vault_password_remembered");
    if (!passToUse) return acc;

    const salt = customSalt || getVaultSalt();
    try {
      const decryptedStr = await SecurityService.decryptData(
        acc.details,
        passToUse,
        salt,
      );
      if (!decryptedStr) return acc;
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
  };

  useEffect(() => {
    setHasSynced(false);
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
    if (checkBool(profile.isVaultLocked) && vaultPassword) {
      console.log("Vault locked from remote update/sync");
      setVaultPassword(null);
      localStorage.removeItem("vault_password_session");
      sessionStorage.removeItem("vault_password_session");
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
          subscriptionId: sub.id,
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
        return { ...sub, nextPaymentDate: nextDateStr, updatedAt: Date.now() };
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

          if (
            cloudData.profile.name &&
            cloudData.profile.name !== profile.name
          ) {
            updates.name = cloudData.profile.name;
          }

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
            // Only accept a "locked" state from cloud if we aren't currently holding a password.
            // If we have a password (either in state or sessionStorage), we are definitively UNLOCKED.
            const isActuallyUnlocked =
              !!vaultPassword ||
              !!sessionStorage.getItem("vault_password_session");
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
            activeProfile = { ...profile, ...updates };
            updateProfile(updates, true);
          }
        }

        const merge = <T extends { id: string; updatedAt?: any }>(
          local: T[],
          cloud: T[],
        ): T[] => {
          const map = new Map<string, T>();
          const now = Date.now();

          // 1. Load all Cloud data into the map.
          // We ALWAYS trust cloud data as the baseline for safety.
          cloud.forEach((i) => {
            if (i.id) {
              const id = String(i.id);
              const cloudUpdated = Number(i.updatedAt || 0);
              map.set(id, {
                ...i,
                updatedAt: cloudUpdated === 0 ? now : cloudUpdated || now,
              });
            }
          });

          // 2. Merge local data
          local.forEach((i) => {
            const id = String(i.id);
            const localUpdated = Number(i.updatedAt || 0);

            if (map.has(id)) {
              const cloudItem = map.get(id)!;
              const cloudUpdated = Number(cloudItem.updatedAt || 0);
              // Last Write Wins. On tie, prefer Cloud.
              if (localUpdated > cloudUpdated) {
                map.set(id, {
                  ...i,
                  updatedAt: localUpdated === 0 ? now : localUpdated || now,
                });
              }
            } else if (i.id) {
              // Item is local-only. Add it to the map to be uploaded to cloud.
              map.set(id, {
                ...i,
                updatedAt: localUpdated === 0 ? now : localUpdated || now,
              });
            }
          });
          return Array.from(map.values());
        };

        const currentPass =
          vaultPassword ||
          sessionStorage.getItem("vault_password_session") ||
          localStorage.getItem("vault_password_remembered") ||
          localStorage.getItem("vault_password_session");

        if (currentPass && !vaultPassword) {
          setVaultPassword(currentPass);
        }
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

        const mergedPockets = merge(
          StorageService.getStoredPockets(),
          cloudData.pockets || [],
        );
        setPockets(mergedPockets);
        StorageService.savePockets(mergedPockets);

        const mergedChatSessions = merge(
          StorageService.getStoredChatSessions(),
          cloudData.chatSessions || [],
        );
        setChatSessions(mergedChatSessions);
        StorageService.saveChatSessions(mergedChatSessions);

        const syncTimestamp = Date.now();
        await SheetService.syncWithGoogleSheets(
          encryptedAccounts,
          mergedTransactions,
          mergedCategories,
          mergedGoals,
          mergedSubs,
          mergedPots,
          mergedPockets,
          profile.syncChatToSheets ? mergedChatSessions : undefined,
          { ...activeProfile, lastSyncAt: syncTimestamp },
        );
        processSubscriptions(mergedSubs, mergedTransactions);

        // Update sync status and timestamp
        updateProfile({ lastSyncAt: syncTimestamp }, false);
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

  const handleAccountSave = async (acc: Omit<Account, "userId">) => {
    const isNew = !accounts.some((a) => a.id === acc.id);
    const accountWithUser = {
      ...acc,
      userId: profile.id || "local",
      updatedAt: Date.now(), // Always update timestamp on save to prevent stale cloud overwrites
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
              updatedAt: Date.now(),
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
      updatedAt: Date.now(),
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
        updatedAt: Date.now(),
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
        updatedAt: Date.now(),
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
            updatedAt: Date.now(),
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

    const accountUpdates = new Map<string, number>();
    const potUpdates = new Map<string, number>();
    const pocketUpdates = new Map<string, number>();

    const applyLegToBalances = (t: Transaction, factor: 1 | -1) => {
      if (t.isHistorical) return;

      // 1. Account Balance
      const acc = accounts.find((a) => a.id === t.accountId);
      if (acc) {
        const amt = getConvertedAmount(t.amount, t.currency, acc.currency);
        const fee = t.fee
          ? getConvertedAmount(t.fee, t.currency, acc.currency)
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

        // Legacy single-record transfer logic
        if (
          t.type === TransactionType.TRANSFER &&
          t.toAccountId &&
          !t.transferDirection &&
          !t.linkedTransactionId
        ) {
          const toAcc = accounts.find((a) => a.id === t.toAccountId);
          if (toAcc) {
            const toAmt = getConvertedAmount(
              t.amount,
              t.currency,
              toAcc.currency,
            );
            const toFee = t.fee
              ? getConvertedAmount(t.fee, t.currency, toAcc.currency)
              : 0;
            const addedAmount = feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
            accountUpdates.set(
              t.toAccountId,
              (accountUpdates.get(t.toAccountId) || 0) + addedAmount * factor,
            );
          }
        }
      }

      // 2. Pots
      if (t.potId) {
        let potDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          potDelta = -t.amount * factor;
        } else {
          potDelta = t.amount * factor;
        }
        potUpdates.set(t.potId, (potUpdates.get(t.potId) || 0) + potDelta);
      }

      // 3. Pockets
      if (t.savingPocketId) {
        const sourceAmount = t.amount;
        let pocketDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          pocketDelta = t.amount * factor;
        } else {
          pocketDelta = -sourceAmount * factor;
        }
        pocketUpdates.set(
          t.savingPocketId,
          (pocketUpdates.get(t.savingPocketId) || 0) + pocketDelta,
        );
      }

      // Legacy single-record pocket logic
      if (
        t.type === TransactionType.TRANSFER &&
        t.toSavingPocketId &&
        !t.transferDirection &&
        !t.linkedTransactionId
      ) {
        const fee = t.fee || 0;
        const feeType = t.feeType || "INCLUSIVE";
        const targetAmount =
          feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
        pocketUpdates.set(
          t.toSavingPocketId,
          (pocketUpdates.get(t.toSavingPocketId) || 0) + targetAmount * factor,
        );
      }
    };

    // Calculate Partner for Restoration
    const oldPartner =
      oldTx && oldTx.linkedTransactionId
        ? transactions.find((t) => t.id === oldTx.linkedTransactionId)
        : null;

    // Restore old impacts
    if (oldTx) applyLegToBalances(oldTx, -1);
    if (oldPartner) applyLegToBalances(oldPartner, -1);

    // Apply new impacts
    applyLegToBalances(txWithUser, 1);
    if (partnerLeg) applyLegToBalances(partnerLeg, 1);

    // Deletions
    if (partnerIdToDelete) {
      const p = transactions.find((t) => t.id === partnerIdToDelete);
      if (p) applyLegToBalances(p, -1);
    }

    // Commit Updates
    if (accountUpdates.size > 0) {
      const updatedAccountList = accounts.map((a) => {
        if (accountUpdates.has(a.id)) {
          return {
            ...a,
            balance: a.balance + (accountUpdates.get(a.id) || 0),
            updatedAt: Date.now(),
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
          const newUsedAmount = p.usedAmount + (potUpdates.get(p.id) || 0);
          return {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
            updatedAt: Date.now(),
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
          const newCurrentAmount =
            p.currentAmount + (pocketUpdates.get(p.id) || 0);
          return {
            ...p,
            currentAmount: newCurrentAmount,
            updatedAt: Date.now(),
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

  const handleTransactionDelete = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    const idsToDelete = [id];
    const txsToProcess = [tx];

    // Check for linked partner
    if (tx.linkedTransactionId) {
      const partner = transactions.find((t) => t.id === tx.linkedTransactionId);
      if (partner) {
        idsToDelete.push(partner.id);
        txsToProcess.push(partner);
      }
    }

    const accountUpdates = new Map<string, number>();
    const potUpdates = new Map<string, number>();
    const pocketUpdates = new Map<string, number>();

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

    const applyLegToBalances = (t: Transaction, factor: 1 | -1) => {
      if (t.isHistorical) return;

      // 1. Account Balance
      const acc = accounts.find((a) => a.id === t.accountId);
      if (acc) {
        const amt = getConvertedAmount(t.amount, t.currency, acc.currency);
        const fee = t.fee
          ? getConvertedAmount(t.fee, t.currency, acc.currency)
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

        // Legacy single-record logic
        if (
          t.type === TransactionType.TRANSFER &&
          t.toAccountId &&
          !t.transferDirection &&
          !t.linkedTransactionId
        ) {
          const toAcc = accounts.find((a) => a.id === t.toAccountId);
          if (toAcc) {
            const toAmt = getConvertedAmount(
              t.amount,
              t.currency,
              toAcc.currency,
            );
            const toFee = t.fee
              ? getConvertedAmount(t.fee, t.currency, toAcc.currency)
              : 0;
            const addedAmount = feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
            accountUpdates.set(
              t.toAccountId,
              (accountUpdates.get(t.toAccountId) || 0) + addedAmount * factor,
            );
          }
        }
      }

      // 2. Pots
      if (t.potId) {
        let potDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          potDelta = -t.amount * factor;
        } else {
          potDelta = t.amount * factor;
        }
        potUpdates.set(t.potId, (potUpdates.get(t.potId) || 0) + potDelta);
      }

      // 3. Pockets
      if (t.savingPocketId) {
        const sourceAmount = t.amount;
        let pocketDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          pocketDelta = t.amount * factor;
        } else {
          pocketDelta = -sourceAmount * factor;
        }
        pocketUpdates.set(
          t.savingPocketId,
          (pocketUpdates.get(t.savingPocketId) || 0) + pocketDelta,
        );
      }

      // Legacy single-record pocket logic
      if (
        t.type === TransactionType.TRANSFER &&
        t.toSavingPocketId &&
        !t.transferDirection &&
        !t.linkedTransactionId
      ) {
        const fee = t.fee || 0;
        const feeType = t.feeType || "INCLUSIVE";
        const targetAmount =
          feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
        pocketUpdates.set(
          t.toSavingPocketId,
          (pocketUpdates.get(t.toSavingPocketId) || 0) + targetAmount * factor,
        );
      }
    };

    // Restore balances (-1 factor because we are deleting)
    txsToProcess.forEach((t) => applyLegToBalances(t, -1));

    // Update States
    if (accountUpdates.size > 0) {
      const updatedAccounts = accounts.map((a) => {
        if (accountUpdates.has(a.id)) {
          return {
            ...a,
            balance: a.balance + (accountUpdates.get(a.id) || 0),
            updatedAt: Date.now(),
          };
        }
        return a;
      });
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    if (potUpdates.size > 0) {
      const updatedPots = pots.map((p) => {
        if (potUpdates.has(p.id)) {
          const newUsedAmount = p.usedAmount + (potUpdates.get(p.id) || 0);
          return {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
            updatedAt: Date.now(),
          };
        }
        return p;
      });
      setPots(updatedPots);
      StorageService.savePots(updatedPots);

      // Batch update affected pots to cloud
      if (isCloudEnabled) {
        const affectedPots = updatedPots.filter((p) => potUpdates.has(p.id));
        if (affectedPots.length > 0) {
          await SheetService.updateMany("Pots", affectedPots);
        }
      }
    }

    if (pocketUpdates.size > 0) {
      const updatedPockets = pockets.map((p) => {
        if (pocketUpdates.has(p.id)) {
          const newCurrentAmount =
            p.currentAmount + (pocketUpdates.get(p.id) || 0);
          return {
            ...p,
            currentAmount: newCurrentAmount,
            updatedAt: Date.now(),
          };
        }
        return p;
      });
      setPockets(updatedPockets);
      StorageService.savePockets(updatedPockets);

      // Batch update affected pockets to cloud
      if (isCloudEnabled) {
        const affectedPockets = updatedPockets.filter((p) =>
          pocketUpdates.has(p.id),
        );
        if (affectedPockets.length > 0) {
          await SheetService.updateMany("Pockets", affectedPockets);
        }
      }
    }

    const updatedTxs = transactions.filter((t) => !idsToDelete.includes(t.id));
    setTransactions(updatedTxs);
    StorageService.saveTransactions(updatedTxs);

    if (isCloudEnabled) {
      for (const idToDel of idsToDelete) {
        await SheetService.deleteOne("Transactions", idToDel);
      }
    }

    showToast("Transaction deleted", "success");
  };

  const handleBatchTransactionDelete = async (ids: string[]) => {
    // Collect all unique IDs to delete including partners
    const idsToDeleteSet = new Set<string>(ids);
    const txsToProcess: Transaction[] = [];

    ids.forEach((id) => {
      const tx = transactions.find((t) => t.id === id);
      if (tx) {
        txsToProcess.push(tx);
        if (
          tx.linkedTransactionId &&
          !idsToDeleteSet.has(tx.linkedTransactionId)
        ) {
          const partner = transactions.find(
            (t) => t.id === tx.linkedTransactionId,
          );
          if (partner) {
            idsToDeleteSet.add(partner.id);
            txsToProcess.push(partner);
          }
        }
      }
    });

    if (txsToProcess.length === 0) return;

    const accountUpdates = new Map<string, number>();
    const potUpdates = new Map<string, number>();
    const pocketUpdates = new Map<string, number>();

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

    const applyLegToBalances = (t: Transaction, factor: 1 | -1) => {
      if (t.isHistorical) return;

      // 1. Account Balance
      const acc = accounts.find((a) => a.id === t.accountId);
      if (acc) {
        const amt = getConvertedAmount(t.amount, t.currency, acc.currency);
        const fee = t.fee
          ? getConvertedAmount(t.fee, t.currency, acc.currency)
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

        // Legacy single-record logic
        if (
          t.type === TransactionType.TRANSFER &&
          t.toAccountId &&
          !t.transferDirection &&
          !t.linkedTransactionId
        ) {
          const toAcc = accounts.find((a) => a.id === t.toAccountId);
          if (toAcc) {
            const toAmt = getConvertedAmount(
              t.amount,
              t.currency,
              toAcc.currency,
            );
            const toFee = t.fee
              ? getConvertedAmount(t.fee, t.currency, toAcc.currency)
              : 0;
            const addedAmount = feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
            accountUpdates.set(
              t.toAccountId,
              (accountUpdates.get(t.toAccountId) || 0) + addedAmount * factor,
            );
          }
        }
      }

      // 2. Pots
      if (t.potId) {
        let potDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          potDelta = -t.amount * factor;
        } else {
          potDelta = t.amount * factor;
        }
        potUpdates.set(t.potId, (potUpdates.get(t.potId) || 0) + potDelta);
      }

      // 3. Pockets
      if (t.savingPocketId) {
        const sourceAmount = t.amount;
        let pocketDelta = 0;
        if (
          t.type === TransactionType.INCOME ||
          t.type === TransactionType.ACCOUNT_OPENING
        ) {
          pocketDelta = t.amount * factor;
        } else {
          pocketDelta = -sourceAmount * factor;
        }
        pocketUpdates.set(
          t.savingPocketId,
          (pocketUpdates.get(t.savingPocketId) || 0) + pocketDelta,
        );
      }

      // Legacy single-record pocket logic
      if (
        t.type === TransactionType.TRANSFER &&
        t.toSavingPocketId &&
        !t.transferDirection &&
        !t.linkedTransactionId
      ) {
        const fee = t.fee || 0;
        const feeType = t.feeType || "INCLUSIVE";
        const targetAmount =
          feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
        pocketUpdates.set(
          t.toSavingPocketId,
          (pocketUpdates.get(t.toSavingPocketId) || 0) + targetAmount * factor,
        );
      }
    };

    // Restore balances
    txsToProcess.forEach((tx) => applyLegToBalances(tx, -1));

    // Update States
    if (accountUpdates.size > 0) {
      const updatedAccounts = accounts.map((a) => {
        if (accountUpdates.has(a.id)) {
          return {
            ...a,
            balance: a.balance + (accountUpdates.get(a.id) || 0),
            updatedAt: Date.now(),
          };
        }
        return a;
      });
      setAccounts(updatedAccounts);
      StorageService.saveAccounts(updatedAccounts);
    }

    if (potUpdates.size > 0) {
      const updatedPots = pots.map((p) => {
        if (potUpdates.has(p.id)) {
          const newUsedAmount = p.usedAmount + (potUpdates.get(p.id) || 0);
          return {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
            updatedAt: Date.now(),
          };
        }
        return p;
      });
      setPots(updatedPots);
      StorageService.savePots(updatedPots);

      // Batch update affected pots to cloud
      if (isCloudEnabled) {
        const affectedPots = updatedPots.filter((p) => potUpdates.has(p.id));
        if (affectedPots.length > 0) {
          await SheetService.updateMany("Pots", affectedPots);
        }
      }
    }

    if (pocketUpdates.size > 0) {
      const updatedPockets = pockets.map((p) => {
        if (pocketUpdates.has(p.id)) {
          const newCurrentAmount =
            p.currentAmount + (pocketUpdates.get(p.id) || 0);
          return {
            ...p,
            currentAmount: newCurrentAmount,
            updatedAt: Date.now(),
          };
        }
        return p;
      });
      setPockets(updatedPockets);
      StorageService.savePockets(updatedPockets);

      // Batch update affected pockets to cloud
      if (isCloudEnabled) {
        const affectedPockets = updatedPockets.filter((p) =>
          pocketUpdates.has(p.id),
        );
        if (affectedPockets.length > 0) {
          await SheetService.updateMany("Pockets", affectedPockets);
        }
      }
    }

    const idsToDelete = Array.from(idsToDeleteSet);
    const updatedTxs = transactions.filter((t) => !idsToDelete.includes(t.id));
    setTransactions(updatedTxs);
    StorageService.saveTransactions(updatedTxs);

    if (isCloudEnabled) {
      for (const id of idsToDelete) {
        await SheetService.deleteOne("Transactions", id);
      }
    }
    showToast(`${txsToProcess.length} transactions deleted`, "success");
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

      thisUpdates.updatedAt = Date.now();

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
          partnerUpdates.updatedAt = Date.now();
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
          t.potId,
          (potUpdates.get(t.potId) || 0) + potDelta * factor,
        );
      }

      // Handle Pockets
      if (t.savingPocketId) {
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
            updatedAt: Date.now(),
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
            updatedAt: Date.now(),
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
            updatedAt: Date.now(),
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

  const handleCategorySave = async (cat: Omit<Category, "userId">) => {
    const isEdit = categories.some((c) => c.id === cat.id);
    const catWithUser = {
      ...cat,
      userId: profile.id || "local",
      updatedAt: Date.now(),
    } as Category;
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
    const goalWithUser = {
      ...goal,
      userId: profile.id || "local",
      updatedAt: Date.now(),
    } as Goal;
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
      updatedAt: Date.now(),
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

  const handlePocketSave = async (pocket: Omit<SavingPocket, "userId">) => {
    const isNew = !pockets.find((p) => p.id === pocket.id);
    const pocketWithUser = {
      ...pocket,
      userId: profile.id || "local",
      updatedAt: Date.now(),
    } as SavingPocket;

    let updated;
    if (isNew) {
      updated = [...pockets, pocketWithUser];
      if (isCloudEnabled)
        await SheetService.insertOne("Pockets", pocketWithUser);
    } else {
      updated = pockets.map((p) => (p.id === pocket.id ? pocketWithUser : p));
      if (isCloudEnabled)
        await SheetService.updateOne("Pockets", pocket.id, pocketWithUser);
    }
    setPockets(updated);
    StorageService.savePockets(updated);
    showToast("Saving Pocket saved", "success");
  };

  const handlePocketDelete = async (id: string) => {
    try {
      const pocketToDelete = pockets.find((p) => p.id === id);
      if (!pocketToDelete) return;

      const newPockets = pockets.filter((p) => p.id !== id);
      setPockets(newPockets);
      StorageService.savePockets(newPockets);

      // Update transactions that were linked to this pocket
      const updatedTransactions = transactions.map((t) =>
        t.savingPocketId === id ? { ...t, savingPocketId: null as any } : t,
      );

      const transactionsChanged = updatedTransactions.some(
        (t, i) => t !== transactions[i],
      );

      if (transactionsChanged) {
        setTransactions(updatedTransactions);
        StorageService.saveTransactions(updatedTransactions);
      }

      if (isCloudEnabled) {
        await SheetService.deleteOne("Pockets", id);
        if (transactionsChanged) {
          // Sync to push transaction changes
          await syncData();
        }
      }
      showToast("Saving pocket deleted", "success");
    } catch (error) {
      console.error("Error deleting pocket:", error);
      showToast("Failed to delete pocket", "alert");
    }
  };

  const handleAddSubscription = async (sub: Omit<Subscription, "userId">) => {
    const currentUserId = profile.id || "guest";
    const newSub: Subscription = {
      ...sub,
      userId: currentUserId,
      updatedAt: Date.now(),
    };
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
    const sessionWithUpdate = { ...session, updatedAt: Date.now() };
    const updated = isEdit
      ? chatSessions.map((s) => (s.id === session.id ? sessionWithUpdate : s))
      : [...chatSessions, sessionWithUpdate];
    setChatSessions(updated);
    StorageService.saveChatSessions(updated);
    if (isCloudEnabled && profile.syncChatToSheets) {
      if (isEdit)
        await SheetService.updateOne(
          "ChatSessions",
          session.id,
          sessionWithUpdate,
        );
      else await SheetService.insertOne("ChatSessions", sessionWithUpdate);
    }
  };

  const handleSelectExistingSheet = async () => {
    try {
      const fileId = await SheetService.selectSpreadsheetWithPicker();
      if (fileId) {
        showToast("Spreadsheet linked! Synchronizing...", "success");
        // Trigger a fresh sync with the newly linked file
        syncData();
      }
    } catch (e) {
      console.error("Failed to select sheet", e);
      showToast("Could not link spreadsheet.", "alert");
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

  const recalculateBalances = async (
    startDateArg?: string | any,
    endDateArg?: string | any,
  ) => {
    // If called from onClick={recalculateBalances}, the first arg is a MouseEvent.
    // We only want to process if they are actual date strings.
    const startDate =
      typeof startDateArg === "string" ? startDateArg : undefined;
    const endDate = typeof endDateArg === "string" ? endDateArg : undefined;

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

      const applyLeg = (t: Transaction) => {
        if (t.isHistorical) return;

        // Date range filtering
        const txDateStr = normalizeDate(t.date);
        if (startDate && txDateStr < normalizeDate(startDate)) return;
        if (endDate && txDateStr > normalizeDate(endDate)) return;

        // 1. Account Balance
        const acc = accounts.find((a) => a.id === t.accountId);
        if (acc) {
          const amt = getConvertedAmount(t.amount, t.currency, acc.currency);
          const fee = t.fee
            ? getConvertedAmount(t.fee, t.currency, acc.currency)
            : 0;
          const feeType = t.feeType || "INCLUSIVE";

          let delta = 0;
          const isInflow =
            t.type === TransactionType.INCOME ||
            t.type === TransactionType.ACCOUNT_OPENING ||
            t.type === TransactionType.ADJUSTMENT || // Adjustments here are treated as positive additions for now
            (t.type === TransactionType.TRANSFER &&
              t.transferDirection === "IN");

          if (isInflow) {
            const addedAmount =
              t.type === TransactionType.TRANSFER && feeType === "EXCLUSIVE"
                ? amt - fee
                : amt;
            delta = addedAmount;
          } else {
            // Expenses or OUT transfers
            const removedAmount = feeType === "INCLUSIVE" ? amt + fee : amt;
            delta = -removedAmount;
          }
          accountUpdates.set(
            t.accountId,
            (accountUpdates.get(t.accountId) || 0) + delta,
          );

          // Legacy single-record transfer logic (toAccountId in the same record)
          if (
            t.type === TransactionType.TRANSFER &&
            t.toAccountId &&
            !t.transferDirection &&
            !t.linkedTransactionId
          ) {
            const toAcc = accounts.find((a) => a.id === t.toAccountId);
            if (toAcc) {
              const toAmt = getConvertedAmount(
                t.amount,
                t.currency,
                toAcc.currency,
              );
              const toFee = t.fee
                ? getConvertedAmount(t.fee, t.currency, toAcc.currency)
                : 0;
              const addedAmount =
                feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
              accountUpdates.set(
                t.toAccountId,
                (accountUpdates.get(t.toAccountId) || 0) + addedAmount,
              );
            }
          }
        }

        // 2. Pots (Spending Limits) - respect pot's reset date cutoff
        if (t.potId) {
          const pot = pots.find((p) => p.id === t.potId);
          // Only count this transaction if it's on or after the pot's reset date
          const isAfterPotReset =
            !pot?.resetDate || txDateStr >= normalizeDate(pot.resetDate);

          if (isAfterPotReset) {
            let potDelta = 0;
            // Use the transaction amount directly (pots track in transaction currency)
            if (
              t.type === TransactionType.INCOME ||
              t.type === TransactionType.ACCOUNT_OPENING
            ) {
              potDelta = -t.amount; // Incoming money restores pot limit
            } else {
              potDelta = t.amount; // Spending uses pot limit
            }
            potUpdates.set(t.potId, (potUpdates.get(t.potId) || 0) + potDelta);
          }
        }

        // 3. Pockets (Goals/Savings) - respect pocket's reset date cutoff
        if (t.savingPocketId) {
          const pocket = pockets.find((p) => p.id === t.savingPocketId);
          // Only count this transaction if it's on or after the pocket's reset date
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
              (pocketUpdates.get(t.savingPocketId) || 0) + pocketDelta,
            );
          }
        }

        // Legacy single-record pocket logic
        if (
          t.type === TransactionType.TRANSFER &&
          t.toSavingPocketId &&
          !t.transferDirection &&
          !t.linkedTransactionId
        ) {
          const fee = t.fee || 0;
          const feeType = t.feeType || "INCLUSIVE";
          const targetAmount =
            feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
          pocketUpdates.set(
            t.toSavingPocketId,
            (pocketUpdates.get(t.toSavingPocketId) || 0) + targetAmount,
          );
        }
      };

      transactions.forEach(applyLeg);

      // Apply Updates
      const updatedAccounts = accounts.map((a) => ({
        ...a,
        balance: accountUpdates.get(a.id) ?? 0,
        updatedAt: Date.now(),
      }));

      const updatedPots = pots.map((p) => {
        const used = potUpdates.get(p.id) ?? 0;
        return {
          ...p,
          usedAmount: used,
          amountLeft: p.limitAmount - used,
          updatedAt: Date.now(),
        };
      });

      const updatedPockets = pockets.map((p) => ({
        ...p,
        currentAmount: pocketUpdates.get(p.id) ?? 0,
        updatedAt: Date.now(),
      }));

      setAccounts(updatedAccounts);
      setPots(updatedPots);
      setPockets(updatedPockets);

      StorageService.saveAccounts(updatedAccounts);
      StorageService.savePots(updatedPots);
      StorageService.savePockets(updatedPockets);

      if (isCloudEnabled) {
        // Batch update all accounts
        if (updatedAccounts.length > 0) {
          await SheetService.updateMany("Accounts", updatedAccounts);
        }
        // Batch update all pots
        if (updatedPots.length > 0) {
          await SheetService.updateMany("Pots", updatedPots);
        }
        // Batch update all pockets
        if (updatedPockets.length > 0) {
          await SheetService.updateMany("Pockets", updatedPockets);
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
        handleAccountSave,
        handleAccountDelete,
        handleTransactionSubmit,
        handleBulkTransactionImport,
        handleTransactionDelete,
        handleCategorySave,
        handleCategoryDelete,
        handleGoalUpdate,
        handleGoalDelete,
        handlePotSave,
        handlePotDelete,
        handlePocketSave,
        handlePocketDelete,
        handleAddSubscription,
        handleDeleteSubscription,
        handleSaveChatSession,
        handleDeleteChatSession,
        handleBatchTransactionDelete,
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
