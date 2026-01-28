import React from "react";
import Goals from "../components/Goals";
import { useData } from "../context/DataContext";

const GoalsPage: React.FC = () => {
  const {
    goals,
    pots,
    accounts,
    handleGoalUpdate,
    handleGoalDelete,
    handlePotSave,
    handlePotDelete,
  } = useData();

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <Goals
        goals={goals}
        pots={pots}
        accounts={accounts}
        onAddGoal={handleGoalUpdate}
        onDeleteGoal={handleGoalDelete}
        onSavePot={handlePotSave}
        onDeletePot={handlePotDelete}
      />
    </div>
  );
};

export default GoalsPage;
