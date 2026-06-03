import React, { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import History from "../components/History";
import { useFinanceStore } from "../src/stores/finance.store";
import { deleteTransaction } from "../src/lib/application/commands";

const HistoryPage: React.FC = () => {
  const usdRate = useFinanceStore((s) => s.usdRate);
  const { transactions, categories, accounts, pockets, pots } =
    useFinanceStore();
  const { showAddModal, setShowAddModal, setEditingTransaction } =
    useOutletContext<any>();

  const expandedTransactions = React.useMemo(() => {
    const results: any[] = [];
    const seen = new Set<string>();
    transactions.forEach((t) => {
      if (seen.has(t.id)) return;
      if (
        t.type === "TRANSFER" &&
        t.toAccountId &&
        t.accountId !== t.toAccountId &&
        !t.transferDirection &&
        !t.linkedTransactionId
      ) {
        const outId = t.id;
        const inId = t.id + "_in";
        if (!seen.has(outId)) {
          results.push({ ...t, transferDirection: "OUT" });
          seen.add(outId);
        }
        if (!seen.has(inId)) {
          results.push({
            ...t,
            id: inId,
            accountId: t.toAccountId,
            toAccountId: t.accountId,
            transferDirection: "IN",
          });
          seen.add(inId);
        }
      } else {
        results.push(t);
        seen.add(t.id);
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
        onDeleteTransaction={(id) =>
          deleteTransaction(id, accounts, pots, pockets, usdRate, transactions)
        }
      />
    </div>
  );
};

export default HistoryPage;
