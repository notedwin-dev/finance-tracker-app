import { Account, Pot, SavingPocket, Transaction } from "../../../../types";
import {
  computeAccountTransactionAmount,
  computeBudgetConsumption,
  computeSavingsMovement,
} from "../../domain/balance.engine";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { normalizeDate } from "../../../../helpers/transactions.helper";

export async function recalculateBalancesCommand(
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  transactions: Transaction[],
  usdRate: number,
  startDate?: string,
  endDate?: string,
): Promise<void> {
  const store = useFinanceStore.getState();
  const { showToast } = useSyncStore.getState();

  const accountUpdates = new Map<string, number>();
  const potUpdates = new Map<string, number>();
  const pocketUpdates = new Map<string, number>();

  accounts.forEach((a) => accountUpdates.set(a.id, 0));
  pots.forEach((p) => potUpdates.set(p.id, 0));
  pockets.forEach((p) => pocketUpdates.set(p.id, 0));

  transactions.forEach((t) => {
    const txDateStr = normalizeDate(t.date);
    if (startDate && txDateStr < normalizeDate(startDate)) return;
    if (endDate && txDateStr > normalizeDate(endDate)) return;

    for (const [id, delta] of computeAccountTransactionAmount(t, 1, accounts, usdRate)) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeBudgetConsumption(t, 1, pots)) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + delta);
    }
    for (const [id, delta] of computeSavingsMovement(t, 1, pockets)) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + delta);
    }
  });

  const now = new Date().toISOString();
  store.setAccounts(
    accounts.map((a) => ({ ...a, balance: accountUpdates.get(a.id) ?? 0, updatedAt: now })),
  );
  store.setPots(
    pots.map((p) => {
      const used = potUpdates.get(p.id) ?? 0;
      return { ...p, usedAmount: used, amountLeft: p.limitAmount - used, updatedAt: now };
    }),
  );
  store.setPockets(
    pockets.map((p) => ({ ...p, currentAmount: pocketUpdates.get(p.id) ?? 0, updatedAt: now })),
  );

  showToast("Recalculation complete", "success");
}
