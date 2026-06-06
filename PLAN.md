# Plan: Complete Layer Migration — DataProvider → Stores + Commands

**Updated:** 2026-06-03

## Vision

Replace the 2,330-line `DataProvider.tsx` monolith with focused **Zustand stores** (state) and **application commands** (logic). Data flows in one direction:

```text
Sheets ──→ DataProvider ──→ Stores ──→ Components
                │               │
                ↓               ↓
            commands          selectors
                │               ↑
                ↓               │
            services/ ──────────┘
            (sheets, storage)
```

- **Stores** are the single source of truth for all components
- **Commands** contain orchestration (validate → deltas → persist → toast)
- **DataProvider** becomes a load-time shim (feeds Sheets data into stores), then is deleted
- **DataContext** and `useData()` are migrated away one domain at a time

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State ownership | Zustand stores (SSOT) | Components read from stores, not context |
| Command pattern | Direct store imports (no DI) | Simpler, follows existing commands.ts pattern |
| Infrastructure layer | Remove interfaces | Backend is thin (Google Auth + Gemini only); services/ is the boundary |
| Migration order | Simple domains first | Build pattern before tackling transactions |
| Read-side migration | Direct per-component switch | No migration adapter needed |
| Persistence | Commands call services/ directly | No adapter layer, no over-abstraction |

## Architecture

```text
src/
├── lib/
│   ├── domain/            ← Pure functions (balance.engine, currency)
│   ├── application/
│   │   ├── commands.ts    ← Barrel re-export from commands/*.ts
│   │   └── commands/      ← Domain-split command modules
│   │       ├── helpers.ts
│   │       ├── transactions.ts
│   │       ├── accounts.ts
│   │       ├── categories.ts
│   │       ├── goals.ts
│   │       ├── subscriptions.ts
│   │       ├── chat-sessions.ts
│   │       ├── pots.ts
│   │       ├── pockets.ts
│   │       └── balance.ts
├── stores/                ← Zustand (4 stores, finance.store gets new state)
├── services/              ← As-is (sheets, storage, auth, gemini, exchange)
├── components/            ← Migrate from useData() to useStore() gradually
├── pages/                 ← Thin, will use stores directly
└── context/
    ├── DataProvider.tsx   ← Shrinks as domains migrate, eventually deleted
    └── DataContext.tsx    ← Deleted alongside DataProvider
```

### Data flow after full migration

```text
User action (click "Save")
  → Command (submitTransaction in commands/transactions.ts)
    → Domain logic (computeAccountTransactionAmount / computeBudgetConsumption / computeSavingsMovement)
    → Store update (useFinanceStore.getState().addTransaction)
    → Persistence (storage.services.save)
    → Toast (useSyncStore.getState().showToast)
  → UI re-render (Zustand selector fires)
```

## Current State

### What's been extracted from DataProvider (20 of ~23 handlers/state removed)

| Handlers | Entity | Status |
|----------|--------|--------|
| `handleGoalUpdate` / `handleGoalDelete` | Goals | ✓ Removed |
| `handleAddSubscription` / `handleDeleteSubscription` | Subscriptions | ✓ Removed |
| `handleSaveChatSession` / `handleDeleteChatSession` | Chat Sessions | ✓ Removed |
| `handlePotSave` / `handlePotDelete` | Pots | ✓ Removed |
| `handlePocketSave` / `handlePocketDelete` | Saving Pockets | ✓ Removed |
| `handleAccountSave` / `handleAccountDelete` | Accounts | ✓ Removed |
| `handleTransactionDelete` | Transactions (single) | ✓ Removed |
| `handleBatchTransactionDelete` | Transactions (batch) | ✓ Removed |
| `handleTransactionSubmit` | Transactions (submit) | ✓ Removed |
| `handleBulkTransactionImport` | Transactions (import) | ✓ Removed |
| `handleBatchTransactionEdit` | Transactions (batch edit) | ✓ Removed |
| `recalculateBalances` | Balance recalculation | ✓ Removed |

### Remaining handlers in DataProvider (3)

| Handler | Line (approx) | Notes |
|---------|------|-------|
| `handleSelectExistingSheet` | ~2031 | Sheet picker UI concern (Issue #4) |
| `handleMigrateData` | ~2056 | Data migration utility (Issue #4) |
| `handleResetAndSync` | ~2209 | Sync reset utility (Issue #4) |

### DataProvider total size

~2070 lines (was ~2874 lines originally).

### Commands (`src/lib/application/commands.ts` — barrel re-export)

10 domain files in `commands/`, 22 exported functions. All entity commands extracted (categories, goals, subscriptions, chat-sessions, pots, pockets, accounts, transactions, balance).

### Stores (`src/stores/`)

All 4 Zustand stores exist. Finance store has `usdRate`, `cryptoPrices`, `exchangeRate` wired.

## Phase 1: State Migration (this session)

### 1.1 Add missing state to `finance.store.ts`

Add to `FinanceState`:
```typescript
usdRate: number;
cryptoPrices: CryptoPrices;
exchangeRate: ExchangeRateData | null;
```

Add to `FinanceActions`: `setUsdRate`, `setCryptoPrices`, `setExchangeRate`.

Initial values: `usdRate: 4.45`, `cryptoPrices: { BTC: 65000, ETH: 3500 }`, `exchangeRate: null`.

### 1.2 Pipe DataProvider state into Zustand stores

**DataProvider `loadData` effect** (lines 713-719): After `setUsdRate`/`setCryptoPrices`, also call:
```typescript
useFinanceStore.getState().setUsdRate(data.rate);
useFinanceStore.getState().setExchangeRate(data);
useFinanceStore.getState().setCryptoPrices(prices);
```

**`displayCurrency` write-through**: Rename React setter to `setDisplayCurrencyState`, create wrapper that also calls `useUIStore.getState().setDisplayCurrency()`.

**`showToast` write-through** (line 674): Also call `useSyncStore.getState().showToast()`.

**`isSyncing`/`hasSynced` write-through**: Pipe into `useSyncStore` alongside React state.

**`maskMode` write-through**: `setMaskMode` (formerly `setSecurityUnlockedWithRef`) calls `useMaskStore.getState().setMaskMode()` to keep the mask store in sync. The legacy `usePrivacyStore.setVaultUnlocked` was removed when the vault subsystem was deleted; mask state now lives in `src/stores/mask.store.ts`.

### 1.3 Update page reads — switch scalar state from `useData()` to stores

| File | Value | New Source |
|------|-------|------------|
| **DashboardPage** | `usdRate`, `cryptoPrices` | `useFinanceStore()` |
| | `displayCurrency`, `setDisplayCurrency` | `useUIStore()` |
| **AssetsPage** | `usdRate`, `cryptoPrices` | `useFinanceStore()` |
| | `displayCurrency` | `useUIStore()` |
| **AccountPage** | `usdRate`, `cryptoPrices` | `useFinanceStore()` |
| | `displayCurrency` | `useUIStore()` |
| | `isVaultEnabled`, `isVaultUnlocked` | `useMaskStore()` (legacy vault fields renamed to `maskMode`) |
| **HistoryPage** | `usdRate` | `useFinanceStore()` |

After this: `useData()` calls in pages remain only for handler functions (maskAmount, maskText, vault methods, complex handlers).

## Phase 2: Split commands.ts into Domain Files

### 2.1 Create file structure

```text
src/lib/application/
├── commands.ts                  ← barrel: re-exports all from commands/*.ts
├── commands/
│   ├── helpers.ts               ← generateId(), shared utilities
│   ├── balance.ts               ← recalculateBalancesCommand
│   ├── transactions.ts          ← submitTransaction, deleteTransaction, batchDeleteTransaction
│   ├── accounts.ts              ← saveAccount, deleteAccount
│   ├── categories.ts            ← saveCategory, deleteCategory
│   ├── goals.ts                 ← saveGoal, deleteGoal
│   ├── subscriptions.ts         ← addSubscription, deleteSubscription
│   ├── chat-sessions.ts         ← saveChatSession, deleteChatSession
│   ├── pots.ts                  ← savePot, deletePot
│   └── pockets.ts               ← saveSavingPocket, deleteSavingPocket
```

### 2.2 Migration approach

Each file copies:
- Its exact imports from `commands.ts` (types, domain functions, services, stores, helpers)
- Only the functions it owns

`commands.ts` becomes:
```typescript
export * from './commands/balance';
export * from './commands/transactions';
export * from './commands/accounts';
export * from './commands/categories';
export * from './commands/goals';
export * from './commands/subscriptions';
export * from './commands/chat-sessions';
export * from './commands/pots';
export * from './commands/pockets';
```

Zero behavioral change. All existing imports (`import { ... } from "../../commands"`) continue to work.

## Phase 3: Custom Subagents in `opencode.json`

Configure three subagents to parallelize work:

```json
{
  "agent": {
    "state-migrator": {
      "description": "Migrate React state from DataProvider to Zustand stores",
      "mode": "subagent",
      "model": "opencode/deepseek-v4-flash-free",
      "prompt": "{file:.opencode/prompts/state-migrator.txt}",
      "temperature": 0.1,
      "permission": {
        "edit": "allow",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "bash": "deny"
      }
    },
    "commands-splitter": {
      "description": "Split commands.ts into domain-specific files in commands/ directory",
      "mode": "subagent",
      "model": "opencode/deepseek-v4-flash-free",
      "prompt": "{file:.opencode/prompts/commands-splitter.txt}",
      "temperature": 0.1,
      "permission": {
        "edit": "allow",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "bash": "deny"
      }
    },
    "page-migrator": {
      "description": "Update page files to read from Zustand stores instead of useData()",
      "mode": "subagent",
      "model": "opencode/deepseek-v4-flash-free",
      "prompt": "{file:.opencode/prompts/page-migrator.txt}",
      "temperature": 0.1,
      "permission": {
        "edit": "allow",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "bash": "deny"
      }
    }
  }
}
```

All three subagent configs set `"bash": "deny"` to follow least-privilege. To opt in to a specific command, use the scoped allowlist pattern:

```json
"bash": "allow:git status,npx tsc --noEmit,npm test"
```

This restricts shell access to the listed commands only; any other shell invocation is denied.

### 3.1 Subagent prompts

**`.opencode/prompts/state-migrator.txt`**
```text
You are a Zustand migration specialist. Your task is to add missing state to Zustand stores and pipe DataProvider React state into stores.

Rules:
1. Add `usdRate`, `cryptoPrices`, `exchangeRate` to `src/stores/finance.store.ts` state/actions/initialState
2. In `context/DataProvider.tsx`, after setUsdRate/setCryptoPrices calls, pipe values into stores via `useFinanceStore.getState().set...()`
3. Create write-through wrappers for displayCurrency, showToast, isSyncing, securityUnlocked that update React state AND Zustand stores
4. Never change function signatures or break existing consumers
5. Do NOT touch any page/component files (that's page-migrator's job)
```

**`.opencode/prompts/commands-splitter.txt`**
```text
You are a code splitting specialist. Your task is to split `src/lib/application/commands.ts` into domain-specific files.

Rules:
1. Copy each function into its domain file under `src/lib/application/commands/` with all required imports
2. Move `generateId()` to `helpers.ts`
3. Update `commands.ts` to be a barrel file that re-exports everything
4. Zero behavioral changes — exact same function bodies
5. Every existing import of `../../commands` must continue to work
```

**`.opencode/prompts/page-migrator.txt`**
```text
You are a page migration specialist. Your task is to update page files to read scalar state from Zustand stores instead of useData().

Rules:
1. Switch usdRate, cryptoPrices → useFinanceStore()
2. Switch displayCurrency, setDisplayCurrency → useUIStore()
3. Switch isVaultEnabled, isVaultUnlocked → useMaskStore() (mask state moved out of legacy privacy store)
4. Only switch values that have store equivalents (maskAmount, maskText, handlers stay on useData())
5. Remove imports of DataContext only when useData() is no longer used in the file
6. Never break existing functionality
```

### 3.2 Orchestration plan

1. **Run `state-migrator`** — augments finance.store.ts + pipes DataProvider state
2. **Run `commands-splitter`** — splits commands.ts (independent of step 1)
3. **Run `page-migrator`** — updates pages to read from stores (depends on step 1)
4. Verify: `npm run test` still passes, `npx tsc --noEmit` check

Steps 1 and 2 can run in parallel. Step 3 runs after step 1.

## Phase 4: Continue with Remaining Tasks

After state migration and commands split:

### 4.1 Component updates — migrate remaining `useData()` consumers

- **Profile.tsx** — mask methods → useMaskStore, recalculateBalances → command
- **History.tsx** — maskAmount/maskText → useMask hook, handleBatchTransactionEdit → command
- **SubscriptionManager.tsx, Goals.tsx** — maskAmount/maskText → useMask hook
- **Charts.tsx** — maskAmount → useMask hook
- **AccountCard.tsx** — maskAmount/maskText → useMask hook
- **AccountForm.tsx** — mask methods → useMaskStore
- **MainLayout.tsx** — maskMode → useMaskStore, handlers → commands, toast → useSyncStore

### 4.2 Complex handler extraction

| Handler | Est. Size | New Command |
|---------|-----------|-------------|
| `handleBatchTransactionEdit` | ~180 lines | `batchEditTransaction` in `commands/transactions.ts` |
| `handleBulkTransactionImport` | ~120 lines | `bulkImportTransactions` in `commands/transactions.ts` |
| `handleTransactionSubmit` (cloud sync) | ~280 lines | Add cloud sync to existing `submitTransaction` |

### 4.3 Final cleanup

- Remove unused types from `context/types.ts`
- Delete `DataProvider` (move bootstrapping to `App.tsx`)
- Delete `DataContext.tsx` and `context/types.ts`
- Clean up unused imports across codebase

## Testing Strategy

- **New state in stores**: Existing store test files verify shape
- **Command split**: No behavior change — existing tests still pass
- **Page switches**: Verify each page still loads data and renders
- **Run**: `npm run test`, `npx tsc --noEmit`

## Task Tracking

- [ ] **Phase 1.1**: Add usdRate, cryptoPrices, exchangeRate to finance.store.ts
- [ ] **Phase 1.2**: Pipe DataProvider state into stores (write-through)
- [ ] **Phase 1.3**: Update pages to read scalar state from stores
- [ ] **Phase 2.1**: Create commands/ directory with domain files
- [ ] **Phase 2.2**: Split functions into domain files, update barrel
- [ ] **Phase 3.1**: Add custom subagents to opencode.json + prompt files
- [ ] **Phase 3.2**: Run subagents and verify
- [ ] **Phase 4.1**: Component updates
- [ ] **Phase 4.2**: Complex handler extraction
- [ ] **Phase 4.3**: Final cleanup
