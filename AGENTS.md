# ZenFinance Tracker — Agent Guide

## Project Structure

```text
finance-tracker-app/
├── components/         # React components (feature folders)
│   └── history/        #   History/search/filter components
├── pages/              # Page-level components
├── services/           # External service integrations (sheets, auth, gemini, etc.)
├── src/
│   ├── lib/
│   │   ├── domain/         # Pure business logic (no React, fully testable)
│   │   │   └── __tests__/  # Domain unit tests
│   │   ├── application/    # Command orchestration layer
│   │   │   └── __tests__/
│   │   └── infrastructure/ # Service interfaces + implementations
│   ├── stores/             # Zustand state management
│   │   └── __tests__/
│   └── test-setup.ts       # Vitest + React Testing Library setup
├── docs/
│   └── adrs/           # Architecture Decision Records
├── helpers/            # Utility/helper functions
├── layouts/            # Layout components
├── public/             # Static assets
├── dist/               # Build output (gitignored)
├── vite.config.ts      # Vite + Vitest configuration
└── tsconfig.json       # TypeScript configuration
```

## Git Branch Conventions

| Prefix     | Purpose                            | Example                          |
|------------|------------------------------------|----------------------------------|
| `feature/*` | New features                      | `feature/export-csv`             |
| `refactor/*` | Major code refactoring or UI revamp | `refactor/layered-architecture` |
| `bugfix/*`  | Bug fixes                        | `bugfix/search-overlay-crash`    |
| `staging`   | Pre-production review branch      | `staging`                        |
| `main`      | Production branch (deployed)      | `main`                           |

### Workflow

1. Create branch from `main`: `feature/xxx`, `bugfix/xxx`, or `refactor/xxx`
2. Develop and commit on the feature branch
3. Push and open a PR to `staging` branch
4. Review changes on `staging`
5. Merge `staging` into `main` after approval
6. `main` auto-deploys to Vercel

## Architecture Decision Records

ADRs are in `docs/adrs/`. Each ADR documents a significant architectural decision:

- **ADR-001**: Layered architecture refactor (domain → infrastructure → stores → commands → presentation)

Read the latest ADR before making architectural changes to understand current decisions and constraints.

## How to Document Processes

### Adding a new ADR

1. Create `docs/adrs/NNN-title-kebab-case.md`
2. Use template from existing ADR (Context → Decision → Consequences → Status)
3. Number sequentially

### Daily process documentation

- Significant decisions go in ADRs
- Task tracking uses `todowrite` during sessions
- Session summaries go in commit messages

## Testing Convention

- **Domain functions**: Pure unit tests (Vitest, no jsdom needed)
- **Zustand stores**: Store action tests (Vitest + jsdom)
- **React components**: Component tests (Vitest + React Testing Library + jsdom)
- **Run all tests**: `npm run test`
- **Watch mode**: `npm run test:watch`
- **Test files**: Co-located in `__tests__/` directories

## Domain Layer Rules

- Pure functions only — no React, no side effects, no imports from `services/` or `stores/`. State lives in Zustand stores under `src/stores/`; React components never call storage or sheet services directly — they go through command handlers in `src/lib/application/commands/`.
- All dependencies must be explicit parameters
- One module per file, co-located tests in `__tests__/`
- Use `TransactionType` enum from types for type discrimination

## Style

- Avoid comments — prefer self-documenting code
- Tailwind CSS for styling (utility-first)

## Key Domain Functions

| Module | Function | Purpose |
|--------|----------|---------|
| `src/lib/domain/currency.ts` | `convertAmount()` | MYR/USD conversion |
| `src/lib/domain/balance.engine.ts` | `computeAccountTransactionAmount()` | Account balance impact per transaction |
| `src/lib/domain/balance.engine.ts` | `computeBudgetConsumption()` | Budget consumed/replenished per transaction |
| `src/lib/domain/balance.engine.ts` | `computeSavingsMovement()` | Savings added/withdrawn per transaction |
| `src/lib/domain/search.ts` | `matchesSearch()` | Transaction text matching |

## Environment Variables (`.env`)

- `VITE_BACKEND_API_URL` — Backend URL (empty = Vite proxy)
- `VITE_GEMINI_API_KEY` — Gemini API key
- `VITE_GOOGLE_API_KEY` — Google API key

Note: `.env`, `.agents/`, `node_modules/`, `dist/`, `build/`, `.next/` are gitignored. `docs/` is NOT ignored (rule is commented out in `.gitignore`).

## Agent skills

### Issue tracker

GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses 5 default labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

## Session Log

### Goal & Chat Refactoring (Previous Session)

- **Goal actions** (`saveGoal`, `deleteGoal`) → extracted from DataProvider to `src/lib/application/commands.ts`
- **Subscription actions** (`addSubscription`, `deleteSubscription`) → extracted from DataProvider to `src/lib/application/commands.ts`
- **Chat session actions** (`saveChatSession`, `deleteChatSession`) → extracted from DataProvider to `src/lib/application/commands.ts`
- **GoalsPage** now reads goals from `useFinanceStore` and calls domain commands
- **MainLayout** reads `goals`, `subscriptions`, `chatSessions` from `useFinanceStore` and calls domain commands
- **DataContext type** (`context/types.ts`) removed the 6 migrated handler signatures
- **DataProvider** removed the 6 handler implementations and their context value entries
- **Finance store bugfix** (`src/stores/finance.store.ts:84`) — `setChatSessions` used incorrect shorthand `{ chatSessions }` when parameter is `sessions`; fixed to `{ chatSessions: sessions }`

### Prior Session (Pot, Pocket & Account Migration)

- **Pot/pocket commands** (`savePot`, `deletePot`, `saveSavingPocket`, `deleteSavingPocket`) — added to `src/lib/application/commands.ts`
- **Account commands** (`saveAccount`, `deleteAccount`) — added to `src/lib/application/commands.ts`
- **GoalsPage** — switched pots, pockets, accounts from `useData()` to `useFinanceStore`; uses new pot/pocket commands
- **MainLayout** — switched accounts, pots, pockets from `useData()` to `useFinanceStore`; uses new account commands
- **DashboardPage** — switched accounts, transactions, categories, pots from `useData()` to `useFinanceStore`
- **AssetsPage** — switched accounts, pots, transactions from `useData()` to `useFinanceStore`
- **HistoryPage** — switched data to `useFinanceStore`; uses `deleteTransaction` command instead of `handleTransactionDelete`
- **AccountPage** — switched data to `useFinanceStore`; uses `deleteTransaction` command instead of `handleTransactionDelete`
- **ProfilePage** — switched goals, subscriptions, chatSessions from `useData()` to `useFinanceStore`
- **DataProvider** — removed `handleAccountSave`, `handleAccountDelete`, `handlePotSave`, `handlePotDelete`, `handlePocketSave`, `handlePocketDelete` (6 handlers) and their context value entries
- **DataContextType** (`context/types.ts`) — removed 6 handler signatures

### Parallel Refactor (This Session — 2026-06-03)

- **Refactored** `computeBalanceDeltas` → `computeAccountTransactionAmount`, `computeBudgetConsumption`, `computeSavingsMovement` — 82 tests pass
- **Created 6 permanent subagents** (`~/.config/opencode/agents/`): code-reviewer, test-writer, git-smith, tech-writer, debugger, architect
- **Created 3 refactor subagents** (`opencode.json`): state-migrator, commands-splitter, page-migrator
- **Phase 1.1+1.2** (*state-migrator agent*): Added `usdRate`, `cryptoPrices`, `exchangeRate` to `finance.store.ts`; piped DataProvider exchange/crypto/toast/security state into stores via write-through wrappers
- **Phase 2** (*commands-splitter agent*): Split `commands.ts` (625 lines) into 10 domain files in `commands/` directory; `commands.ts` now barrel re-export
- **Phase 1.3** (*page-migrator agent*): DashboardPage, AssetsPage, AccountPage, HistoryPage, History component — scalar state reads switched from `useData()` to `useFinanceStore`; HistoryPage and AssetsPage fully off `useData()`
- **Setup mattpocock skills**: Created `docs/agents/issue-tracker.md`, `triage-labels.md`, `domain.md`
