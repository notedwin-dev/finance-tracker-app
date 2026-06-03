# Issue #4: Commands — extract remaining handlers from DataProvider

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/4

## Summary

Extract the 5 remaining complex handlers from DataProvider into `src/lib/application/commands/`.

## Rationale

After the prior migration, 5 handlers remain in DataProvider: `batchTransactionEdit`, `bulkTransactionImport`, `migrateData`, `resetAndSync`, and `recalculateBalances`. Each contains cloud sync logic that must be preserved.

## Sub-tasks

- [ ] **B.1 — `batchEditTransactions`** — Extract `handleBatchTransactionEdit` into `commands/transactions.ts`; update `History.tsx` to call command
- [ ] **B.2 — `bulkImportTransactions`** — Extract `handleBulkTransactionImport` into `commands/transactions.ts`; update `AccountPage.tsx` to call command
- [ ] **B.3 — `migrateData`** — Extract `handleMigrateData` into a new sync command; update `Profile`/`MainLayout`
- [ ] **B.4 — `resetAndSync`** — Extract `handleResetAndSync` into a new sync command; update `Profile`/`MainLayout`
- [ ] **B.5 — `recalculateBalances`** — Extract `recalculateBalances` into `commands/balance.ts`; update `Profile.tsx`
- [ ] **B.6 — Cleanup** — Remove all 5 handlers from DataProvider and their signatures from `DataContextType`

## Verification

- Batch edit works on History page
- Bulk import works on AccountPage
- Data export/migrate/sync works from Profile
- Recalculate balances works from Profile
- 82+ tests pass

## Assignee

`commands-splitter` subagent (extracts to commands/) → `page-migrator` subagent (updates consumers)
