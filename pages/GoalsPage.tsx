import React from "react";
import Goals from "../components/Goals";
import { useFinanceStore } from "../src/stores/finance.store";
import {
  saveGoal, deleteGoal,
  savePot, deletePot,
  saveSavingPocket, deleteSavingPocket,
} from "../src/lib/application/commands";
import { useAuth } from "../services/auth.services";

const GoalsPage: React.FC = () => {
  const { profile } = useAuth();
  const goals = useFinanceStore((s) => s.goals);
  const pots = useFinanceStore((s) => s.pots);
  const pockets = useFinanceStore((s) => s.pockets);
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <Goals
        goals={goals}
        pots={pots}
        pockets={pockets}
        accounts={accounts}
        onAddGoal={(g) => saveGoal(g, goals, profile?.id || "local")}
        onDeleteGoal={(id) => deleteGoal(id, goals)}
        onSavePot={(p) => savePot(p, pots, profile?.id || "local")}
        onDeletePot={(id) => deletePot(id, pots)}
        onSavePocket={(p) => saveSavingPocket(p, pockets, profile?.id || "local")}
        onDeletePocket={(id) => deleteSavingPocket(id, pockets, transactions)}
      />
    </div>
  );
};

export default GoalsPage;
