# ZenFinance Tracker

A personal finance tracker. Owns the user's own financial data: accounts, transactions, categories, pots, pockets, goals, subscriptions, and chat sessions. Syncs to the user's own Google account via Google Sheets. Has no other users, no third parties, no backend.

## Language

**Account**:
A financial account the user tracks — a bank account, a credit card, a cash envelope, etc.
_Avoid:_ wallet, card (a card is one kind of account, not the general term)

**Transaction**:
A single movement of money on an account — income, expense, or transfer.
_Avoid:_ entry, record

**Pot**:
A budgeted spending limit tied to a category (e.g., "Groceries pot, RM 500/month").
_Avoid:_ budget, envelope

**Pocket**:
A savings target with a goal amount and progress (e.g., "Emergency fund, target RM 10,000").
_Avoid:_ goal jar, savings pot (do not confuse with **Pot**)

**Goal**:
A non-financial objective the user is tracking (e.g., "Pay off credit card by Dec 2026"). Distinct from a **Pocket**, which has a money target.
_Avoid:_ objective, target

**Subscription**:
A recurring payment the user wants to track (e.g., Netflix, RM 55.90/month). The app generates synthetic transactions for subscriptions on their next-payment date.
_Avoid:_ recurring payment, biller

**Mask Mode**:
A UI toggle that hides amounts and account names in the interface. A presentation-only concern — masks are CSS, not crypto. Distinct from any prior notion of a "vault."
_Avoid:_ privacy mode, vault, secure view

**Schema Version**:
A monotonically increasing integer on the user profile that gates data-shape migrations. Current: 2 (post-vault-removal). Bump on any breaking change to the data model.
_Avoid:_ migration flag, version

## Removed terms (do not reintroduce)

The following concepts used to exist and were explicitly removed in ADR-002. If a future session suggests adding them back, challenge the suggestion.

**Vault**:
A crypto feature that encrypted account details using a TOTP-derived key. Removed because the TOTP secret was synced to the same cloud store it was supposed to protect, making the encryption security theatre. Use **Mask Mode** for the "hide my numbers" UX need; do not store data you don't need.

**TOTP secret as encryption seed**:
A design where `deriveKeyFromTOTP(totpSecret)` produced the AES key for vault encryption. The key was stored in the user's Google Sheet. Never reintroduce — encryption keys must never live in the same trust boundary as the data they protect.

**Sensitive account fields** (`accountNumber`, `cardNumber`, `cvv`, `expiry`, `holderName`):
Fields that used to be encrypted via the vault. Removed from the data model entirely. The app is a finance tracker, not a wallet. Identify cards by typing a freeform string in **Account** `name` (e.g., `"Amex Gold •••• 1234"`).

**In-app biometric authentication**:
Biometric prompts (Face ID, fingerprint) used to unlock the vault. Removed because the vault is gone and the OS provides app-lock at the device level. Do not re-add biometric code to the app — let the OS handle it.

## Temporary features (do not extend, plan to remove)

**Vault schema migration (`migrateSchemaV1toV2` / `runVaultSchemaMigration`)**:
A one-time cleanup pass that runs on first v2 sync to remove vault-related fields from the user's cloud data. Lives in `src/lib/domain/migration.ts` (pure) and `src/lib/application/commands/migration.ts` (orchestrator). Triggered from `useAppInit` after a successful `loadData`. **This is temporary infrastructure** — do not extend it, do not generalize it into a "migration framework."

**Removal criterion**: when the user (sole user) confirms that both their devices are on v2 AND the cloud profile has `profile.schemaVersion === 2` AND no v1 client has re-introduced legacy fields for at least one release cycle, the migration code can be deleted. The function name `runVaultSchemaMigration` is unique enough that `grep -r runVaultSchemaMigration src/` will find all call sites in one pass. Do not add new migration paths; if a future breaking change needs one, write a new temporary command with its own removal criterion rather than generalizing this one.

**`profile.schemaVersion`**:
A monotonically increasing integer on the user profile that gates the v1-to-v2 cleanup. Current value: 2. **It is a temporary field** — once the v1-to-v2 migration is removed, this field can be dropped too. Do not start treating `schemaVersion` as a permanent schema-evolution mechanism.
