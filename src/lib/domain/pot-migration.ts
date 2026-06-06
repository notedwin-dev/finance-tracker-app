import { Pot } from "../../../types";

export function migrateLegacyPot(raw: Record<string, unknown>): Pot {
  const migrated: Record<string, unknown> = { ...raw };

  if (migrated.limitAmount === undefined && migrated.targetAmount !== undefined) {
    migrated.limitAmount = Number(migrated.targetAmount);
  }
  if (migrated.amountLeft === undefined && migrated.currentAmount !== undefined) {
    migrated.amountLeft = Number(migrated.currentAmount);
  }
  if (migrated.usedAmount === undefined) {
    if (migrated.limitAmount !== undefined && migrated.amountLeft !== undefined) {
      migrated.usedAmount =
        Number(migrated.limitAmount) - Number(migrated.amountLeft);
    } else {
      migrated.usedAmount = 0;
    }
  }
  return migrated as unknown as Pot;
}
