# Issue #4: Commands — extract remaining handlers from DataProvider

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/4

## Summary

Extract the 5 remaining complex handlers from DataProvider into `src/lib/application/commands/`.

## Rationale

After the prior migration, 5 handlers remain in DataProvider: `batchTransactionEdit`, `bulkTransactionImport`, `migrateData`, `resetAndSync`, and `recalculateBalances`. Each contains cloud sync logic that must be preserved.

## Sub-tasks

- [x] **B.1 — `batchEditTransactions`** — Extracted to `commands/transactions.ts`; `History.tsx` calls command directly (c5ea1c8)
- [x] **B.2 — `bulkImportTransactions`** — Extracted to `commands/transactions.ts`; `AccountPage.tsx` calls command directly (c5ea1c8)
- [ ] **B.3 — `migrateData`** — Extract `handleMigrateData` into a new sync command; update `Profile`/`MainLayout`
- [ ] **B.4 — `resetAndSync`** — Extract `handleResetAndSync` into a new sync command; update `Profile`/`MainLayout`
- [x] **B.5 — `recalculateBalances`** — Extracted to `commands/balance.ts`; `Profile.tsx` calls command directly (c5ea1c8)
- [x] **B.6 — Partial cleanup** — 5 dead signatures removed from `DataContextType`; corresponding implementations removed from DataProvider (c5ea1c8). Remaining: `handleMigrateData`, `handleResetAndSync`, `handleSelectExistingSheet`

## Verification

- Batch edit works on History page
- Bulk import works on AccountPage
- Data export/migrate/sync works from Profile
- Recalculate balances works from Profile
- 82+ tests pass

## Assignee

`commands-splitter` subagent (extracts to commands/) → `page-migrator` subagent (updates consumers)
