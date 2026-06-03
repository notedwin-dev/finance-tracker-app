import { Transaction, TransactionType, Account, Pot, SavingPocket } from "../../../types";
import { normalizeDate } from "../../../helpers/transactions.helper";
import { convertAmount } from "./currency";

export function computeBudgetConsumption(
  t: Transaction,
  factor: 1 | -1,
  pots: Pot[],
): Map<string, number> {
  const potDeltas = new Map<string, number>();

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
