import { useEffect, useRef } from "react";
import { useAuth } from "../services/auth.services";
import { getUSDToMYRRate } from "../services/exchange.services";
import { getCryptoPrices } from "../services/coin.services";
import * as StorageService from "../services/storage.services";
import { useFinanceStore } from "../src/stores/finance.store";
import { usePrivacyStore } from "../src/stores/privacy.store";
import { loadData, syncData, processSubscriptions } from "../src/lib/application/commands";

export function useAppInit() {
  const { profile, updateProfile, loginWithGoogle, isInitialized } = useAuth();
  const hasSynced = useRef(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!profile.id) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    hasSynced.current = false;
    loadData(profile);

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
      const currentTxs = StorageService.getStoredTransactions();
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
        await syncData(profile, updateProfile, loginWithGoogle);
        hasSynced.current = true;
      };
      doSync();
    }
  }, [profile.isLoggedIn, isInitialized, profile.offlineMode]);

  useEffect(() => {
    const isLocked = profile.isVaultLocked === true;
    if (isLocked && usePrivacyStore.getState().isVaultUnlocked) {
      usePrivacyStore.getState().setVaultUnlocked(false);
      loadData(profile);
    }
  }, [profile.isVaultLocked]);
}
