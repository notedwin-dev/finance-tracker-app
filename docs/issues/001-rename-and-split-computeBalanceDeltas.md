# Refactor: Rename and split `computeBalanceDeltas`

**Labels:** refactor, domain-layer

## Problem Statement

`computeBalanceDeltas` in `src/lib/domain/balance.engine.ts` computes three independent financial concepts — account credit/debit, budget consumption, and savings movement — but bundles them under a single function with jargon name ("Deltas"). The name doesn't tell the reader what the function does. The `BalanceDeltas` interface uses math terminology (Δ) instead of domain terminology.

## Solution

Split into three named functions, each telling exactly what it computes:

| Old | New | Returns |
|-----|-----|---------|
| `computeBalanceDeltas` (account part) | `computeAccountTransactionAmount` | `Map<accountId, number>` — the realised monetary impact in the account's currency |
| `computeBalanceDeltas` (pot part) | `computeBudgetConsumption` | `Map<potId, number>` — how much budget is consumed or replenished |
| `computeBalanceDeltas` (pocket part) | `computeSavingsMovement` | `Map<pocketId, number>` — how much savings are added or withdrawn |
| `BalanceDeltas` interface | Delete | No longer needed |

Each function takes only its required parameters — `computeBudgetConsumption` doesn't need `accounts`, `pockets`, or `usdRate`.

## Commits

### Commit 1 — Rename `computeBalanceDeltas` → `computeAccountTransactionAmount`

- Rename the function in `balance.engine.ts`
- Rename the interface to `AccountTransactionMap` (temporary — removed in commit 4)
- Update import + calls in `balance.engine.test.ts` (15 tests), `commands.ts` (4 call sites), `DataProvider.tsx` (2 call sites)
- Zero behavior change

### Commit 2 — Extract `computeBudgetConsumption` (pot logic)

- Copy pot logic (lines 70–90 of current file) into `computeBudgetConsumption(tx, factor, pots)` in `balance.engine.ts`
- The old function delegates to the new one (all callers still work)
- Add tests for `computeBudgetConsumption` — reduce signature (no accounts/pockets/usdRate)

### Commit 3 — Extract `computeSavingsMovement` (pocket logic)

- Copy pocket logic (lines 92–139) into `computeSavingsMovement(tx, factor, pockets)`
- Old function delegates to new one
- Add tests — simplified signature

### Commit 4 — Remove combined function, inline calls

- Delete `computeBalanceDeltas` (the original combined function)
- Delete `BalanceDeltas` interface
- Update 6 call sites across `commands.ts` and `DataProvider.tsx` to call all three functions individually and apply results separately

### Commit 5 — Reorganize tests

- Rename `describe("computeBalanceDeltas")` → `describe("computeAccountTransactionAmount")`
- Move pot tests → `describe("computeBudgetConsumption")`
- Move pocket tests → `describe("computeSavingsMovement")`
- Remove any composite-behavior tests that no longer apply

## Decision Document

- Functions use exact same logic from the original — no behavioral changes
- `computeBudgetConsumption` and `computeSavingsMovement` don't take `usdRate` because budget/spending uses raw transaction amounts, not currency-converted amounts
- The `factor: 1 | -1` parameter stays for now — cleaning up the apply/reverse pattern is a separate refactor
- All three functions return `Map<string, number>` for consistency
- The store action redesign (domain-meaningful actions vs raw setters) is deferred

## Testing Decisions

- **Good test**: calls a single function with known inputs, asserts the exact expected map values. No mocking needed — pure functions.
- **Prior art**: existing 22 tests in `balance.engine.test.ts` follow this pattern with `makeTx`/`makeAcc`/`makePot`/`makePocket` factory helpers
- Each new function gets its own `describe` block
- `npm run test` must pass after every commit

## Out of Scope

- Cleaning up the 6 call sites beyond switching 1 call → 3 calls
- The `factor: 1 | -1` pattern
- Store action redesign
- Changes to `currency.ts` or `convertAmount`
