import React from "react";
import DatePicker from "../DatePicker";
import { AccountSelect } from "./account-select";
import { SavingsFormModal, type SavingsBaseModalProps } from "./savings-form-modal";
import { AmountInput } from "./amount-input";

type Props = SavingsBaseModalProps & {
	deadline: string;
	category: string;
	linkedAccountId: string;
	onDeadlineChange: (v: string) => void;
	onCategoryChange: (v: string) => void;
	onLinkedAccountIdChange: (v: string) => void;
};

const CATEGORIES: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "SHORT_TERM", label: "Short Term" },
	{ value: "LONG_TERM", label: "Long Term" },
];

const labelClass =
	"text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block";
const inputClass =
	"w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none";

export const GoalFormModal: React.FC<Props> = ({
	isOpen,
	editingId,
	accounts,
	name,
	target,
	current,
	deadline,
	category,
	linkedAccountId,
	isSubmitting,
	onNameChange,
	onTargetChange,
	onCurrentChange,
	onDeadlineChange,
	onCategoryChange,
	onLinkedAccountIdChange,
	onClose,
	onSubmit,
}) => {
	if (!isOpen) return null;

	return (
		<SavingsFormModal
			title={editingId ? "Edit Savings Goal" : "Create Savings Goal"}
			subtitle="Track progress towards a target"
			submitLabel={editingId ? "Update Goal" : "Create Goal"}
			isSubmitting={isSubmitting}
			onClose={onClose}
			onSubmit={onSubmit}
		>
			<div>
				<label className={labelClass}>Goal Name</label>
				<input
					type="text"
					required
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					className={inputClass}
					placeholder="e.g. New Car"
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className={labelClass}>Target Amount</label>
					<AmountInput value={target} onChange={onTargetChange} required />
				</div>
				<div>
					<label className={labelClass}>Current (Manual)</label>
					<AmountInput
						value={current}
						onChange={onCurrentChange}
						disabled={!!linkedAccountId}
						className={linkedAccountId ? "opacity-30 cursor-not-allowed" : ""}
					/>
				</div>
			</div>

			<div>
				<label className={labelClass}>Linked Account (Auto-sync)</label>
				<AccountSelect
					accounts={accounts}
					value={linkedAccountId}
					onChange={(value) => {
						onLinkedAccountIdChange(value);
						if (value) onCurrentChange("");
					}}
					placeholder="No Link (Manual Tracking)"
					className={`${inputClass} appearance-none font-medium`}
				/>
				{linkedAccountId && (
					<p className="text-[10px] text-primary mt-2 font-medium">
						Goal progress will track this account's live balance.
					</p>
				)}
			</div>

			<div>
				<label className={labelClass}>Deadline (Optional)</label>
				<DatePicker value={deadline} onChange={onDeadlineChange} />
			</div>

			<div>
				<label className={labelClass}>Goal Type</label>
				<select
					required
					value={category}
					onChange={(e) => onCategoryChange(e.target.value)}
					className={`${inputClass} appearance-none font-medium`}
				>
					{CATEGORIES.map((c) => (
						<option key={c.value} value={c.value}>
							{c.label}
						</option>
					))}
				</select>
			</div>
		</SavingsFormModal>
	);
};
