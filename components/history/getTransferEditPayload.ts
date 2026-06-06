import { Transaction, TransactionType } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";

function getTransferEditPayload(
  t: GroupedTransaction,
  transactions: Transaction[],
): { baseTx: Transaction; linkedRecord?: Transaction } {
  let baseTx: Transaction = t;
  let linkedRecord: Transaction | undefined = t.linkedTransaction;

  if (t.type === TransactionType.TRANSFER && !linkedRecord) {
    linkedRecord = transactions.find(
      (pt) =>
        pt.linkedTransactionId === t.id ||
        (t.linkedTransactionId === pt.id &&
          pt.accountId === t.toAccountId &&
          pt.toAccountId === t.accountId),
    );
  }

  if (t.type === TransactionType.TRANSFER && t.transferDirection === "IN") {
    if (linkedRecord) {
      baseTx = linkedRecord;
      linkedRecord = t;
    } else {
      baseTx = {
        ...t,
        accountId: t.toAccountId || "",
        toAccountId: t.accountId,
        transferDirection: "OUT" as const,
        savingPocketId: t.toSavingPocketId,
        toSavingPocketId: t.savingPocketId,
        isHistorical: false,
      };
      linkedRecord = t;
    }
  }

  return { baseTx, linkedRecord };
}

export function prepareTransactionForEdit(
  t: Transaction,
  transactions: Transaction[],
): any {
  const { baseTx, linkedRecord } = getTransferEditPayload(t, transactions);
  const txToEdit = { ...baseTx } as any;
  if (linkedRecord) {
    txToEdit.isToAccountHistorical = linkedRecord.isHistorical;
    txToEdit.linkedTransaction = linkedRecord;
  }
  return txToEdit;
}
