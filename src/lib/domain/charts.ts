import { Transaction, TransactionType } from "../../../types";
import { convertAmount } from "./currency";
import { toYMD } from "./dates";

export interface MonthlyAggregate {
  income: number;
  expense: number;
}

export function aggregateMonthly(
  transactions: Transaction[],
  monthStr: string,
  usdRate: number,
  displayCurrency: "MYR" | "USD",
): MonthlyAggregate {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!toYMD(t.date).startsWith(monthStr)) continue;
    if (t.type === TransactionType.INCOME) {
      income += convertAmount(t.amount, t.currency, displayCurrency, usdRate);
    } else if (t.type === TransactionType.EXPENSE) {
      expense += convertAmount(t.amount, t.currency, displayCurrency, usdRate);
    } else if (t.type === TransactionType.TRANSFER && t.fee) {
      expense += convertAmount(t.fee, t.currency, displayCurrency, usdRate);
    }
  }
  return { income, expense };
}
