# Plan: Complete Layer Migration — DataProvider → Stores + Commands

## Vision

Replace the 2,879-line `DataProvider.tsx` monolith with focused **Zustand stores** (state) and **application commands** (logic). Data flows in one direction:

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
│   │   └── commands.ts    ← Orchestration (grows domain by domain)
├── stores/                ← Zustand (4 stores exist, will be wired in)
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
  → Command (submitTransaction in commands.ts)
    → Domain logic (computeAccountTransactionAmount / computeBudgetConsumption / computeSavingsMovement)
    → Store update (useFinanceStore.getState().addTransaction)
    → Persistence (storage.services.save)
    → Toast (useSyncStore.getState().showToast)
  → UI re-render (Zustand selector fires)
```

## Migration Order

Each domain follows the same pattern:

1. **DataProvider pipes into store** — after loading data, calls `store.setXxx(data)`
2. **Handler extracted to command** — move logic from DataProvider to `commands.ts`
3. **Component switched to store** — change `useData().xxx` → `useFinanceStore(s => s.xxx)`
4. **Handler removed from DataProvider** — dead code cleaned up

| # | Domain | Complexity | Existing Commands | Handlers to Extract | Components to Migrate |
|---|--------|-----------|-------------------|---------------------|----------------------|
| 1 | Categories | Low | — | saveCategory, deleteCategory | CategoryManager |
| 2 | Goals | Low | — | updateGoal, deleteGoal | Goals (page) |
| 3 | Subscriptions | Low | — | addSubscription, deleteSubscription | SubscriptionManager |
| 4 | Chat Sessions | Low | — | saveChatSession, deleteChatSession | AIInsights |
| 5 | Pots | Low | — | savePot, deletePot | Budgets (page) |
| 6 | Pockets | Medium | — | savePocket, deletePocket | AssetsPage |
| 7 | Accounts | Medium | — | saveAccount, deleteAccount | AccountCard, AccountForm, AccountPage |
| 8 | Transactions | Very High | submit, delete, batchDelete | batchEdit (309 lines), bulkImport (120 lines) | History, Dashboard, Charts |
| 9 | Mask Mode | Medium | — | mask-mode toggles (replaces vault handlers) | Auth, Profile |
| 10 | Sync | Very High | — | syncData (464 lines) | DataProvider itself |
| 11 | Cleanup | — | — | — | Remove DataProvider, DataContext, dead code |

## Commit Plan

### Phase 1: Foundation (1 commit)

```text
Commit 1: DataProvider pipes loaded data into Zustand stores
  - After loadData completes, call:
    useFinanceStore.getState().setAccounts(data.accounts)
    useFinanceStore.getState().setTransactions(data.transactions)
    ... etc for all 8 entity types
  - No behavioral change — DataProvider still owns state
  - Stores now mirror DataProvider's state for read-side migration
```

### Phase 2: Simple Domains (8 small commits)

```text
Commit 2: Extract Category commands + store wiring
  - Create saveCategory, deleteCategory in commands.ts
  - Switch CategoryManager from useData() to useFinanceStore()
  - Remove category handlers from DataProvider

Commit 3: Extract Goal commands
  - create/update/delete goal commands
  - Switch GoalsPage from useData() to useFinanceStore()

Commit 4: Extract Subscription commands
  - Switch SubscriptionManager

Commit 5: Extract Chat Session commands
  - Switch AIInsights

Commit 6: Extract Pot commands
  - Switch Budgets page components

Commit 7: Extract Pocket commands
  - Switch AssetsPage

Commit 8: Extract Account commands
  - Switch AccountCard, AccountForm, AccountPage

Commit 9: Verify all simple domains migrated
  - No more useData() calls for categories, goals, subs, chats, pots, pockets, accounts
  - Confirm tests pass
```

### Phase 3: Transactions Domain (3-4 commits, split into sub-tasks)

```text
Commit 10: Extract batchEditTransaction to command
  - 309-line handler in DataProvider → commands.ts
  - Split into smaller sub-tasks

Commit 11: Extract bulkImport transaction command

Commit 12: Switch History page components to useFinanceStore()
  - SearchOverlay, TransactionItem, FiltersPanel, BatchActionBar

Commit 13: Switch Dashboard + Charts to useFinanceStore()
```

### Phase 4: Mask Mode + Sync (2-3 commits)

```text
Commit 14: Create mask-mode commands (toggle setMaskMode, mask helpers)
  - Switch Auth and Profile components

Commit 15: Extract syncData to sync command
  - The 464-line beast — split into sub-tasks
  - Sync command orchestrates: fetch → merge → store → toast

Commit 16: Final sync — DataProvider becomes thin
```

### Phase 5: Cleanup (1-2 commits)

```text
Commit 17: Remove DataContext
  - All components now use stores directly
  - Delete context/DataContext.tsx

Commit 18: Remove DataProvider
  - Move any remaining bootstrapping to App.tsx
  - Delete context/DataProvider.tsx
  - Remove unused imports across codebase
```

## Task Granularity

Tasks exceeding ~100 lines of extraction get their own spec document under `docs/plans/` with sub-tasks spawned as subagents:

- `docs/plans/batch-edit-transaction.md` (309 lines, extract from DataProvider)
- `docs/plans/bulk-import-transaction.md` (120 lines)
- `docs/plans/sync-data.md` (464 lines, the most complex piece)
- `docs/plans/transaction-commands.md` (overall transaction migration plan)

Each spec includes:
- Current code location (file + line range)
- Target interface in commands.ts
- Test strategy
- Component migration checklist

## Testing Strategy

- **New commands**: Added to `src/lib/application/__tests__/commands.test.ts` alongside existing transaction command tests
- **Store changes**: Tested via existing store test files
- **Component migration**: Each component switch is verified by existing component tests
- **No behavioral regressions**: After each phase, verify the app loads, displays data, and handles CRUD operations

## Out of Scope

- The backend repo (`finance-tracker-app-backend`). No API integration, no tRPC, no shared types.
- CSS/styling refactors — components keep their current Tailwind classes
- Adding new features — this is pure extraction, no behavioral changes
- Performance optimization — Zustand's selector-based rendering is already an improvement over Context
- Mobile/responsive improvements
- Migration to a different storage backend (Sheets stays until backend API is ready)

## How Each Domain Migration Works

Detailed pattern for extracting a domain handler:

### Before (in DataProvider.tsx)

```typescript
const [categories, setCategories] = useState<Category[]>([]);

const handleCategorySave = async (cat: Category) => {
  const updated = [...categories.filter(c => c.id !== cat.id), cat];
  setCategories(updated);
  await storageService.save({ categories: updated });
};
```

### After

**commands.ts:**

```typescript
export async function saveCategory(cat: Category): Promise<void> {
  const store = useFinanceStore.getState();
  store.addCategory(cat); // or update
  await storageService.save({ categories: [...store.categories] });
  useSyncStore.getState().showToast("Category saved", "success");
}
```

**Component:**

```typescript
// Before
const { categories, handleCategorySave } = useData();
// After
const categories = useFinanceStore(s => s.categories);
const handleCategorySave = (cat: Category) => saveCategory(cat);
```

**DataProvider:**

```typescript
// After loading data from Sheets:
const store = useFinanceStore.getState();
store.setCategories(loadedCategories);
```
