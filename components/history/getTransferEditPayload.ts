import { Transaction, TransactionType } from "../../types";
import { GroupedTransaction } from "../../helpers/transactions.helper";

export function getTransferEditPayload(
  t: GroupedTransaction,
  transactions: Transaction[],
): { baseTx: Transaction; partnerTx?: Transaction } {
  let baseTx: Transaction = t;
  let partnerTx: Transaction | undefined = t.linkedTransaction;

  if (t.type === TransactionType.TRANSFER && !partnerTx) {
    partnerTx = transactions.find(
      (pt) =>
        pt.linkedTransactionId === t.id ||
        (t.linkedTransactionId === pt.id &&
          pt.accountId === t.toAccountId &&
          pt.toAccountId === t.accountId),
    );
  }

  if (t.type === TransactionType.TRANSFER && t.transferDirection === "IN") {
    if (partnerTx) {
      baseTx = partnerTx;
      partnerTx = t;
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
      partnerTx = t;
    }
  }

  return { baseTx, partnerTx };
}

export function prepareTransactionForEdit(
  t: Transaction,
  transactions: Transaction[],
): any {
  const { baseTx, partnerTx } = getTransferEditPayload(t, transactions);
  const txToEdit = { ...baseTx } as any;
  if (partnerTx) {
    txToEdit.isToAccountHistorical = partnerTx.isHistorical;
    txToEdit.linkedTransaction = partnerTx;
  }
  return txToEdit;
}
