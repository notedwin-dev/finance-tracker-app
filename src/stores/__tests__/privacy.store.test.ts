import { describe, it, expect, beforeEach } from "vitest";
import { usePrivacyStore } from "../privacy.store";

describe("privacy.store", () => {
  beforeEach(() => {
    usePrivacyStore.getState().reset();
  });

  it("starts with privacy features disabled and unlocked", () => {
    const state = usePrivacyStore.getState();
    expect(state.isVaultEnabled).toBe(false);
    expect(state.isVaultCreated).toBe(false);
    expect(state.isVaultUnlocked).toBe(false);
    expect(state.privacyMode).toBe(false);
    expect(state.securityUnlocked).toBe(false);
    expect(state.masterKey).toBeNull();
  });

  it("toggles privacy mode", () => {
    usePrivacyStore.getState().setPrivacyMode(true);
    expect(usePrivacyStore.getState().privacyMode).toBe(true);
    usePrivacyStore.getState().setPrivacyMode(false);
    expect(usePrivacyStore.getState().privacyMode).toBe(false);
  });

  it("enables vault and marks it as created", () => {
    usePrivacyStore.getState().setVaultEnabled(true);
    usePrivacyStore.getState().setVaultCreated(true);
    expect(usePrivacyStore.getState().isVaultEnabled).toBe(true);
    expect(usePrivacyStore.getState().isVaultCreated).toBe(true);
  });

  it("tracks security unlock state", () => {
    usePrivacyStore.getState().setSecurityUnlocked(true);
    expect(usePrivacyStore.getState().securityUnlocked).toBe(true);
  });

  it("stores a master key", () => {
    const key = {} as CryptoKey;
    usePrivacyStore.getState().setMasterKey(key);
    expect(usePrivacyStore.getState().masterKey).toBe(key);
  });
});
