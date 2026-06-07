import React, { useState } from "react";
import { Goal, Account, Pot, SavingPocket } from "../types";
import { normalizeDate } from "../helpers/transactions.helper";
import { GoalsHeader, GoalTab } from "./goals/goals-header";
import { PotsTab } from "./goals/pots-tab";
import { PocketsTab } from "./goals/pockets-tab";
import { GoalsTab } from "./goals/goals-tab";
import { PotFormModal } from "./goals/pot-form-modal";
import { PocketFormModal } from "./goals/pocket-form-modal";
import { GoalFormModal } from "./goals/goal-form-modal";

interface Props {
	goals: Goal[];
	pots: Pot[];
	pockets: SavingPocket[];
	accounts: Account[];
	onAddGoal: (goal: Omit<Goal, "userId">) => void;
	onDeleteGoal: (id: string) => void;
	onSavePot: (pot: Omit<Pot, "userId">) => void;
	onDeletePot: (id: string) => void;
	onSavePocket: (pocket: Omit<SavingPocket, "userId">) => void;
	onDeletePocket: (id: string) => void;
}

type PocketType = "SAVING_POCKET" | "BONUS_POCKET";
type Tenure = 2 | 3;

const Goals: React.FC<Props> = ({
	goals,
	pots,
	pockets,
	accounts,
	onAddGoal,
	onDeleteGoal,
	onSavePot,
	onDeletePot,
	onSavePocket,
	onDeletePocket,
}) => {
	const [activeTab, setActiveTab] = useState<GoalTab>("POTS");
	const [showGoalModal, setShowGoalModal] = useState(false);
	const [showPotModal, setShowPotModal] = useState(false);
	const [showPocketModal, setShowPocketModal] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [pocketType, setPocketType] = useState<PocketType>("SAVING_POCKET");
	const [tenureMonths, setTenureMonths] = useState<Tenure>(3);

	const [potName, setPotName] = useState("");
	const [potAccountId, setPotAccountId] = useState("");
	const [potTarget, setPotTarget] = useState("");
	const [potCurrent, setPotCurrent] = useState("");
	const [potResetDate, setPotResetDate] = useState("");

	const [pocketName, setPocketName] = useState("");
	const [pocketAccountId, setPocketAccountId] = useState("");
	const [pocketCurrent, setPocketCurrent] = useState("");
	const [pocketCurrency, setPocketCurrency] = useState("MYR");
	const [pocketIcon, setPocketIcon] = useState("🚀");
	const [pocketColor, setPocketColor] = useState("indigo-500");
	const [pocketResetDate, setPocketResetDate] = useState("");

	const [goalName, setGoalName] = useState("");
	const [goalTarget, setGoalTarget] = useState("");
	const [goalCurrent, setGoalCurrent] = useState("");
	const [goalDeadline, setGoalDeadline] = useState("");
	const [goalCategory, setGoalCategory] = useState("");
	const [goalLinkedAccountId, setGoalLinkedAccountId] = useState("");

	const handleEditPot = (pot: Pot) => {
		setEditingId(pot.id);
		setPotName(pot.name);
		setPotAccountId(pot.accountId);
		setPotTarget(pot.limitAmount.toFixed(2));
		setPotCurrent(pot.usedAmount.toFixed(2));
		setPotResetDate(pot.resetDate ? normalizeDate(pot.resetDate) : "");
		setShowPotModal(true);
	};

	const handleEditPocket = (pocket: SavingPocket) => {
		setEditingId(pocket.id);
		setPocketName(pocket.name);
		setPocketAccountId(pocket.accountId || "");
		setPocketCurrent(pocket.currentAmount.toFixed(2));
		setPocketCurrency(pocket.currency);
		setPocketIcon(pocket.icon);
		setPocketColor(pocket.color);
		setPocketType(pocket.pocketType || "SAVING_POCKET");
		setTenureMonths(pocket.tenureMonths || 3);
		setPocketResetDate(pocket.resetDate ? normalizeDate(pocket.resetDate) : "");
		setShowPocketModal(true);
	};

	const handleEditGoal = (goal: Goal) => {
		setEditingId(goal.id);
		setGoalName(goal.name);
		setGoalTarget(goal.targetAmount.toFixed(2));
		setGoalCurrent(goal.currentAmount.toFixed(2));
		setGoalDeadline(goal.deadline || "");
		setGoalCategory(goal.type);
		setGoalLinkedAccountId(goal.linkedAccountId || "");
		setShowGoalModal(true);
	};

	const closePotModal = () => {
		setShowPotModal(false);
		setEditingId(null);
		setPotName("");
		setPotAccountId("");
		setPotTarget("");
		setPotCurrent("");
		setPotResetDate("");
	};

	const closePocketModal = () => {
		setShowPocketModal(false);
		setEditingId(null);
		setPocketName("");
		setPocketAccountId("");
		setPocketCurrent("");
		setPocketResetDate("");
	};

	const closeGoalModal = () => {
		setShowGoalModal(false);
		setEditingId(null);
		setGoalName("");
		setGoalTarget("");
		setGoalCurrent("");
		setGoalDeadline("");
		setGoalCategory("");
		setGoalLinkedAccountId("");
	};

	const handlePocketSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			const selectedAccount = accounts.find((a) => a.id === pocketAccountId);
			const isGXBank = selectedAccount?.providerId === "GXBANK";

			await onSavePocket({
				id: editingId || crypto.randomUUID(),
				name: pocketName,
				accountId: pocketAccountId || undefined,
				currentAmount: parseFloat(pocketCurrent) || 0,
				currency: pocketCurrency,
				icon: pocketIcon,
				color: pocketColor,
				pocketType: isGXBank ? pocketType : "SAVING_POCKET",
				tenureMonths:
					isGXBank && pocketType === "BONUS_POCKET" ? tenureMonths : undefined,
				resetDate: pocketResetDate || undefined,
			});
			closePocketModal();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handlePotSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			const limit = parseFloat(potTarget);
			const used = parseFloat(potCurrent) || 0;
			await onSavePot({
				id: editingId || crypto.randomUUID(),
				name: potName,
				accountId: potAccountId,
				limitAmount: limit,
				usedAmount: used,
				amountLeft: limit - used,
				currency: accounts.find((a) => a.id === potAccountId)?.currency || "MYR",
				icon: "💰",
				color: "bg-primary",
				resetDate: potResetDate || undefined,
				updatedAt: new Date().toISOString(),
			});
			closePotModal();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGoalSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onAddGoal({
				id: editingId || crypto.randomUUID(),
				name: goalName,
				targetAmount: parseFloat(goalTarget),
				currentAmount: parseFloat(goalCurrent) || 0,
				deadline: goalDeadline || undefined,
				currency: "MYR",
				type: (goalCategory as any) || "SHORT_TERM",
				linkedAccountId: goalLinkedAccountId || undefined,
				icon: "🎯",
				color: "bg-primary",
				updatedAt: new Date().toISOString(),
			});
			closeGoalModal();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCreate = () => {
		if (activeTab === "POTS") setShowPotModal(true);
		else if (activeTab === "POCKETS") setShowPocketModal(true);
		else setShowGoalModal(true);
	};

	return (
		<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
			<GoalsHeader
				activeTab={activeTab}
				onTabChange={setActiveTab}
				onCreate={handleCreate}
			/>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pb-20">
				{activeTab === "POTS" && (
					<PotsTab pots={pots} accounts={accounts} onEdit={handleEditPot} onDelete={onDeletePot} />
				)}
				{activeTab === "POCKETS" && (
					<PocketsTab pockets={pockets} accounts={accounts} onEdit={handleEditPocket} onDelete={onDeletePocket} />
				)}
				{activeTab === "GOALS" && (
					<GoalsTab goals={goals} accounts={accounts} onEdit={handleEditGoal} onDelete={onDeleteGoal} />
				)}
			</div>

			<PotFormModal
				isOpen={showPotModal}
				editingId={editingId}
				accounts={accounts}
				name={potName}
				accountId={potAccountId}
				target={potTarget}
				current={potCurrent}
				resetDate={potResetDate}
				isSubmitting={isSubmitting}
				onNameChange={setPotName}
				onAccountIdChange={setPotAccountId}
				onTargetChange={setPotTarget}
				onCurrentChange={setPotCurrent}
				onResetDateChange={setPotResetDate}
				onClose={closePotModal}
				onSubmit={handlePotSubmit}
			/>

			<PocketFormModal
				isOpen={showPocketModal}
				editingId={editingId}
				accounts={accounts}
				name={pocketName}
				accountId={pocketAccountId}
				current={pocketCurrent}
				currency={pocketCurrency}
				icon={pocketIcon}
				color={pocketColor}
				resetDate={pocketResetDate}
				pocketType={pocketType}
				tenureMonths={tenureMonths}
				isSubmitting={isSubmitting}
				onNameChange={setPocketName}
				onAccountIdChange={setPocketAccountId}
				onCurrentChange={setPocketCurrent}
				onCurrencyChange={setPocketCurrency}
				onIconChange={setPocketIcon}
				onColorChange={setPocketColor}
				onResetDateChange={setPocketResetDate}
				onPocketTypeChange={setPocketType}
				onTenureMonthsChange={setTenureMonths}
				onClose={closePocketModal}
				onSubmit={handlePocketSubmit}
			/>

			<GoalFormModal
				isOpen={showGoalModal}
				editingId={editingId}
				accounts={accounts}
				name={goalName}
				target={goalTarget}
				current={goalCurrent}
				deadline={goalDeadline}
				category={goalCategory}
				linkedAccountId={goalLinkedAccountId}
				isSubmitting={isSubmitting}
				onNameChange={setGoalName}
				onTargetChange={setGoalTarget}
				onCurrentChange={setGoalCurrent}
				onDeadlineChange={setGoalDeadline}
				onCategoryChange={setGoalCategory}
				onLinkedAccountIdChange={setGoalLinkedAccountId}
				onClose={closeGoalModal}
				onSubmit={handleGoalSubmit}
			/>
		</div>
	);
};

export default Goals;
