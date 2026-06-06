import { describe, it, expect } from "vitest";
import { accumulateDeltas, materializeDeltas, mergeDeltas } from "../balance.engine";
import { Transaction, TransactionType, Account, Pot, SavingPocket } from "../../../../types";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "t",
  userId: "u1",
  type: TransactionType.EXPENSE,
  amount: 100,
  currency: "MYR",
  accountId: "a1",
  categoryId: "c1",
  shopName: "Test",
  date: "2026-06-15",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
  ...overrides,
});

const account = (overrides: Partial<Account>): Account => ({
  id: "a1",
  userId: "u1",
  name: "Main",
  type: "CASH",
  currency: "MYR",
  balance: 1000,
  color: "#000",
  iconType: "EMOJI",
  iconValue: "💰",
  ...overrides,
});

const pot = (overrides: Partial<Pot>): Pot => ({
  id: "p1",
  userId: "u1",
  name: "Groceries",
  accountId: "a1",
  limitAmount: 500,
  usedAmount: 0,
  amountLeft: 500,
  currency: "MYR",
  color: "#000",
  icon: "💰",
  ...overrides,
});

const pocket = (overrides: Partial<SavingPocket>): SavingPocket => ({
  id: "pk1",
  userId: "u1",
  name: "Vacation",
  currentAmount: 0,
  currency: "MYR",
  color: "#000",
  icon: "💰",
  ...overrides,
});

const NOW = "2026-06-15T12:00:00.000Z";

describe("accumulateDeltas", () => {
  it("returns empty maps for an empty tx list", () => {
    const r = accumulateDeltas([], [account({})], [pot({})], [pocket({})], 1, 4.45);
    expect(r.accountDeltas.size).toBe(0);
    expect(r.potDeltas.size).toBe(0);
    expect(r.pocketDeltas.size).toBe(0);
  });

  it("accumulates positive deltas with factor=+1", () => {
    const txs = [tx({ type: TransactionType.EXPENSE, amount: 100 })];
    const r = accumulateDeltas(txs, [account({})], [], [], 1, 4.45);
    expect(r.accountDeltas.get("a1")).toBe(-100);
  });

  it("accumulates negative deltas with factor=-1", () => {
    const txs = [tx({ type: TransactionType.EXPENSE, amount: 100 })];
    const r = accumulateDeltas(txs, [account({})], [], [], -1, 4.45);
    expect(r.accountDeltas.get("a1")).toBe(100);
  });

  it("accumulates pot and pocket deltas", () => {
    const txs = [tx({ potId: "p1", savingPocketId: "pk1", type: TransactionType.EXPENSE, amount: 50 })];
    const r = accumulateDeltas(txs, [account({})], [pot({})], [pocket({})], 1, 4.45);
    expect(r.accountDeltas.get("a1")).toBe(-50);
    expect(r.potDeltas.get("p1")).toBe(50);
    expect(r.pocketDeltas.get("pk1")).toBe(-50);
  });
});

describe("mergeDeltas", () => {
  it("sums delta maps across groups", () => {
    const g1 = { accountDeltas: new Map([["a1", 10]]), potDeltas: new Map(), pocketDeltas: new Map() };
    const g2 = { accountDeltas: new Map([["a1", 5], ["a2", 7]]), potDeltas: new Map(), pocketDeltas: new Map() };
    const r = mergeDeltas(g1, g2);
    expect(r.accountDeltas.get("a1")).toBe(15);
    expect(r.accountDeltas.get("a2")).toBe(7);
  });

  it("merges pot and pocket maps independently", () => {
    const g1 = { accountDeltas: new Map(), potDeltas: new Map([["p1", 1]]), pocketDeltas: new Map() };
    const g2 = { accountDeltas: new Map(), potDeltas: new Map(), pocketDeltas: new Map([["pk1", 2]]) };
    const r = mergeDeltas(g1, g2);
    expect(r.potDeltas.get("p1")).toBe(1);
    expect(r.pocketDeltas.get("pk1")).toBe(2);
  });
});

describe("materializeDeltas", () => {
  it("returns the same arrays when no deltas", () => {
    const accounts = [account({})];
    const pots = [pot({})];
    const pockets = [pocket({})];
    const r = materializeDeltas(accounts, pots, pockets, { accountDeltas: new Map(), potDeltas: new Map(), pocketDeltas: new Map() }, NOW);
    expect(r.accounts).toBe(accounts);
    expect(r.pots).toBe(pots);
    expect(r.pockets).toBe(pockets);
  });

  it("applies account deltas with new balance and updatedAt", () => {
    const r = materializeDeltas(
      [account({ balance: 1000 })],
      [],
      [],
      { accountDeltas: new Map([["a1", -250]]), potDeltas: new Map(), pocketDeltas: new Map() },
      NOW,
    );
    expect(r.accounts[0].balance).toBe(750);
    expect(r.accounts[0].updatedAt).toBe(NOW);
  });

  it("clamps pot usedAmount to 0 and recomputes amountLeft", () => {
    const r = materializeDeltas(
      [],
      [pot({ usedAmount: 50, amountLeft: 450 })],
      [],
      { accountDeltas: new Map(), potDeltas: new Map([["p1", -100]]), pocketDeltas: new Map() },
      NOW,
    );
    expect(r.pots[0].usedAmount).toBe(0);
    expect(r.pots[0].amountLeft).toBe(500);
  });

  it("clamps pocket currentAmount to 0", () => {
    const r = materializeDeltas(
      [],
      [],
      [pocket({ currentAmount: 100 })],
      { accountDeltas: new Map(), potDeltas: new Map(), pocketDeltas: new Map([["pk1", -200]]) },
      NOW,
    );
    expect(r.pockets[0].currentAmount).toBe(0);
  });
});
