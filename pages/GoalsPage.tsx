import React from "react";
import Goals from "../components/Goals";
import { useData } from "../context/DataContext";

const GoalsPage: React.FC = () => {
  const {
    goals,
    pots,
    pockets,
    accounts,
    handleGoalUpdate,
    handleGoalDelete,
    handlePotSave,
    handlePotDelete,
    handlePocketSave,
    handlePocketDelete,
  } = useData();

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <Goals
        goals={goals}
        pots={pots}
        pockets={pockets}
        accounts={accounts}
        onAddGoal={handleGoalUpdate}
        onDeleteGoal={handleGoalDelete}
        onSavePot={handlePotSave}
        onDeletePot={handlePotDelete}
        onSavePocket={handlePocketSave}
        onDeletePocket={handlePocketDelete}
      />
    </div>
  );
};

export default GoalsPage;
