import React from "react";
import DatePicker from "../DatePicker";
import { AccountSelect } from "./account-select";
import { SavingsFormModal, type SavingsBaseModalProps } from "./savings-form-modal";
import { AmountInput } from "./amount-input";

type Props = SavingsBaseModalProps & {
	accountId: string;
	resetDate: string;
	onAccountIdChange: (v: string) => void;
	onResetDateChange: (v: string) => void;
};

const getAccountName = (accounts: SavingsBaseModalProps["accounts"], id: string) =>
	accounts.find((a) => a.id === id)?.name || "Unknown Account";

const labelClass =
	"text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 block";
const inputClass =
	"w-full bg-background border border-gray-700 rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-primary outline-none";

export const PotFormModal: React.FC<Props> = ({
	isOpen,
	editingId,
	accounts,
	name,
	accountId,
	target,
	current,
	resetDate,
	isSubmitting,
	onNameChange,
	onAccountIdChange,
	onTargetChange,
	onCurrentChange,
	onResetDateChange,
	onClose,
	onSubmit,
}) => {
	if (!isOpen) return null;

	return (
		<SavingsFormModal
			title={editingId ? "Edit Spending Pot" : "Create Spending Pot"}
			subtitle="Set a spending limit within an account"
			submitLabel={editingId ? "Update Pot" : "Create Pot"}
			isSubmitting={isSubmitting}
			onClose={onClose}
			onSubmit={onSubmit}
		>
			<div>
				<label className={labelClass}>Pot Name</label>
				<input
					type="text"
					required
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					className={inputClass}
					placeholder="e.g. Dream Holiday"
				/>
			</div>

			<div>
				<label className={labelClass}>Linked Account</label>
				<AccountSelect
					accounts={accounts}
					value={accountId}
					onChange={onAccountIdChange}
					placeholder="Select Account"
					className={`${inputClass} appearance-none font-medium`}
					required
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className={labelClass}>Spending Limit</label>
					<AmountInput value={target} onChange={onTargetChange} required />
				</div>
				<div>
					<label className={labelClass}>Amount Used</label>
					<AmountInput value={current} onChange={onCurrentChange} required />
				</div>
			</div>

			<div>
				<label className={labelClass}>Reset Date (Optional)</label>
				<DatePicker value={resetDate} onChange={onResetDateChange} />
				<p className="text-[10px] text-gray-500 mt-1.5 font-medium">
					Only count transactions from this date onwards. Leave empty to
					include all transactions.
				</p>
			</div>

			{accountId && (
				<div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-4">
					<p className="text-[10px] sm:text-xs text-primary/80 font-medium leading-relaxed">
						This pot sets a spending limit for funds within{" "}
						{getAccountName(accounts, accountId)}. Tracking your usage here
						helps you stay within budget.
					</p>
				</div>
			)}
		</SavingsFormModal>
	);
};
