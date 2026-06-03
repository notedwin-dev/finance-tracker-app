import { create } from "zustand";

export interface VaultState {
  isVaultEnabled: boolean;
  isVaultCreated: boolean;
  isVaultUnlocked: boolean;
  privacyMode: boolean;
  securityUnlocked: boolean;
  masterKey: CryptoKey | null;
}

export interface PrivacyActions {
  setVaultEnabled: (enabled: boolean) => void;
  setVaultCreated: (created: boolean) => void;
  setVaultUnlocked: (unlocked: boolean) => void;
  setPrivacyMode: (mode: boolean) => void;
  setSecurityUnlocked: (unlocked: boolean) => void;
  setMasterKey: (key: CryptoKey | null) => void;
  reset: () => void;
}

const initialVaultState: VaultState = {
  isVaultEnabled: false,
  isVaultCreated: false,
  isVaultUnlocked: false,
  privacyMode: false,
  securityUnlocked: false,
  masterKey: null,
};

export const usePrivacyStore = create<VaultState & PrivacyActions>((set) => ({
  ...initialVaultState,

  setVaultEnabled: (enabled) => set({ isVaultEnabled: enabled }),
  setVaultCreated: (created) => set({ isVaultCreated: created }),
  setVaultUnlocked: (unlocked) => set({ isVaultUnlocked: unlocked }),
  setPrivacyMode: (mode) => set({ privacyMode: mode }),
  setSecurityUnlocked: (unlocked) => set({ securityUnlocked: unlocked }),
  setMasterKey: (key) => set({ masterKey: key }),
  reset: () => set(initialVaultState),
}));
