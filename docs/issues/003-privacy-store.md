# Issue #3: Privacy store — migrate masking from DataProvider

**Labels**: `refactor`, `ready-for-agent`
**Link**: https://github.com/notedwin-dev/finance-tracker-app/issues/3

## Summary

Move mask UI state (`maskAmount`, `maskText`, `privacyMode`) from DataProvider into `mask.store.ts` (renamed from `privacy.store.ts` after the vault was dropped — see ADR-002).

## Rationale

Masking is a UI-only concern; once the vault was dropped, the privacy store no longer needed the vault state. Masking is currently scattered across 11 components via `useData()`.

## Sub-tasks

- [x] **A.1 — Add mask UI state** — `maskAmount`, `maskText`, `privacyMode`, `setPrivacyMode` in `mask.store.ts`
- [x] **A.2 — Update mask consumers** — Switched `DashboardPage`, `History`, `AccountPage`, `AccountCard`, `Goals`, `Charts`, `SubscriptionManager`, `Profile`, `MainLayout` to read from `useMaskStore`
- [x] **A.3 — Cleanup** — Removed mask state and handlers from DataProvider context and `DataContextType`
- Vault subtasks (A.2, A.3, A.5 in the original issue) were dropped per ADR-002.

## Verification

- Mask/hide toggle works on Dashboard, History, Account pages
- 147 tests pass (13 files)
- No new TypeScript errors

## Assignee

`state-migrator` subagent (adds state to store + pipes from DataProvider) → `page-migrator` subagent (updates consumers)
