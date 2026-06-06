import { Account, Pot, SavingPocket, Transaction } from "../../../../types";
import {
  computeAccountChange,
  computePotChange,
  computePocketChange,
} from "../../domain/balance.engine";
import { useFinanceStore } from "../../../stores/finance.store";
import { useSyncStore } from "../../../stores/sync.store";
import { normalizeDate } from "../../../../helpers/transactions.helper";
import * as StorageService from "../../../../services/storage.services";
import * as SheetService from "../../../../services/sheets.services";

export async function recalculateBalances(
  accounts: Account[],
  pots: Pot[],
  pockets: SavingPocket[],
  transactions: Transaction[],
  usdRate: number,
  profileId: string,
  isCloudEnabled: boolean,
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

    for (const [id, change] of computeAccountChange(t, 1, accounts, usdRate)) {
      accountUpdates.set(id, (accountUpdates.get(id) || 0) + change);
    }
    for (const [id, change] of computePotChange(t, 1, pots)) {
      potUpdates.set(id, (potUpdates.get(id) || 0) + change);
    }
    for (const [id, change] of computePocketChange(t, 1, pockets)) {
      pocketUpdates.set(id, (pocketUpdates.get(id) || 0) + change);
    }
  });

  const now = new Date().toISOString();
  const updatedAccounts = accounts.map((a) => ({
    ...a,
    balance: accountUpdates.get(a.id) ?? 0,
    updatedAt: now,
  }));
  const updatedPots = pots.map((p) => {
    const used = potUpdates.get(p.id) ?? 0;
    return {
      ...p,
      usedAmount: used,
      amountLeft: p.limitAmount - used,
      updatedAt: now,
    };
  });
  const updatedPockets = pockets.map((p) => ({
    ...p,
    currentAmount: pocketUpdates.get(p.id) ?? 0,
    updatedAt: now,
  }));

  if (!startDate && !endDate) {
    await Promise.all([
      StorageService.saveAccounts(updatedAccounts),
      StorageService.savePots(updatedPots),
      StorageService.savePockets(updatedPockets),
    ]);
  }
  store.setAccounts(updatedAccounts);
  store.setPots(updatedPots);
  store.setPockets(updatedPockets);

  if (isCloudEnabled && !startDate && !endDate) {
    if (updatedAccounts.length > 0) {
      await SheetService.updateMany("Accounts", updatedAccounts, [
        "balance",
        "updatedAt",
      ]);
    }
    if (updatedPots.length > 0) {
      await SheetService.updateMany("Pots", updatedPots, [
        "usedAmount",
        "amountLeft",
        "updatedAt",
      ]);
    }
    if (updatedPockets.length > 0) {
      await SheetService.updateMany("Pockets", updatedPockets, [
        "currentAmount",
        "updatedAt",
      ]);
    }
  }

  showToast("Recalculation complete", "success");
}
