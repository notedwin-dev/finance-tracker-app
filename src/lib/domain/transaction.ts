import { Account, Transaction, Pot, SavingPocket } from "../../../types";
import {
  computeAccountTransactionAmount,
  computeBudgetConsumption,
  computeSavingsMovement,
} from "./balance.engine";

export const isCrossCurrency = (
  tx: Pick<Transaction, "currency">,
  acc: Pick<Account, "currency"> | undefined,
): boolean => {
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
): {
  accountDeltas: Map<string, number>;
  potDeltas: Map<string, number>;
  pocketDeltas: Map<string, number>;
} => ({
  accountDeltas: new Map(computeAccountTransactionAmount(tx, factor, accounts, usdRate)),
  potDeltas: new Map(computeBudgetConsumption(tx, factor, pots)),
  pocketDeltas: new Map(computeSavingsMovement(tx, factor, pockets)),
});
