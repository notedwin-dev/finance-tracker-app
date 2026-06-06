# Round 4 Refactor Plan

**Status:** Approved (executing)
**Date:** 2026-06-06
**Branch:** `bugfix/pr10-coderabbit-cleanup`
**Related:** CodeRabbit round 4 review (PR #10)

## Context

The round 4 CodeRabbit review flagged 28 findings. The small ones were fixed in commit `9743b8c` (PR #15). Three findings were skipped as "large refactors" because they would each warrant their own commit and require careful planning. This plan breaks them into atomic tasks and documents the approach before any code changes.

## Goals

1. **Refactor A: Route component extraction** — Replace inline JSX comments in `App.tsx` with named route components. Self-documenting structure.
2. **Refactor B: `processSubscriptions` → domain functions** — Extract pure domain logic from `src/lib/application/commands/sync.ts` into `src/lib/domain/subscriptions.ts`, per ADR-001 (application = orchestration, domain = pure functions).
3. **Refactor C: `submitTransaction` → domain functions** — Extract `isCrossCurrency` validation and `applyDeltas` orchestration into `src/lib/domain/transaction.ts` to match the pattern already established by `balance.engine.ts`.

## Non-Goals

- No behavioral changes — refactors only. All existing tests must pass unchanged.
- No changes to other commands (`accounts.ts`, `balance.ts`, `categories.ts`, etc.) beyond what these three require.
- No public API renames that would force PR #10 to be rebased again.

---

## Refactor A: Route Component Extraction

**Files touched:** 1 created, 1 modified
**Commit:** 1
**Risk:** Low (UI-only, route structure unchanged)

### Current state (`App.tsx:50-76`)

```tsx
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<AuthPage />} />
  <Route path="/privacy" element={<PrivacyPolicy />} />
  <Route path="/terms" element={<TermsOfService />} />

  <Route
    path="/app"
    element={
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    }
  >
    <Route index element={<DashboardPage />} />
    <Route path="history" element={<HistoryPage />} />
    ...
  </Route>

  <Route path="/404" element={<NotFound />} />
  <Route path="*" element={<Navigate to="/404" replace />} />
</Routes>
```

### Target state

```tsx
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<AuthPage />} />
  <Route path="/privacy" element={<PrivacyPolicy />} />
  <Route path="/terms" element={<TermsOfService />} />

  <Route path="/app" element={<ProtectedAppShell />}>
    <Route index element={<DashboardPage />} />
    <Route path="history" element={<HistoryPage />} />
    ...
  </Route>

  <Route path="/404" element={<NotFound />} />
  <Route path="*" element={<Navigate to="/404" replace />} />
</Routes>
```

Where `ProtectedAppShell` is a small component in `App.tsx` that wraps `<ProtectedRoute><MainLayout /></ProtectedRoute>`. The 4 public routes are not extracted into a separate file — they live inline in `App.tsx` because they're tiny and the public/protected boundary is now obvious from `ProtectedAppShell`.

### Tasks

1. **A.1** — Add `ProtectedAppShell` component to `App.tsx` that returns `<ProtectedRoute><MainLayout /></ProtectedRoute>`.
2. **A.2** — Replace the inline `<Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>` with `<Route element={<ProtectedAppShell />}>`. Update children routes unchanged.
3. **A.3** — Run `npx tsc --noEmit` and `npm test`. Commit.

---

## Refactor B: `processSubscriptions` → Domain Functions

**Files touched:** 1 created, 1 modified, 1 test created
**Commit:** B
**Risk:** Medium (logic extraction, but pure functions with no side effects in domain)

### Current state (`src/lib/application/commands/sync.ts:144-278`)

`processSubscriptions` mixes:
- Date advancement (parse → next-date math)
- Transaction object construction
- Currency conversion (USD/MYR with `usdRate`)
- Dedupe by tx.id
- Storage I/O (`StorageService.getStoredSubscriptions`, `getStoredTransactions`, `getStoredProfile`, `saveTransactions`, `saveSubscriptions`, `saveAccounts`)
- Store mutations (`useFinanceStore.getState().set*`)
- Toast

### Target state

**`src/lib/domain/subscriptions.ts`** (new file) — 4 pure functions:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `computeNextOccurrences` | `(sub: Subscription, today: string, maxIterations?: number) => { nextDateStr: string; generatedTxDates: string[]; bailed: boolean }` | Walks the sub's recurrence from `nextPaymentDate` to `today`, returning every due date and the final next-payment date. Pure. |
| `buildSubscriptionTransaction` | `(sub: Subscription, date: string, userId: string) => Transaction` | Builds the Transaction object for a given sub + date. Pure. |
| `convertTransactionAmountForAccount` | `(tx: Transaction, account: Account, usdRate: number, rateValid: boolean) => number` | Returns the amount in the account's currency, or 0 if cross-currency and rate invalid. Pure. |
| `dedupeTransactions` | `(existing: Transaction[], candidates: Transaction[]) => Transaction[]` | Filters out candidates whose `id` already exists in `existing`. Pure. |

**`src/lib/application/commands/sync.ts`** — `processSubscriptions` becomes a thin orchestrator:

```ts
import {
  computeNextOccurrences,
  buildSubscriptionTransaction,
  convertTransactionAmountForAccount,
  dedupeTransactions,
} from "../../domain/subscriptions";

export function processSubscriptions(accounts, usdRate, options = { persist: true }) {
  const { persist = true } = options;
  const subs = StorageService.getStoredSubscriptions();
  const currentTxs = StorageService.getStoredTransactions();
  const today = new Date().toLocaleDateString("en-CA");
  const storedProfile = StorageService.getStoredProfile();
  const currentUserId = storedProfile.id || "guest";
  const rateValid = usdRate > 0 && isFinite(usdRate);

  if (!rateValid) {
    logger.warn("processSubscriptions: usdRate invalid, cross-currency subs will be skipped");
  }

  let processedCount = 0;
  const updatedSubs = subs.map((sub) => {
    if (!sub.active) return sub;
    const { nextDateStr, generatedTxDates, bailed } = computeNextOccurrences(sub, today);
    if (!nextDateStr) {
      logger.warn(`processSubscriptions: invalid nextPaymentDate for sub ${sub.id}, skipping`);
      return sub;
    }
    const newTxs = generatedTxDates.map((d) => buildSubscriptionTransaction(sub, d, currentUserId));
    generatedTxDates.forEach(() => (processedCount += 1));
    return bailed
      ? { ...sub, nextPaymentDate: nextDateStr }
      : generatedTxDates.length > 0
        ? { ...sub, nextPaymentDate: nextDateStr, updatedAt: new Date().toISOString() }
        : { ...sub, nextPaymentDate: nextDateStr };
  });

  if (newTxs.length === 0) {
    if (persist) StorageService.saveSubscriptions(updatedSubs);
    useFinanceStore.getState().setSubscriptions(updatedSubs);
    return;
  }

  const dedupedNewTxs = dedupeTransactions(currentTxs, newTxs);
  ...
}
```

**`src/lib/domain/__tests__/subscriptions.test.ts`** (new) — tests for each of the 4 domain functions, covering: empty input, single occurrence, multiple occurrences, bail-out at `MAX_ITERATIONS`, weekly/monthly/yearly/daily frequencies, cross-currency amount conversion (USD/MYR), dedupe by id, dedupe with no overlap.

### Tasks

1. **B.1** — Create `src/lib/domain/subscriptions.ts` with `computeNextOccurrences` + its 4 test cases in `__tests__/subscriptions.test.ts`.
2. **B.2** — Add `buildSubscriptionTransaction` to `subscriptions.ts` + 2 tests (basic + subscription id linkage).
3. **B.3** — Add `convertTransactionAmountForAccount` to `subscriptions.ts` + 4 tests (same currency, USD→MYR, MYR→USD, invalid rate).
4. **B.4** — Add `dedupeTransactions` to `subscriptions.ts` + 3 tests (no overlap, full overlap, partial overlap).
5. **B.5** — Refactor `processSubscriptions` in `sync.ts` to call the 4 domain functions. Keep orchestration (storage, store, toast) in the command. Preserve existing behavior including the `updatedSubs` persistence on empty-dedup path (already fixed in round 3).
6. **B.6** — Run `npx tsc --noEmit` and `npm test`. Existing tests must still pass. Commit.

---

## Refactor C: `submitTransaction` → Domain Functions

**Files touched:** 1 created, 1 modified, 1 test created
**Commit:** C
**Risk:** Medium

### Current state (`src/lib/application/commands/transactions.ts:44-72`)

```ts
const isCrossCurrency = (acc: Account | undefined) =>
  !!acc &&
  acc.currency !== tx.currency &&
  (tx.currency === "USD" || tx.currency === "MYR") &&
  (acc.currency === "USD" || acc.currency === "MYR");

if (usdRate <= 0 && (isCrossCurrency(txAccount) || isCrossCurrency(toAccount))) {
  showToast("Exchange rate not loaded...", "alert");
  return;
}

const accountUpdates = new Map<string, number>();
const potUpdates = new Map<string, number>();
const pocketUpdates = new Map<string, number>();

const applyDeltas = (t: Transaction, factor: 1 | -1) => {
  for (const [id, delta] of computeAccountTransactionAmount(t, factor, accounts, usdRate)) {
    accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
  }
  for (const [id, delta] of computeBudgetConsumption(t, factor, pots)) {
    potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
  }
  for (const [id, delta] of computeSavingsMovement(t, factor, pockets)) {
    pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
  }
};
```

`isCrossCurrency` is pure (depends only on args). `applyDeltas` writes to 3 closure-scoped Maps — not pure, but the *pattern* (map 3 entities from a tx) is pure if we return the maps instead of mutating closures.

### Target state

**`src/lib/domain/transaction.ts`** (new file) — 2 functions:

```ts
export const isCrossCurrency = (tx: Transaction, acc: Account | undefined): boolean => {
  if (!acc) return false;
  if (acc.currency === tx.currency) return false;
  if (!["USD", "MYR"].includes(tx.currency)) return false;
  return ["USD", "MYR"].includes(acc.currency);
};

export const computeTransactionDeltas = (
  tx: Transaction,
  factor: 1 | -1,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
): { accountDeltas: Map<string, number>; potDeltas: Map<string, number>; pocketDeltas: Map<string, number> } => {
  const accountDeltas = new Map(computeAccountTransactionAmount(tx, factor, accounts, usdRate));
  const potDeltas = new Map(computeBudgetConsumption(tx, factor, pots));
  const pocketDeltas = new Map(computeSavingsMovement(tx, factor, pockets));
  return { accountDeltas, potDeltas, pocketDeltas };
};
```

**`src/lib/application/commands/transactions.ts:44-72`** — refactored to use the domain functions:

```ts
import { isCrossCurrency, computeTransactionDeltas } from "../../domain/transaction";

if (usdRate <= 0 && (isCrossCurrency(tx, txAccount) || isCrossCurrency(tx, toAccount))) {
  showToast("Exchange rate not loaded...", "alert");
  return;
}

const accountUpdates = new Map<string, number>();
const potUpdates = new Map<string, number>();
const pocketUpdates = new Map<string, number>();

const accumulateDeltas = (t: Transaction, factor: 1 | -1) => {
  const { accountDeltas, potDeltas, pocketDeltas } = computeTransactionDeltas(t, factor, accounts, pots, pockets, usdRate);
  for (const [id, delta] of accountDeltas) accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
  for (const [id, delta] of potDeltas) potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
  for (const [id, delta] of pocketDeltas) pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
};
```

The local `accumulateDeltas` is an *orchestration* concern (it merges into the cumulative maps), not a domain concern. Keeping it in the command matches the ADR-001 split.

**`src/lib/domain/__tests__/transaction.test.ts`** (new) — tests for:
- `isCrossCurrency`: same currency returns false; USD→MYR/MYR→USD returns true; non-USD/MYR base returns false; missing account returns false; self-currency (USD→USD) returns false.
- `computeTransactionDeltas`: account-only tx returns 1 account delta, 0 pot, 0 pocket; pot tx returns 1 pot delta; pocket tx returns 1 pocket delta; factor -1 flips signs.

### Tasks

1. **C.1** — Create `src/lib/domain/transaction.ts` with `isCrossCurrency` + 5 tests.
2. **C.2** — Add `computeTransactionDeltas` to `transaction.ts` + 4 tests (uses the existing `makeTx`/`makeAcc`/`makePot`/`makePocket` factories from `balance.engine.test.ts`).
3. **C.3** — Refactor `transactions.ts:44-72` to import and use the domain functions. Keep the `accumulateDeltas` orchestrator in the command.
4. **C.4** — Run `npx tsc --noEmit` and `npm test`. Commit.

---

## Execution Order

1. **Refactor A** (1 commit) — small, low risk, builds confidence.
2. **Refactor B** (1 commit) — biggest extraction, but pure functions, easily testable.
3. **Refactor C** (1 commit) — smaller extraction, follows the pattern from B.

Each refactor validated independently. After all three, the round 4 review is fully addressed.

## Validation

After each refactor:
- `npx tsc --noEmit` — must be clean
- `npm test -- --run` — all existing tests still pass; new tests pass

After all three:
- `npx tsc --noEmit` — clean
- `npm test -- --run` — all tests pass
- Manual smoke: open app, submit a transaction, run a subscription, see normal behavior

## Out of Scope

- Refactoring other commands (`accounts.ts`, `balance.ts`, `categories.ts`) — not flagged in this review.
- Adding new tests for orchestration (commands) — only domain gets new tests.
- Renaming or restructuring existing domain modules — `balance.engine.ts` stays as-is.

## Risks

- **Refactor B**: The current `processSubscriptions` has subtle invariants (e.g., `nextDateStr` advances correctly through DST, `MAX_ITERATIONS` bail-out). The tests must cover these to catch regressions.
- **Refactor C**: `isCrossCurrency` accepts `(acc: Account | undefined)` and the call sites pass `txAccount` and `toAccount` (which can be undefined). The signature must keep the optional account parameter to match.

## Rollback

Each refactor is its own commit. If any commit breaks tests, revert that single commit. The PR will only merge the working commits.
