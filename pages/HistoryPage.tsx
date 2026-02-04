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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">
        Transaction History
      </h2>
      <History
        transactions={transactions}
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
