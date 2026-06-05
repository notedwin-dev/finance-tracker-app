# Drop the vault: data minimization for a personal finance tracker

**Date:** 2026-06-04
**Deciders:** Edwin

## Context

The codebase has a vault crypto system that encrypts `account.details` blobs (card numbers, CVV, expiry, holder name, account number, note) using an AES key derived from the user's TOTP secret. The TOTP secret itself is stored in the user's profile row in Google Sheets, so anyone with read access to the Sheet has the key — encryption is security theatre. Multi-device unlock is broken-by-design: the secret is per-Google-Account rather than per-user-passphrase, and the cross-device sync of an encryption secret is the same problem in a different costume. The vault was originally a Copilot suggestion rather than a designed feature, and the underlying use case (storing actual bank card numbers in a personal finance tracker) is gold-plating with real PII liability.

### Considered Options

- **Passphrase-derived encryption key.** Rejected. Still requires a passphrase prompt, key derivation, recovery story, and a way to bootstrap a new device. The data being protected doesn't warrant this much complexity. Argon2-stretching a 6-digit PIN to defend against a Google-account compromise is solving a problem we created by storing the data in the first place.
- **Keep TOTP-as-key, fix multi-device.** Rejected. The key is in the cloud, so encryption-at-rest provides no additional protection beyond what the cloud already provides. "Fixing" multi-device on this foundation only papers over the original design flaw.
- **Drop the vault, drop the sensitive fields.** Chosen. Data minimization is the strongest defense: data you don't have can't be stolen. The original threat model (mum's concern that "data is uploaded to Google") is honestly addressed by the fact that there are no secrets to upload.

## Decision

Remove the vault entirely. Drop all sensitive fields (`accountNumber`, `cardNumber`, `cvv`, `expiry`, `holderName`) from the `Account` data model. Delete the TOTP service, the security/vault crypto service, the biometric registration, the vault commands, and the vault UI. Keep `note` as a freeform unencrypted string. Keep "Mask Mode" as a UI-only toggle that hides amounts and account names in the UI (no crypto, just CSS). Migrate existing data via a one-time soft-migration on first sync, gated by `profile.schemaVersion` (1 → 2).

The only sensitive data the app will hold after this change is whatever the user types into `note` — and that's their call.

## Consequences

**Positive**
- ~600–800 lines of crypto, vault commands, and vault UI deleted. Fewer attack surfaces, fewer cross-platform quirks (WebAuthn, biometric prompts, TOTP code rotation), no recovery story needed.
- Multi-device sync becomes trivial. There are no secrets to sync, so any device the user logs into sees the same data immediately. The previous "vault unlock fails on second device" class of bugs becomes structurally impossible.
- PCI scope is avoided. Storing card numbers (let alone CVV) in a personal app dragged in compliance considerations. Removing the fields removes the question.
- The `Account` data model is simpler and easier to reason about. The "is this account encrypted?" branch in every read/write path disappears.

**Negative / Mitigations**
- Users lose the ability to store actual card numbers in the app. **Mitigation:** account names are freeform — `"Amex Gold •••• 1234"` carries the same identifying information for the user's own tracking purposes. Last-4 of a card is fine to type; the full PAN is not.
- The in-app biometric app lock goes away. **Mitigation:** iOS and Android both provide OS-level "require Face ID / fingerprint to open app" settings. The user enables it at the device level — no app code needed.
- Existing users with vaults enabled have legacy data in their Sheet (encrypted `details` blobs, `totpSecret` in profile row). **Mitigation:** soft-migration on first sync of the new app version — see implementation. The migration is silent (the user is the only user) and idempotent (gated by `profile.schemaVersion: 2`).
- Accounts that can't be decrypted during migration (legacy `ENC:` blobs without a recoverable key) lose their sensitive fields. **Mitigation:** the user re-adds them. Acceptable for solo use.

### Migration shape
- On first successful `loadData` of v2, if `profile.schemaVersion !== 2`, run `migrateSchemaV1toV2(accounts, profile)`: blank sensitive fields on every account, drop vault fields from the profile, set `schemaVersion: 2`, save to localStorage first, then push to Sheets.
- New accounts never have the sensitive fields; `saveAccount` doesn't read or write them.
- The export function (`ProfilePage.handleExportData`) drops the `_note` warning added in M18 — there's nothing secret in the export anymore.

### References
- `src/lib/application/commands/privacy.ts` — entire file deleted
- `src/stores/privacy.store.ts` — `isVaultEnabled`, `isVaultCreated`, `isVaultUnlocked`, `securityUnlocked`, `masterKey` fields deleted; `privacyMode` → `maskMode` kept
- `services/twofa.services.ts` — file deleted
- `services/security.services.ts` — vault crypto deleted; `registerBiometrics` / `verifyWithBiometrics` deleted (OS handles app lock)
- `services/sheets.services.ts` — drops reads/writes for `totpSecret`, `isSecurityEnabled`, `isVaultLocked`, `vaultSalt`, `biometricCredId(s)`, and account `details` blob
- `pages/ProfilePage.tsx` — vault UI deleted; export `_note` warning removed
- `layouts/MainLayout.tsx` — vault unlock modal deleted
- `helpers/useAppInit.tsx` — vault-specific init paths deleted

---

**Status:** Accepted
