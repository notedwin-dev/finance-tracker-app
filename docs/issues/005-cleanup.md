# Issue #5: Cleanup — remove DataProvider and DataContext

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/5

## Summary

Remove the last remaining `useData()` references, then delete DataProvider, DataContext, and `context/types.ts`.

## Prerequisites

Depends on Issue #3 (privacy store) and Issue #4 (commands extraction) being complete — no handlers or state should remain in DataProvider.

## Sub-tasks

- [x] **C.1 — Switch ProfilePage data reads** — `ProfilePage` destructures `transactions`, `categories`, `pots`, `pockets` from `useData()` but they are already in `useFinanceStore`; trivial one-file switch
- [x] **C.2 — Verify no `useData()` consumers remain** — Run `grep` for `useData()` across all `.tsx` files; confirm 0 matches
- [x] **C.3 — Delete DataProvider, DataContext, types** — Remove `context/DataProvider.tsx`, `context/DataContext.tsx`, `context/types.ts`; remove `<DataProvider>` wrapper from App
- [x] **C.4 — Run tests and typecheck** — Confirm 147 tests pass (13 files) and `npx tsc --noEmit` is clean

## Verification

- App boots without DataProvider wrapper
- No `useData()` imports anywhere
- All existing functionality preserved
- 147 tests pass (13 files), 0 type errors

## Assignee

`page-migrator` subagent (last reads → stores) → cleanup
