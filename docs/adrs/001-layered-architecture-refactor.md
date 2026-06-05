# ADR-001: Layered Architecture Refactor

**Status:** Accepted (in progress)  
**Date:** 2026-06-01  
**Deciders:** Edwin  

---

## Context

The finance tracker app started as a prototype and grew organically. The `context/DataProvider.tsx` file became a 3000+ line monolith responsible for:

- State management (accounts, transactions, categories, pots, pockets, goals, subscriptions, chat sessions)
- Business logic (balance calculation per transaction, currency conversion, pot/pocket delta computation)
- Persistence (localStorage via `storage.services`, Google Sheets via `sheets.services`)
- UI concerns (toast notifications, loading state)
- Data synchronization (cloud sync, conflict resolution)

Key problems:

1. **No separation of concerns** — business logic is entangled with React state and persistence
2. **Duplicated logic** — `applyLegToBalances` + `getConvertedAmount` were copy-pasted across 4 handlers (~520 lines total)
3. **No testability** — pure business logic sits inside React context closures, impossible to unit test
4. **No clear boundaries** — infrastructure (sheets, storage, auth), application (commands), and domain (balance math) all live together
5. **Single-file fragility** — any change risks breaking unrelated features

---

## Decision

We will refactor into a **5-layer architecture** with strict dependency rules:

```
┌─────────────────────────────────────────────┐
│              Presentation Layer              │
│  pages/  components/  layouts/               │
│  (thin React components, feature folders)    │
├─────────────────────────────────────────────┤
│              Application Layer               │
│  src/lib/application/commands.ts             │
│  (orchestration: validate → domain → store   │
│   → persist, no React code)                 │
├─────────────────────────────────────────────┤
│               State Layer                    │
│  src/stores/*.store.ts                       │
│  (Zustand stores, holds state + dispatch)    │
├─────────────────────────────────────────────┤
│           Infrastructure Layer               │
│  src/lib/infrastructure/*.ts                 │
│  (interfaces + implementations: storage,     │
│   sheets, auth, AI, exchange rate, crypto)  │
├─────────────────────────────────────────────┤
│               Domain Layer                   │
│  src/lib/domain/*.ts                        │
│  (pure functions, no side effects,           │
│   no React, fully testable)                 │
└─────────────────────────────────────────────┘
```

### Dependency Rules

| Layer | Depends On |
|-------|-----------|
| Domain | Nothing (pure TS) |
| Infrastructure | Domain (types only) |
| State | Domain, Infrastructure |
| Application | Domain, State, Infrastructure |
| Presentation | State, Application |

No layer may import from a layer above it.

---

## Detailed Architecture

### 1. Domain Layer (`src/lib/domain/`)

Pure functions with explicit parameters — no global state, no React, no side effects.

| Module | Responsibility |
|--------|---------------|
| `currency.ts` | `convertAmount(amount, fromCurrency, toCurrency, usdRate)` |
| `balance.engine.ts` | `computeAccountTransactionAmount(tx, factor, accounts, usdRate)` → account delta map; `computeBudgetConsumption(tx, factor, pots)` → pot delta map; `computeSavingsMovement(tx, factor, pockets)` → pocket delta map |
| `transactions.ts` *(future)* | Validation, splitting, category inference |
| `accounts.ts` *(future)* | Balance aggregation, currency rollup |
| `pots.ts` *(future)* | Spending limit calculations |
| `pockets.ts` *(future)* | Savings pocket goal tracking |

Tests are co-located in `src/lib/domain/__tests__/`.

### 2. Infrastructure Layer (`src/lib/infrastructure/`)

Service interfaces and implementations. Interfaces are defined here so stores can depend on abstractions, not concretions.

| Interface | Implementations | Responsibility |
|-----------|----------------|----------------|
| `IStorageBackend` | `LocalStorageBackend` | Read/write data to local storage |
| `ICloudBackend` | `GoogleSheetsBackend` | Read/write data to Google Sheets |
| `IAuthService` | `GoogleAuthService` | OAuth login, profile management |
| `IAIService` | `GeminiService` | Chat completion, AI features |
| `IExchangeService` | `ExchangeRateService` | Fetch USD/MYR rate |
| `ICryptoService` | `CryptoPriceService` | Fetch crypto prices |

### 3. State Layer — Zustand Stores (`src/stores/`)

Split the single `DataContext` into focused stores:

| Store | State | Actions |
|-------|-------|---------|
| `finance.store.ts` | accounts, transactions, categories, pots, pockets, goals, subscriptions, chatSessions | CRUD handlers for each entity |
| `privacy.store.ts` | privacyMode, vault state (isVaultEnabled, isVaultCreated, isVaultUnlocked) | lockVault, unlockVault*, maskAmount, maskText |
| `sync.store.ts` | isSyncing, toast, hasSynced, isCloudEnabled | syncData, loadData, showToast |
| `ui.store.ts` | displayCurrency | setDisplayCurrency |

Each store uses Zustand with `persist` middleware (or delegates persistence to infrastructure layer). Stores remain independent — a transaction save in `finance.store` does not directly call Google Sheets. That happens in the application layer.

### 4. Application Layer (`src/lib/application/commands.ts`)

Commands orchestrate a full operation across multiple stores and infrastructure:

```
handleTransactionSubmit(tx) {
  1. Validate tx (domain)
  2. Compute balance deltas (domain: balance.engine)
  3. Apply deltas to finance.store
  4. Persist via IStorageBackend + ICloudBackend
  5. Show toast via sync.store
  6. Return result
}
```

Commands are plain async functions, not React hooks. They receive stores via function arguments (DI), making them testable without rendering React.

### 5. Presentation Layer (pages/, components/ layouts/)

Pages become thin — they call commands (or use Zustand hooks directly for reads) and render components. Feature folders group related components (e.g., `components/history/` for History page components).

---

## Key Decisions

### Vitest over Jest
- **Why:** Native Vite integration, zero additional config, faster cold starts, compatible with existing Vite setup.
- **Config:** `globals: true, environment: "jsdom", setupFiles: "./src/test-setup.ts"`

### Zustand over Redux / React Context
- **Why:** Minimal boilerplate, no action/reducer ceremony, built-in TypeScript inference, `persist` middleware for localStorage sync, subscribable outside React.
- **Why not Context:** The current `DataContext` causes re-renders of all consumers on any state change. Zustand's selector-based subscriptions avoid this.

### Pure Domain Functions over Class Methods
- **Why:** Simpler to test (no instantiation), tree-shakeable, no hidden `this` bugs, natural TypeScript inference.
- **Pattern:** `computeAccountTransactionAmount(tx, factor, accounts, usdRate)`, `computeBudgetConsumption(tx, factor, pots)`, `computeSavingsMovement(tx, factor, pockets)` — every dependency is explicit.

### `factor: 1 | -1` over Separate Apply/Reverse Functions
- **Why:** Balance operations are symmetric — applying a transaction (`factor = 1`) and reversing it (`factor = -1`) use the same logic with flipped sign. This eliminates the need for separate `applyLegToBalances` and `reverseLegToBalances`.

### Incremental Migration over Big Bang
- **Why:** 3000+ lines of untested production code cannot be rewritten in one pass. Each phase:
  1. Extracts a pure function + tests
  2. Wires it back into DataProvider (no behavioral change)
  3. Later, migrates the state to a Zustand store
  4. Finally, migrates the handler to an application command

### Balance Engine Replaces 4 Inline Copies
- `applyLegToBalances` was duplicated in `handleTransactionSubmit`, `handleTransactionDelete`, `handleBatchTransactionDelete`, and `recalculateBalances`.
- Extracted to three named functions — `computeAccountTransactionAmount` (account-level transaction amounts), `computeBudgetConsumption` (budget/pocket consumption), and `computeSavingsMovement` (transfers/savings adjustments) — forming a single source of truth, covered by 22 tests.
- Note: During extraction, a sign bug was **intentionally fixed**: `recalculateBalances` treated pocket adjustments with the wrong sign (positive for all adjustments) compared to the CRUD handlers (negative for non-income adjustments). The extracted functions match the CRUD handler behavior (which is exercised on every transaction), making `recalculateBalances` consistent.

---

## Phase Plan

### Phase 0: Tooling (✓ DONE)
- [x] Install Vitest, React Testing Library, jsdom, `@testing-library/jest-dom`
- [x] Configure `vite.config.ts` test block
- [x] Update `tsconfig.json` with vitest types
- [x] Create `src/` directory skeleton
- [x] Add test scripts to `package.json`

### Phase 1: Balance Engine Extraction (✓ DONE)
- [x] Extract `convertAmount` pure function + tests
- [x] Extract `computeBalanceDeltas` pure function + 22 tests
- [x] Wire `computeBalanceDeltas` into DataProvider (removed ~520 lines)
  - `handleTransactionSubmit`
  - `handleTransactionDelete`
  - `handleBatchTransactionDelete`
  - `recalculateBalances`

### Phase 2: Infrastructure Interfaces
- [ ] Define `IStorageBackend` interface
- [ ] Define `ICloudBackend` interface
- [ ] Define `IAuthService` interface
- [ ] Define `IAIService` interface
- [ ] Define `IExchangeService` interface
- [ ] Define `ICryptoService` interface
- [ ] Implement wrappers for existing services

### Phase 3: Zustand Stores
- [ ] Create `finance.store.ts` (accounts, transactions, categories, pots, pockets, goals, subscriptions, chatSessions + CRUD actions)
- [ ] Create `privacy.store.ts` (privacy mode, vault state, mask helpers)
- [ ] Create `sync.store.ts` (isSyncing, toast, sync state)
- [ ] Create `ui.store.ts` (displayCurrency)

### Phase 4: Application Commands
- [ ] Create `commands.ts` with orchestration functions
  - `submitTransaction(tx, stores, backends)`
  - `deleteTransaction(id, stores, backends)`
  - `batchDeleteTransaction(ids, stores, backends)`
  - `recalculateBalances(startDate, endDate, stores)`
  - Account/goal/pot/pocket CRUD commands

### Phase 5: Thin Pages + Feature Folders
- [ ] Migrate page components to read from Zustand stores
- [ ] Organize components into feature folders
- [ ] Add component tests with React Testing Library
- [ ] Remove or thin DataProvider to a migration shim

---

## Consequences

### Positive
1. Testable business logic — pure functions with no React dependency
2. Reduced cognitive load — each file has one responsibility
3. Faster re-renders — Zustand selectors prevent unnecessary renders
4. Parallel work possible — multiple people can work on different stores simultaneously
5. Framework-agnostic domain — could reuse domain functions in a backend or CLI tool
6. Smaller bundle — dead code elimination works better with small modules

### Negative
1. Migration effort — all consumers of `DataContext` must be updated to use Zustand stores
2. Learning curve — team must learn Zustand patterns
3. Boilerplate for interfaces — defining interfaces for every infrastructure concern

### Mitigations
- Migration is incremental — each phase is independently testable and revertible
- A compatibility layer (`useData` hook wrapping Zustand stores) can ease the transition
- Each interface is simple (3-5 methods) — minimal boilerplate

---

## Alternatives Considered

### Redux Toolkit
- **Rejected:** Too much ceremony (slices, actions, reducers, thunks) for an app of this size. Zustand provides equivalent capabilities with 90% less boilerplate.

### React Query (TanStack Query)
- **Rejected:** The app is primarily local-first with cloud sync, not server-state driven. React Query's caching/invalidation model doesn't align with the localStorage + Sheets sync pattern.

### Keep Context API
- **Rejected:** The current Context causes full-tree re-renders on any state change, lacks middleware, and encourages monolithic providers.

### Class-based Domain Model
- **Rejected:** Classes add complexity (instantiation, inheritance, `this` binding) without benefit. Pure functions are simpler to test and compose.

### Event Sourcing / CQRS
- **Rejected:** Overkill for a personal finance app. The current CRUD model is sufficient. Domain events could be added later if needed.

---

## References

- `context/DataProvider.tsx` — the monolith being refactored
- `context/DataContext.tsx` — current Context provider + consumer hook
- `context/types.ts` — `DataContextType` interface (105 lines)
- `src/lib/domain/balance.engine.ts` — extracted balance computation
- `src/lib/domain/currency.ts` — extracted currency conversion
- `src/lib/domain/__tests__/` — 22 tests for domain functions
