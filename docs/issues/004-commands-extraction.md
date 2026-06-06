# Issue #4: Commands — extract remaining handlers from DataProvider

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/4

## Summary

Extract the 3 remaining handlers from DataProvider into `src/lib/application/commands/`.

## Rationale

After the prior migration, 3 handlers remain in DataProvider: `handleMigrateData`, `handleResetAndSync`, and `handleSelectExistingSheet`.

## Sub-tasks

- [x] **B.1 — `batchEditTransactions`** — Extracted to `commands/transactions.ts`; `History.tsx` calls command directly (c5ea1c8)
- [x] **B.2 — `bulkImportTransactions`** — Extracted to `commands/transactions.ts`; `AccountPage.tsx` calls command directly (c5ea1c8)
- [x] **B.3 — `migrateData`** — Extracted to `commands/sync.ts`; `Profile.tsx` calls command directly (76a60ac)
- [x] **B.4 — `resetAndSync`** — Extracted to `commands/sync.ts`; `Profile.tsx` calls command directly (76a60ac)
- [x] **B.5 — `recalculateBalances`** — Extracted to `commands/balance.ts`; `Profile.tsx` calls command directly (c5ea1c8)
- [x] **B.6 — Partial cleanup** — 5 dead signatures removed from `DataContextType`; corresponding implementations removed from DataProvider (c5ea1c8). Remaining: `handleMigrateData`, `handleResetAndSync`, `handleSelectExistingSheet`

## Verification

- Batch edit works on History page
- Bulk import works on AccountPage
- Data export/migrate/sync works from Profile
- Recalculate balances works from Profile
- 147 tests pass (13 files)

## Assignee

`commands-splitter` subagent (extracts to commands/) → `page-migrator` subagent (updates consumers)
