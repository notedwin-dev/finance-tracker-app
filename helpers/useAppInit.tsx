import { useEffect, useRef } from "react";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import { getCryptoPrices } from "../services/coin.services";
import * as StorageService from "../services/storage.services";
import { useFinanceStore } from "../src/stores/finance.store";
import { usePrivacyStore } from "../src/stores/privacy.store";
import { useSyncStore } from "../src/stores/sync.store";
import { loadData, syncData, processSubscriptions } from "../src/lib/application/commands";

export function useAppInit() {
  const { profile, updateProfile, loginWithGoogle, isInitialized } = useAuth();
  const hasSynced = useRef(false);
  const lastInitializedProfileId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!profile.id) {
      lastInitializedProfileId.current = undefined;
      return;
    }
    if (lastInitializedProfileId.current === profile.id) return;
    lastInitializedProfileId.current = profile.id;

    hasSynced.current = false;
    loadData(profile).catch((e) => {
      console.error("loadData failed during init:", e);
      useSyncStore.getState().showToast(
        "Failed to load data. Please refresh.",
        "alert",
      );
    });

    getUSDToMYRRate().then((data) => {
      useFinanceStore.getState().setUsdRate(data.rate);
      useFinanceStore.getState().setExchangeRate(data);
    });
    getCryptoPrices().then((prices) => {
      useFinanceStore.getState().setCryptoPrices(prices);
    });
  }, [profile.id]);

  useEffect(() => {
    if (!isInitialized) return;
    if (hasSynced.current || profile.offlineMode) {
      const currentSubs = StorageService.getStoredSubscriptions();
      const store = useFinanceStore.getState();
      if (currentSubs && currentSubs.length > 0) {
        processSubscriptions(store.accounts, store.usdRate);
      }
    }
  }, [hasSynced.current, profile.offlineMode, isInitialized]);

  useEffect(() => {
    if (
      profile.isLoggedIn &&
      isInitialized &&
      !profile.offlineMode &&
      !hasSynced.current
    ) {
      const doSync = async () => {
        try {
          await syncData(profile, updateProfile, loginWithGoogle);
          hasSynced.current = true;
        } catch (e) {
          console.warn("Auto-sync failed, will retry on next dep change", e);
        }
      };
      doSync();
    }
  }, [profile.isLoggedIn, isInitialized, profile.offlineMode]);

  useEffect(() => {
    const isLocked = profile.isVaultLocked === true;
    if (isLocked && usePrivacyStore.getState().isVaultUnlocked) {
      usePrivacyStore.getState().setVaultUnlocked(false);
      loadData(profile).catch((e) => {
        console.error("loadData failed during vault lock:", e);
      });
    }
  }, [profile.isVaultLocked]);
}
