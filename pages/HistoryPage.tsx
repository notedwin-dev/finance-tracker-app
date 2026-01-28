import React from "react";
import { useOutletContext } from "react-router-dom";
import History from "../components/History";
import { useData } from "../context/DataContext";

const HistoryPage: React.FC = () => {
  const { transactions, categories, accounts, handleTransactionDelete } =
    useData();
  const { setShowAddModal, setEditingTransaction } = useOutletContext<any>();

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">
        Transaction History
      </h2>
      <History
        transactions={transactions}
        categories={categories}
        accounts={accounts}
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
