import { Transaction, TransactionType, Account, Pot, SavingPocket } from "../../../types";
import { normalizeDate } from "./dates";
import { convertAmount } from "./currency";

export interface AccumulatedChanges {
  accountChanges: Map<string, number>;
  potChanges: Map<string, number>;
  pocketChanges: Map<string, number>;
}

export function sumChanges(
  txs: Transaction[],
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  factor: 1 | -1,
  usdRate: number,
): AccumulatedChanges {
  const accountChanges = new Map<string, number>();
  const potChanges = new Map<string, number>();
  const pocketChanges = new Map<string, number>();

  for (const t of txs) {
    for (const [id, change] of computeAccountChange(t, factor, accounts, usdRate)) {
      accountChanges.set(id, (accountChanges.get(id) || 0) + change);
    }
    for (const [id, change] of computePotChange(t, factor, pots)) {
      potChanges.set(id, (potChanges.get(id) || 0) + change);
    }
    for (const [id, change] of computePocketChange(t, factor, pockets)) {
      pocketChanges.set(id, (pocketChanges.get(id) || 0) + change);
    }
  }

  return { accountChanges, potChanges, pocketChanges };
}

export function addChanges(...groups: AccumulatedChanges[]): AccumulatedChanges {
  const accountChanges = new Map<string, number>();
  const potChanges = new Map<string, number>();
  const pocketChanges = new Map<string, number>();
  for (const g of groups) {
    for (const [id, change] of g.accountChanges) {
      accountChanges.set(id, (accountChanges.get(id) || 0) + change);
    }
    for (const [id, change] of g.potChanges) {
      potChanges.set(id, (potChanges.get(id) || 0) + change);
    }
    for (const [id, change] of g.pocketChanges) {
      pocketChanges.set(id, (pocketChanges.get(id) || 0) + change);
    }
  }
  return { accountChanges, potChanges, pocketChanges };
}

export function applyChanges(
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  changes: AccumulatedChanges,
  now: string,
): { accounts: Account[]; pots: Pot[]; pockets: SavingPocket[] } {
  const updatedAccounts =
    changes.accountChanges.size > 0
      ? accounts.map((a) => {
          const change = changes.accountChanges.get(a.id);
          return change !== undefined
            ? { ...a, balance: a.balance + change, updatedAt: now }
            : a;
        })
      : accounts;

  const updatedPots =
    changes.potChanges.size > 0
      ? pots.map((p) => {
          const change = changes.potChanges.get(p.id);
          if (change === undefined) return p;
          const newUsedAmount = Math.max(0, p.usedAmount + change);
          return {
            ...p,
            usedAmount: newUsedAmount,
            amountLeft: p.limitAmount - newUsedAmount,
            updatedAt: now,
          };
        })
      : pots;

  const updatedPockets =
    changes.pocketChanges.size > 0
      ? pockets.map((p) => {
          const change = changes.pocketChanges.get(p.id);
          if (change === undefined) return p;
          const newCurrentAmount = Math.max(0, p.currentAmount + change);
          return { ...p, currentAmount: newCurrentAmount, updatedAt: now };
        })
      : pockets;

  return { accounts: updatedAccounts, pots: updatedPots, pockets: updatedPockets };
}

export function computePotChange(
  t: Transaction,
  factor: 1 | -1,
  pots: Pot[],
): Map<string, number> {
  const potChanges = new Map<string, number>();

  if (t.isHistorical) return potChanges;

  if (t.potId) {
    const potId = String(t.potId);
    const pot = pots.find((p) => p.id === potId);
    const txDateStr = normalizeDate(t.date);
    const isAfterPotReset =
      pot && (!pot.resetDate || txDateStr >= normalizeDate(pot.resetDate));

    if (isAfterPotReset) {
      const consumesBudget =
        t.type !== TransactionType.INCOME &&
        t.type !== TransactionType.ACCOUNT_OPENING;
      const change = consumesBudget ? t.amount * factor : -t.amount * factor;
      potChanges.set(potId, (potChanges.get(potId) || 0) + change);
    }
  }

  return potChanges;
}

export function computePocketChange(
  t: Transaction,
  factor: 1 | -1,
  pockets: SavingPocket[],
): Map<string, number> {
  const pocketChanges = new Map<string, number>();

  if (t.isHistorical) return pocketChanges;

  if (t.savingPocketId) {
    const txDateStr = normalizeDate(t.date);
    const isAfterReset = isActivePocket(t.savingPocketId, pockets, txDateStr);
    if (isAfterReset) {
      const addsToPocket =
        t.type === TransactionType.INCOME ||
        t.type === TransactionType.ACCOUNT_OPENING;
      const change = addsToPocket ? t.amount * factor : -t.amount * factor;
      pocketChanges.set(
        t.savingPocketId,
        (pocketChanges.get(t.savingPocketId) || 0) + change,
      );
    }
  }

  if (
    t.type === TransactionType.TRANSFER &&
    t.toSavingPocketId &&
    !t.transferDirection &&
    !t.linkedTransactionId
  ) {
    const txDateStr = normalizeDate(t.date);
    const isAfterReset = isActivePocket(t.toSavingPocketId, pockets, txDateStr);
    if (isAfterReset) {
      const fee = t.fee || 0;
      const feeType = t.feeType || "INCLUSIVE";
      const targetAmount = feeType === "EXCLUSIVE" ? t.amount - fee : t.amount;
      pocketChanges.set(
        t.toSavingPocketId,
        (pocketChanges.get(t.toSavingPocketId) || 0) + targetAmount * factor,
      );
    }
  }

  return pocketChanges;
}

export function computeAccountChange(
  t: Transaction,
  factor: 1 | -1,
  accounts: Account[],
  usdRate: number,
): Map<string, number> {
  const accountChanges = new Map<string, number>();

  if (t.isHistorical) return accountChanges;

  const acc = accounts.find((a) => a.id === t.accountId);
  if (!acc) return accountChanges;

  const sourceChange = computeSourceAccountChange(t, acc, usdRate, factor);
  accountChanges.set(t.accountId, (accountChanges.get(t.accountId) || 0) + sourceChange);

  const counterChange = computeSingleRecordTransferCounterChange(t, accounts, usdRate, factor);
  if (counterChange !== null && t.toAccountId) {
    accountChanges.set(
      t.toAccountId,
      (accountChanges.get(t.toAccountId) || 0) + counterChange,
    );
  }

  return accountChanges;
}

const isInflowTransaction = (t: Transaction): boolean => {
  if (t.type === TransactionType.INCOME) return true;
  if (t.type === TransactionType.ACCOUNT_OPENING) return true;
  if (t.type === TransactionType.ADJUSTMENT && t.amount >= 0) return true;
  if (t.type === TransactionType.TRANSFER && t.transferDirection === "IN") return true;
  return false;
};

const isActivePocket = (
  pocketId: string,
  pockets: SavingPocket[],
  txDateStr: string,
): boolean => {
  const pocket = pockets.find((p) => p.id === pocketId);
  if (!pocket) return false;
  if (!pocket.resetDate) return true;
  return txDateStr >= normalizeDate(pocket.resetDate);
};

const computeSourceAccountChange = (
  t: Transaction,
  acc: Account,
  usdRate: number,
  factor: 1 | -1,
): number => {
  const amt = convertAmount(t.amount, t.currency, acc.currency, usdRate);
  const fee = t.fee ? convertAmount(t.fee, t.currency, acc.currency, usdRate) : 0;
  const feeType = t.feeType || "INCLUSIVE";

  if (isInflowTransaction(t)) {
    const addedAmount =
      t.type === TransactionType.TRANSFER && feeType === "EXCLUSIVE"
        ? amt - fee
        : amt;
    return addedAmount * factor;
  }
  const removedAmount = feeType === "INCLUSIVE" ? amt + fee : amt;
  return -removedAmount * factor;
};

const isSingleRecordTransfer = (t: Transaction): boolean =>
  t.type === TransactionType.TRANSFER &&
  !!t.toAccountId &&
  !t.transferDirection &&
  !t.linkedTransactionId;

const computeSingleRecordTransferCounterChange = (
  t: Transaction,
  accounts: Account[],
  usdRate: number,
  factor: 1 | -1,
): number | null => {
  if (!isSingleRecordTransfer(t) || !t.toAccountId) return null;
  const toAcc = accounts.find((a) => a.id === t.toAccountId);
  if (!toAcc) return null;
  const toAmt = convertAmount(t.amount, t.currency, toAcc.currency, usdRate);
  const toFee = t.fee ? convertAmount(t.fee, t.currency, toAcc.currency, usdRate) : 0;
  const feeType = t.feeType || "INCLUSIVE";
  const addedAmount = feeType === "EXCLUSIVE" ? toAmt - toFee : toAmt;
  return addedAmount * factor;
};
