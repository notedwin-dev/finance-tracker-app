# AGENTS.md

Conventions for AI agents working in this repository.

## Commands

```bash
npm test              # vitest run - run once
npm run test:watch    # vitest - watch mode
npm run build         # vite build
npx tsc --noEmit      # typecheck
```

## Workflow: test-first

Write the failing test **before** the implementation, and watch it fail for the
right reason. A test that fails on a typo or a bad import path tells you
nothing; confirm the failure is the missing behavior.

Then make it pass with the least code that works. Then refactor, keeping tests
green.

Never retrofit tests onto code you just wrote and call it TDD. If you already
know the answer, say so rather than staging a fake red phase — but do run a real
red-green-refactor on anything you could not have specified up front.

### Verify tests are not vacuous

A green suite proves nothing on its own. For any non-trivial logic, confirm the
tests actually fail when the logic is broken — temporarily reintroduce the bug,
run the suite, count the failures, then restore. A test that survives its own
regression is decoration.

This catches bugs you wrote. It does **not** catch a wrong assumption baked into
both your implementation and your test. Derive test cases from the requirement,
not from reading your own code.

## Testability rules

- **Keep logic out of React closures.** Anything inside a component body is
  unreachable from tests. Extract it to a service module with dependencies
  injected (`isSecurityEnabled`, `totpSecret`, `isUnlocked`) and keep a thin
  wrapper in the component that binds local state. See
  `services/account-crypto.services.ts` for the established pattern.
- **Tests must exercise production code.** Never re-implement a production loop
  inside a test file. If a test needs a helper the app does not have, extract
  the real one — a test that runs its own copy of the logic passes no matter
  what the app does.
- **Don't assume call order under concurrency.** `Promise.all` over mocked calls
  is nondeterministic. Key mocks off payload content (`data.includes(...)`),
  never off "first call wins".
- **jsdom lacks `crypto.subtle`.** `test/setup.ts` polyfills it from Node's
  `webcrypto`. Use real crypto in tests rather than mocking it away.

## Security invariants

Account details are encrypted client-side before they reach Google Sheets. The
following are non-negotiable and must be covered by tests:

- **No plaintext `details` may ever enter an outbound cloud payload** while the
  security layer is enabled.
- **Never trust the `isEncrypted` flag.** Inspect `details` via
  `isCipherText()`. The flag can disagree with reality — `decryptAccount` resets
  details to `{}` when the key is unavailable, which historically left accounts
  flagged encrypted while holding plaintext.
- **One failure must not abort a batch.** An unencryptable account is dropped
  from the payload with a warning; it does not fail the sync.
- **Never log or persist decrypted account details** in a `console.*` call.

If a change touches `services/account-crypto.services.ts`, add a test that fails
before the change and passes after. If you cannot state the failing test, the
change is not understood well enough to make.

## Known pre-existing failures

`npx tsc --noEmit` reports 6 errors in `services/storage.services.ts` (legacy
`isVaultEnabled` / `isVaultCreated` / `isVaultLocked` / `vaultSalt` /
`biometricCredId` fields missing from `UserProfile`). These predate current
work — do not treat them as regressions, and do not count them as introduced by
your change.