import { Account, Transaction, Pot, SavingPocket } from "../../../types";
import {
  computeAccountChange,
  computePotChange,
  computePocketChange,
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

export const computeTransactionChanges = (
  tx: Transaction,
  factor: 1 | -1,
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  usdRate: number,
): {
  accountChanges: Map<string, number>;
  potChanges: Map<string, number>;
  pocketChanges: Map<string, number>;
} => ({
  accountChanges: new Map(computeAccountChange(tx, factor, accounts, usdRate)),
  potChanges: new Map(computePotChange(tx, factor, pots)),
  pocketChanges: new Map(computePocketChange(tx, factor, pockets)),
});
