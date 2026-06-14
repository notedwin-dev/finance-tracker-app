import { useOutletContext } from "react-router-dom";
import { useFinanceStore } from "../../../stores/finance.store";
import { Transaction } from "../../../../types";
import { deleteTransaction } from "../../../lib/application/commands";

interface HistoryHandlers {
  onAddTransaction: () => void;
  onEditTransaction: (t: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export function useHistoryHandlers(): HistoryHandlers {
  const { setShowAddModal, setEditingTransaction } = useOutletContext<{
    setShowAddModal: (b: boolean) => void;
    setEditingTransaction: (t: Transaction | null) => void;
  }>();
  const { accounts, pots, pockets, usdRate, transactions } = useFinanceStore();

  return {
    onAddTransaction: () => setShowAddModal(true),
    onEditTransaction: (t) => {
      setEditingTransaction(t);
      setShowAddModal(true);
    },
    onDeleteTransaction: (id) =>
      deleteTransaction(id, accounts, pots, pockets, usdRate, transactions),
  };
}
