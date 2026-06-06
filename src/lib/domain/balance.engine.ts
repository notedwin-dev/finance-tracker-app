import { Transaction, TransactionType, Account, Pot, SavingPocket } from "../../../types";
import { normalizeDate } from "./dates";
import { convertAmount } from "./currency";

export interface AccumulatedDeltas {
  accountDeltas: Map<string, number>;
  potDeltas: Map<string, number>;
  pocketDeltas: Map<string, number>;
}

export function accumulateDeltas(
  txs: Transaction[],
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  factor: 1 | -1,
  usdRate: number,
): AccumulatedDeltas {
  const accountDeltas = new Map<string, number>();
  const potDeltas = new Map<string, number>();
  const pocketDeltas = new Map<string, number>();

  for (const t of txs) {
    for (const [id, delta] of computeAccountTransactionAmount(t, factor, accounts, usdRate)) {
      accountDeltas.set(id, (accountDeltas.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeBudgetConsumption(t, factor, pots)) {
      potDeltas.set(id, (potDeltas.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeSavingsMovement(t, factor, pockets)) {
      pocketDeltas.set(id, (pocketDeltas.get(id) || 0) + delta);
    }
  }

  return { accountDeltas, potDeltas, pocketDeltas };
}

export function mergeDeltas(...groups: AccumulatedDeltas[]): AccumulatedDeltas {
  const accountDeltas = new Map<string, number>();
  const potDeltas = new Map<string, number>();
  const pocketDeltas = new Map<string, number>();
  for (const g of groups) {
    for (const [id, d] of g.accountDeltas) accountDeltas.set(id, (accountDeltas.get(id) || 0) + d);
    for (const [id, d] of g.potDeltas) potDeltas.set(id, (potDeltas.get(id) || 0) + d);
    for (const [id, d] of g.pocketDeltas) pocketDeltas.set(id, (pocketDeltas.get(id) || 0) + d);
  }
  return { accountDeltas, potDeltas, pocketDeltas };
}

export function materializeDeltas(
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  deltas: AccumulatedDeltas,
  now: string,
): { accounts: Account[]; pots: Pot[]; pockets: SavingPocket[] } {
  const updatedAccounts =
    deltas.accountDeltas.size > 0
      ? accounts.map((a) => {
          const d = deltas.accountDeltas.get(a.id);
          return d !== undefined ? { ...a, balance: a.balance + d, updatedAt: now } : a;
        })
      : accounts;

  const updatedPots =
    deltas.potDeltas.size > 0
      ? pots.map((p) => {
          const d = deltas.potDeltas.get(p.id);
          if (d === undefined) return p;
          const newUsedAmount = Math.max(0, p.usedAmount + d);
          return {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
            updatedAt: now,
          };
        })
      : pots;

  const updatedPockets =
    deltas.pocketDeltas.size > 0
      ? pockets.map((p) => {
          const d = deltas.pocketDeltas.get(p.id);
          if (d === undefined) return p;
          const newCurrentAmount = Math.max(0, p.currentAmount + d);
          return { ...p, currentAmount: newCurrentAmount, updatedAt: now };
        })
      : pockets;

  return { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets };
}

export function computeBudgetConsumption(
  t: Transaction,
  factor: 1 | -1,
  pots: Pot[],
): Map<string, number> {
  const potDeltas = new Map<string, number>();

  if (t.isHistorical) return potDeltas;

  if (t.potId) {
    const potId = String(t.potId);
    const pot = pots.find((p) => p.id === potId);
    const txDateStr = normalizeDate(t.date);
    const isAfterPotReset =
      pot && (!pot.resetDate || txDateStr >= normalizeDate(pot.resetDate));

    if (isAfterPotReset) {
      let potDelta = 0;
      if (
        t.type === TransactionType.INCOME ||
        t.type === TransactionType.ACCOUNT_OPENING
      ) {
        potDelta = -t.amount * factor;
      } else {
        potDelta = t.amount * factor;
      }
      potDeltas.set(potId, (potDeltas.get(potId) || 0) + potDelta);
    }
  }

  return potDeltas;
}

export function computeSavingsMovement(
  t: Transaction,
  factor: 1 | -1,
  pockets: SavingPocket[],
): Map<string, number> {
  const pocketDeltas = new Map<string, number>();

  if (t.isHistorical) return pocketDeltas;

  if (t.savingPocketId) {
    const pocket = pockets.find((p) => p.id === t.savingPocketId);
    const txDateStr = normalizeDate(t.date);
    const isAfterPocketReset =
      pocket && (!pocket.resetDate || txDateStr >= normalizeDate(pocket.resetDate));

    if (isAfterPocketReset) {
      const sourceAmount = t.amount;
      let pocketDelta = 0;
      if (
        t.type === TransactionType.INCOME ||
        t.type === TransactionType.ACCOUNT_OPENING
      ) {
        pocketDelta = t.amount * factor;
      } else {
        pocketDelta = -sourceAmount * factor;
      }
      pocketDeltas.set(
        t.savingPocketId,
        (pocketDeltas.get(t.savingPocketId) || 0) + pocketDelta,
      );
    }
  }

  if (
    t.type === TransactionType.TRANSFER &&
    t.toSavingPocketId &&
    !t.transferDirection &&
    !t.linkedTransactionId
  ) {
    const pocket = pockets.find((p) => p.id === t.toSavingPocketId);
    const txDateStr = normalizeDate(t.date);
    const isAfterPocketReset =
      pocket && (!pocket.resetDate || txDateStr >= normalizeDate(pocket.resetDate));

    if (isAfterPocketReset) {
      const fee = t.fee || 0;
      const feeType = t.feeType || "INCLUSIVE";
      const targetAmount =
        feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
      pocketDeltas.set(
        t.toSavingPocketId,
        (pocketDeltas.get(t.toSavingPocketId) || 0) + targetAmount * factor,
      );
    }
  }

  return pocketDeltas;
}

export function computeAccountTransactionAmount(
  t: Transaction,
  factor: 1 | -1,
  accounts: Account[],
  usdRate: number,
): Map<string, number> {
  const accountDeltas = new Map<string, number>();

  if (t.isHistorical) return accountDeltas;

  const acc = accounts.find((a) => a.id === t.accountId);
  if (acc) {
    const amt = convertAmount(t.amount, t.currency, acc.currency, usdRate);
    const fee = t.fee ? convertAmount(t.fee, t.currency, acc.currency, usdRate) : 0;
    const feeType = t.feeType || "INCLUSIVE";

    let delta = 0;
    const isInflow =
      t.type === TransactionType.INCOME ||
      t.type === TransactionType.ACCOUNT_OPENING ||
      (t.type === TransactionType.ADJUSTMENT && t.amount >= 0) ||
      (t.type === TransactionType.TRANSFER && t.transferDirection === "IN");

    if (isInflow) {
      const addedAmount =
        t.type === TransactionType.TRANSFER && feeType === "EXCLUSIVE"
          ? amt - fee
          : amt;
      delta = addedAmount * factor;
    } else {
      const removedAmount = feeType === "INCLUSIVE" ? amt + fee : amt;
      delta = -removedAmount * factor;
    }
    accountDeltas.set(t.accountId, (accountDeltas.get(t.accountId) || 0) + delta);

    if (
      t.type === TransactionType.TRANSFER &&
      t.toAccountId &&
      !t.transferDirection &&
      !t.linkedTransactionId
    ) {
      const toAcc = accounts.find((a) => a.id === t.toAccountId);
      if (toAcc) {
        const toAmt = convertAmount(t.amount, t.currency, toAcc.currency, usdRate);
        const toFee = t.fee ? convertAmount(t.fee, t.currency, toAcc.currency, usdRate) : 0;
        const addedAmount = feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
        accountDeltas.set(
          t.toAccountId,
          (accountDeltas.get(t.toAccountId) || 0) + addedAmount * factor,
        );
      }
    }
  }

  return accountDeltas;
}
