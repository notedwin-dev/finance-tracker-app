# Issue #3: Privacy store — migrate masking and vault from DataProvider

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/3

## Summary

Move all privacy-related state (mask UI + vault crypto) from DataProvider into `privacy.store.ts`.

## Rationale

Masking (`maskAmount`, `maskText`, `privacyMode`) and vault (`lock`/`unlock`/`enable`/`disable`/`TOTP`/`biometric`) are both privacy concerns that belong together in one store. Currently scattered across 11 components via `useData()`.

## Sub-tasks

- [ ] **A.1 — Add mask/privacy UI state** — Add `maskAmount`, `maskText`, `privacyMode`, `setPrivacyMode` to `privacy.store.ts`; pipe initial values from DataProvider on load
- [ ] **A.2 — Add vault state** — Add `isVaultEnabled`, `isVaultCreated`, `isVaultLocked`, `isVaultUnlocked`, `vaultSalt`, `biometricCredId` to `privacy.store.ts`; pipe from DataProvider
- [ ] **A.3 — Add vault actions** — Add `unlockVaultWithTOTP`, `unlockVaultWithBiometrics`, `lockVault`, `enableVault`, `disableVault` as store actions (may delegate to `SecurityService` internally)
- [ ] **A.4 — Update mask consumers** — Switch `DashboardPage`, `History`, `AccountPage`, `AccountCard`, `Goals`, `Charts`, `SubscriptionManager`, `Profile`, `MainLayout` to read `maskAmount`/`maskText`/`privacyMode` from `usePrivacyStore`
- [ ] **A.5 — Update vault consumers** — Switch `AccountForm`, `AccountPage`, `Profile` to use vault actions from privacy store
- [ ] **A.6 — Cleanup** — Remove mask/vault state and handlers from DataProvider context and `DataContextType`

## Verification

- Mask/hide toggle works on Dashboard, History, Account pages
- Vault lock/unlock/enable/disable works end to end
- 82+ tests pass
- No new TypeScript errors

## Assignee

`state-migrator` subagent (adds state to store + pipes from DataProvider) → `page-migrator` subagent (updates consumers)
