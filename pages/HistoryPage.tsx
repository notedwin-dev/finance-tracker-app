import React, { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import History from "../components/History";
import { useData } from "../context/DataContext";

const HistoryPage: React.FC = () => {
  const {
    transactions,
    categories,
    accounts,
    pockets,
    handleTransactionDelete,
  } = useData();
  const { showAddModal, setShowAddModal, setEditingTransaction } =
    useOutletContext<any>();

  const expandedTransactions = React.useMemo(() => {
    const results: any[] = [];
    transactions.forEach((t) => {
      if (
        t.type === "TRANSFER" &&
        t.toAccountId &&
        t.accountId !== t.toAccountId &&
        !t.transferDirection &&
        !t.linkedTransactionId
      ) {
        // Create OUT leg
        results.push({ ...t, transferDirection: "OUT" });
        // Create IN leg
        results.push({
          ...t,
          id: t.id + "_in",
          accountId: t.toAccountId,
          toAccountId: t.accountId,
          transferDirection: "IN",
        });
      } else {
        results.push(t);
      }
    });
    return results;
  }, [transactions]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">
        Transaction History
      </h2>
      <History
        transactions={expandedTransactions}
        categories={categories}
        accounts={accounts}
        pockets={pockets}
        showAddModal={showAddModal}
        onAddTransaction={() => setShowAddModal(true)}
        onEditTransaction={(t) => {
          setEditingTransaction(t);
          setShowAddModal(true);
        }}
        onDeleteTransaction={handleTransactionDelete}
      />
    </div>
  );
};

export default HistoryPage;
